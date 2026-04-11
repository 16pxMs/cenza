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
import { IconBack, IconMinus } from '@/components/ui/Icons'
import { fmt } from '@/lib/finance'
import type { LogPageData, LogSection, LogSubItem } from '@/lib/loaders/log'
import { deleteCurrentCycleCategoryEntries, recordRefund, updateLogEntry } from './actions'

const T = {
  brandDark: 'var(--brand-dark)',
  pageBg: 'var(--page-bg)',
  white: 'var(--white)',
  border: 'var(--border)',
  borderSubtle: 'var(--border-subtle)',
  text1: 'var(--text-1)',
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

const SECTION_EMPTY: Record<string, string> = {
  fixed: 'No essential expenses logged this month.',
  daily: 'No life expenses logged this month.',
  debts: 'No debt payments logged this month.',
  other: '',
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
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

  const visibleSections = data.sections.filter((section) => !(section.items.length === 0 && (section.key === 'daily' || section.key === 'debts')))
  const totalLogged = visibleSections.reduce(
    (sum, section) => sum + section.items.reduce((sectionSum, item) => sectionSum + item.loggedAmount, 0),
    0,
  )
  const totalEntries = visibleSections.reduce((sum, section) => sum + section.items.filter((item) => item.loggedAmount > 0).length, 0)

  const logItem = (item: LogSubItem) => {
    const params = new URLSearchParams({
      key: item.key,
      label: item.label,
      type: item.groupType,
      returnTo: '/log',
      ...(item.plannedAmount ? { amount: String(item.plannedAmount) } : {}),
    })
    router.push(`/log/new?${params.toString()}`)
  }

  const reviewItemEntries = (item: LogSubItem) => {
    const params = new URLSearchParams({
      label: item.label,
      type: item.groupType,
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

  const handleDeleteCategory = async (key: string) => {
    setDeletingKey(key)
    try {
      await deleteCurrentCycleCategoryEntries(key)
      toast('Entry removed')
      setPendingDelete(null)
      router.refresh()
    } catch {
      toast('Could not remove entry')
    } finally {
      setDeletingKey(null)
    }
  }

  const renderSection = (section: LogSection) => {
    if (section.items.length === 0 && (section.key === 'daily' || section.key === 'debts')) return null

    const isAccordion = section.items.length >= 4
    const isOpen = expanded.has(section.key)
    const sortByAmountThenLabel = (a: LogSubItem, b: LogSubItem) => {
      const aHasLogged = a.loggedAmount > 0 ? 1 : 0
      const bHasLogged = b.loggedAmount > 0 ? 1 : 0

      if (aHasLogged !== bHasLogged) return bHasLogged - aHasLogged
      if (a.loggedAmount !== b.loggedAmount) return b.loggedAmount - a.loggedAmount

      return a.label.localeCompare(b.label)
    }

    const groupedItems = section.items
      .filter((item) => (item.entryCount ?? 0) > 1)
      .sort(sortByAmountThenLabel)
    const singleItems = section.items
      .filter((item) => (item.entryCount ?? 0) <= 1)
      .sort(sortByAmountThenLabel)
    const orderedItems = [...groupedItems, ...singleItems]
    const visibleItems = isAccordion && !isOpen ? orderedItems.slice(0, 3) : orderedItems
    const visibleGroupedItems = visibleItems.filter((item) => (item.entryCount ?? 0) > 1)
    const visibleSingleItems = visibleItems.filter((item) => (item.entryCount ?? 0) <= 1)
    const totalLogged = section.items.reduce((sum, item) => sum + item.loggedAmount, 0)

    const renderRow = (item: LogSubItem) => {
      const isLogged = item.loggedAmount > 0
      const isDeleting = deletingKey === item.key
      const isGroup = (item.entryCount ?? 0) > 1
      const canManageInline = isLogged && !isGroup
      const secondaryText = isGroup
        ? `${item.entryCount} entries`
        : item.sublabel && !isLogged
          ? item.sublabel
          : null

      return (
        <div
          key={item.key}
          style={{
            display: 'flex',
            alignItems: 'center',
            background: T.white,
            minHeight: 60,
            gap: 12,
          }}
        >
          {isGroup && (
            <div
              aria-hidden
              style={{
                minWidth: 44,
                height: 28,
                padding: '0 10px',
                borderRadius: 999,
                background: 'var(--grey-100)',
                color: T.textMuted,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {item.entryCount}
            </div>
          )}

          {canManageInline && (
            <button
              onClick={() => { setPendingDelete(item); setDeleteStep('reason') }}
              disabled={isDeleting}
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                background: 'var(--grey-100)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                opacity: isDeleting ? 0.4 : 1,
                padding: 0,
                flexShrink: 0,
                marginLeft: 0,
              }}
            >
              <IconMinus size={14} color={T.textMuted} />
            </button>
          )}

          <button
            onClick={() => isLogged ? reviewItemEntries(item) : logItem(item)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              border: 'none',
              background: 'transparent',
              padding: '12px 0',
              minHeight: 60,
              cursor: 'pointer',
              textAlign: 'left',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: T.text1, lineHeight: 1.3 }}>
                {item.label}
              </div>
              {secondaryText && (
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
                  {secondaryText}
                </div>
              )}
            </div>

            {isLogged ? (
              <span style={{ fontSize: 15, fontWeight: 600, color: T.text1, flexShrink: 0, marginLeft: 8 }}>
                {fmt(item.loggedAmount, data.currency)}
              </span>
            ) : (
              <span style={{ fontSize: 20, color: T.textMuted, flexShrink: 0, lineHeight: 1, marginLeft: 8, opacity: 0.4 }}>
                ›
              </span>
            )}
          </button>
        </div>
      )
    }

    return (
      <section
        key={section.key}
        style={{
          padding: isDesktop ? '20px 24px 0' : '18px 16px 0',
        }}
      >
        <div style={{
          padding: 0,
          paddingBottom: section.items.length > 0 ? 10 : 0,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
            <span style={{ margin: 0, fontSize: 16, fontWeight: 600, color: T.text1, lineHeight: 1.3 }}>
              {section.label}
            </span>
            {totalLogged > 0 && (
              <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: T.text3, lineHeight: 1.4 }}>
                {fmt(totalLogged, data.currency)} total
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {section.items.length === 0 && SECTION_EMPTY[section.key] && (
            <p style={{ fontSize: 13, color: T.textMuted, margin: '12px 0 16px' }}>
              {SECTION_EMPTY[section.key]}
            </p>
          )}

          {visibleGroupedItems.length > 0 && (
            <div>
              <div
                style={{
                  padding: '6px 0 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: T.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Grouped entries
              </div>
              {visibleGroupedItems.map(renderRow)}
            </div>
          )}

          {visibleSingleItems.length > 0 && (
            <div>
              {visibleGroupedItems.length > 0 && (
                <div
                  style={{
                    padding: '18px 0 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: T.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Single entries
                </div>
              )}
              {visibleSingleItems.map(renderRow)}
            </div>
          )}
        </div>

        {isAccordion && (
          <TertiaryBtn
            size="sm"
            onClick={() => setExpanded(prev => {
              const next = new Set(prev)
              next.has(section.key) ? next.delete(section.key) : next.add(section.key)
              return next
            })}
            style={{
              padding: '18px 0 18px',
              color: T.brandDark,
              textAlign: 'left',
            }}
          >
            {isOpen ? 'Show less' : `Show all ${orderedItems.length}`}
          </TertiaryBtn>
        )}

        {!isAccordion && section.items.length > 0 && <div style={{ height: 2 }} />}
      </section>
    )
  }

  const content = (
    <div style={{ paddingBottom: isDesktop ? 80 : 144, paddingTop: 4 }}>
      <div style={{ padding: isDesktop ? '32px 32px 20px' : '20px 16px 16px' }}>
        <button
          onClick={() => router.push('/app')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            width: 44,
            height: 44,
            padding: 0,
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconBack size={18} color="var(--grey-900)" />
        </button>
        <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 500, color: T.textMuted }}>
          {data.cycleLabel}
        </p>
        <h1 style={{ fontSize: isDesktop ? 24 : 22, fontWeight: 650, color: T.text1, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
          Expense log
        </h1>
      </div>

      <div style={{ margin: isDesktop ? '0 32px 20px' : '0 16px 16px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 16,
          padding: isDesktop ? '0 0 16px' : '0 0 12px',
        }}>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Logged total
            </p>
            <p style={{ margin: 0, fontSize: 14, color: T.text3, lineHeight: 1.35 }}>
              {totalEntries} {totalEntries === 1 ? 'expense' : 'expenses'} logged
            </p>
          </div>
          <p style={{ margin: 0, fontSize: isDesktop ? 22 : 20, fontWeight: 650, color: T.text1, letterSpacing: '-0.02em', lineHeight: 1, textAlign: 'right', minWidth: 0 }}>
            {fmt(totalLogged, data.currency)}
          </p>
        </div>

        <div style={{
          background: T.white,
          borderRadius: 20,
          overflow: 'hidden',
        }}>
          {visibleSections.map((section, index) => {
            const sectionNode = renderSection(section)
            if (!sectionNode) return null

            return (
              <div
                key={section.key}
                style={{
                  borderTop: index === 0 ? 'none' : `1px solid ${T.borderSubtle}`,
                }}
              >
                {sectionNode}
              </div>
            )
          })}
        </div>
      </div>

      {isDesktop && (
        <div style={{ padding: '0 32px' }}>
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
              ? 'What happened?'
              : deleteStep === 'refund'
                ? 'Log a refund'
                : deleteStep === 'edit'
                  ? 'Edit expense'
                  : 'Are you sure?'
          }
        >
          {deleteStep === 'reason' && (
            <div>
              <p style={{ fontSize: 14, color: T.text3, margin: '0 0 20px', lineHeight: 1.6 }}>
                {pendingDelete.label} · {fmt(pendingDelete.loggedAmount, data.currency)} · {data.cycleLabel}
                {pendingDelete.latestLoggedDate ? ` · logged ${formatEntryDate(pendingDelete.latestLoggedDate)}` : ''}
              </p>

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
                onClick={() => handleDeleteCategory(pendingDelete.key)}
                disabled={deletingKey === pendingDelete.key}
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
                  opacity: deletingKey === pendingDelete.key ? 0.6 : 1,
                }}
              >
                {deletingKey === pendingDelete.key ? 'Removing…' : 'Yes, remove it'}
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
