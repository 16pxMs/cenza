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
  deleteLogEntry,
  recordRefund,
  stopTrackingEssential,
  trackEssential,
  updateLogEntry,
} from '../actions'

const CATEGORY_LABEL: Record<string, string> = {
  everyday: 'Spending',
  fixed: 'Essentials',
  debt: 'Debt',
}

const CATEGORY_HELPER: Record<EditableCategory, string> = {
  everyday: 'For everyday spending like food, transport, or going out',
  fixed: 'For fixed costs like rent, bills, or subscriptions',
  debt: 'Money you owe and are paying back',
}

type EditableCategory = 'everyday' | 'fixed' | 'debt'

function isEditableCategory(value: string | null | undefined): value is EditableCategory {
  return value === 'everyday' || value === 'fixed' || value === 'debt'
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

  const [activeFlow, setActiveFlow] = useState<'edit' | 'refund' | 'confirm' | 'track' | null>(null)

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
  const [editDialog, setEditDialog] = useState<'delete' | 'discard' | 'recurring' | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  const [trackingEssential, setTrackingEssential] = useState(false)
  const [trackMonthlyAmount, setTrackMonthlyAmount] = useState('')
  const [trackError, setTrackError] = useState<string | null>(null)

  const [deletingKey, setDeletingKey] = useState<string | null>(null)

  const goBack = () => router.push('/log')

  const openEdit = () => {
    setEditAmount(String(entry.amount))
    setEditDate(entry.date)
    setEditNote(entry.note ?? '')
    setEditLabel(entry.name)
    setEditCategoryType(isEditableCategory(entry.categoryType) ? entry.categoryType : 'everyday')
    setEditErrors({})
    setEditDialog(null)
    setActiveFlow('edit')
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
    setEditErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const performSaveEdit = async (removeRecurring: boolean) => {
    if (!entry.id || !editCategoryType) return
    const amount = parseFloat(editAmount)
    if (!amount || amount <= 0 || !editDate || !editCategoryType) return

    const transactionDirty =
      editLabel.trim() !== entry.name.trim() ||
      amount !== entry.amount ||
      editCategoryType !== entry.categoryType

    setSavingEdit(true)
    try {
      if (transactionDirty || removeRecurring) {
        await updateLogEntry({
          id: entry.id,
          amount,
          date: editDate,
          note: editNote,
          label: editLabel,
          categoryKey: entry.categoryKey,
          categoryType: editCategoryType,
          removeRecurringCategoryKey: removeRecurring
            ? (entry.trackedEssentialKey ?? entry.categoryKey)
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
      entry.trackedEssential &&
      entry.categoryType === 'fixed' &&
      editCategoryType &&
      editCategoryType !== 'fixed'
    ) {
      setEditDialog('recurring')
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

  const handleDeleteEntry = async () => {
    if (!entry.id) return
    setDeletingKey(entry.id)
    try {
      await deleteLogEntry(
        entry.id,
        entry.trackedEssential ? (entry.trackedEssentialKey ?? entry.categoryKey) : null
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

  const handleToggleEssentialTracking = async () => {
    if (entry.categoryType !== 'fixed') return

    setTrackingEssential(true)
    try {
      if (entry.trackedEssential) {
        await stopTrackingEssential({
          categoryKey: entry.trackedEssentialKey ?? entry.categoryKey,
        })
        toast('Removed from recurring')
      } else {
        await trackEssential({
          categoryKey: entry.categoryKey,
          categoryLabel: entry.name,
          amount: parseFloat(trackMonthlyAmount),
        })
        toast('Marked as recurring')
      }
      router.push('/log')
      router.refresh()
    } catch {
      toast('Could not update recurring status')
    } finally {
      setTrackingEssential(false)
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
        {entry.trackedEssential && (
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
              Recurring
            </span>
          </div>
        )}
      </div>

      {/* Action cards */}
      <div style={{ padding: `0 ${pageX}`, display: 'grid', gap: 'var(--space-sm)' }}>
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

        {entry.categoryType === 'fixed' && (
          <div style={{
            background: T.white,
            border: `1px solid ${T.border}`,
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}>
            <button
              onClick={
                entry.trackedEssential
                  ? handleToggleEssentialTracking
                  : () => {
                      setTrackMonthlyAmount(String(entry.amount))
                      setTrackError(null)
                      setActiveFlow('track')
                    }
              }
              disabled={trackingEssential}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: 'var(--space-md)',
                background: T.white,
                border: 'none',
                cursor: trackingEssential ? 'default' : 'pointer',
              }}
            >
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: T.text1 }}>
                {entry.trackedEssential ? 'Remove from recurring' : 'Set as recurring'}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: T.text3, marginTop: 2 }}>
                {entry.trackedEssential
                  ? 'You won’t get reminders for this'
                  : 'We’ll remind you before it’s due'}
              </div>
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
            <div style={{ fontSize: 'var(--text-xs)', color: T.text3, marginTop: 2 }}>Remove this expense</div>
          </button>
        </div>
      </div>

      {/* Sub-flow sheets */}
      <Sheet
        open={activeFlow === 'track'}
        onClose={() => setActiveFlow(null)}
        title="Set as recurring"
      >
        <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
          <Input
            label="Monthly amount"
            prefix={currency}
            type="number"
            value={trackMonthlyAmount}
            onChange={(value) => {
              setTrackMonthlyAmount(value)
              setTrackError(null)
            }}
            error={trackError ?? undefined}
          />
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: T.text2, lineHeight: 1.5 }}>
            We’ll remind you before it’s due.
          </p>
          <PrimaryBtn
            size="lg"
            onClick={() => {
              if (!(parseFloat(trackMonthlyAmount) > 0)) {
                setTrackError('Add a monthly amount')
                return
              }
              handleToggleEssentialTracking()
            }}
            disabled={trackingEssential}
          >
            {trackingEssential ? 'Saving…' : 'Save'}
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
                    { value: 'fixed', label: 'Essentials' },
                    { value: 'debt', label: 'Debt' },
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
                    : editDialog === 'recurring'
                      ? 'Keep this as recurring?'
                      : 'Discard changes?'}
                </p>
                {(editDialog === 'delete' || editDialog === 'recurring') && (
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
                  ) : editDialog === 'recurring' ? (
                    <>
                      <SecondaryBtn
                        size="lg"
                        onClick={() => {
                          setEditDialog(null)
                          void performSaveEdit(false)
                        }}
                        disabled={savingEdit}
                      >
                        Keep recurring
                      </SecondaryBtn>
                      <PrimaryBtn
                        size="lg"
                        onClick={() => {
                          setEditDialog(null)
                          void performSaveEdit(true)
                        }}
                        disabled={savingEdit}
                      >
                        {savingEdit ? 'Saving…' : 'Remove from recurring'}
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
        open={activeFlow === 'confirm'}
        onClose={() => setActiveFlow(null)}
        title="Are you sure?"
      >
        <div>
          <p style={{ fontSize: 14, color: '#475467', margin: '0 0 24px', lineHeight: 1.6 }}>
            This will permanently remove your <strong>{entry.name}</strong> entry of{' '}
            <strong>{fmt(entry.amount, currency)}</strong> for this month.
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
