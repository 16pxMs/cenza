// ─────────────────────────────────────────────────────────────
// /history — Monthly transaction history
//
// Shows all transactions logged this month, grouped by type:
//   Fixed → Goals → Daily → Debts → Other
//
// Each row is tappable → expands inline for edit/delete
// Top: summary card (total spent / budget + progress bar)
// ─────────────────────────────────────────────────────────────
'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { IconBack, IconTrash } from '@/components/ui/Icons'
import { fmt, formatDate } from '@/lib/finance'

// ─── Tokens ───────────────────────────────────────────────────
const T = {
  brand:        '#EADFF4',
  brandMid:     '#C9AEE8',
  brandDark:    '#5C3489',
  pageBg:       '#FAFAF8',
  white:        '#FFFFFF',
  border:       '#EDE8F5',
  borderStrong: '#D5CDED',
  text1:        '#1A1025',
  text2:        '#4A3B66',
  text3:        '#8B7BA8',
  textMuted:    '#B8AECE',
}


const TYPE_ORDER = ['fixed', 'goal', 'variable', 'debt', 'other']
const TYPE_LABEL: Record<string, string> = {
  fixed:    'Fixed spending',
  goal:     'Goals',
  variable: 'Daily expenses',
  debt:     'Debts',
  other:    'Other',
}

interface Transaction {
  id:             string
  date:           string
  category_type:  string
  category_key:   string
  category_label: string
  amount:         number
  note:           string | null
}

