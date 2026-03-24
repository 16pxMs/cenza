'use client'
export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// /history — Monthly health check
//
// Not a transaction ledger — a breakdown of the month:
//   1. Summary: total spent vs budget, days left
//   2. Category rows: each planned item with spent/budget bar
//      (unlogged items shown muted so nothing is hidden)
//   3. Inline edit/delete on each transaction row
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/context/UserContext'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { IconBack, IconChevronRight } from '@/components/ui/Icons'
import { fmt } from '@/lib/finance'
import { getCurrentCycleId } from '@/lib/supabase/cycles-db'

function titleCase(s: string) {
  return s.replace(/\b\w/g, c => c.toUpperCase())
}

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
  type:         'fixed' | 'goal' | 'variable' | 'debt' | 'subscription' | 'other'
  planned:      number       // budget / target / monthly — 0 if unknown
  spent:        number       // sum of transactions this month
  transactions: Transaction[]
}

function BarFill({ pct, type }: { pct: number; type: CategoryRow['type'] }) {
  // Goals: always brand purple — progress is never a warning
  // Fixed: green when paid (≤100%), red only if somehow overpaid
  // Variable/debt/other: traffic light — green <75%, amber 75-100%, red over
  const color = type === 'goal'
    ? T.brandDark
    : type === 'fixed' || type === 'subscription'
    ? (pct > 100 ? '#EF4444' : '#22C55E')
    : pct > 100 ? '#EF4444' : pct > 75 ? '#F59E0B' : '#22C55E'
  return (
    <div style={{ height: 4, background: '#EBEBED', borderRadius: 99, marginTop: 10 }}>
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
  const { user, profile: ctxProfile } = useUser()
  const { isDesktop } = useBreakpoint()

  const [loading, setLoading]         = useState(true)
  const [currency, setCurrency]       = useState('KES')
  const [rows, setRows]               = useState<CategoryRow[]>([])
  const [totalBudget, setTotalBudget] = useState(0)
  const [totalSpent, setTotalSpent]   = useState(0)
  const [totalIncome, setTotalIncome] = useState(0)

  const loadData = useCallback(async () => {
    if (!user) return

    const cycleId = await getCurrentCycleId(supabase as any, user.id, (ctxProfile ?? { pay_schedule_type: null, pay_schedule_days: null }) as any)

    const [
      { data: txnRows },
      { data: expenses },
      { data: budgets },
      { data: targets },
      { data: income },
    ] = await Promise.all([
      (supabase.from('transactions') as any)
        .select('id, date, category_type, category_key, category_label, amount, note')
        .eq('user_id', user.id).eq('cycle_id', cycleId)
        .order('date', { ascending: false }).order('created_at', { ascending: false }),
      (supabase.from('fixed_expenses') as any)
        .select('total_monthly, entries').eq('user_id', user.id).eq('cycle_id', cycleId).maybeSingle(),
      (supabase.from('spending_budgets') as any)
        .select('total_budget, categories').eq('user_id', user.id).eq('cycle_id', cycleId).maybeSingle(),
      (supabase.from('goal_targets') as any)
        .select('goal_id, amount').eq('user_id', user.id),
      (supabase.from('income_entries') as any)
        .select('total').eq('user_id', user.id).eq('cycle_id', cycleId).maybeSingle(),
    ])

    const cur = ctxProfile?.currency ?? 'KES'
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
        key: e.key, label: EXPENSE_LABELS[e.key] ?? titleCase(e.label ?? e.key),
        type: 'fixed', planned: e.monthly,
        spent: spentByKey(e.key), transactions: txnByKey[e.key] ?? [],
      })
    }

    // Goals
    const targetMap: Record<string, number> = {}
    for (const t of targets ?? []) targetMap[t.goal_id] = Number(t.amount)

    for (const gid of (ctxProfile?.goals ?? [])) {
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
        key: c.key, label: titleCase(c.label ?? c.key),
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
      if (!debtMap[t.category_key]) debtMap[t.category_key] = { label: titleCase(t.category_label ?? t.category_key), txns: [] }
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

    // Subscriptions
    const subMap: Record<string, { label: string; txns: Transaction[] }> = {}
    for (const t of allTxns) {
      if (coveredKeys.has(t.category_key)) continue
      if (t.category_type !== 'subscription') continue
      coveredKeys.add(t.category_key)
      if (!subMap[t.category_key]) subMap[t.category_key] = { label: titleCase(t.category_label ?? t.category_key), txns: [] }
      subMap[t.category_key].txns.push(t)
    }
    for (const [key, { label, txns }] of Object.entries(subMap)) {
      categoryRows.push({
        key, label, type: 'subscription', planned: 0,
        spent: txns.reduce((s, t) => s + t.amount, 0), transactions: txns,
      })
    }

    // Other — everything remaining
    const otherMap: Record<string, { label: string; txns: Transaction[] }> = {}
    for (const t of allTxns) {
      if (coveredKeys.has(t.category_key)) continue
      if (!otherMap[t.category_key]) otherMap[t.category_key] = { label: titleCase(t.category_label ?? t.category_key), txns: [] }
      otherMap[t.category_key].txns.push(t)
    }
    for (const [key, { label, txns }] of Object.entries(otherMap)) {
      categoryRows.push({
        key, label, type: 'other', planned: 0,
        spent: txns.reduce((s, t) => s + t.amount, 0), transactions: txns,
      })
    }

    const spent = allTxns.filter(t => t.category_type !== 'goal').reduce((s, t) => s + t.amount, 0)
    setRows(categoryRows)
    setTotalSpent(spent)
    setTotalIncome(Number(income?.total ?? 0))
    setTotalBudget((expenses?.total_monthly ?? 0) + (budgets?.total_budget ?? 0))
    setLoading(false)
  }, [supabase, user, ctxProfile])

  useEffect(() => { if (user) loadData() }, [loadData, user])

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--page-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMuted, fontSize: 14,
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
          onClick={() => router.push('/app')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 12px', display: 'flex', alignItems: 'center' }}
        >
          <IconBack size={18} color={T.text3} />
        </button>
        <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Monthly review
        </p>
        <h1 style={{ fontSize: isDesktop ? 28 : 24, color: T.text1, margin: 0 }}>
          {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h1>
      </div>

      {/* Hero stats — white card, clear hierarchy */}
      {totalIncome > 0 && (
        <div style={{ padding: `0 ${isDesktop ? 32 : 16}px 16px` }}>
          <div style={{
            background: T.white, borderRadius: 20,
            boxShadow: '0 1px 10px rgba(0,0,0,0.07)',
            display: 'flex', alignItems: 'stretch',
          }}>
            {[
              { label: 'Income',  value: totalIncome, color: T.text1 },
              { label: 'Spent',   value: totalSpent,  color: T.text1 },
              { label: 'In hand', value: unallocated,  color: unallocated >= 0 ? '#1A7A45' : '#D93025' },
            ].map((col, i) => (
              <div key={col.label} style={{ display: 'flex', flex: 1, alignItems: 'stretch' }}>
                {i > 0 && <div style={{ width: 1, background: '#F0F0F0', margin: '18px 0', flexShrink: 0 }} />}
                <div style={{ flex: 1, padding: '22px 0', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 5px', fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {col.label}
                  </p>
                  <span style={{ fontSize: i === 2 ? 17 : 15, fontWeight: 700, color: col.color }}>
                    {fmt(Math.abs(col.value), currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Where it went — stacked proportion bar + legend */}
      {breakdown.length > 0 && totalSpent > 0 && (() => {
        const segments = [
          { label: 'Fixed',  amount: fixedSpent,  color: '#5C3489' },
          { label: 'Goals',  amount: goalsSpent,  color: '#9B72CC' },
          { label: 'Daily',  amount: dailySpent,  color: '#C4A8E0' },
          { label: 'Debts',  amount: debtSpent,   color: '#EF4444' },
          { label: 'Other',  amount: otherSpent,  color: '#D1D5DB' },
        ].filter(s => s.amount > 0)
        return (
          <div style={{ padding: `0 ${isDesktop ? 32 : 16}px 24px` }}>
            <div style={{
              background: T.white, border: `1px solid var(--border)`,
              borderRadius: 16, padding: '18px 20px',
            }}>
              <p style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Where it went
              </p>

              {/* Stacked proportion bar */}
              <div style={{
                display: 'flex', height: 8, borderRadius: 99,
                overflow: 'hidden', marginBottom: 16, gap: 2,
              }}>
                {segments.map(s => (
                  <div
                    key={s.label}
                    style={{
                      height: '100%',
                      width: `${(s.amount / totalSpent) * 100}%`,
                      background: s.color,
                      borderRadius: 99,
                      transition: 'width 0.4s ease',
                      minWidth: 4,
                    }}
                  />
                ))}
              </div>

              {/* Legend rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {segments.map(s => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13.5, color: T.text2 }}>{s.label}</span>
                    </div>
                    <span style={{ fontSize: 13.5, fontWeight: 500, color: s.label === 'Debts' ? '#EF4444' : T.text1 }}>
                      {fmt(s.amount, currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}


      {/* Category sections */}
      {sections.map(section => {
        const sectionRows = rows.filter(r => section.types.includes(r.type))
        if (sectionRows.length === 0) return null

        return (
          <div key={section.label} style={{ padding: pad, marginBottom: 24 }}>
            <p style={{
              margin: '0 0 10px', fontSize: 11, fontWeight: 600,
              color: T.textMuted, textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              {section.label}
            </p>

            <div style={{
              background: T.white, border: `1px solid var(--border)`,
              borderRadius: 16, overflow: 'hidden',
            }}>
              {sectionRows.map((row, idx) => {
                const rowPct    = row.planned > 0 ? (row.spent / row.planned) * 100 : 0
                const rowOver   = row.planned > 0 && row.spent > row.planned
                const isLast    = idx === sectionRows.length - 1
                const hasLogged = row.spent > 0
                const showBar   = hasLogged && row.planned > 0
                const ledgerUrl = `/history/${row.key}?label=${encodeURIComponent(row.label)}&planned=${row.planned}&type=${row.type}`
                const inner = (
                  <div style={{ padding: `18px 16px ${showBar ? 10 : 18}px` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 28 }}>
                      {/* Left: label + budget sublabel */}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: hasLogged ? T.text1 : T.textMuted }}>
                          {row.label}
                        </div>
                        {row.planned > 0 && (
                          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 3 }}>
                            {fmt(row.planned, currency)} budget
                          </div>
                        )}
                      </div>

                      {/* Right: logged amount or placeholder */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 16 }}>
                        {hasLogged ? (
                          <>
                            <span style={{ fontSize: 15, fontWeight: 600, color: rowOver ? '#EF4444' : T.text1 }}>
                              {fmt(row.spent, currency)}
                            </span>
                            <IconChevronRight size={16} color={T.textMuted} />
                          </>
                        ) : (
                          <span style={{ fontSize: 14, color: T.textMuted, fontWeight: 400, letterSpacing: '0.05em' }}>
                            —
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress bar — only when logged + has budget */}
                    {showBar && (
                      <div style={{ marginTop: 10 }}>
                        <BarFill pct={rowPct} type={row.type} />
                      </div>
                    )}
                  </div>
                )

                return (
                  <div key={row.key} style={{ borderBottom: isLast ? 'none' : `1px solid var(--border-subtle)` }}>
                    {hasLogged ? (
                      <button
                        onClick={() => router.push(ledgerUrl)}
                        style={{
                          width: '100%', textAlign: 'left', background: 'none',
                          border: 'none', cursor: 'pointer', padding: 0, boxSizing: 'border-box',
                          display: 'block',
                        } as React.CSSProperties}
                      >
                        {inner}
                      </button>
                    ) : (
                      inner
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
          <p style={{ fontSize: 15, color: T.textMuted, marginBottom: 16 }}>
            Nothing logged yet this month.
          </p>
          <button
            onClick={() => router.push('/log')}
            style={{
              height: 48, borderRadius: 12, background: T.brandDark,
              color: '#fff', border: 'none', padding: '0 28px',
              fontWeight: 600, fontSize: 14, cursor: 'pointer',
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
