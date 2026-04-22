'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/lib/context/ToastContext'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { PrimaryBtn, SecondaryBtn, TertiaryBtn } from '@/components/ui/Button/Button'
import { Input } from '@/components/ui/Input/Input'
import { SingleSelectChip } from '@/components/ui/SingleSelectChip/SingleSelectChip'
import { IconBack, IconChevronX } from '@/components/ui/Icons'
import { fmt, formatDate } from '@/lib/finance'
import type { LogEntry } from '@/lib/loaders/log'
import {
  createTrackedDebtFromLogEntry,
  deleteLogEntry,
  linkLogEntryToExistingDebt,
  loadActiveDebtsForLog,
  recordRefund,
  removeMonthlyReminder,
  setMonthlyReminder,
  updateLogEntry,
  type ActiveDebtOption,
} from '../actions'
import {
  deleteDebtTransactionForDebt,
  updateDebtTransactionForDebt,
} from '../../history/debt/[id]/actions'
import type { DebtDirection } from '@/types/database'

const CATEGORY_LABEL: Record<string, string> = {
  everyday: 'Spending',
  essentials: 'Fixed',
  fixed: 'Fixed',
  debt: 'Debt',
  goal: 'Goal',
}

const CATEGORY_HELPER: Record<EditableCategory, string> = {
  everyday: 'For everyday spending like food, transport, or going out',
  fixed: 'For fixed costs like rent, bills, or subscriptions',
  debt: 'Money you owe and are paying back',
}

type EditableCategory = 'everyday' | 'fixed' | 'debt'

function isEditableCategory(value: string | null | undefined): value is EditableCategory {
  return value === 'everyday' || value === 'fixed' || value === 'essentials' || value === 'debt'
}

function toEditableCategory(value: string | null | undefined): EditableCategory {
  if (value === 'essentials' || value === 'fixed') return 'fixed'
  if (value === 'debt') return 'debt'
  return 'everyday'
}

const T = {
  brandDark: 'var(--brand-dark)',
  pageBg: 'var(--page-bg)',
  white: 'var(--white)',
  border: 'var(--border)',
  borderSubtle: 'var(--border-subtle)',
  text1: 'var(--text-1)',
  text2: 'var(--text-2)',
  text3: 'var(--text-3)',
  textMuted: 'var(--text-muted)',
  textInverse: 'var(--text-inverse)',
}

interface Props {
  entry: LogEntry
  currency: string
}

