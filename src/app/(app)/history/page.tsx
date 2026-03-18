// ─────────────────────────────────────────────────────────────
// /history — Monthly health check
//
// Not a transaction ledger — a breakdown of the month:
//   1. Summary: total spent vs budget, days left
//   2. Category rows: each planned item with spent/budget bar
//      (unlogged items shown muted so nothing is hidden)
//   3. Inline edit/delete on each transaction row
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

const DEBT_KEYWORDS = new Set([
  'debt', 'loan', 'repayment', 'credit card', 'overdraft', 'mortgage',
  'student loan', 'car loan', 'helb', 'bnpl', 'afterpay', 'klarna',
  'credit', 'borrowing', 'instalment', 'installment',
])

const isDebtByLabel = (label: string) => DEBT_KEYWORDS.has(label.trim().toLowerCase())

const GOAL_LABELS: Record<string, string> = {
  emergency: 'Emergency Fund', car: 'Car', travel: 'Travel',
  home: 'Home', education: 'Education', business: 'Business',
  family: 'Family', other: 'Other Goal',
}

const EXPENSE_LABELS: Record<string, string> = {
  rent: 'Rent', electricity: 'Electricity', water: 'Water',
  gas: 'Cooking fuel', internet: 'Internet', phone: 'Phone',
  houseKeeping: 'Housekeeping', blackTax: 'Black tax',
  schoolFees: 'School fees', childcare: 'Childcare',
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

interface CategoryRow {
  key:          string
  label:        string
  type:         'fixed' | 'goal' | 'variable' | 'debt' | 'other'
  planned:      number       // budget / target / monthly — 0 if unknown
  spent:        number       // sum of transactions this month
  transactions: Transaction[]
}

function BarFill({ pct, type }: { pct: number; type: CategoryRow['type'] }) {
  const color = type === 'goal'
    ? T.brandDark
    : pct > 100 ? '#D93025' : pct > 75 ? '#F4A01C' : T.brandDark
  return (
    <div style={{ height: 3, background: '#E5E5EA', borderRadius: 99, marginTop: 8 }}>
      <div style={{
        height: '100%',
        width: `${Math.min(100, pct)}%`,
        background: color,
        borderRadius: 99,
        transition: 'width 0.4s ease',
        minWidth: pct > 0 ? 4 : 0,
      }} />
    </div>
  )
}

export default function HistoryPage() {
  const router        = useRouter()
  const supabase      = createClient()
  const { isDesktop } = useBreakpoint()

  const [loading, setLoading]         = useState(true)
  const [currency, setCurrency]       = useState('KES')
  const [rows, setRows]               = useState<CategoryRow[]>([])
  const [totalBudget, setTotalBudget] = useState(0)
  const [totalSpent, setTotalSpent]   = useState(0)
  const [totalIncome, setTotalIncome] = useState(0)
  const [expandedTxn, setExpandedTxn] = useState<string | null>(null)
  const [editAmount, setEditAmount]   = useState('')
  const [editNote, setEditNote]       = useState('')
  const [saving, setSaving]           = useState(false)
  const [deleting, setDeleting]       = useState(false)

  const amountRef    = useRef<HTMLInputElement>(null)
  const currentMonth = new Date().toISOString().slice(0, 7)

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const [
      { data: profile },
      { data: txnRows },
      { data: expenses },
      { data: budgets },
      { data: targets },
      { data: income },
    ] = await Promise.all([
      supabase.from('user_profiles').select('currency, goals').eq('id', user.id).single() as any,
      (supabase.from('transactions') as any)
        .select('id, date, category_type, category_key, category_label, amount, note')
        .eq('user_id', user.id).eq('month', currentMonth)
        .order('date', { ascending: false }).order('created_at', { ascending: false }),
      (supabase.from('fixed_expenses') as any)
        .select('total_monthly, entries').eq('user_id', user.id).eq('month', currentMonth).maybeSingle(),
      (supabase.from('spending_budgets') as any)
        .select('total_budget, categories').eq('user_id', user.id).eq('month', currentMonth).maybeSingle(),
      (supabase.from('goal_targets') as any)
        .select('goal_id, amount').eq('user_id', user.id),
      (supabase.from('income_entries') as any)
        .select('total').eq('user_id', user.id).eq('month', currentMonth).maybeSingle(),
    ])

    const cur = profile?.currency ?? 'KES'
    setCurrency(cur)

    const allTxns: Transaction[] = (txnRows ?? []).map((r: any) => ({ ...r, amount: Number(r.amount) }))

    // Index transactions by category_key
    const txnByKey: Record<string, Transaction[]> = {}
    for (const t of allTxns) {
      if (!txnByKey[t.category_key]) txnByKey[t.category_key] = []
      txnByKey[t.category_key].push(t)
    }
    const spentByKey = (key: string) => (txnByKey[key] ?? []).reduce((s, t) => s + t.amount, 0)

    // ── Build category rows ──────────────────────────────────
    const categoryRows: CategoryRow[] = []
    const coveredKeys = new Set<string>()

    // Fixed expenses
    for (const e of (expenses?.entries ?? []).filter((e: any) => e.confidence === 'known' && e.monthly > 0)) {
      coveredKeys.add(e.key)
      categoryRows.push({
        key: e.key, label: EXPENSE_LABELS[e.key] ?? e.key,
        type: 'fixed', planned: e.monthly,
        spent: spentByKey(e.key), transactions: txnByKey[e.key] ?? [],
      })
    }

    // Goals
    const targetMap: Record<string, number> = {}
    for (const t of targets ?? []) targetMap[t.goal_id] = Number(t.amount)

    for (const gid of (profile?.goals ?? [])) {
      if (!GOAL_LABELS[gid]) continue
      coveredKeys.add(gid)
      categoryRows.push({
        key: gid, label: GOAL_LABELS[gid],
        type: 'goal', planned: targetMap[gid] ?? 0,
        spent: spentByKey(gid), transactions: txnByKey[gid] ?? [],
      })
    }

    // Daily spending categories
    for (const c of (budgets?.categories ?? [])) {
      coveredKeys.add(c.key)
      categoryRows.push({
        key: c.key, label: c.label,
        type: 'variable', planned: c.budget ?? 0,
        spent: spentByKey(c.key), transactions: txnByKey[c.key] ?? [],
      })
    }

    // Debt transactions — includes stored debts AND uncovered transactions whose label
    // matches a known debt keyword (e.g. a "debt" entry mistakenly saved as 'other')
    const debtMap: Record<string, { label: string; txns: Transaction[] }> = {}
    const toFixAsDebt: string[] = []
    for (const t of allTxns) {
      const isStoredDebt  = t.category_type === 'debt'
      const isKeywordDebt = !coveredKeys.has(t.category_key) && isDebtByLabel(t.category_label)
      if (!isStoredDebt && !isKeywordDebt) continue
      coveredKeys.add(t.category_key)
      if (!debtMap[t.category_key]) debtMap[t.category_key] = { label: t.category_label, txns: [] }
      debtMap[t.category_key].txns.push(t)
      if (isKeywordDebt) toFixAsDebt.push(t.id)
    }
    for (const [key, { label, txns }] of Object.entries(debtMap)) {
      categoryRows.push({
        key, label, type: 'debt', planned: 0,
        spent: txns.reduce((s, t) => s + t.amount, 0), transactions: txns,
      })
    }
    // Silently correct the category_type in the DB for promoted entries
    if (toFixAsDebt.length > 0) {
      ;(supabase.from('transactions') as any)
        .update({ category_type: 'debt' })
        .in('id', toFixAsDebt)
        .then(() => {})
    }

    // Other — everything remaining
    const otherMap: Record<string, { label: string; txns: Transaction[] }> = {}
    for (const t of allTxns) {
      if (coveredKeys.has(t.category_key)) continue
      if (!otherMap[t.category_key]) otherMap[t.category_key] = { label: t.category_label, txns: [] }
      otherMap[t.category_key].txns.push(t)
    }
    for (const [key, { label, txns }] of Object.entries(otherMap)) {
      categoryRows.push({
        key, label, type: 'other', planned: 0,
        spent: txns.reduce((s, t) => s + t.amount, 0), transactions: txns,
      })
    }

    const spent = allTxns.reduce((s, t) => s + t.amount, 0)
    setRows(categoryRows)
    setTotalSpent(spent)
    setTotalIncome(Number(income?.total ?? 0))
    setTotalBudget((expenses?.total_monthly ?? 0) + (budgets?.total_budget ?? 0))
    setLoading(false)
  }, [supabase, router, currentMonth])

  useEffect(() => { loadData() }, [loadData])

  const openTxn = (txn: Transaction) => {
    if (expandedTxn === txn.id) { setExpandedTxn(null); return }
    setExpandedTxn(txn.id)
    setEditAmount(String(txn.amount))
    setEditNote(txn.note ?? '')
    setTimeout(() => amountRef.current?.focus(), 80)
  }

  const handleSave = async (txn: Transaction) => {
    const amt = parseFloat(editAmount) || 0
    if (amt <= 0) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    await (supabase.from('transactions') as any)
      .update({ amount: amt, note: editNote || null })
      .eq('id', txn.id).eq('user_id', user.id)
    setSaving(false)
    setExpandedTxn(null)
    loadData(); router.refresh()
  }

  const handleDelete = async (txn: Transaction) => {
    setDeleting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setDeleting(false); return }
    await (supabase.from('transactions') as any)
      .delete().eq('id', txn.id).eq('user_id', user.id)
    setDeleting(false)
    setExpandedTxn(null)
    loadData(); router.refresh()
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--page-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-sans)', color: T.textMuted, fontSize: 14,
      }}>Loading...</div>
    )
  }

  const daysInMonth  = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const daysLeft     = daysInMonth - new Date().getDate()
  const unallocated  = totalIncome - totalSpent
  const fixedSpent   = rows.filter(r => r.type === 'fixed').reduce((s, r) => s + r.spent, 0)
  const goalsSpent   = rows.filter(r => r.type === 'goal').reduce((s, r) => s + r.spent, 0)
  const dailySpent   = rows.filter(r => r.type === 'variable').reduce((s, r) => s + r.spent, 0)
  const debtSpent    = rows.filter(r => r.type === 'debt').reduce((s, r) => s + r.spent, 0)
  const otherSpent   = rows.filter(r => r.type === 'other').reduce((s, r) => s + r.spent, 0)

  const breakdown = [
    { label: 'Fixed',   amount: fixedSpent,  accent: false },
    { label: 'Goals',   amount: goalsSpent,  accent: false },
    { label: 'Daily',   amount: dailySpent,  accent: false },
    { label: 'Debts',   amount: debtSpent,   accent: debtSpent > 0 },
    { label: 'Other',   amount: otherSpent,  accent: false },
  ].filter(b => b.amount > 0)

  // Group rows for rendering
  const sections: { label: string; types: CategoryRow['type'][] }[] = [
    { label: 'Fixed',    types: ['fixed'] },
    { label: 'Goals',    types: ['goal'] },
    { label: 'Daily',    types: ['variable'] },
    { label: 'Debts',    types: ['debt'] },
    { label: 'Other',    types: ['other'] },
  ]

  const pad = isDesktop ? '0 32px' : '0 16px'

  const content = (
    <div style={{ paddingBottom: isDesktop ? 80 : 100 }}>

      {/* Header */}
      <div style={{ padding: isDesktop ? '32px 32px 20px' : '20px 16px 20px' }}>
        <button
          onClick={() => router.push('/')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 12px', display: 'flex', alignItems: 'center' }}
        >
          <IconBack size={18} color={T.text3} />
        </button>
        <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-sans)' }}>
          Monthly review
        </p>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: isDesktop ? 28 : 24, fontWeight: 700, color: T.text1, margin: 0 }}>
          {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h1>
      </div>

      {/* Income / Spent / Unallocated card — leads the page */}
      {totalIncome > 0 && (
        <div style={{ padding: `0 ${isDesktop ? 32 : 16}px 12px` }}>
          <div style={{
            background: '#F5F5F7', borderRadius: 16,
            display: 'flex', alignItems: 'stretch', fontFamily: 'var(--font-sans)',
          }}>
            {[
              { label: 'Income',      value: totalIncome, color: T.text1 },
              { label: 'Spent',       value: totalSpent,  color: T.text1 },
              { label: 'In hand', value: unallocated, color: unallocated >= 0 ? '#1A7A45' : '#D93025' },
            ].map((col, i) => (
              <div key={col.label} style={{ display: 'flex', flex: 1, alignItems: 'stretch' }}>
                {i > 0 && (
                  <div style={{ width: 1, background: '#EBEBF0', margin: '16px 0', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, padding: '24px 0', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {col.label}
                  </p>
                  <span style={{ fontSize: 15, fontWeight: 700, color: col.color }}>
                    {fmt(Math.abs(col.value), currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Breakdown card */}
      <div style={{ padding: `0 ${isDesktop ? 32 : 16}px 40px` }}>
        <div style={{
          background: T.white, border: `1px solid ${T.border}`,
          borderRadius: 16, padding: '18px 20px',
          fontFamily: 'var(--font-sans)',
        }}>
          <p style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Where it went
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {breakdown.map(b => (
              <div key={b.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, color: b.accent ? '#D93025' : T.text2 }}>{b.label}</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: b.accent ? '#D93025' : T.text1 }}>{fmt(b.amount, currency)}</span>
              </div>
            ))}
          </div>
          {breakdown.length > 1 && (
            <>
              <div style={{ height: 1, background: T.border, margin: '14px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: T.text1 }}>Total</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: T.text1 }}>{fmt(totalSpent, currency)}</span>
              </div>
            </>
          )}
        </div>
      </div>


      {/* Category sections */}
      {sections.map(section => {
        const sectionRows = rows.filter(r => section.types.includes(r.type))
        if (sectionRows.length === 0) return null

        return (
          <div key={section.label} style={{ padding: pad, marginBottom: 24 }}>
            <p style={{
              margin: '0 0 10px', fontSize: 11, fontWeight: 600,
              color: T.textMuted, textTransform: 'uppercase',
              letterSpacing: '0.08em', fontFamily: 'var(--font-sans)',
            }}>
              {section.label}
            </p>

            <div style={{
              background: T.white, border: `1px solid ${T.border}`,
              borderRadius: 16, overflow: 'hidden',
            }}>
              {sectionRows.map((row, idx) => {
                const rowPct     = row.planned > 0 ? (row.spent / row.planned) * 100 : 0
                const rowOver    = row.planned > 0 && row.spent > row.planned
                const isLast     = idx === sectionRows.length - 1
                const hasLogged  = row.spent > 0

                return (
                  <div key={row.key} style={{
                    borderBottom: isLast ? 'none' : `1px solid ${T.border}`,
                  }}>
                    {/* Category summary row */}
                    <div style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{
                          fontSize: 14, fontWeight: 500,
                          color: hasLogged ? T.text1 : T.textMuted,
                          fontFamily: 'var(--font-sans)',
                        }}>
                          {row.label}
                        </span>
                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                          {hasLogged ? (
                            <span style={{ fontSize: 14, fontWeight: 600, color: rowOver ? '#D93025' : T.text1, fontFamily: 'var(--font-sans)' }}>
                              {fmt(row.spent, currency)}
                            </span>
                          ) : (
                            <span style={{ fontSize: 13, color: T.textMuted, fontFamily: 'var(--font-sans)' }}>
                              —
                            </span>
                          )}
                          {row.planned > 0 && (
                            <span style={{ fontSize: 11, color: T.textMuted, display: 'block', marginTop: 1, fontFamily: 'var(--font-sans)' }}>
                              {fmt(row.planned, currency)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Progress bar — only if there's a planned amount */}
                      {row.planned > 0 && (
                        <BarFill pct={rowPct} type={row.type} />
                      )}
                      {/* Thin line for logged-only rows with no planned amount */}
                      {row.planned === 0 && hasLogged && (
                        <div style={{ height: 3, background: '#E5E5EA', borderRadius: 99, marginTop: 8 }}>
                          <div style={{ height: '100%', width: '100%', background: T.brandDark, borderRadius: 99, opacity: 0.3 }} />
                        </div>
                      )}
                    </div>

                    {/* Individual transactions — always shown so every entry can be edited/deleted */}
                    {row.transactions.length > 0 && (
                      <div style={{ borderTop: `1px solid ${T.border}` }}>
                        {row.transactions.map(txn => {
                          const isExpanded = expandedTxn === txn.id
                          return (
                            <div key={txn.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                              <button
                                onClick={() => openTxn(txn)}
                                style={{
                                  width: '100%', display: 'flex', alignItems: 'center',
                                  justifyContent: 'space-between', padding: '10px 16px 10px 24px',
                                  background: isExpanded ? '#F8F9FA' : 'transparent',
                                  border: 'none', cursor: 'pointer',
                                  fontFamily: 'var(--font-sans)', textAlign: 'left',
                                  boxSizing: 'border-box',
                                } as React.CSSProperties}
                              >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <span style={{ fontSize: 13, color: T.text3, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {txn.note || formatDate(txn.date)}
                                  </span>
                                  {txn.note && (
                                    <span style={{ fontSize: 11, color: T.textMuted }}>{formatDate(txn.date)}</span>
                                  )}
                                </div>
                                <span style={{ fontSize: 13, color: T.text2, fontWeight: 500, flexShrink: 0, marginLeft: 8, fontFamily: 'var(--font-sans)' }}>
                                  {fmt(txn.amount, currency)}
                                </span>
                              </button>

                              {/* Inline edit */}
                              {isExpanded && (
                                <div style={{
                                  padding: '12px 16px', background: '#F8F9FA',
                                  display: 'flex', flexDirection: 'column', gap: 8,
                                }}>
                                  <input
                                    ref={amountRef}
                                    type="text" inputMode="decimal"
                                    value={editAmount} onChange={e => {
                                      const val = e.target.value.replace(/[^0-9.]/g, '')
                                      const parts = val.split('.')
                                      if (parts.length > 2 || (parts[1] && parts[1].length > 2)) return
                                      setEditAmount(val)
                                    }}
                                    onKeyDown={e => { if (e.key === 'Enter') handleSave(txn) }}
                                    style={{
                                      height: 40, borderRadius: 8, border: `1.5px solid ${T.border}`,
                                      padding: '0 12px', fontSize: 14, fontWeight: 600,
                                      color: T.text1, background: T.white,
                                      fontFamily: 'var(--font-sans)', outline: 'none',
                                      width: '100%', boxSizing: 'border-box',
                                    }}
                                  />
                                  <input
                                    type="text" value={editNote}
                                    onChange={e => setEditNote(e.target.value)}
                                    placeholder="Note (optional)"
                                    style={{
                                      height: 40, borderRadius: 8, border: `1.5px solid ${T.border}`,
                                      padding: '0 12px', fontSize: 13,
                                      color: T.text1, background: T.white,
                                      fontFamily: 'var(--font-sans)', outline: 'none',
                                      width: '100%', boxSizing: 'border-box',
                                    }}
                                  />
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                      onClick={() => handleSave(txn)}
                                      disabled={saving || parseFloat(editAmount) <= 0}
                                      style={{
                                        flex: 1, height: 38, borderRadius: 8,
                                        background: saving ? T.border : T.brandDark,
                                        border: 'none', color: '#fff',
                                        fontSize: 13, fontWeight: 600,
                                        fontFamily: 'var(--font-sans)', cursor: 'pointer',
                                      }}
                                    >
                                      {saving ? 'Saving…' : 'Save'}
                                    </button>
                                    <button
                                      onClick={() => handleDelete(txn)}
                                      disabled={deleting}
                                      style={{
                                        width: 38, height: 38, borderRadius: 8,
                                        background: '#FEF2F2', border: '1px solid #FCA5A5',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', flexShrink: 0,
                                      }}
                                    >
                                      <IconTrash size={15} color="#D93025" />
                                    </button>
                                    <button
                                      onClick={() => setExpandedTxn(null)}
                                      style={{
                                        width: 38, height: 38, borderRadius: 8,
                                        background: 'none', border: `1px solid ${T.border}`,
                                        fontSize: 13, color: T.text3,
                                        fontFamily: 'var(--font-sans)', cursor: 'pointer', flexShrink: 0,
                                      }}
                                    >✕</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Empty state */}
      {rows.length === 0 && (
        <div style={{ padding: pad, textAlign: 'center', paddingTop: 40 } as React.CSSProperties}>
          <p style={{ fontSize: 15, color: T.textMuted, fontFamily: 'var(--font-sans)', marginBottom: 16 }}>
            Nothing logged yet this month.
          </p>
          <button
            onClick={() => router.push('/log')}
            style={{
              height: 48, borderRadius: 12, background: T.brandDark,
              color: '#fff', border: 'none', padding: '0 28px',
              fontWeight: 600, fontSize: 14, fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}
          >
            Log a payment
          </button>
        </div>
      )}

    </div>
  )

  if (isDesktop) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--page-bg)' }}>
        <SideNav />
        <main style={{ flex: 1, maxWidth: 720 }}>{content}</main>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', paddingBottom: 72 }}>
      <main>{content}</main>
      <BottomNav />
    </div>
  )
}
