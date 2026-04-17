'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useToast } from '@/lib/context/ToastContext'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { PrimaryBtn, SecondaryBtn, TertiaryBtn } from '@/components/ui/Button/Button'
import { Input } from '@/components/ui/Input/Input'
import { IconBack, IconChevronX } from '@/components/ui/Icons'
import { fmt } from '@/lib/finance'
import type { LogEntry, LogPageData, LogSubItem } from '@/lib/loaders/log'
import {
  deleteLogEntry,
  recordRefund,
  stopTrackingEssential,
  trackEssential,
  updateLogEntry,
} from './actions'

const CATEGORY_LABEL: Record<string, string> = {
  everyday: 'Spending',
  fixed: 'Essentials',
  debt: 'Debt',
}

type EditableCategory = 'everyday' | 'fixed' | 'debt'

function entryToSubItem(entry: LogEntry): LogSubItem {
  return {
    key: entry.categoryKey,
    label: entry.name,
    sublabel: null,
    groupType: entry.categoryType,
    loggedAmount: entry.amount,
    latestLoggedDate: entry.date,
    entryCount: 1,
    singleEntryId: entry.id,
    singleEntryDate: entry.date,
    singleEntryNote: entry.note,
    scope: 'key',
    trackedEssential: entry.trackedEssential,
    trackedEssentialKey: entry.trackedEssentialKey,
    trackedMonthlyAmount: entry.trackedMonthlyAmount,
  }
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

function formatEntryDate(iso: string | null | undefined) {
  if (!iso) return null
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, (month ?? 1) - 1, day ?? 1)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isEditableCategory(value: string | null | undefined): value is EditableCategory {
  return value === 'everyday' || value === 'fixed' || value === 'debt'
}

interface LogPageClientProps {
  data: LogPageData
}

export default function LogPageClient({ data }: LogPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isDesktop } = useBreakpoint()
  const { toast } = useToast()

  const autoOpened = useRef(false)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<LogSubItem | null>(null)
  const [deleteStep, setDeleteStep] = useState<'reason' | 'confirm' | 'refund' | 'edit' | 'track'>('reason')
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
  const [editDialog, setEditDialog] = useState<'delete' | 'discard' | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [trackingEssential, setTrackingEssential] = useState(false)
  const [trackMonthlyAmount, setTrackMonthlyAmount] = useState('')
  const [trackError, setTrackError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'everyday' | 'fixed' | 'debt'>('all')

  const entries = data.entries
  const totalLogged = entries.reduce((sum, entry) => sum + entry.amount, 0)
  const totalEntries = entries.length
  const visibleEntries = filter === 'all'
    ? entries
    : entries.filter(entry => entry.categoryType === filter)

  const filterEmptyMessage: Record<typeof filter, string> = {
    all: 'No expenses logged yet for this cycle.',
    everyday: 'No life entries yet',
    fixed: 'No bills logged yet',
    debt: 'No debt entries yet',
  }

  const FILTER_OPTIONS: Array<{ value: typeof filter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'everyday', label: 'Spending' },
    { value: 'fixed', label: 'Essentials' },
    { value: 'debt', label: 'Debt' },
  ]

  const pageX = isDesktop ? 'var(--space-page-desktop)' : 'var(--space-page-mobile)'

  const categoryDisplayName = (key: string, fallback: string) => {
    const cleaned = key.replace(/[_-]+/g, ' ').trim()
    if (!cleaned) return fallback
    return cleaned.replace(/\b\w/g, c => c.toUpperCase())
  }
  const topCategories = (() => {
    const sums = new Map<string, { name: string; amount: number }>()
    for (const entry of entries) {
      const existing = sums.get(entry.categoryKey)
      if (existing) existing.amount += entry.amount
      else sums.set(entry.categoryKey, {
        name: categoryDisplayName(entry.categoryKey, entry.name),
        amount: entry.amount,
      })
    }
    return Array.from(sums.values()).sort((a, b) => b.amount - a.amount).slice(0, 3)
  })()

  const reviewItemEntries = (item: LogSubItem) => {
    const params = new URLSearchParams({
      label: item.label,
      type: item.groupType,
      scope: item.scope ?? ((item.entryCount ?? 0) > 1 ? 'label' : 'key'),
      returnTo: '/log',
      ...(item.plannedAmount ? { planned: String(item.plannedAmount) } : {}),
    })
    router.push(`/history/${item.key}?${params.toString()}`)
  }

  const openDirectEdit = (item: LogSubItem) => {
    if (!item.singleEntryId || !item.singleEntryDate) {
      reviewItemEntries(item)
      return
    }
    setEditAmount(String(item.loggedAmount))
    setEditDate(item.singleEntryDate)
    setEditNote(item.singleEntryNote ?? '')
    setEditLabel(item.label)
    setEditCategoryType(isEditableCategory(item.groupType) ? item.groupType : 'everyday')
    setEditErrors({})
    setEditDialog(null)
    setDeleteStep('edit')
  }

  const logOther = () => {
    router.push('/log/new?isOther=true&returnTo=/log')
  }

  useEffect(() => {
    if (autoOpened.current) return
    if (searchParams.get('open') !== 'true') return

    autoOpened.current = true
    logOther()
  }, [router, searchParams])

  const editIsDirty = !!(
    pendingDelete &&
    deleteStep === 'edit' &&
    (
      editLabel.trim() !== pendingDelete.label.trim() ||
      editAmount !== String(pendingDelete.loggedAmount) ||
      editCategoryType !== pendingDelete.groupType
    )
  )

  const requestCloseEdit = () => {
    if (deleteStep === 'edit' && editDialog) {
      setEditDialog(null)
      return
    }

    if (deleteStep === 'edit' && editIsDirty) {
      setEditDialog('discard')
      return
    }

    setPendingDelete(null)
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

  const handleSaveRefund = async () => {
    if (!pendingDelete) return

    const amount = parseFloat(refundAmount)
    if (!amount || amount <= 0) return

    setSavingRefund(true)
    try {
      await recordRefund({
        categoryType: pendingDelete.groupType as any,
        categoryKey: pendingDelete.key,
        categoryLabel: pendingDelete.label,
        amount,
        note: refundNote,
      })
      toast('Refund recorded')
      setPendingDelete(null)
      setRefundAmount('')
      setRefundNote('')
      router.refresh()
    } catch {
      toast('Could not record refund')
    } finally {
      setSavingRefund(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!pendingDelete?.singleEntryId) return
    if (!validateEdit()) return

    const amount = parseFloat(editAmount)
    if (!amount || amount <= 0 || !editDate || !editCategoryType) return

    const transactionDirty =
      editLabel.trim() !== pendingDelete.label.trim() ||
      amount !== pendingDelete.loggedAmount ||
      editCategoryType !== pendingDelete.groupType

    setSavingEdit(true)
    try {
      if (transactionDirty) {
        await updateLogEntry({
          id: pendingDelete.singleEntryId,
          amount,
          date: editDate,
          note: editNote,
          label: editLabel,
          categoryKey: pendingDelete.key,
          categoryType: editCategoryType,
        })
      }

      toast('Entry updated')
      setPendingDelete(null)
      setEditAmount('')
      setEditDate('')
      setEditNote('')
      setEditLabel('')
      setEditCategoryType(null)
      setEditErrors({})
      setEditDialog(null)
      router.refresh()
    } catch {
      toast('Could not update entry')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDeleteEntry = async (id: string) => {
    setDeletingKey(id)
    try {
      await deleteLogEntry(id)
      toast('Entry removed')
      setEditDialog(null)
      setPendingDelete(null)
      setEditErrors({})
      setEditCategoryType(null)
      router.refresh()
    } catch {
      toast('Could not remove entry')
    } finally {
      setDeletingKey(null)
    }
  }

  const handleToggleEssentialTracking = async () => {
    if (!pendingDelete || pendingDelete.groupType !== 'fixed') return

    setTrackingEssential(true)
    try {
      if (pendingDelete.trackedEssential) {
        await stopTrackingEssential({
          categoryKey: pendingDelete.trackedEssentialKey ?? pendingDelete.key,
        })
        toast('Removed from recurring')
      } else {
        await trackEssential({
          categoryKey: pendingDelete.key,
          categoryLabel: pendingDelete.label,
          amount: parseFloat(trackMonthlyAmount),
        })
        toast('Marked as recurring')
      }
      setPendingDelete(null)
      router.refresh()
    } catch {
      toast('Could not update recurring status')
    } finally {
      setTrackingEssential(false)
    }
  }

  const formatSavedAt = (iso: string | null | undefined) => {
    if (!iso) return null
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return null
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const renderEntryRow = (entry: LogEntry) => {
    const item = entryToSubItem(entry)
    const categoryLabel = CATEGORY_LABEL[entry.categoryType] ?? 'Other'
    const savedAt = formatSavedAt(entry.createdAt)

    return (
      <div
        key={entry.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          background: T.white,
          minHeight: 72,
          padding: `0 ${pageX}`,
          borderTop: `var(--border-width) solid ${T.borderSubtle}`,
        }}
      >
        <button
          onClick={() => { setPendingDelete(item); setDeleteStep('reason') }}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-md)',
            border: 'none',
            background: 'transparent',
            padding: 'var(--space-md) 0',
            minHeight: 72,
            cursor: 'pointer',
            textAlign: 'left',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-base)',
              fontWeight: 'var(--weight-regular)',
              color: T.text2,
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {entry.name}
            </div>
            <div style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--weight-regular)',
              color: T.text3,
              marginTop: 'var(--space-sm)',
              lineHeight: 1.3,
            }}>
              {categoryLabel}{savedAt ? ` · ${savedAt}` : ''}
            </div>
          </div>

          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-base)',
            fontWeight: 'var(--weight-semibold)',
            color: T.text1,
            flexShrink: 0,
            marginLeft: 'var(--space-sm)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {fmt(entry.amount, data.currency)}
          </span>
        </button>
      </div>
    )
  }


  const content = (
    <div style={{ paddingBottom: isDesktop ? 'var(--space-xxl)' : 144, paddingTop: 'var(--space-xs)' }}>
      {/* Header */}
      <div style={{
        padding: isDesktop
          ? `var(--space-xl) var(--space-page-desktop) var(--space-md)`
          : `var(--space-lg) var(--space-page-mobile) var(--space-md)`,
      }}>
        <button
          onClick={() => router.push('/app')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            width: 44,
            height: 44,
            padding: 0,
            marginBottom: 'var(--space-sm)',
            marginLeft: -10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconBack size={18} color="var(--grey-900)" />
        </button>
        <p style={{
          margin: '0 0 var(--space-xs)',
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--weight-semibold)',
          color: T.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          {data.cycleLabel}
        </p>
        <h1 style={{
          fontSize: 'var(--text-lg)',
          fontWeight: 'var(--weight-semibold)',
          color: T.text2,
          margin: 0,
          letterSpacing: '-0.01em',
          lineHeight: 1.2,
        }}>
          Expense log
        </h1>
      </div>

      {/* Summary */}
      <div style={{
        padding: `0 ${pageX}`,
        marginBottom: 'var(--space-lg)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 'var(--space-md)',
        }}>
          <div>
            <p style={{
              margin: '0 0 var(--space-xs)',
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-semibold)',
              color: T.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              Logged total
            </p>
            <p style={{
              margin: 0,
              fontSize: 'var(--text-sm)',
              color: T.text3,
              lineHeight: 1.4,
            }}>
              {totalEntries} {totalEntries === 1 ? 'expense' : 'expenses'} logged
            </p>
          </div>
          <p style={{
            margin: 0,
            fontSize: 'var(--text-xl)',
            fontWeight: 'var(--weight-semibold)',
            color: T.text1,
            letterSpacing: '-0.02em',
            lineHeight: 1,
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {fmt(totalLogged, data.currency)}
          </p>
        </div>
      </div>

      {/* Insight — permanent, contained surface */}
      {topCategories.length > 0 && (
        <div style={{
          padding: `0 ${pageX}`,
          marginBottom: 'var(--space-lg)',
        }}>
          <div style={{
            background: T.white,
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-md)',
            border: `var(--border-width) solid ${T.borderSubtle}`,
          }}>
            <p style={{
              margin: '0 0 var(--space-sm)',
              fontSize: 'var(--text-base)',
              fontWeight: 'var(--weight-semibold)',
              color: T.text1,
              lineHeight: 1.3,
            }}>
              Top expenses this month
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2xs)' }}>
              {topCategories.map(cat => (
                <div key={cat.name} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 'var(--space-md)',
                }}>
                  <span style={{
                    fontSize: 'var(--text-sm)',
                    color: T.text2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {cat.name}
                  </span>
                  <span style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--weight-semibold)',
                    color: T.text1,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {fmt(cat.amount, data.currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filter controls */}
      <div style={{
        padding: `0 ${pageX}`,
        marginBottom: 'var(--space-md)',
        display: 'flex',
        gap: 'var(--space-sm)',
        flexWrap: 'wrap',
      }}>
        {FILTER_OPTIONS.map(option => {
          const selected = filter === option.value
          return (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              style={{
                height: 'var(--control-sm)',
                padding: '0 var(--space-md)',
                borderRadius: 'var(--radius-full)',
                border: selected
                  ? `var(--border-width-thick) solid ${T.brandDark}`
                  : `var(--border-width) solid ${T.border}`,
                background: selected ? T.brandDark : T.white,
                color: selected ? T.textInverse : T.text2,
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      {/* List */}
      <div style={{ padding: `0 ${pageX}` }}>
        <div style={{
          background: T.white,
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
        }}>
          {visibleEntries.length === 0 ? (
            <p style={{
              fontSize: 'var(--text-sm)',
              color: T.textMuted,
              margin: 0,
              padding: `var(--space-lg) ${pageX}`,
            }}>
              {filterEmptyMessage[filter]}
            </p>
          ) : (
            visibleEntries.map(renderEntryRow)
          )}
        </div>
      </div>

      {isDesktop && (
        <div style={{ padding: `var(--space-lg) var(--space-page-desktop) 0` }}>
          <PrimaryBtn
            size="lg"
            onClick={() => router.push('/log/new?returnTo=/log')}
            style={{ background: T.brandDark, color: T.textInverse }}
          >
            Add expense
          </PrimaryBtn>
        </div>
      )}

      {pendingDelete && (
        <Sheet
          open={true}
          onClose={requestCloseEdit}
          title={
            deleteStep === 'reason'
              ? ''
                : deleteStep === 'refund'
                  ? 'Log a refund'
                : deleteStep === 'track'
                  ? 'Set as recurring'
                : deleteStep === 'edit'
                  ? 'Edit expense'
                  : 'Are you sure?'
          }
          hideHeader={deleteStep === 'edit'}
          bodyPadding={deleteStep === 'edit' ? 'none' : 'default'}
          variant={deleteStep === 'edit' ? 'bottom' : 'default'}
        >
          {deleteStep === 'reason' && (
            <div>
              <div style={{ margin: '0 0 var(--space-lg)' }}>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-xl)',
                  fontWeight: 'var(--weight-semibold)',
                  color: T.text1,
                  lineHeight: 1.2,
                  letterSpacing: '-0.01em',
                }}>
                  {pendingDelete.label}
                </div>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-lg)',
                  fontWeight: 'var(--weight-semibold)',
                  color: T.text1,
                  marginTop: 'var(--space-2xs)',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1.2,
                }}>
                  {fmt(pendingDelete.loggedAmount, data.currency)}
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-sm)',
                  flexWrap: 'wrap',
                  marginTop: 'var(--space-sm)',
                }}>
                  <div style={{
                    fontSize: 'var(--text-sm)',
                    color: T.text3,
                    lineHeight: 1.3,
                  }}>
                    {CATEGORY_LABEL[pendingDelete.groupType] ?? 'Other'}
                    {pendingDelete.latestLoggedDate ? ` · ${formatEntryDate(pendingDelete.latestLoggedDate)}` : ''}
                  </div>
                  {pendingDelete.trackedEssential && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      minHeight: 22,
                      padding: '0 var(--space-sm)',
                      borderRadius: 'var(--radius-full)',
                      border: `var(--border-width) solid ${T.border}`,
                      background: 'var(--grey-50)',
                      fontSize: 11,
                      fontWeight: 600,
                      color: T.text2,
                      letterSpacing: '0.02em',
                    }}>
                      Recurring
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
                <div>
                  <p style={{
                    margin: '0 0 var(--space-sm)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 'var(--weight-semibold)',
                    color: T.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                  }}>
                    This expense
                  </p>
                  <div style={{
                    background: T.white,
                    border: `1px solid ${T.border}`,
                    borderRadius: 18,
                    overflow: 'hidden',
                  }}>
                    <button
                      onClick={() => {
                        if ((pendingDelete.entryCount ?? 0) <= 1 && pendingDelete.singleEntryId) {
                          openDirectEdit(pendingDelete)
                        } else {
                          setPendingDelete(null)
                          reviewItemEntries(pendingDelete)
                        }
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '14px 16px',
                        background: T.white,
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: T.text1 }}>
                          {pendingDelete.entryCount && pendingDelete.entryCount > 1 ? 'Review entries' : 'Edit expense'}
                        </div>
                        <div style={{ fontSize: 12, color: T.text3, marginTop: 3 }}>
                          Edit amount, date, or note
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {pendingDelete.groupType === 'fixed' && (
                  <div>
                    <p style={{
                      margin: '0 0 var(--space-sm)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 'var(--weight-semibold)',
                      color: T.textMuted,
                      textTransform: 'uppercase',
                      letterSpacing: '0.07em',
                    }}>
                      Recurring
                    </p>
                    <div style={{
                      background: T.white,
                      border: `1px solid ${T.border}`,
                      borderRadius: 18,
                      overflow: 'hidden',
                    }}>
                      <button
                        onClick={
                          pendingDelete.trackedEssential
                            ? handleToggleEssentialTracking
                            : () => {
                                setTrackMonthlyAmount(String(pendingDelete.loggedAmount))
                                setTrackError(null)
                                setDeleteStep('track')
                              }
                        }
                        disabled={trackingEssential}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '14px 16px',
                          background: T.white,
                          border: 'none',
                          cursor: trackingEssential ? 'default' : 'pointer',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 600, color: T.text1 }}>
                            {pendingDelete.trackedEssential ? 'Remove from recurring' : 'Mark as recurring'}
                          </div>
                          <div style={{ fontSize: 12, color: T.text3, marginTop: 3 }}>
                            {pendingDelete.trackedEssential
                              ? 'Remove this from your recurring essentials'
                              : 'Add this to your recurring essentials'}
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <p style={{
                    margin: '0 0 var(--space-sm)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 'var(--weight-semibold)',
                    color: T.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                  }}>
                    Other actions
                  </p>
                  <div style={{
                    background: T.white,
                    border: `1px solid ${T.border}`,
                    borderRadius: 18,
                    overflow: 'hidden',
                  }}>
                    <button
                      onClick={() => { setRefundAmount(''); setRefundNote(''); setDeleteStep('refund') }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '14px 16px',
                        background: T.white,
                        border: 'none',
                        borderBottom: `1px solid ${T.borderSubtle}`,
                        cursor: 'pointer',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: T.text1 }}>Refund</div>
                        <div style={{ fontSize: 12, color: T.text3, marginTop: 3 }}>Log money returned to you</div>
                      </div>
                    </button>
                    <button
                      onClick={() => setDeleteStep('confirm')}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '14px 16px',
                        background: T.white,
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: T.text1 }}>Delete entry</div>
                        <div style={{ fontSize: 12, color: T.text3, marginTop: 3 }}>Remove this expense</div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {deleteStep === 'track' && pendingDelete && (
            <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
              <Input
                label="Monthly amount"
                type="number"
                value={trackMonthlyAmount}
                onChange={(value) => {
                  setTrackMonthlyAmount(value)
                  setTrackError(null)
                }}
                error={trackError ?? undefined}
              />
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: T.text2, lineHeight: 1.5 }}>
                This will be included in your monthly expenses.
              </p>
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: T.text2, lineHeight: 1.5 }}>
                Reminders will use your pay schedule by default.
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
                {trackingEssential ? 'Saving…' : 'Save recurring'}
              </PrimaryBtn>
            </div>
          )}

          {deleteStep === 'edit' && pendingDelete && (
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
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 'var(--space-md)',
                padding: 'var(--space-lg) var(--space-page-mobile) var(--space-md)',
                borderBottom: `var(--border-width) solid ${T.borderSubtle}`,
                background: 'var(--page-bg)',
              }}>
                <div style={{ minWidth: 0 }}>
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
                    {editLabel.trim() || pendingDelete.label}
                  </p>
                  <p style={{
                    margin: 'var(--space-xs) 0 0',
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-lg)',
                    fontWeight: 'var(--weight-semibold)',
                    color: T.text2,
                    lineHeight: 1.2,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {fmt(parseFloat(editAmount) || 0, data.currency)}
                  </p>
                  <p style={{
                    margin: 'var(--space-sm) 0 0',
                    fontSize: 'var(--text-sm)',
                    color: T.textMuted,
                    lineHeight: 1.35,
                  }}>
                    {(editCategoryType ? CATEGORY_LABEL[editCategoryType] : CATEGORY_LABEL[pendingDelete.groupType] ?? 'Other')}
                    {pendingDelete.latestLoggedDate ? ` · ${formatEntryDate(pendingDelete.latestLoggedDate)}` : ''}
                  </p>
                </div>
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
                flex: 1,
                overflowY: 'auto',
                padding: 'var(--space-lg) var(--space-page-mobile) var(--space-xl)',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
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

                  <div>
                    <p style={{
                      margin: '0 0 6px',
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: T.text2,
                      letterSpacing: '0.2px',
                    }}>
                      Category
                    </p>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                      {([
                        { value: 'everyday', label: 'Spending' },
                        { value: 'fixed', label: 'Essentials' },
                        { value: 'debt', label: 'Debt' },
                      ] as const).map((option) => {
                        const selected = editCategoryType === option.value
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setEditCategoryType(option.value)
                              setEditErrors((current) => ({ ...current, category: undefined }))
                            }}
                            style={{
                              height: 'var(--button-height-md)',
                              padding: '0 var(--space-md)',
                              borderRadius: 'var(--radius-full)',
                              border: selected
                                ? `var(--border-width-thick) solid ${T.brandDark}`
                                : `var(--border-width) solid ${T.border}`,
                              background: selected ? T.brandDark : T.white,
                              color: selected ? T.textInverse : T.text2,
                              fontSize: 'var(--text-sm)',
                              fontWeight: 'var(--weight-medium)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 'var(--space-xs)',
                              cursor: 'pointer',
                              lineHeight: 1,
                            }}
                          >
                            {option.label}
                          </button>
                        )
                      })}
                    </div>
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
                padding: 'var(--space-md) var(--space-page-mobile) calc(var(--space-md) + env(safe-area-inset-bottom, 0px))',
                borderTop: `var(--border-width) solid ${T.borderSubtle}`,
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
                      {editDialog === 'delete' ? 'Delete this entry?' : 'Discard changes?'}
                    </p>
                    {editDialog === 'delete' && (
                      <p style={{
                        margin: 'var(--space-sm) 0 0',
                        fontSize: 'var(--text-sm)',
                        color: T.text2,
                        lineHeight: 1.5,
                      }}>
                        This will remove it from your log.
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
                            onClick={() => pendingDelete.singleEntryId && handleDeleteEntry(pendingDelete.singleEntryId)}
                            disabled={deletingKey === pendingDelete.singleEntryId}
                            style={{
                              background: 'var(--red-dark)',
                              color: T.textInverse,
                            }}
                          >
                            {deletingKey === pendingDelete.singleEntryId ? 'Deleting…' : 'Delete'}
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
                              setPendingDelete(null)
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
          )}

          {deleteStep === 'confirm' && (
            <div>
              <p style={{ fontSize: 14, color: '#475467', margin: '0 0 24px', lineHeight: 1.6 }}>
                This will permanently remove your <strong>{pendingDelete.label}</strong> entry of{' '}
                <strong>{fmt(pendingDelete.loggedAmount, data.currency)}</strong> for this month.
              </p>
              <button
                onClick={() => pendingDelete.singleEntryId && handleDeleteEntry(pendingDelete.singleEntryId)}
                disabled={deletingKey === pendingDelete.singleEntryId}
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
                  opacity: deletingKey === pendingDelete.singleEntryId ? 0.6 : 1,
                }}
              >
                {deletingKey === pendingDelete.singleEntryId ? 'Removing…' : 'Yes, remove it'}
              </button>
              <TertiaryBtn
                size="md"
                onClick={() => setDeleteStep('reason')}
                style={{
                  marginTop: 10,
                  padding: '12px',
                }}
              >
                Go back
              </TertiaryBtn>
            </div>
          )}

          {deleteStep === 'refund' && (
            <div>
              <p style={{ fontSize: 14, color: '#475467', margin: '0 0 20px', lineHeight: 1.6 }}>
                How much was refunded for <strong>{pendingDelete.label}</strong>?
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
                  {data.currency}
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
                onClick={() => setDeleteStep('reason')}
                style={{
                  marginTop: 10,
                  padding: '12px',
                }}
              >
                Go back
              </TertiaryBtn>
            </div>
          )}
        </Sheet>
      )}
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
      <div style={{
        position: 'fixed',
        bottom: 72,
        left: 0,
        right: 0,
        padding: '10px 16px',
        background: T.pageBg,
        borderTop: '1px solid var(--border-subtle)',
        zIndex: 40,
      }}>
        <PrimaryBtn
          size="lg"
          onClick={() => router.push('/log/new?returnTo=/log')}
          style={{
            background: T.brandDark,
            color: T.textInverse,
          }}
        >
          Add expense
        </PrimaryBtn>
      </div>
      <BottomNav />
    </div>
  )
}