export function EntryActionsClient({ entry, currency }: Props) {
  const router = useRouter()
  const { isDesktop } = useBreakpoint()
  const { toast } = useToast()

  const [activeFlow, setActiveFlow] = useState<'edit' | 'refund' | 'confirm' | 'track' | 'debtEdit' | 'createDebt' | 'linkDebt' | null>(null)

  const [refundAmount, setRefundAmount] = useState('')
  const [refundNote, setRefundNote] = useState('')
  const [savingRefund, setSavingRefund] = useState(false)

  const [editAmount, setEditAmount] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editLabel, setEditLabel] = useState('')
  const [editCategoryType, setEditCategoryType] = useState<EditableCategory | null>(null)
  const [editErrors, setEditErrors] = useState<{
    label?: string
    amount?: string
    category?: string
  }>({})
  const [editDialog, setEditDialog] = useState<'delete' | 'discard' | 'monthlyReminder' | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [debtEditAmount, setDebtEditAmount] = useState('')
  const [debtEditDate, setDebtEditDate] = useState('')
  const [debtEditNote, setDebtEditNote] = useState('')
  const [debtEditError, setDebtEditError] = useState<string | null>(null)
  const [savingDebtEdit, setSavingDebtEdit] = useState(false)
  const [createDebtName, setCreateDebtName] = useState('')
  const [createDebtDirection, setCreateDebtDirection] = useState<DebtDirection | null>(null)
  const [savingCreateDebt, setSavingCreateDebt] = useState(false)
  const [createDebtError, setCreateDebtError] = useState<string | null>(null)
  const [activeDebts, setActiveDebts] = useState<ActiveDebtOption[]>([])
  const [loadingActiveDebts, setLoadingActiveDebts] = useState(false)
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null)
  const [linkDebtRole, setLinkDebtRole] = useState<'balance' | 'payment' | null>(null)
  const [savingLinkDebt, setSavingLinkDebt] = useState(false)
  const [linkDebtError, setLinkDebtError] = useState<string | null>(null)

  const [savingMonthlyReminder, setSavingMonthlyReminder] = useState(false)
  const [monthlyReminderAmount, setMonthlyReminderAmount] = useState('')
  const [monthlyReminderError, setMonthlyReminderError] = useState<string | null>(null)

  const [deletingKey, setDeletingKey] = useState<string | null>(null)

  const goBack = () => router.push('/log')
  const isDebtEntry = entry.categoryType === 'debt'
  const isGoalEntry = entry.categoryType === 'goal'
  const hasLinkedDebt = isDebtEntry && !!entry.debtId && !!entry.debtTransactionId
  const entryReturnTo = `/log/${entry.id}`
  const debtHref = entry.debtId
    ? `/history/debt/${entry.debtId}?returnTo=${encodeURIComponent(entryReturnTo)}`
    : '/history/debt'
  const isUnlinkedDebtEntry = isDebtEntry && !hasLinkedDebt
  const debtEntryLabel = entry.debtEntryType === 'principal_increase'
    ? 'opening balance'
    : 'entry'

  const openEdit = () => {
    setEditAmount(String(entry.amount))
    setEditDate(entry.date)
    setEditNote(entry.note ?? '')
    setEditLabel(entry.name)
    setEditCategoryType(isEditableCategory(entry.categoryType) ? toEditableCategory(entry.categoryType) : 'everyday')
    setEditErrors({})
    setEditDialog(null)
    setActiveFlow('edit')
  }

  const openDebtEdit = () => {
    setDebtEditAmount(String(entry.amount))
    setDebtEditDate(entry.date)
    setDebtEditNote(entry.note ?? '')
    setDebtEditError(null)
    setActiveFlow('debtEdit')
  }

  const openGoalEdit = () => {
    setDebtEditAmount(String(entry.amount))
    setDebtEditDate(entry.date)
    setDebtEditNote(entry.note ?? '')
    setDebtEditError(null)
    setActiveFlow('debtEdit')
  }

  const openCreateDebt = () => {
    setCreateDebtName(entry.name)
    setCreateDebtDirection(null)
    setCreateDebtError(null)
    setActiveFlow('createDebt')
  }

  const openLinkDebt = async () => {
    setSelectedDebtId(null)
    setLinkDebtRole(null)
    setLinkDebtError(null)
    setActiveFlow('linkDebt')
    setLoadingActiveDebts(true)
    try {
      setActiveDebts(await loadActiveDebtsForLog())
    } catch {
      setLinkDebtError('Could not load your debts')
    } finally {
      setLoadingActiveDebts(false)
    }
  }

  const editIsDirty =
    activeFlow === 'edit' &&
    (
      editLabel.trim() !== entry.name.trim() ||
      editAmount !== String(entry.amount) ||
      editCategoryType !== entry.categoryType
    )

  const requestCloseEdit = () => {
    if (activeFlow === 'edit' && editDialog) {
      setEditDialog(null)
      return
    }
    if (activeFlow === 'edit' && editIsDirty) {
      setEditDialog('discard')
      return
    }
    setActiveFlow(null)
    setEditCategoryType(null)
    setEditErrors({})
    setEditDialog(null)
  }

  const validateEdit = () => {
    const nextErrors: { label?: string; amount?: string; category?: string } = {}
    if (!editLabel.trim()) nextErrors.label = 'Add a name'
    if (!editAmount.trim() || !(parseFloat(editAmount) > 0)) nextErrors.amount = 'Add an amount'
    if (!editCategoryType) nextErrors.category = 'Choose a category'
    if (!isDebtEntry && editCategoryType === 'debt') {
      nextErrors.category = 'Debt entries need to be linked to a tracked debt.'
    }
    setEditErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const performSaveEdit = async (removeReminder: boolean) => {
    if (!entry.id || !editCategoryType) return
    const amount = parseFloat(editAmount)
    if (!amount || amount <= 0 || !editDate || !editCategoryType) return

    const transactionDirty =
      editLabel.trim() !== entry.name.trim() ||
      amount !== entry.amount ||
      editCategoryType !== entry.categoryType

    setSavingEdit(true)
    try {
      if (transactionDirty || removeReminder) {
        await updateLogEntry({
          id: entry.id,
          amount,
          date: editDate,
          note: editNote,
          label: editLabel,
          categoryKey: entry.categoryKey,
          categoryType: editCategoryType,
          removeMonthlyReminderKey: removeReminder
            ? (entry.monthlyReminderKey ?? entry.categoryKey)
            : undefined,
        })
      }
      toast('Entry updated')
      router.push('/log')
      router.refresh()
    } catch {
      toast('Could not update entry')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!entry.id) return
    if (!validateEdit()) return

    if (
      entry.hasMonthlyReminder &&
      editCategoryType &&
      editCategoryType !== 'everyday' &&
      editCategoryType !== 'fixed'
    ) {
      setEditDialog('monthlyReminder')
      return
    }

    await performSaveEdit(false)
  }

  const handleSaveRefund = async () => {
    const amount = parseFloat(refundAmount)
    if (!amount || amount <= 0) return

    setSavingRefund(true)
    try {
      await recordRefund({
        categoryType: entry.categoryType as any,
        categoryKey: entry.categoryKey,
        categoryLabel: entry.name,
        amount,
        note: refundNote,
      })
      toast('Refund recorded')
      router.push('/log')
      router.refresh()
    } catch {
      toast('Could not record refund')
    } finally {
      setSavingRefund(false)
    }
  }

  const handleSaveDebtEdit = async () => {
    const amount = parseFloat(debtEditAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setDebtEditError('Amount must be greater than zero')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(debtEditDate.trim())) {
      setDebtEditError('Enter a valid date')
      return
    }

    setSavingDebtEdit(true)
    setDebtEditError(null)
    try {
      if (isGoalEntry) {
        await updateLogEntry({
          id: entry.id,
          amount,
          date: debtEditDate,
          note: debtEditNote,
          categoryKey: entry.categoryKey,
          categoryType: 'goal',
        })
        toast('Goal entry updated')
      } else {
        if (!entry.debtId || !entry.debtTransactionId) return
        await updateDebtTransactionForDebt({
          debtId: entry.debtId,
          transactionId: entry.debtTransactionId,
          amount,
          date: debtEditDate,
          note: debtEditNote,
        })
        toast('Debt entry updated')
      }
      router.push('/log')
      router.refresh()
    } catch {
      setDebtEditError(isGoalEntry ? 'Could not update goal entry' : 'Could not update debt entry')
    } finally {
      setSavingDebtEdit(false)
    }
  }

  const handleCreateTrackedDebt = async () => {
    if (!entry.id) return
    if (!createDebtName.trim()) {
      setCreateDebtError('Add a debt name')
      return
    }
    if (!createDebtDirection) {
      setCreateDebtError('Choose who owes this')
      return
    }

    setSavingCreateDebt(true)
    setCreateDebtError(null)
    try {
      const result = await createTrackedDebtFromLogEntry({
        transactionId: entry.id,
        name: createDebtName,
        direction: createDebtDirection,
      })
      toast('Debt is now tracked')
      router.push(`/history/debt/${result.debtId}?returnTo=${encodeURIComponent(entryReturnTo)}`)
      router.refresh()
    } catch (caught) {
      setCreateDebtError(caught instanceof Error ? caught.message : 'Could not create debt')
    } finally {
      setSavingCreateDebt(false)
    }
  }

  const handleLinkDebt = async () => {
    if (!entry.id) return
    if (!selectedDebtId) {
      setLinkDebtError('Choose a debt')
      return
    }
    if (!linkDebtRole) {
      setLinkDebtError('Choose how this entry affects the debt')
      return
    }

    setSavingLinkDebt(true)
    setLinkDebtError(null)
    try {
      const result = await linkLogEntryToExistingDebt({
        transactionId: entry.id,
        debtId: selectedDebtId,
        entryRole: linkDebtRole,
      })
      toast('Entry connected to debt')
      router.push(`/history/debt/${result.debtId}?returnTo=${encodeURIComponent(entryReturnTo)}`)
      router.refresh()
    } catch (caught) {
      setLinkDebtError(caught instanceof Error ? caught.message : 'Could not link debt')
    } finally {
      setSavingLinkDebt(false)
    }
  }

  const handleDeleteEntry = async () => {
    if (!entry.id) return
    setDeletingKey(entry.id)
    try {
      if (hasLinkedDebt && entry.debtId && entry.debtTransactionId) {
        const result = await deleteDebtTransactionForDebt({
          debtId: entry.debtId,
          transactionId: entry.debtTransactionId,
        })
        toast(result.deletedDebt ? 'Debt removed' : 'Debt entry removed')
        router.push('/log')
        router.refresh()
        return
      }

      if (process.env.NODE_ENV !== 'production') {
        console.info('[log.delete] client', {
          transactionId: entry.id,
          hasMonthlyReminder: entry.hasMonthlyReminder,
          monthlyReminderKey: entry.monthlyReminderKey,
          categoryKey: entry.categoryKey,
          categoryLabel: entry.name,
        })
      }
      await deleteLogEntry(
        entry.id,
        entry.hasMonthlyReminder ? (entry.monthlyReminderKey ?? entry.categoryKey) : null
      )
      toast('Entry removed')
      router.push('/log')
      router.refresh()
    } catch {
      toast('Could not remove entry')
    } finally {
      setDeletingKey(null)
    }
  }

  const handleToggleMonthlyReminder = async () => {
    if (entry.categoryType !== 'everyday' && entry.categoryType !== 'fixed') return

    setSavingMonthlyReminder(true)
    try {
      if (entry.hasMonthlyReminder) {
        await removeMonthlyReminder({
          categoryKey: entry.monthlyReminderKey ?? entry.categoryKey,
        })
        toast('Monthly reminder removed')
      } else {
        await setMonthlyReminder({
          categoryType: entry.categoryType as 'everyday' | 'fixed',
          categoryKey: entry.categoryKey,
          categoryLabel: entry.name,
          amount: parseFloat(monthlyReminderAmount),
        })
        toast('Monthly reminder set')
      }
      router.push('/log')
      router.refresh()
    } catch {
      toast('Could not update monthly reminder')
    } finally {
      setSavingMonthlyReminder(false)
    }
  }

  const pageX = isDesktop ? 'var(--space-page-desktop)' : 'var(--space-page-mobile)'

  const content = (
    <div>
      <div style={{ padding: isDesktop ? '32px 32px 0' : `18px ${pageX} 0` }}>
        <button
          onClick={goBack}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            width: 44,
            height: 44,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconBack size={18} color="var(--grey-900)" />
        </button>
      </div>

      {/* Summary block */}
      <div style={{
        textAlign: 'center',
        padding: 'var(--space-xl) 0 var(--space-lg)',
      }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-xl)',
          fontWeight: 'var(--weight-bold)',
          color: T.text1,
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
        }}>
          {entry.name}
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-xs)',
          fontSize: 'var(--text-sm)',
          color: T.text2,
          marginTop: 'var(--space-xs)',
          lineHeight: 1.25,
        }}>
          <span>{CATEGORY_LABEL[entry.categoryType] ?? 'Other'}</span>
          <span style={{ opacity: 0.3 }}>·</span>
          <span>{fmt(entry.amount, currency)}</span>
          {entry.date && (
            <>
              <span style={{ opacity: 0.3 }}>·</span>
              <span>{formatDate(entry.date)}</span>
            </>
          )}
        </div>
        {entry.hasMonthlyReminder && (
          <div style={{ marginTop: 'var(--space-md)', display: 'flex', justifyContent: 'center' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: 22,
              padding: '0 var(--space-sm)',
              borderRadius: 'var(--radius-full)',
              border: `var(--border-width) solid ${T.borderSubtle}`,
              background: T.pageBg,
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-semibold)',
              color: T.textMuted,
              letterSpacing: '0.02em',
            }}>
              Monthly reminder
            </span>
          </div>
        )}
      </div>

      {/* Action cards */}
      <div style={{ padding: `0 ${pageX}`, display: 'grid', gap: 'var(--space-sm)' }}>
        {isDebtEntry ? (
          <>
            {isUnlinkedDebtEntry && (
              <div style={{
                background: 'var(--grey-50)',
                border: `1px solid ${T.border}`,
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-md)',
              }}>
                <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: T.text1 }}>
                  Not linked to a tracked debt
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: T.text3, marginTop: 4, lineHeight: 1.45 }}>
                  This entry is marked as Debt, but it does not have a balance or repayment history yet.
                </div>
              </div>
            )}

            {hasLinkedDebt ? (
              <div style={{
                background: T.white,
                border: `1px solid ${T.border}`,
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
              }}>
                <button
                  onClick={() => router.push(debtHref)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: 'var(--space-md)',
                    background: T.white,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: T.text1 }}>
                    Open debt
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: T.text3, marginTop: 2 }}>
                    View this in Things to pay
                  </div>
                </button>
              </div>
            ) : (
              <>
                <div style={{
                  background: T.white,
                  border: `1px solid ${T.border}`,
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                }}>
                  <button
                    onClick={openCreateDebt}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: 'var(--space-md)',
                      background: T.white,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: T.text1 }}>
                      Track as new debt
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: T.text3, marginTop: 2 }}>
                      Start a debt record with this amount
                    </div>
                  </button>
                </div>

                <div style={{
                  background: T.white,
                  border: `1px solid ${T.border}`,
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                }}>
                  <button
                    onClick={openLinkDebt}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: 'var(--space-md)',
                      background: T.white,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: T.text1 }}>
                      Connect to a debt
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: T.text3, marginTop: 2 }}>
                      Use this entry on a debt you already track
                    </div>
                  </button>
                </div>
              </>
            )}

            {entry.debtId && (
              <div style={{
                background: T.white,
                border: `1px solid ${T.border}`,
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                }}>
                <button
                  onClick={() => router.push(`${debtHref}&action=add-payment`)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: 'var(--space-md)',
                    background: T.white,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: T.text1 }}>
                    Add payment
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: T.text3, marginTop: 2 }}>
                    Record another payment for this debt
                  </div>
                </button>
              </div>
            )}

            {hasLinkedDebt && (
              <div style={{
                background: T.white,
                border: `1px solid ${T.border}`,
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
              }}>
                <button
                  onClick={openDebtEdit}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: 'var(--space-md)',
                    background: T.white,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: T.text1 }}>
                    {entry.debtEntryType === 'principal_increase' ? 'Edit opening balance' : 'Edit entry'}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: T.text3, marginTop: 2 }}>
                    Update the debt {debtEntryLabel}
                  </div>
                </button>
              </div>
            )}

            {isUnlinkedDebtEntry && (
              <div style={{
                background: T.white,
                border: `1px solid ${T.border}`,
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
              }}>
                <button
                  onClick={openEdit}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: 'var(--space-md)',
                    background: T.white,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: T.text1 }}>
                    Edit entry
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: T.text3, marginTop: 2 }}>
                    Change the category if this is not really debt
                  </div>
                </button>
              </div>
            )}
          </>
        ) : isGoalEntry ? (
          <>
            <div style={{
              background: T.white,
              border: `1px solid ${T.border}`,
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
            }}>
              <button
                onClick={() => router.push('/goals')}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: 'var(--space-md)',
                  background: T.white,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: T.text1 }}>
                  Open goal
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: T.text3, marginTop: 2 }}>
                  View this in Goals
                </div>
              </button>
            </div>

            <div style={{
              background: T.white,
              border: `1px solid ${T.border}`,
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
            }}>
              <button
                onClick={openGoalEdit}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: 'var(--space-md)',
                  background: T.white,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: T.text1 }}>
                  Edit entry
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: T.text3, marginTop: 2 }}>
                  Update this goal contribution
                </div>
              </button>
            </div>
          </>
        ) : (
          <div style={{
            background: T.white,
            border: `1px solid ${T.border}`,
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}>
            <button
              onClick={openEdit}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: 'var(--space-md)',
                background: T.white,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: T.text1 }}>
                Edit expense
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: T.text3, marginTop: 2 }}>
                Change amount or category
              </div>
            </button>
          </div>
        )}

        {!isDebtEntry && !isGoalEntry && (entry.categoryType === 'everyday' || entry.categoryType === 'fixed') && (
          <div style={{
            background: T.white,
            border: `1px solid ${T.border}`,
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}>
            <button
              onClick={
                entry.hasMonthlyReminder
                  ? handleToggleMonthlyReminder
                  : () => {
                      setMonthlyReminderAmount(String(entry.amount))
                      setMonthlyReminderError(null)
                      setActiveFlow('track')
                    }
              }
              disabled={savingMonthlyReminder}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: 'var(--space-md)',
                background: T.white,
                border: 'none',
                cursor: savingMonthlyReminder ? 'default' : 'pointer',
              }}
            >
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: T.text1 }}>
                {entry.hasMonthlyReminder ? 'Remove monthly reminder' : 'Remind me about this every month'}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: T.text3, marginTop: 2 }}>
                {entry.hasMonthlyReminder
                  ? 'We’ll stop reminding you before it’s due'
                  : 'We’ll remind you before it’s due'}
              </div>
            </button>
          </div>
        )}

        {!isDebtEntry && !isGoalEntry && (
          <div style={{
            background: T.white,
            border: `1px solid ${T.border}`,
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}>
            <button
              onClick={() => { setRefundAmount(''); setRefundNote(''); setActiveFlow('refund') }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: 'var(--space-md)',
                background: T.white,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: T.text1 }}>Refund</div>
              <div style={{ fontSize: 'var(--text-xs)', color: T.text3, marginTop: 2 }}>Log money returned</div>
            </button>
          </div>
        )}

        <div style={{
          background: T.white,
          border: `1px solid ${T.border}`,
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}>
          <button
            onClick={() => setActiveFlow('confirm')}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: 'var(--space-md)',
              background: T.white,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: 'var(--red-dark)' }}>Delete entry</div>
            <div style={{ fontSize: 'var(--text-xs)', color: T.text3, marginTop: 2 }}>
              {isDebtEntry
                ? `Remove this debt ${debtEntryLabel}`
                : isGoalEntry
                  ? 'Remove this goal contribution'
                  : 'Remove this expense'}
            </div>
          </button>
        </div>
      </div>

      {/* Sub-flow sheets */}
      <Sheet
        open={activeFlow === 'createDebt'}
        onClose={() => setActiveFlow(null)}
        title="Track as new debt"
      >
        <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
          <Input
            label="Debt name"
            value={createDebtName}
            onChange={(value) => {
              setCreateDebtName(value)
              setCreateDebtError(null)
            }}
            error={createDebtError ?? undefined}
          />

          <div>
            <p style={{
              margin: '0 0 var(--space-xs)',
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-semibold)',
              color: T.text2,
              letterSpacing: '0.2px',
            }}>
              Who owes the money?
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
              {([
                { value: 'owed_by_me', label: 'I owe someone' },
                { value: 'owed_to_me', label: 'Someone owes me' },
              ] as const).map((option) => (
                <SingleSelectChip
                  key={option.value}
                  label={option.label}
                  selected={createDebtDirection === option.value}
                  fill
                  onClick={() => {
                    setCreateDebtDirection(option.value)
                    setCreateDebtError(null)
                  }}
                />
              ))}
            </div>
          </div>

          <div style={{
            padding: 'var(--space-md)',
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${T.borderSubtle}`,
            background: T.pageBg,
          }}>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: T.text1 }}>
              This amount starts the debt
            </p>
            <p style={{ margin: 'var(--space-2xs) 0 0', fontSize: 'var(--text-sm)', color: T.text3, lineHeight: 1.45 }}>
              {fmt(entry.amount, currency)} · {entry.date ? formatDate(entry.date) : 'Date unavailable'}
            </p>
          </div>

          {createDebtError ? (
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--red-dark)', lineHeight: 1.45 }}>
              {createDebtError}
            </p>
          ) : null}

          <PrimaryBtn
            size="lg"
            onClick={handleCreateTrackedDebt}
            disabled={savingCreateDebt}
          >
            {savingCreateDebt ? 'Creating…' : 'Create debt'}
          </PrimaryBtn>
          <TertiaryBtn size="lg" onClick={() => setActiveFlow(null)} disabled={savingCreateDebt}>
            Cancel
          </TertiaryBtn>
        </div>
      </Sheet>

      <Sheet
        open={activeFlow === 'linkDebt'}
        onClose={() => setActiveFlow(null)}
        title="Connect to a debt"
      >
        <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
          <div>
            <p style={{
              margin: '0 0 var(--space-xs)',
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-semibold)',
              color: T.text2,
              letterSpacing: '0.2px',
            }}>
              Choose debt
            </p>
            {loadingActiveDebts ? (
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: T.text3 }}>
                Loading debts…
              </p>
            ) : activeDebts.length > 0 ? (
              <div style={{ display: 'grid', gap: 'var(--space-xs)' }}>
                {activeDebts.map((debt) => {
                  const selected = selectedDebtId === debt.id
                  return (
                    <button
                      key={debt.id}
                      type="button"
                      onClick={() => {
                        setSelectedDebtId(debt.id)
                        setLinkDebtError(null)
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: 'var(--space-sm) var(--space-md)',
                        borderRadius: 'var(--radius-md)',
                        border: selected ? '1px solid transparent' : `1px solid ${T.border}`,
                        background: selected ? 'var(--brand-light)' : T.white,
                        color: selected ? 'var(--brand-dark)' : T.text1,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)' }}>
                        {debt.name}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: selected ? 'var(--brand-dark)' : T.text3, marginTop: 2 }}>
                        {debt.direction === 'owed_by_me' ? 'You owe' : 'Owed to you'} · {fmt(debt.currentBalance, debt.currency)}
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: T.text3, lineHeight: 1.45 }}>
                No active debts found. Create a tracked debt from this entry instead.
              </p>
            )}
          </div>

          <div>
            <p style={{
              margin: '0 0 var(--space-xs)',
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-semibold)',
              color: T.text2,
              letterSpacing: '0.2px',
            }}>
              What did this entry do?
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
              {([
                { value: 'balance', label: 'Increased debt' },
                { value: 'payment', label: 'Reduced debt' },
              ] as const).map((option) => (
                <SingleSelectChip
                  key={option.value}
                  label={option.label}
                  selected={linkDebtRole === option.value}
                  fill
                  onClick={() => {
                    setLinkDebtRole(option.value)
                    setLinkDebtError(null)
                  }}
                />
              ))}
            </div>
            <p style={{ margin: 'var(--space-xs) 0 0', fontSize: 'var(--text-sm)', color: T.text3, lineHeight: 1.45 }}>
              Choose increased debt if this entry added money owed. Choose reduced debt if it was a payment.
            </p>
          </div>

          <div style={{
            padding: 'var(--space-md)',
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${T.borderSubtle}`,
            background: T.pageBg,
          }}>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: T.text1 }}>
              This entry
            </p>
            <p style={{ margin: 'var(--space-2xs) 0 0', fontSize: 'var(--text-sm)', color: T.text3, lineHeight: 1.45 }}>
              {entry.name} · {fmt(entry.amount, currency)}
            </p>
          </div>

          {linkDebtError ? (
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--red-dark)', lineHeight: 1.45 }}>
              {linkDebtError}
            </p>
          ) : null}

          <PrimaryBtn
            size="lg"
            onClick={handleLinkDebt}
            disabled={savingLinkDebt || loadingActiveDebts || activeDebts.length === 0}
          >
            {savingLinkDebt ? 'Connecting…' : 'Connect entry'}
          </PrimaryBtn>
          <TertiaryBtn size="lg" onClick={() => setActiveFlow(null)} disabled={savingLinkDebt}>
            Cancel
          </TertiaryBtn>
        </div>
      </Sheet>

      <Sheet
        open={activeFlow === 'track'}
        onClose={() => setActiveFlow(null)}
        title="Monthly reminder"
      >
        <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
          <Input
            label="Monthly amount"
            prefix={currency}
            type="number"
            value={monthlyReminderAmount}
            onChange={(value) => {
              setMonthlyReminderAmount(value)
              setMonthlyReminderError(null)
            }}
            error={monthlyReminderError ?? undefined}
          />
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: T.text2, lineHeight: 1.5 }}>
            We’ll remind you before it’s due.
          </p>
          <PrimaryBtn
            size="lg"
            onClick={() => {
              if (!(parseFloat(monthlyReminderAmount) > 0)) {
                setMonthlyReminderError('Add a monthly amount')
                return
              }
              handleToggleMonthlyReminder()
            }}
            disabled={savingMonthlyReminder}
          >
            {savingMonthlyReminder ? 'Saving…' : 'Save'}
          </PrimaryBtn>
        </div>
      </Sheet>

      <Sheet
        open={activeFlow === 'edit'}
        onClose={requestCloseEdit}
        title="Edit expense"
        hideHeader
        bodyPadding="none"
        variant="bottom"
      >
        <div style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '80vh',
          minHeight: 'min(640px, 80vh)',
          background: 'var(--page-bg)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: 'var(--space-sm) var(--space-page-mobile) 0',
            background: 'var(--page-bg)',
          }}>
            <button
              type="button"
              onClick={requestCloseEdit}
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--radius-full)',
                border: 'none',
                background: 'var(--grey-100)',
                color: T.text2,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                cursor: 'pointer',
              }}
            >
              <IconChevronX size={16} color="var(--text-2)" />
            </button>
          </div>

          <div style={{
            padding: 'var(--space-sm) var(--space-page-mobile) var(--space-lg)',
            textAlign: 'center',
          }}>
            <p style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-xl)',
              fontWeight: 'var(--weight-semibold)',
              color: T.text1,
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {editLabel.trim() || entry.name}
            </p>
            <p style={{
              margin: 'var(--space-2xs) 0 0',
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-lg)',
              fontWeight: 'var(--weight-semibold)',
              color: T.text2,
              lineHeight: 1.2,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {fmt(parseFloat(editAmount) || 0, currency)}
            </p>
            <p style={{
              margin: 'var(--space-2xs) 0 0',
              fontSize: 'var(--text-sm)',
              color: T.text2,
              lineHeight: 1.35,
            }}>
              {(editCategoryType ? CATEGORY_LABEL[editCategoryType] : CATEGORY_LABEL[entry.categoryType] ?? 'Other')}
              {entry.date ? ` · ${formatDate(entry.date)}` : ''}
            </p>
          </div>

          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0 var(--space-page-mobile) var(--space-md)',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Input
                label="Name"
                value={editLabel}
                onChange={(value) => {
                  setEditLabel(value)
                  setEditErrors((current) => ({ ...current, label: undefined }))
                }}
                autoFocus
                placeholder={editLabel ? undefined : 'Name'}
                error={editErrors.label}
              />
              <Input
                label="Amount"
                prefix={currency}
                type="number"
                value={editAmount}
                onChange={(value) => {
                  setEditAmount(value)
                  setEditErrors((current) => ({ ...current, amount: undefined }))
                }}
                autoFocus={false}
                placeholder={editAmount ? undefined : 'Amount'}
                error={editErrors.amount}
              />
              <div style={{ marginTop: 'var(--space-sm)' }}>
                <p style={{
                  margin: '0 0 var(--space-2xs)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--weight-semibold)',
                  color: T.text2,
                  letterSpacing: '0.2px',
                }}>
                  Category
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                  {([
                    { value: 'everyday', label: 'Spending' },
                    { value: 'fixed', label: 'Fixed' },
                    ...(isDebtEntry ? [{ value: 'debt', label: 'Debt' } as const] : []),
                  ] as const).map((option) => {
                    const selected = editCategoryType === option.value
                    return (
                      <SingleSelectChip
                        key={option.value}
                        label={option.label}
                        selected={selected}
                        fill
                        onClick={() => {
                          setEditCategoryType(option.value)
                          setEditErrors((current) => ({ ...current, category: undefined }))
                        }}
                      />
                    )
                  })}
                </div>
                {editCategoryType && (
                  <p style={{
                    margin: 'var(--space-xs) 0 0',
                    fontSize: 'var(--text-sm)',
                    color: T.text3,
                    lineHeight: 1.45,
                  }}>
                    {CATEGORY_HELPER[editCategoryType]}
                  </p>
                )}
                {editErrors.category && (
                  <p style={{
                    margin: 'var(--space-xs) 0 0',
                    fontSize: 12,
                    color: 'var(--red-dark)',
                    fontWeight: 500,
                  }}>
                    {editErrors.category}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div style={{
            position: 'sticky',
            bottom: 0,
            display: 'grid',
            gap: 'var(--space-sm)',
            padding: 'var(--space-lg) var(--space-page-mobile) calc(var(--space-md) + env(safe-area-inset-bottom, 0px))',
            background: 'var(--page-bg)',
          }}>
            <PrimaryBtn
              size="lg"
              onClick={handleSaveEdit}
              disabled={savingEdit}
            >
              {savingEdit ? 'Saving…' : 'Save changes'}
            </PrimaryBtn>
            <TertiaryBtn
              size="lg"
              onClick={() => setEditDialog('delete')}
              style={{
                color: 'var(--red-dark)',
                minHeight: 'var(--button-height)',
              }}
            >
              Delete entry
            </TertiaryBtn>
          </div>

          {editDialog && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(16, 24, 40, 0.32)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--space-md)',
              zIndex: 2,
            }}>
              <div style={{
                width: '100%',
                maxWidth: 360,
                background: T.white,
                borderRadius: 'var(--radius-lg)',
                border: `var(--border-width) solid ${T.border}`,
                padding: 'var(--space-lg)',
              }}>
                <p style={{
                  margin: 0,
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-lg)',
                  fontWeight: 'var(--weight-semibold)',
                  color: T.text1,
                  letterSpacing: '-0.01em',
                }}>
                  {editDialog === 'delete'
                    ? 'Delete this entry?'
                    : editDialog === 'monthlyReminder'
                      ? 'Keep monthly reminder?'
                      : 'Discard changes?'}
                </p>
                {(editDialog === 'delete' || editDialog === 'monthlyReminder') && (
                  <p style={{
                    margin: 'var(--space-sm) 0 0',
                    fontSize: 'var(--text-sm)',
                    color: T.text2,
                    lineHeight: 1.5,
                  }}>
                    {editDialog === 'delete'
                      ? 'This will remove it from your log.'
                      : 'This item will still appear in reminders.'}
                  </p>
                )}
                <div style={{
                  display: 'grid',
                  gap: 'var(--space-sm)',
                  marginTop: 'var(--space-lg)',
                }}>
                  {editDialog === 'delete' ? (
                    <>
                      <SecondaryBtn
                        size="lg"
                        onClick={() => setEditDialog(null)}
                      >
                        Cancel
                      </SecondaryBtn>
                      <PrimaryBtn
                        size="lg"
                        onClick={handleDeleteEntry}
                        disabled={deletingKey === entry.id}
                        style={{
                          background: 'var(--red-dark)',
                          color: T.textInverse,
                        }}
                      >
                        {deletingKey === entry.id ? 'Deleting…' : 'Delete'}
                      </PrimaryBtn>
                    </>
                  ) : editDialog === 'monthlyReminder' ? (
                    <>
                      <SecondaryBtn
                        size="lg"
                        onClick={() => {
                          setEditDialog(null)
                          void performSaveEdit(false)
                        }}
                        disabled={savingEdit}
                      >
                        Keep monthly reminder
                      </SecondaryBtn>
                      <PrimaryBtn
                        size="lg"
                        onClick={() => {
                          setEditDialog(null)
                          void performSaveEdit(true)
                        }}
                        disabled={savingEdit}
                      >
                        {savingEdit ? 'Saving…' : 'Remove monthly reminder'}
                      </PrimaryBtn>
                    </>
                  ) : (
                    <>
                      <SecondaryBtn
                        size="lg"
                        onClick={() => setEditDialog(null)}
                      >
                        Keep editing
                      </SecondaryBtn>
                      <TertiaryBtn
                        size="lg"
                        onClick={() => {
                          setEditDialog(null)
                          setActiveFlow(null)
                          setEditErrors({})
                        }}
                      >
                        Discard
                      </TertiaryBtn>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Sheet>

      <Sheet
        open={activeFlow === 'debtEdit'}
        onClose={() => setActiveFlow(null)}
        title={
          isGoalEntry
            ? 'Edit goal entry'
            : entry.debtEntryType === 'principal_increase'
              ? 'Edit opening balance'
              : 'Edit debt entry'
        }
      >
        <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
          <Input
            label="Amount"
            prefix={currency}
            type="number"
            value={debtEditAmount}
            onChange={(value) => {
              setDebtEditAmount(value)
              setDebtEditError(null)
            }}
            error={debtEditError ?? undefined}
          />
          <Input
            label="Date"
            type="date"
            value={debtEditDate}
            onChange={(value) => {
              setDebtEditDate(value)
              setDebtEditError(null)
            }}
          />
          <Input
            label="Note"
            value={debtEditNote}
            onChange={setDebtEditNote}
            placeholder="Optional note"
          />
          <PrimaryBtn
            size="lg"
            onClick={handleSaveDebtEdit}
            disabled={savingDebtEdit}
          >
            {savingDebtEdit ? 'Saving…' : 'Save changes'}
          </PrimaryBtn>
          <TertiaryBtn
            size="md"
            onClick={() => setActiveFlow(null)}
            style={{ padding: '12px' }}
          >
            Cancel
          </TertiaryBtn>
        </div>
      </Sheet>

      <Sheet
        open={activeFlow === 'confirm'}
        onClose={() => setActiveFlow(null)}
        title="Are you sure?"
      >
        <div>
          <p style={{ fontSize: 14, color: '#475467', margin: '0 0 24px', lineHeight: 1.6 }}>
            {isDebtEntry
              ? (
                  <>
                    This will remove the <strong>{entry.name}</strong> debt {debtEntryLabel} of{' '}
                    <strong>{fmt(entry.amount, currency)}</strong>.
                  </>
                )
              : isGoalEntry
                ? (
                    <>
                      This will remove the <strong>{entry.name}</strong> goal contribution of{' '}
                      <strong>{fmt(entry.amount, currency)}</strong>.
                    </>
                  )
              : (
                  <>
                    This will permanently remove your <strong>{entry.name}</strong> entry of{' '}
                    <strong>{fmt(entry.amount, currency)}</strong> for this month.
                  </>
                )}
          </p>
          <button
            onClick={handleDeleteEntry}
            disabled={deletingKey === entry.id}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 14,
              background: '#D93025',
              border: 'none',
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: 600,
              color: T.textInverse,
              opacity: deletingKey === entry.id ? 0.6 : 1,
            }}
          >
            {deletingKey === entry.id ? 'Removing…' : 'Yes, remove it'}
          </button>
          <TertiaryBtn
            size="md"
            onClick={() => setActiveFlow(null)}
            style={{
              marginTop: 10,
              padding: '12px',
            }}
          >
            Go back
          </TertiaryBtn>
        </div>
      </Sheet>

      <Sheet
        open={activeFlow === 'refund'}
        onClose={() => setActiveFlow(null)}
        title="Log a refund"
      >
        <div>
          <p style={{ fontSize: 14, color: '#475467', margin: '0 0 20px', lineHeight: 1.6 }}>
            How much was refunded for <strong>{entry.name}</strong>?
          </p>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            border: '1px solid var(--border-strong)',
            borderRadius: 12,
            background: T.white,
            overflow: 'hidden',
            marginBottom: 12,
          }}>
            <span style={{
              padding: '0 14px',
              fontSize: 14,
              fontWeight: 600,
              color: T.text3,
              borderRight: '1px solid var(--border-subtle)',
              whiteSpace: 'nowrap',
            }}>
              {currency}
            </span>
            <input
              autoFocus
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={refundAmount.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              onChange={event => {
                const raw = event.target.value.replace(/,/g, '')
                if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return
                setRefundAmount(raw)
              }}
              style={{
                flex: 1,
                height: 52,
                border: 'none',
                outline: 'none',
                padding: '0 14px',
                fontSize: 18,
                fontWeight: 600,
                color: T.text1,
                background: 'transparent',
              }}
            />
          </div>
          <input
            type="text"
            placeholder="Note (optional)"
            value={refundNote}
            onChange={event => setRefundNote(event.target.value)}
            style={{
              width: '100%',
              height: 46,
              borderRadius: 12,
              border: '1px solid var(--border)',
              padding: '0 14px',
              fontSize: 14,
              color: T.text1,
              background: T.white,
              outline: 'none',
              boxSizing: 'border-box',
              marginBottom: 20,
            }}
          />
          <PrimaryBtn
            size="lg"
            onClick={handleSaveRefund}
            disabled={!refundAmount || parseFloat(refundAmount) <= 0 || savingRefund}
            style={{
              background: refundAmount && parseFloat(refundAmount) > 0 ? T.brandDark : T.border,
              color: refundAmount && parseFloat(refundAmount) > 0 ? T.textInverse : T.textMuted,
            }}
          >
            {savingRefund ? 'Saving…' : 'Log refund'}
          </PrimaryBtn>
          <TertiaryBtn
            size="md"
            onClick={() => setActiveFlow(null)}
            style={{
              marginTop: 10,
              padding: '12px',
            }}
          >
            Go back
          </TertiaryBtn>
        </div>
      </Sheet>
    </div>
  )

  if (isDesktop) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <SideNav />
        <main style={{ flex: 1, maxWidth: 720, margin: '0 auto' }}>{content}</main>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', paddingBottom: 88 }}>
      <main>{content}</main>
      <BottomNav />
    </div>
  )
}
