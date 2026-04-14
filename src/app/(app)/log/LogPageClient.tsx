'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useToast } from '@/lib/context/ToastContext'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { PrimaryBtn, TertiaryBtn } from '@/components/ui/Button/Button'
import { IconBack } from '@/components/ui/Icons'
import { fmt } from '@/lib/finance'
import type { LogEntry, LogPageData, LogSubItem } from '@/lib/loaders/log'
import { deleteLogEntry, recordRefund, updateLogEntry } from './actions'

const CATEGORY_LABEL: Record<string, string> = {
  everyday: 'Life',
  fixed: 'Essentials',
  debt: 'Debt',
}

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
  const [deleteStep, setDeleteStep] = useState<'reason' | 'confirm' | 'refund' | 'edit'>('reason')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundNote, setRefundNote] = useState('')
  const [savingRefund, setSavingRefund] = useState(false)
  const [editAmount, setEditAmount] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editLabel, setEditLabel] = useState('')
  const [editIsSmsMeta, setEditIsSmsMeta] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
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
    fixed: 'No essentials logged yet',
    debt: 'No debt entries yet',
  }

  const FILTER_OPTIONS: Array<{ value: typeof filter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'everyday', label: 'Life' },
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
    setEditIsSmsMeta((item.singleEntryNote ?? '').trim().toLowerCase() === 'imported from sms')
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
    const amount = parseFloat(editAmount)
    if (!amount || amount <= 0 || !editDate) return

    setSavingEdit(true)
    try {
      await updateLogEntry({
        id: pendingDelete.singleEntryId,
        amount,
        date: editDate,
        note: editNote,
        label: editLabel,
        categoryKey: pendingDelete.key,
      })
      toast('Entry updated')
      setPendingDelete(null)
      setEditAmount('')
      setEditDate('')
      setEditNote('')
      setEditLabel('')
      setEditIsSmsMeta(false)
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
      setPendingDelete(null)
      router.refresh()
    } catch {
      toast('Could not remove entry')
    } finally {
      setDeletingKey(null)
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
          onClose={() => setPendingDelete(null)}
          title={
            deleteStep === 'reason'
              ? ''
              : deleteStep === 'refund'
                ? 'Log a refund'
                : deleteStep === 'edit'
                  ? 'Edit expense'
                  : 'Are you sure?'
          }
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
                  fontSize: 'var(--text-sm)',
                  color: T.text3,
                  marginTop: 'var(--space-sm)',
                  lineHeight: 1.3,
                }}>
                  {CATEGORY_LABEL[pendingDelete.groupType] ?? 'Other'}
                  {pendingDelete.latestLoggedDate ? ` · ${formatEntryDate(pendingDelete.latestLoggedDate)}` : ''}
                </div>
              </div>

              <div style={{
                background: T.white,
                border: `1px solid ${T.border}`,
                borderRadius: 18,
                overflow: 'hidden',
              }}>
                {[
                {
                  label: pendingDelete.entryCount && pendingDelete.entryCount > 1 ? 'Review entries' : 'Edit this expense',
                  sub: pendingDelete.entryCount && pendingDelete.entryCount > 1
                    ? 'Edit amount, date, or note'
                    : 'Edit amount, date, or note',
                  action: () => {
                    if ((pendingDelete.entryCount ?? 0) <= 1 && pendingDelete.singleEntryId) {
                      openDirectEdit(pendingDelete)
                    } else {
                      setPendingDelete(null)
                      reviewItemEntries(pendingDelete)
                    }
                  },
                },
                {
                  label: 'Refund',
                  sub: 'Log money returned to you',
                  action: () => { setRefundAmount(''); setRefundNote(''); setDeleteStep('refund') },
                },
                {
                  label: "Didn't happen",
                  sub: 'Remove this expense',
                  action: () => setDeleteStep('confirm'),
                },
                ].map((option, index, options) => (
                  <button
                    key={option.label}
                    onClick={option.action}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '14px 16px',
                      background: T.white,
                      border: 'none',
                      borderBottom: index < options.length - 1 ? `1px solid ${T.borderSubtle}` : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: T.text1 }}>{option.label}</div>
                      <div style={{ fontSize: 12, color: T.text3, marginTop: 3 }}>{option.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {deleteStep === 'edit' && pendingDelete && (
            <div>
              <p style={{ fontSize: 14, color: T.text3, margin: '0 0 20px', lineHeight: 1.6 }}>
                {pendingDelete.label} · {data.cycleLabel}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  type="text"
                  value={editLabel}
                  onChange={event => setEditLabel(event.target.value)}
                  placeholder="Expense name"
                  style={{
                    height: 40,
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    padding: '0 12px',
                    fontSize: 13,
                    color: T.text1,
                    background: T.white,
                    outline: 'none',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={(() => {
                    if (!editAmount) return ''
                    const parts = editAmount.split('.')
                    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                    return parts.join('.')
                  })()}
                  onChange={event => {
                    const value = event.target.value.replace(/,/g, '').replace(/[^0-9.]/g, '')
                    const parts = value.split('.')
                    if (parts.length > 2 || (parts[1] && parts[1].length > 2)) return
                    setEditAmount(value)
                  }}
                  placeholder="Amount"
                  style={{
                    height: 44,
                    borderRadius: 10,
                    border: '2px solid var(--border-focus)',
                    padding: '0 12px',
                    fontSize: 16,
                    fontWeight: 600,
                    color: T.text1,
                    background: T.white,
                    outline: 'none',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                />
                <input
                  type="date"
                  value={editDate}
                  onChange={event => setEditDate(event.target.value)}
                  style={{
                    height: 40,
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    padding: '0 12px',
                    fontSize: 13,
                    color: T.text1,
                    background: T.white,
                    outline: 'none',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                />
                {editIsSmsMeta ? (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span
                      style={{
                        height: 28,
                        borderRadius: 999,
                        border: `1px solid ${T.border}`,
                        background: 'var(--grey-100)',
                        color: T.text3,
                        padding: '0 10px',
                        fontSize: 11,
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Imported from SMS
                    </span>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={editNote}
                    onChange={event => setEditNote(event.target.value)}
                    placeholder="Note (optional)"
                    style={{
                      height: 40,
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      padding: '0 12px',
                      fontSize: 13,
                      color: T.text1,
                      background: T.white,
                      outline: 'none',
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  />
                )}
              </div>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit || parseFloat(editAmount) <= 0 || !editDate || editLabel.trim().length === 0}
                style={{
                  width: '100%',
                  marginTop: 14,
                  padding: '14px',
                  borderRadius: 14,
                  background: savingEdit ? T.border : T.brandDark,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 15,
                  fontWeight: 600,
                  color: T.textInverse,
                }}
              >
                {savingEdit ? 'Saving…' : 'Save changes'}
              </button>
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
