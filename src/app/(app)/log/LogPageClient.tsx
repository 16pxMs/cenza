'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useToast } from '@/lib/context/ToastContext'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { IconBack, IconTrash } from '@/components/ui/Icons'
import { fmt } from '@/lib/finance'
import type { LogPageData, LogSection, LogSubItem } from '@/lib/loaders/log'
import { deleteCurrentCycleCategoryEntries, recordRefund } from './actions'

const T = {
  brandDark: '#5C3489',
  pageBg: '#F8F9FA',
  white: '#FFFFFF',
  border: '#E4E7EC',
  text1: '#101828',
  text3: '#667085',
  textMuted: '#98A2B3',
}

const GOAL_ICONS: Record<string, string> = {
  emergency: '🛡️',
  car: '🚗',
  travel: '✈️',
  home: '🏠',
  education: '🎓',
  business: '💼',
  family: '👨‍👩‍👧',
  other: '🎯',
}

const SECTION_EMPTY: Record<string, string> = {
  fixed: 'No fixed expenses set up for this month.',
  goals: 'No active goals. Add one from the Goals tab.',
  daily: 'No spending categories set up yet.',
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
  const [deleteStep, setDeleteStep] = useState<'reason' | 'confirm' | 'refund'>('reason')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundNote, setRefundNote] = useState('')
  const [savingRefund, setSavingRefund] = useState(false)

  const logItem = (item: LogSubItem) => {
    const params = new URLSearchParams({
      key: item.key,
      label: item.label,
      type: item.groupType,
      ...(item.plannedAmount ? { amount: String(item.plannedAmount) } : {}),
    })
    router.push(`/log/new?${params.toString()}`)
  }

  const logOther = () => {
    router.push('/log/new?isOther=true')
  }

  useEffect(() => {
    if (autoOpened.current) return
    if (searchParams.get('open') !== 'true') return

    autoOpened.current = true
    if (data.isFirstTime) {
      router.push('/log/first')
    } else {
      logOther()
    }
  }, [data.isFirstTime, router, searchParams])

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
    const sortedItems = isAccordion
      ? [...section.items].sort((a, b) => (b.loggedAmount > 0 ? 1 : 0) - (a.loggedAmount > 0 ? 1 : 0))
      : section.items
    const visibleItems = isAccordion && !isOpen ? sortedItems.slice(0, 3) : sortedItems
    const hiddenCount = isAccordion ? sortedItems.length - 3 : 0
    const totalLogged = section.items.reduce((sum, item) => sum + item.loggedAmount, 0)

    return (
      <div key={section.key} style={{ margin: isDesktop ? '0 32px 16px' : '0 16px 16px' }}>
        <div style={{
          background: T.white,
          border: `1px solid var(--border)`,
          borderRadius: 16,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '13px 16px 12px',
            borderBottom: section.items.length > 0 ? '1px solid #F2F4F7' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: T.text3 }}>
                {section.label}
              </p>
              {isAccordion && (
                <span style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: T.textMuted,
                  background: '#F1F3F5',
                  borderRadius: 99,
                  padding: '2px 7px',
                }}>
                  {section.items.length}
                </span>
              )}
            </div>
            {totalLogged > 0 && (
              <span style={{ fontSize: 13, fontWeight: 600, color: T.brandDark }}>
                {fmt(totalLogged, data.currency)}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {section.items.length === 0 && SECTION_EMPTY[section.key] && (
              <p style={{ fontSize: 13, color: T.textMuted, margin: '12px 16px 16px' }}>
                {SECTION_EMPTY[section.key]}
              </p>
            )}

            {visibleItems.map((item, index) => {
              const isLogged = item.loggedAmount > 0
              const isLast = index === visibleItems.length - 1
              const isDeleting = deletingKey === item.key
              const goalIcon = item.groupType === 'goal' ? GOAL_ICONS[item.key] : null

              return (
                <div
                  key={item.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: T.white,
                    borderBottom: isLast ? 'none' : '1px solid #F2F4F7',
                    minHeight: 60,
                  }}
                >
                  <button
                    onClick={() => logItem(item)}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      border: 'none',
                      background: 'transparent',
                      padding: '12px 16px',
                      minHeight: 60,
                      cursor: 'pointer',
                      textAlign: 'left',
                      boxSizing: 'border-box',
                    }}
                  >
                    {goalIcon && (
                      <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        flexShrink: 0,
                        background: '#F3EDFB',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 17,
                      }}>
                        {goalIcon}
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: isLogged ? 500 : 400, color: T.text1, lineHeight: 1.3 }}>
                        {item.label}
                      </div>
                      {item.sublabel && !isLogged && (
                        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 1 }}>
                          {item.sublabel}
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

                  {isLogged && (
                    <button
                      onClick={() => { setPendingDelete(item); setDeleteStep('reason') }}
                      disabled={isDeleting}
                      style={{
                        width: 44,
                        height: 60,
                        flexShrink: 0,
                        background: 'transparent',
                        border: 'none',
                        borderLeft: '1px solid #F2F4F7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        opacity: isDeleting ? 0.4 : 1,
                      }}
                    >
                      <IconTrash size={14} color="#C8CCCF" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {isAccordion && (
            <button
              onClick={() => setExpanded(prev => {
                const next = new Set(prev)
                next.has(section.key) ? next.delete(section.key) : next.add(section.key)
                return next
              })}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                padding: '12px 16px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                color: T.brandDark,
                textAlign: 'left',
              }}
            >
              {isOpen ? 'Show less' : `View ${hiddenCount} more`}
            </button>
          )}

          {!isAccordion && section.items.length > 0 && <div style={{ height: 4 }} />}
        </div>
      </div>
    )
  }

  const content = (
    <div style={{ paddingBottom: isDesktop ? 80 : 144, paddingTop: 4 }}>
      <div style={{ padding: isDesktop ? '32px 32px 20px' : '20px 16px 16px' }}>
        <button
          onClick={() => router.push('/app')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 12px', display: 'flex', alignItems: 'center' }}
        >
          <IconBack size={18} color={T.text3} />
        </button>
        <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 500, color: T.textMuted }}>
          {data.cycleLabel}
        </p>
        <h1 style={{ fontSize: isDesktop ? 28 : 26, fontWeight: 700, color: T.text1, margin: 0, letterSpacing: -0.5 }}>
          Add an expense
        </h1>
      </div>

      {data.sections.map(renderSection)}

      {isDesktop && (
        <div style={{ padding: '0 32px' }}>
          <button
            onClick={() => data.isFirstTime ? router.push('/log/first') : logOther()}
            style={{
              width: '100%',
              height: 50,
              background: T.brandDark,
              border: 'none',
              borderRadius: 14,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              color: '#fff',
            }}
          >
            Add an expense
          </button>
        </div>
      )}

      {pendingDelete && (
        <Sheet
          open={true}
          onClose={() => setPendingDelete(null)}
          title={deleteStep === 'reason' ? 'Why are you removing this?' : deleteStep === 'refund' ? 'Log a refund' : 'Are you sure?'}
        >
          {deleteStep === 'reason' && (
            <div>
              <p style={{ fontSize: 14, color: '#475467', margin: '0 0 20px', lineHeight: 1.6 }}>
                You logged <strong>{fmt(pendingDelete.loggedAmount, data.currency)}</strong> for{' '}
                <strong>{pendingDelete.label}</strong> this month.
              </p>
              {[
                {
                  label: '✏️ I logged the wrong amount',
                  sub: 'Correct it right here',
                  action: () => { setPendingDelete(null); logItem(pendingDelete) },
                },
                {
                  label: '💸 I got a refund',
                  sub: 'Log it here so your totals stay honest',
                  action: () => { setRefundAmount(''); setRefundNote(''); setDeleteStep('refund') },
                },
                {
                  label: '🚫 This never happened',
                  sub: 'Remove it entirely',
                  action: () => setDeleteStep('confirm'),
                },
              ].map(option => (
                <button
                  key={option.label}
                  onClick={option.action}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '14px 16px',
                    background: T.white,
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    cursor: 'pointer',
                    marginBottom: 10,
                    display: 'block',
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 600, color: T.text1 }}>{option.label}</div>
                  <div style={{ fontSize: 12, color: T.text3, marginTop: 3 }}>{option.sub}</div>
                </button>
              ))}
              <button
                onClick={() => setPendingDelete(null)}
                style={{
                  marginTop: 4,
                  width: '100%',
                  padding: '12px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  color: T.textMuted,
                }}
              >
                Cancel
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
                  color: '#fff',
                  opacity: deletingKey === pendingDelete.key ? 0.6 : 1,
                }}
              >
                {deletingKey === pendingDelete.key ? 'Removing…' : 'Yes, remove it'}
              </button>
              <button
                onClick={() => setDeleteStep('reason')}
                style={{
                  marginTop: 10,
                  width: '100%',
                  padding: '12px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  color: T.text3,
                }}
              >
                Go back
              </button>
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
              <button
                onClick={handleSaveRefund}
                disabled={!refundAmount || parseFloat(refundAmount) <= 0 || savingRefund}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: 14,
                  background: refundAmount && parseFloat(refundAmount) > 0 ? T.brandDark : T.border,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 15,
                  fontWeight: 600,
                  color: refundAmount && parseFloat(refundAmount) > 0 ? '#fff' : T.textMuted,
                }}
              >
                {savingRefund ? 'Saving…' : 'Log refund'}
              </button>
              <button
                onClick={() => setDeleteStep('reason')}
                style={{
                  marginTop: 10,
                  width: '100%',
                  padding: '12px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  color: T.text3,
                }}
              >
                Go back
              </button>
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
        <button
          onClick={() => data.isFirstTime ? router.push('/log/first') : logOther()}
          style={{
            width: '100%',
            height: 50,
            background: T.brandDark,
            border: 'none',
            borderRadius: 14,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            color: '#fff',
          }}
        >
          Add an expense
        </button>
      </div>
      <BottomNav />
    </div>
  )
}
