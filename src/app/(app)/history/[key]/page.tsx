'use client'
export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// /history/[key] — Category ledger
//
// Chronological list of every entry for one category in the
// current month. Edit amount/note inline; delete with confirm.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/context/UserContext'
import { useToast } from '@/lib/context/ToastContext'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { IconBack } from '@/components/ui/Icons'
import { fmt, formatDate } from '@/lib/finance'

const T = {
  brandDark:    '#5C3489',
  pageBg:       '#F8F9FA',
  white:        '#FFFFFF',
  border:       '#E4E7EC',
  borderStrong: '#D0D5DD',
  text1:        '#101828',
  text2:        '#475467',
  text3:        '#667085',
  textMuted:    '#98A2B3',
}

interface Transaction {
  id:     string
  date:   string
  amount: number
  note:   string | null
}

function LedgerInner() {
  const router        = useRouter()
  const params        = useParams()
  const searchParams  = useSearchParams()
  const supabase      = createClient()
  const { user, profile: ctxProfile } = useUser()
  const { isDesktop } = useBreakpoint()

  const categoryKey   = params.key as string
  const categoryLabel = searchParams.get('label') ?? categoryKey
  const planned       = Number(searchParams.get('planned') ?? 0)
  const currentMonth  = new Date().toISOString().slice(0, 7)

  const { toast } = useToast()

  const [loading, setLoading]       = useState(true)
  const [currency, setCurrency]     = useState('')
  const [txns, setTxns]             = useState<Transaction[]>([])
  const [totalSpent, setTotalSpent] = useState(0)

  // Edit state
  const [editId, setEditId]         = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editNote, setEditNote]     = useState('')
  const [saving, setSaving]         = useState(false)

  // Delete state
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null)
  const [deleteStep, setDeleteStep]       = useState<'reason' | 'confirm'>('reason')
  const [deleting, setDeleting]           = useState(false)

  // Refund state
  const [showRefundForm, setShowRefundForm] = useState(false)
  const [refundAmount, setRefundAmount]     = useState('')
  const [refundNote, setRefundNote]         = useState('')
  const [savingRefund, setSavingRefund]     = useState(false)

  const amountRef  = useRef<HTMLInputElement>(null)
  const refundRef  = useRef<HTMLInputElement>(null)

  const loadData = useCallback(async () => {
    if (!user) return

    const txnRes = await (supabase.from('transactions') as any)
      .select('id, date, amount, note')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('category_key', categoryKey)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    setCurrency(ctxProfile?.currency ?? '')
    const rows: Transaction[] = (txnRes.data ?? []).map((r: any) => ({ ...r, amount: Number(r.amount) }))
    setTxns(rows)
    setTotalSpent(rows.reduce((s, t) => s + t.amount, 0))
    setLoading(false)
  }, [supabase, currentMonth, categoryKey, user, ctxProfile])

  useEffect(() => { if (user) loadData() }, [loadData, user])

  const openEdit = (txn: Transaction) => {
    setEditId(txn.id)
    setEditAmount(String(txn.amount))
    setEditNote(txn.note ?? '')
    setTimeout(() => amountRef.current?.focus(), 80)
  }

  const handleSave = async () => {
    const amt = parseFloat(editAmount) || 0
    if (!editId || amt <= 0) return
    setSaving(true)
    if (!user) { setSaving(false); return }
    await (supabase.from('transactions') as any)
      .update({ amount: amt, note: editNote || null })
      .eq('id', editId).eq('user_id', user.id)
    toast('Entry updated')
    setSaving(false)
    setEditId(null)
    loadData()
    router.refresh()
  }

  const handleDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    if (!user) { setDeleting(false); return }
    await (supabase.from('transactions') as any)
      .delete().eq('id', pendingDelete.id).eq('user_id', user.id)
    toast('Entry deleted')
    setDeleting(false)
    setPendingDelete(null)
    loadData()
    router.refresh()
  }

  const handleRefund = async () => {
    const amt = parseFloat(refundAmount) || 0
    if (amt <= 0) return
    setSavingRefund(true)
    if (!user) { setSavingRefund(false); return }
    const categoryType = searchParams.get('type') ?? 'variable'
    await (supabase.from('transactions') as any).insert({
      user_id:        user.id,
      date:           new Date().toISOString().slice(0, 10),
      month:          currentMonth,
      category_type:  categoryType,
      category_key:   categoryKey,
      category_label: categoryLabel,
      amount:         -amt,
      note:           refundNote.trim() || 'Refund',
    })
    toast('Refund recorded')
    setSavingRefund(false)
    setShowRefundForm(false)
    setRefundAmount('')
    setRefundNote('')
    loadData()
    router.refresh()
  }

  const categoryType = searchParams.get('type') ?? 'variable'
  const overBudget   = planned > 0 && totalSpent > planned
  const pct          = planned > 0 ? Math.min(100, (totalSpent / planned) * 100) : 0
  const barColor     = overBudget
    ? '#EF4444'
    : categoryType === 'fixed'
    ? '#22C55E'
    : categoryType === 'goal'
    ? '#5C3489'
    : pct > 75 ? '#F59E0B' : '#22C55E'
  const spendCount  = txns.filter(t => t.amount > 0).length
  const pad         = isDesktop ? '0 32px' : '0 16px'

  // Group transactions by date, newest date first
  const dateGroups = txns.reduce<Record<string, Transaction[]>>((acc, txn) => {
    if (!acc[txn.date]) acc[txn.date] = []
    acc[txn.date].push(txn)
    return acc
  }, {})
  const sortedDates = Object.keys(dateGroups).sort((a, b) => b.localeCompare(a))

  const content = (
    <div style={{ paddingBottom: isDesktop ? 80 : 100 }}>

      {/* Header */}
      <div style={{ padding: isDesktop ? '32px 32px 20px' : '20px 16px 20px' }}>
        <button
          onClick={() => router.push('/history')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 16px', display: 'flex', alignItems: 'center' }}
        >
          <IconBack size={18} color={T.text3} />
        </button>
        <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>
        <h1 style={{ margin: 0, fontSize: isDesktop ? 26 : 22, color: T.text1 }}>
          {categoryLabel}
        </h1>
      </div>

      {/* Summary card — includes refund button/form */}
      <div style={{ padding: pad, marginBottom: 24 }}>
        <div style={{
          background: T.white, borderRadius: 20,
          boxShadow: '0 1px 10px rgba(0,0,0,0.07)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '22px 20px' }}>
            {/* Spent + budget side by side, balanced */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Spent
                </p>
                <p style={{ margin: 0, fontSize: 32, fontWeight: 700, color: overBudget ? '#EF4444' : T.text1, lineHeight: 1, letterSpacing: -1 }}>
                  {fmt(totalSpent, currency)}
                </p>
              </div>
              {planned > 0 && (
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    Budget
                  </p>
                  <p style={{ margin: 0, fontSize: 18, fontWeight: 600, color: T.text3 }}>
                    {fmt(planned, currency)}
                  </p>
                </div>
              )}
            </div>

            {/* Progress bar — correct color semantics */}
            {planned > 0 && (
              <div style={{ height: 5, background: '#EBEBED', borderRadius: 99, overflow: 'hidden', marginBottom: 10 }}>
                <div style={{
                  height: '100%', borderRadius: 99, width: `${pct}%`,
                  background: barColor, transition: 'width 0.4s ease',
                }} />
              </div>
            )}

            {/* Status line */}
            <p style={{ margin: 0, fontSize: 12, color: T.text3 }}>
              {overBudget
                ? `${fmt(totalSpent - planned, currency)} over budget`
                : planned > 0 && pct === 100
                  ? `Exactly on budget · ${spendCount} ${spendCount === 1 ? 'entry' : 'entries'}`
                  : planned > 0
                    ? `${fmt(planned - totalSpent, currency)} remaining · ${spendCount} ${spendCount === 1 ? 'entry' : 'entries'}`
                    : `${spendCount} ${spendCount === 1 ? 'entry' : 'entries'} this month`}
            </p>
          </div>

          {/* Refund button */}
          {!showRefundForm && spendCount > 0 && (
            <button
              onClick={() => { setShowRefundForm(true); setTimeout(() => refundRef.current?.focus(), 80) }}
              style={{
                width: '100%', padding: '13px',
                background: 'none', border: 'none',
                borderTop: `1px solid #F0F0F0`,
                cursor: 'pointer',
                fontSize: 13, fontWeight: 500, color: T.text3,
                letterSpacing: '0.01em',
              }}
            >
              + Log a refund
            </button>
          )}

          {/* Refund form — expands inside the card */}
          {showRefundForm && (
            <>
              <div style={{ padding: '14px 20px', borderTop: `1px solid var(--border-subtle)`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  ref={refundRef}
                  type="text" inputMode="decimal"
                  value={(() => {
                    if (!refundAmount) return ''
                    const parts = refundAmount.split('.')
                    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                    return parts.join('.')
                  })()}
                  onChange={e => {
                    const val = e.target.value.replace(/,/g, '').replace(/[^0-9.]/g, '')
                    const parts = val.split('.')
                    if (parts.length > 2 || (parts[1] && parts[1].length > 2)) return
                    setRefundAmount(val)
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') handleRefund() }}
                  placeholder="Refund amount"
                  style={{
                    width: '100%', height: 44, borderRadius: 10,
                    border: `1px solid var(--border-strong)`, padding: '0 12px',
                    fontSize: 16, fontWeight: 600, color: T.text1,
                    background: T.white,
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
                <input
                  type="text" value={refundNote}
                  onChange={e => setRefundNote(e.target.value)}
                  placeholder="Note (optional)"
                  style={{
                    width: '100%', height: 40, borderRadius: 10,
                    border: `1px solid var(--border)`, padding: '0 12px',
                    fontSize: 13, color: T.text1, background: T.white, outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ display: 'flex', borderTop: `1px solid var(--border-subtle)` }}>
                <button
                  onClick={() => { setShowRefundForm(false); setRefundAmount(''); setRefundNote('') }}
                  style={{
                    flex: 1, height: 44, background: 'transparent',
                    border: 'none', borderRight: `1px solid var(--border-subtle)`,
                    fontSize: 13, fontWeight: 500, color: T.text3, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRefund}
                  disabled={savingRefund || parseFloat(refundAmount) <= 0}
                  style={{
                    flex: 1, height: 44, background: 'transparent', border: 'none',
                    fontSize: 13, fontWeight: 600,
                    color: parseFloat(refundAmount) > 0 ? '#1A7A45' : T.textMuted, cursor: 'pointer',
                  }}
                >
                  {savingRefund ? 'Saving…' : 'Save refund'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Entry list — grouped by date */}
      <div style={{ padding: pad }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: T.textMuted, fontSize: 14 }}>
            Loading…
          </div>
        ) : txns.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '48px 24px',
            background: T.white, border: `1px solid var(--border)`, borderRadius: 16,
          }}>
            <div style={{ fontSize: 13, color: T.textMuted }}>
              No entries logged yet this month.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {sortedDates.map(date => (
              <div key={date}>
                {/* Date label */}
                <div style={{
                  fontSize: 11, fontWeight: 600, color: T.textMuted, marginBottom: 8,
                  textTransform: 'uppercase', letterSpacing: '0.07em',
                }}>
                  {formatDate(date)}
                </div>

                {/* Cards for this date */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {dateGroups[date].map(txn => {
                    const isEditing = editId === txn.id
                    const isRefund  = txn.amount < 0
                    const hasNote   = !!(txn.note && txn.note !== 'Refund')
                    return (
                      <div
                        key={txn.id}
                        style={{
                          background: isRefund ? '#F0FDF4' : T.white,
                          border: isRefund ? `1px solid #BBF7D0` : `1px solid var(--border)`,
                          borderRadius: 14, overflow: 'hidden',
                        }}
                      >
                        {/* Main row */}
                        <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 17, fontWeight: 600, color: isRefund ? '#1A7A45' : T.text1, marginBottom: hasNote ? 3 : 0 }}>
                              {isRefund ? `−${fmt(Math.abs(txn.amount), currency)}` : fmt(txn.amount, currency)}
                            </div>
                            {isRefund && !hasNote && (
                              <span style={{
                                fontSize: 10, fontWeight: 600, color: '#1A7A45',
                                background: '#DCFCE7', borderRadius: 4, padding: '2px 6px',
                                textTransform: 'uppercase', letterSpacing: '0.06em',
                                display: 'inline-block',
                              }}>
                                Refund
                              </span>
                            )}
                            {hasNote && (
                              <div style={{ fontSize: 13, color: isRefund ? '#166534' : T.text3 }}>
                                {txn.note}
                              </div>
                            )}
                          </div>

                          {/* Actions — Edit prominent, Delete subtle */}
                          {!isRefund && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                              <button
                                onClick={() => isEditing ? setEditId(null) : openEdit(txn)}
                                style={{
                                  height: 32, padding: '0 14px',
                                  background: isEditing ? '#EADFF4' : '#F1F3F5',
                                  border: 'none', borderRadius: 8,
                                  fontSize: 12, fontWeight: 500,
                                  color: isEditing ? T.brandDark : T.text2,
                                  cursor: 'pointer',
                                }}
                              >
                                {isEditing ? 'Cancel' : 'Edit'}
                              </button>
                              {!isEditing && (
                                <button
                                  onClick={() => { setDeleteStep('reason'); setPendingDelete(txn) }}
                                  style={{
                                    background: 'none', border: 'none', padding: 0,
                                    fontSize: 12, fontWeight: 400, color: T.textMuted,
                                    cursor: 'pointer', textDecoration: 'none',
                                  }}
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Inline edit form */}
                        {isEditing && (
                          <div style={{ padding: '12px 16px', borderTop: `1px solid var(--border-subtle)`, display: 'flex', flexDirection: 'column', gap: 8, background: '#FAFAFA' }}>
                            <input
                              ref={amountRef}
                              type="text" inputMode="decimal"
                              value={(() => {
                                if (!editAmount) return ''
                                const parts = editAmount.split('.')
                                parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                                return parts.join('.')
                              })()}
                              onChange={e => {
                                const val = e.target.value.replace(/,/g, '').replace(/[^0-9.]/g, '')
                                const parts = val.split('.')
                                if (parts.length > 2 || (parts[1] && parts[1].length > 2)) return
                                setEditAmount(val)
                              }}
                              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
                              style={{
                                height: 44, borderRadius: 10, border: `2px solid var(--border-focus)`,
                                padding: '0 12px', fontSize: 16, fontWeight: 600,
                                color: T.text1, background: T.white, outline: 'none',
                                width: '100%', boxSizing: 'border-box',
                              }}
                            />
                            <input
                              type="text" value={editNote}
                              onChange={e => setEditNote(e.target.value)}
                              placeholder="Note (optional)"
                              style={{
                                height: 40, borderRadius: 10, border: `1px solid var(--border)`,
                                padding: '0 12px', fontSize: 13,
                                color: T.text1, background: T.white, outline: 'none',
                                width: '100%', boxSizing: 'border-box',
                              }}
                            />
                            <button
                              onClick={handleSave}
                              disabled={saving || parseFloat(editAmount) <= 0}
                              style={{
                                height: 42, borderRadius: 10,
                                background: saving ? T.border : T.brandDark,
                                border: 'none', color: '#fff',
                                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                              }}
                            >
                              {saving ? 'Saving…' : 'Save changes'}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete sheet — reason picker + confirm */}
      {pendingDelete && (
        <Sheet
          open={true}
          onClose={() => setPendingDelete(null)}
          title={deleteStep === 'reason' ? 'Why are you removing this?' : 'Are you sure?'}
        >
          {deleteStep === 'reason' && (
            <div>
              <p style={{ fontSize: 14, color: T.text2, margin: '0 0 20px', lineHeight: 1.6 }}>
                You logged <strong>{fmt(pendingDelete.amount, currency)}</strong> on{' '}
                <strong>{formatDate(pendingDelete.date)}</strong>.
              </p>
              {[
                {
                  label: '✏️ I logged the wrong amount',
                  sub:   'Correct it right here',
                  action: () => { setPendingDelete(null); openEdit(pendingDelete) },
                },
                {
                  label: '💸 I got a refund',
                  sub:   'Log it so your totals stay honest',
                  action: () => { setPendingDelete(null); setShowRefundForm(true); setTimeout(() => refundRef.current?.focus(), 80) },
                },
                {
                  label: '🚫 This never happened',
                  sub:   'Remove it entirely',
                  action: () => setDeleteStep('confirm'),
                },
              ].map(opt => (
                <button
                  key={opt.label}
                  onClick={opt.action}
                  style={{
                    width: '100%', textAlign: 'left', padding: '14px 16px',
                    background: T.white, border: `1px solid var(--border)`,
                    borderRadius: 14, cursor: 'pointer', marginBottom: 10, display: 'block',
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 600, color: T.text1 }}>{opt.label}</div>
                  <div style={{ fontSize: 12, color: T.text3, marginTop: 3 }}>{opt.sub}</div>
                </button>
              ))}
              <button
                onClick={() => setPendingDelete(null)}
                style={{
                  marginTop: 4, width: '100%', padding: '12px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 14, color: T.textMuted,
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {deleteStep === 'confirm' && (
            <div>
              <p style={{ fontSize: 14, color: T.text2, margin: '0 0 24px', lineHeight: 1.6 }}>
                This will permanently remove the <strong>{fmt(pendingDelete.amount, currency)}</strong> entry
                from <strong>{formatDate(pendingDelete.date)}</strong>.
              </p>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  width: '100%', padding: '14px', borderRadius: 14,
                  background: '#D93025', border: 'none', cursor: 'pointer',
                  fontSize: 15, fontWeight: 600, color: '#fff', opacity: deleting ? 0.6 : 1,
                }}
              >
                {deleting ? 'Removing…' : 'Yes, remove it'}
              </button>
              <button
                onClick={() => setDeleteStep('reason')}
                style={{
                  marginTop: 10, width: '100%', padding: '12px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 14, color: T.text3,
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

  return isDesktop ? (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <SideNav />
      <main style={{ flex: 1, maxWidth: 640, margin: '0 auto' }}>{content}</main>
    </div>
  ) : (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', paddingBottom: 88 }}>
      <main>{content}</main>
      <BottomNav />
    </div>
  )
}

export default function CategoryLedgerPage() {
  return (
    <Suspense>
      <LedgerInner />
    </Suspense>
  )
}