// ─── Page ─────────────────────────────────────────────────────
export default function HistoryPage() {
  const router        = useRouter()
  const supabase      = createClient()
  const { isDesktop } = useBreakpoint()

  const [loading, setLoading]     = useState(true)
  const [currency, setCurrency]   = useState('KES')
  const [txns, setTxns]           = useState<Transaction[]>([])
  const [totalBudget, setTotalBudget] = useState(0)
  const [expandedId, setExpandedId]   = useState<string | null>(null)

  // Edit state
  const [editAmount, setEditAmount] = useState('')
  const [editNote, setEditNote]     = useState('')
  const [saving, setSaving]         = useState(false)
  const [deleting, setDeleting]     = useState(false)

  const amountRef = useRef<HTMLInputElement>(null)
  const currentMonth = new Date().toISOString().slice(0, 7)

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('currency')
      .eq('id', user.id)
      .single() as { data: any }

    const cur = profile?.currency ?? 'KES'
    setCurrency(cur)

    // All transactions this month
    const { data: rows } = await (supabase.from('transactions') as any)
      .select('id, date, category_type, category_key, category_label, amount, note')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    setTxns((rows ?? []).map((r: any) => ({ ...r, amount: Number(r.amount) })))

    // Budget totals for progress bar
    const [{ data: expenses }, { data: budgets }] = await Promise.all([
      (supabase.from('fixed_expenses') as any)
        .select('total_monthly')
        .eq('user_id', user.id)
        .eq('month', currentMonth)
        .maybeSingle(),
      (supabase.from('spending_budgets') as any)
        .select('total_budget')
        .eq('user_id', user.id)
        .eq('month', currentMonth)
        .maybeSingle(),
    ])
    setTotalBudget((expenses?.total_monthly ?? 0) + (budgets?.total_budget ?? 0))

    setLoading(false)
  }, [supabase, router, currentMonth])

  useEffect(() => { loadData() }, [loadData])

  // Open a row for editing
  const openRow = (txn: Transaction) => {
    if (expandedId === txn.id) { setExpandedId(null); return }
    setExpandedId(txn.id)
    setEditAmount(String(txn.amount))
    setEditNote(txn.note ?? '')
    setTimeout(() => amountRef.current?.focus(), 80)
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9.]/g, '')
    const parts = val.split('.')
    if (parts.length > 2) return
    if (parts[1] && parts[1].length > 2) return
    setEditAmount(val)
  }

  const handleSave = async (txn: Transaction) => {
    const amt = parseFloat(editAmount) || 0
    if (amt <= 0) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    await (supabase.from('transactions') as any)
      .update({ amount: amt, note: editNote || null })
      .eq('id', txn.id)
      .eq('user_id', user.id)
    setSaving(false)
    setExpandedId(null)
    loadData()
    router.refresh()
  }

  const handleDelete = async (txn: Transaction) => {
    setDeleting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setDeleting(false); return }
    await (supabase.from('transactions') as any)
      .delete()
      .eq('id', txn.id)
      .eq('user_id', user.id)
    setDeleting(false)
    setExpandedId(null)
    loadData()
    router.refresh()
  }

  // ─── Group transactions by type ──────────────────────────────
  const grouped: Record<string, Transaction[]> = {}
  for (const t of txns) {
    const type = TYPE_ORDER.includes(t.category_type) ? t.category_type : 'other'
    if (!grouped[type]) grouped[type] = []
    grouped[type].push(t)
  }

  const totalSpent = txns.reduce((s, t) => s + t.amount, 0)
  const pct = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0

  // ─── Loading ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--page-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-sans)', color: T.textMuted, fontSize: 14,
      }}>
        Loading...
      </div>
    )
  }

  // ─── Content ─────────────────────────────────────────────────
  const content = (
    <div style={{ paddingBottom: isDesktop ? 80 : 100 }}>

      {/* Page header */}
      <div style={{ padding: isDesktop ? '32px 32px 20px' : '20px 16px 16px' }}>
        <button
          onClick={() => router.push('/')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 10px', display: 'flex', alignItems: 'center' }}
        >
          <IconBack size={18} color={T.text3} />
        </button>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: isDesktop ? 28 : 24, fontWeight: 600, color: T.text1, margin: '0 0 2px' }}>
          {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h1>
      </div>

      {/* Summary card */}
      <div style={{ padding: isDesktop ? '0 32px 24px' : '0 16px 24px' }}>
        <div style={{
          background: T.brandDark, borderRadius: 20, padding: '20px 22px',
          boxShadow: '0 4px 20px rgba(92,52,137,0.25)',
        }}>
          <p style={{ margin: '0 0 4px', fontSize: 11, color: 'rgba(234,223,244,0.6)', fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Total spent
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: totalBudget > 0 ? 12 : 0 }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-sans)', letterSpacing: -0.5 }}>
              {fmt(totalSpent, currency)}
            </span>
            {totalBudget > 0 && (
              <span style={{ fontSize: 13, color: 'rgba(234,223,244,0.6)', fontFamily: 'var(--font-sans)' }}>
                of {fmt(totalBudget, currency)}
              </span>
            )}
          </div>
          {totalBudget > 0 && (
            <div style={{ height: 5, background: 'rgba(255,255,255,0.15)', borderRadius: 99 }}>
              <div style={{
                height: '100%', width: `${pct}%`,
                background: pct > 90 ? '#FCA5A5' : pct > 75 ? '#FCD34D' : '#86EFAC',
                borderRadius: 99, transition: 'width 0.5s ease',
              }} />
            </div>
          )}
        </div>
      </div>

      {/* Empty state */}
      {txns.length === 0 && (
        <div style={{ padding: isDesktop ? '0 32px' : '0 16px', textAlign: 'center', paddingTop: 40 }}>
          <p style={{ fontSize: 15, color: T.textMuted, fontFamily: 'var(--font-sans)' }}>
            No transactions logged yet this month.
          </p>
          <button
            onClick={() => router.push('/log')}
            style={{
              marginTop: 16, height: 48, borderRadius: 12,
              background: T.brandDark, color: '#fff', border: 'none',
              padding: '0 28px', fontWeight: 600, fontSize: 14,
              fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}
          >
            Log a payment
          </button>
        </div>
      )}

      {/* Grouped transaction list */}
      {TYPE_ORDER.filter(type => grouped[type]?.length > 0).map(type => (
        <div key={type} style={{ marginBottom: 28 }}>

          {/* Section header */}
          <div style={{ padding: isDesktop ? '0 32px 10px' : '0 16px 10px' }}>
            <p style={{
              margin: 0, fontSize: 11, fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: T.textMuted, fontFamily: 'var(--font-sans)',
            }}>
              {TYPE_LABEL[type] ?? type}
            </p>
          </div>

          <div style={{ padding: isDesktop ? '0 32px' : '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {grouped[type].map(txn => {
              const isExpanded = expandedId === txn.id
              return (
                <div
                  key={txn.id}
                  style={{
                    background: T.white,
                    border: `1.5px solid ${isExpanded ? T.brandMid : T.border}`,
                    borderRadius: 14,
                    overflow: 'hidden',
                    transition: 'border-color 0.15s',
                  }}
                >
                  {/* Row */}
                  <button
                    onClick={() => openRow(txn)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px', background: 'none', border: 'none',
                      cursor: 'pointer', fontFamily: 'var(--font-sans)', textAlign: 'left',
                      boxSizing: 'border-box',
                    } as React.CSSProperties}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 15, fontWeight: 500, color: T.text1, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {txn.category_label}
                      </span>
                      {txn.note && (
                        <span style={{ fontSize: 12, color: T.text3, display: 'block', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {txn.note}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, marginLeft: 12 }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: T.text1 }}>
                        {fmt(txn.amount, currency)}
                      </span>
                      <span style={{ fontSize: 11.5, color: T.textMuted, marginTop: 1 }}>
                        {formatDate(txn.date)}
                      </span>
                    </div>
                  </button>

                  {/* Inline edit panel */}
                  {isExpanded && (
                    <div style={{
                      borderTop: `1px solid ${T.border}`,
                      padding: '14px 16px',
                      display: 'flex', flexDirection: 'column', gap: 10,
                      background: '#FAFAF8',
                    }}>
                      {/* Amount input */}
                      <div>
                        <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 500, color: T.text3, fontFamily: 'var(--font-sans)' }}>
                          Amount ({currency})
                        </p>
                        <input
                          ref={amountRef}
                          type="text"
                          inputMode="decimal"
                          value={editAmount}
                          onChange={handleAmountChange}
                          onKeyDown={e => { if (e.key === 'Enter') handleSave(txn) }}
                          style={{
                            height: 44, borderRadius: 10,
                            border: `1.5px solid ${T.border}`,
                            padding: '0 14px', fontSize: 15, fontWeight: 600,
                            color: T.text1, background: T.white,
                            fontFamily: 'var(--font-sans)', outline: 'none',
                            width: '100%', boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      {/* Note input */}
                      <input
                        type="text"
                        value={editNote}
                        onChange={e => setEditNote(e.target.value)}
                        placeholder="Note (optional)"
                        style={{
                          height: 44, borderRadius: 10,
                          border: `1.5px solid ${T.border}`,
                          padding: '0 14px', fontSize: 14,
                          color: T.text1, background: T.white,
                          fontFamily: 'var(--font-sans)', outline: 'none',
                          width: '100%', boxSizing: 'border-box',
                        }}
                      />

                      {/* Actions row */}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button
                          onClick={() => handleSave(txn)}
                          disabled={saving || parseFloat(editAmount) <= 0}
                          style={{
                            flex: 1, height: 42, borderRadius: 10,
                            background: (saving || parseFloat(editAmount) <= 0) ? T.border : T.brandDark,
                            border: 'none', color: (saving || parseFloat(editAmount) <= 0) ? T.textMuted : '#fff',
                            fontSize: 14, fontWeight: 600,
                            fontFamily: 'var(--font-sans)', cursor: saving ? 'wait' : 'pointer',
                          }}
                        >
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          onClick={() => handleDelete(txn)}
                          disabled={deleting}
                          style={{
                            width: 42, height: 42, borderRadius: 10,
                            background: '#FEF2F2', border: '1.5px solid #FCA5A5',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: deleting ? 'wait' : 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          <IconTrash size={16} color="#EF4444" />
                        </button>
                        <button
                          onClick={() => setExpandedId(null)}
                          style={{
                            width: 42, height: 42, borderRadius: 10,
                            background: 'none', border: `1.5px solid ${T.border}`,
                            fontSize: 13, color: T.text3,
                            fontFamily: 'var(--font-sans)', cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

    </div>
  )

  // ─── Desktop layout ───────────────────────────────────────────
  if (isDesktop) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--page-bg)' }}>
        <SideNav />
        <main style={{ flex: 1, maxWidth: 720 }}>{content}</main>
      </div>
    )
  }

  // ─── Mobile layout ────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', paddingBottom: 72 }}>
      <main>{content}</main>
      <BottomNav />
    </div>
  )
}
