'use client'
export const dynamic = 'force-dynamic'


import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/context/UserContext'
import { getCurrentCycleId, getPrevCycleId } from '@/lib/supabase/cycles-db'
import { useToast } from '@/lib/context/ToastContext'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { AddIncomeSheet } from '@/components/flows/income/AddIncomeSheet'
import { EditFixedExpensesSheet, type FixedEntry } from '@/components/flows/plan/EditFixedExpensesSheet'
import { EditSpendingBudgetSheet, type BudgetCategory } from '@/components/flows/plan/EditSpendingBudgetSheet'

// ─── Tokens — all reference the design system CSS variables ───
const T = {
  pageBg:    'var(--page-bg)',
  white:     'var(--white)',
  border:    'var(--border)',
  brandDark: 'var(--brand-dark)',
  text1:     'var(--text-1)',
  text2:     'var(--text-2)',
  text3:     'var(--text-3)',
  textMuted: 'var(--text-muted)',
}

const EXPENSE_ICONS: Record<string, string> = {
  rent: '🏠', electricity: '⚡', water: '💧', gas: '🔥',
  internet: '📡', phone: '📱', houseKeeping: '🧹',
  blackTax: '🤲', schoolFees: '🎓', childcare: '👶',
}
const EXPENSE_LABELS: Record<string, string> = {
  rent: 'Rent', electricity: 'Electricity', water: 'Water', gas: 'Cooking fuel',
  internet: 'Internet', phone: 'Phone', houseKeeping: 'Housekeeping',
  blackTax: 'Black tax', schoolFees: 'School fees', childcare: 'Childcare',
}

function fmt(n: number, cur = 'KES') {
  if (!n) return `${cur} 0`
  return `${cur} ${n.toLocaleString()}`
}

function titleCase(s: string) {
  return s.replace(/\b\w/g, c => c.toUpperCase())
}

function monthLabel(iso: string) {
  const [y, m] = iso.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en', { month: 'long', year: 'numeric' })
}


// ─── Page ──────────────────────────────────────────────────────
export default function PlanPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createClient()
  const { user, profile: ctxProfile } = useUser()
  const { isDesktop } = useBreakpoint()
  const currentMonth = new Date().toISOString().slice(0, 7)

  const { toast } = useToast()

  const [loading,            setLoading]            = useState(true)
  const [incomeData,         setIncomeData]         = useState<any>(null)
  const [fixedExpenses,      setFixedExpenses]      = useState<any>(null)
  const [spendingBudget,     setSpendingBudget]     = useState<any>(null)
  const [spendingHistory,    setSpendingHistory]    = useState<Record<string, number>>({})
  const [incomeSheetOpen,    setIncomeSheetOpen]    = useState(false)
  const [fixedEditOpen,      setFixedEditOpen]      = useState(false)
  const [budgetEditOpen,     setBudgetEditOpen]     = useState(false)
  const [savingFixed,        setSavingFixed]        = useState(false)
  const [savingBudget,       setSavingBudget]       = useState(false)

  const load = useCallback(async () => {
    if (!user) return

    const [cycleId, prevCycleId] = await Promise.all([
      getCurrentCycleId(supabase as any, user.id, ctxProfile as any),
      getPrevCycleId(supabase as any, user.id, ctxProfile as any),
    ])

    const [
      { data: income },
      { data: fixed },
      { data: budget },
      { data: txns },
    ] = await Promise.all([
      (supabase.from('income_entries') as any).select('*').eq('user_id', user.id).eq('cycle_id', cycleId).maybeSingle(),
      (supabase.from('fixed_expenses') as any).select('total_monthly, entries').eq('user_id', user.id).eq('cycle_id', cycleId).maybeSingle(),
      (supabase.from('spending_budgets') as any).select('total_budget, categories').eq('user_id', user.id).eq('cycle_id', cycleId).maybeSingle(),
      prevCycleId
        ? (supabase.from('transactions') as any)
            .select('category_key, amount')
            .eq('user_id', user.id)
            .eq('cycle_id', prevCycleId)
            .eq('category_type', 'variable')
        : Promise.resolve({ data: [] }),
    ])

    if (income)  setIncomeData(income)
    if (fixed)   setFixedExpenses(fixed)
    if (budget)  setSpendingBudget(budget)

    if (txns && txns.length > 0) {
      const history: Record<string, number> = {}
      for (const t of txns) {
        history[t.category_key] = (history[t.category_key] ?? 0) + Number(t.amount)
      }
      setSpendingHistory(history)
    }

    setLoading(false)
  }, [supabase, currentMonth, user, ctxProfile])

  useEffect(() => { if (user) load() }, [load, user])

  const saveIncome = async (data: { income: number; extraIncome: any[]; total: number }) => {
    if (!user) return
    const cycleId = await getCurrentCycleId(supabase as any, user.id, ctxProfile as any)
    await (supabase.from('income_entries') as any).upsert({
      user_id:      user.id,
      month:        currentMonth,
      cycle_id:     cycleId,
      salary:       data.income,
      extra_income: data.extraIncome,
      total:        data.total,
    }, { onConflict: 'user_id,cycle_id' })
    toast('Income updated')
    setIncomeSheetOpen(false)
    await load()
  }

  const saveFixedExpenses = async (entries: FixedEntry[]) => {
    if (!user) return
    setSavingFixed(true)
    const cycleId = await getCurrentCycleId(supabase as any, user.id, ctxProfile as any)
    const totalMonthly = entries.reduce((s, e) => s + e.monthly, 0)
    await (supabase.from('fixed_expenses') as any).upsert({
      user_id:       user.id,
      month:         currentMonth,
      cycle_id:      cycleId,
      total_monthly: totalMonthly,
      entries,
    }, { onConflict: 'user_id,cycle_id' })
    toast('Fixed expenses updated')
    setSavingFixed(false)
    setFixedEditOpen(false)
    await load()
  }

  const saveSpendingBudget = async (categories: BudgetCategory[]) => {
    if (!user) return
    setSavingBudget(true)
    const cycleId = await getCurrentCycleId(supabase as any, user.id, ctxProfile as any)
    const totalBudget = categories.reduce((s, c) => s + c.budget, 0)
    await (supabase.from('spending_budgets') as any).upsert({
      user_id:      user.id,
      month:        currentMonth,
      cycle_id:     cycleId,
      total_budget: totalBudget,
      categories,
    }, { onConflict: 'user_id,cycle_id' })
    toast('Spending budget updated')
    setSavingBudget(false)
    setBudgetEditOpen(false)
    await load()
  }

  const currency    = ctxProfile?.currency || 'KES'
  const incomeTotal = incomeData ? Number(incomeData.total ?? 0) : 0
  const fixedTotal  = fixedExpenses ? Number(fixedExpenses.total_monthly ?? 0) : 0
  const budgetTotal = spendingBudget ? Number(spendingBudget.total_budget ?? 0) : 0
  const available   = incomeTotal - fixedTotal
  const extras      = incomeData?.extra_income ?? []

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: T.pageBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.text3, fontSize: 14 }}>
        Loading...
      </div>
    )
  }

  // ── Shared style tokens ───────────────────────────────────────
  const editBtnStyle: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 500, color: T.brandDark, padding: 0,
  }
  const subtleAmt: React.CSSProperties = { fontSize: 12, fontWeight: 400, color: T.textMuted, marginLeft: 1 }

  // ── Derived state ────────────────────────────────────────────
  const hasIncome  = !!incomeData && searchParams.get('preview') !== '1'
  const hasFixed   = !!(fixedExpenses && (fixedExpenses.entries ?? []).some((e: any) => e.confidence !== 'unsure' && e.monthly > 0))
  const hasBudget  = !!(spendingBudget && (spendingBudget.categories as any[]).some((c: any) => c.budget > 0))
  const isNegative = available < 0
  const fixedPct   = incomeTotal > 0 ? Math.round((fixedTotal  / incomeTotal) * 100) : 0
  const budgetPct  = incomeTotal > 0 ? Math.round((budgetTotal / incomeTotal) * 100) : 0

  // ── Shared styles ────────────────────────────────────────────
  const sectionCard: React.CSSProperties = {
    background: T.white,
    border: `1px solid var(--border)`,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 12,
  }
  const sectionHead: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 16px 14px',
    borderBottom: `1px solid var(--border-subtle)`,
  }
  const itemRow = (border: boolean): React.CSSProperties => ({
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '13px 16px',
    borderBottom: border ? `1px solid var(--border-subtle)` : 'none',
  })
  const totalRow: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 16px',
    background: 'var(--grey-50)',
    borderTop: `1px solid var(--border-subtle)`,
  }

  const content = (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: isDesktop ? '48px 32px 80px' : '28px 20px 100px' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 3px', fontSize: isDesktop ? 28 : 25, fontWeight: 700, color: T.text1, letterSpacing: '-0.5px', fontFamily: 'var(--font-display)' }}>
          Budget
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: T.textMuted }}>
          {monthLabel(currentMonth)} · plan your month
        </p>
      </div>

      {/* ════════════════════════════════════════
          EMPTY STATE
      ════════════════════════════════════════ */}
      {!hasIncome && (
        <div>
          {/* Onboarding card */}
          <div style={{
            background: T.white, border: `1px solid var(--border)`,
            borderRadius: 20, padding: '28px 24px',
            marginBottom: 16,
          }}>
            <p style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: T.text1 }}>
              Set up your budget
            </p>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: T.text3, lineHeight: 1.6 }}>
              Decide where your money goes before it's spent. Income, fixed bills, and day-to-day spending.
            </p>
            <button
              onClick={() => setIncomeSheetOpen(true)}
              style={{
                width: '100%', height: 48, borderRadius: 14,
                background: T.brandDark, border: 'none', cursor: 'pointer',
                fontSize: 15, fontWeight: 600, color: '#fff',
              }}
            >
              Add your income to get started
            </button>
          </div>

          {/* Preview steps */}
          {[
            { label: 'Income',           desc: 'Your salary and other sources' },
            { label: 'Fixed costs',      desc: 'Rent, utilities, subscriptions' },
            { label: 'Spending budget',  desc: 'Food, transport, entertainment' },
          ].map((step, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 0',
              borderBottom: i < 2 ? `1px solid var(--border-subtle)` : 'none',
              opacity: 0.4,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, background: 'var(--grey-100)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: T.textMuted, flexShrink: 0,
              }}>
                {i + 1}
              </div>
              <div>
                <p style={{ margin: '0 0 1px', fontSize: 14, fontWeight: 600, color: T.text1 }}>{step.label}</p>
                <p style={{ margin: 0, fontSize: 12, color: T.text3 }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ════════════════════════════════════════
          BUDGET LAYOUT — income is set
      ════════════════════════════════════════ */}
      {hasIncome && (
        <>
          {/* ── Summary card — the key number ── */}
          <div style={{
            background: T.white, border: `1px solid var(--border)`,
            borderRadius: 20, overflow: 'hidden',
            marginBottom: 20,
          }}>
            {/* Top: the big number */}
            <div style={{ padding: '22px 20px 18px' }}>
              <p style={{
                margin: '0 0 5px', fontSize: 12, fontWeight: 600,
                color: isNegative ? 'var(--red-dark)' : T.textMuted,
                textTransform: 'uppercase', letterSpacing: '0.6px',
              }}>
                {hasFixed ? 'Left to allocate' : 'Monthly income'}
              </p>
              <p style={{
                margin: 0, fontFamily: 'var(--font-display)',
                fontSize: 40, fontWeight: 700, letterSpacing: '-1.5px', lineHeight: 1,
                color: isNegative ? 'var(--red-dark)' : T.text1,
              }}>
                {fmt(hasFixed ? available : incomeTotal, currency)}
              </p>
              {isNegative && (
                <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--red-dark)' }}>
                  Your fixed costs exceed your income.
                </p>
              )}
            </div>

            {/* Bottom: income − committed breakdown */}
            {hasFixed && (
              <div style={{
                display: 'flex',
                borderTop: `1px solid var(--border-subtle)`,
              }}>
                {[
                  { label: 'Income',    value: fmt(incomeTotal, currency) },
                  { label: 'Committed', value: fmt(fixedTotal, currency) },
                ].map((col, i) => (
                  <div key={col.label} style={{ flex: 1, padding: '12px 20px', borderLeft: i > 0 ? `1px solid var(--border-subtle)` : 'none' }}>
                    <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{col.label}</p>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: T.text2 }}>{col.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Income ── */}
          <div style={sectionCard}>
            <div style={sectionHead}>
              <div>
                <p style={{ margin: '0 0 1px', fontSize: 12, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Income</p>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: T.text1 }}>{fmt(incomeTotal, currency)}</p>
              </div>
              <button onClick={() => setIncomeSheetOpen(true)} style={editBtnStyle}>Edit</button>
            </div>
            <div style={itemRow(extras.length > 0)}>
              <span style={{ fontSize: 14, color: T.text2 }}>Salary</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: T.text1 }}>{fmt(Number(incomeData.salary ?? 0), currency)}</span>
            </div>
            {extras.map((e: any, i: number) => (
              <div key={i} style={itemRow(i < extras.length - 1)}>
                <span style={{ fontSize: 14, color: T.text2 }}>{e.label || 'Extra income'}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: T.text1 }}>{fmt(Number(e.amount ?? 0), currency)}</span>
              </div>
            ))}
          </div>

          {/* ── Fixed commitments ── */}
          {hasFixed ? (() => {
            const entries = (fixedExpenses.entries as any[]).filter((e: any) => e.confidence !== 'unsure' && e.monthly > 0)
            return (
              <div style={sectionCard}>
                <div style={sectionHead}>
                  <div>
                    <p style={{ margin: '0 0 1px', fontSize: 12, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Fixed commitments</p>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: T.text1 }}>
                      {fmt(fixedTotal, currency)}
                      {fixedPct > 0 && <span style={{ fontSize: 12, fontWeight: 400, color: T.textMuted, marginLeft: 6 }}>{fixedPct}% of income</span>}
                    </p>
                  </div>
                  <button onClick={() => setFixedEditOpen(true)} style={editBtnStyle}>Edit</button>
                </div>
                {entries.map((e: any, i: number) => (
                  <div key={e.key} style={itemRow(i < entries.length - 1)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18, lineHeight: 1 }}>{EXPENSE_ICONS[e.key] ?? '📋'}</span>
                      <span style={{ fontSize: 14, color: T.text2 }}>{EXPENSE_LABELS[e.key] ?? titleCase(e.label)}</span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: T.text1 }}>
                      {fmt(Number(e.monthly ?? 0), currency)}<span style={subtleAmt}>/mo</span>
                    </span>
                  </div>
                ))}
              </div>
            )
          })() : (
            <div style={{ ...sectionCard, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: '0 0 1px', fontSize: 14, fontWeight: 600, color: T.text1 }}>Fixed commitments</p>
                <p style={{ margin: 0, fontSize: 12, color: T.textMuted }}>Rent, bills, subscriptions</p>
              </div>
              <button onClick={() => setFixedEditOpen(true)} style={{
                background: T.brandDark, border: 'none', borderRadius: 10,
                padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#fff',
              }}>Add</button>
            </div>
          )}

          {/* ── Spending budget ── */}
          {hasBudget ? (() => {
            const cats = (spendingBudget.categories as any[]).filter((c: any) => c.budget > 0)
            return (
              <div style={sectionCard}>
                <div style={sectionHead}>
                  <div>
                    <p style={{ margin: '0 0 1px', fontSize: 12, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Spending budget</p>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: T.text1 }}>
                      {fmt(budgetTotal, currency)}
                      {budgetPct > 0 && <span style={{ fontSize: 12, fontWeight: 400, color: T.textMuted, marginLeft: 6 }}>{budgetPct}% of income</span>}
                    </p>
                  </div>
                  <button onClick={() => setBudgetEditOpen(true)} style={editBtnStyle}>Edit</button>
                </div>
                {cats.map((c: any, i: number) => (
                  <div key={c.key} style={itemRow(i < cats.length - 1)}>
                    <span style={{ fontSize: 14, color: T.text2 }}>{titleCase(c.label)}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: T.text1 }}>
                      {fmt(Number(c.budget ?? 0), currency)}<span style={subtleAmt}>/mo</span>
                    </span>
                  </div>
                ))}
              </div>
            )
          })() : (
            <div style={{ ...sectionCard, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: '0 0 1px', fontSize: 14, fontWeight: 600, color: T.text1 }}>Spending budget</p>
                <p style={{ margin: 0, fontSize: 12, color: T.textMuted }}>
                  {Object.keys(spendingHistory).length > 0
                    ? 'Based on last month, we have suggestions ready'
                    : 'Food, transport, entertainment'}
                </p>
              </div>
              <button onClick={() => setBudgetEditOpen(true)} style={{
                background: T.brandDark, border: 'none', borderRadius: 10,
                padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#fff',
              }}>Add</button>
            </div>
          )}
        </>
      )}

    </div>
  )

  const sheets = (
    <>
      <AddIncomeSheet open={incomeSheetOpen} onClose={() => setIncomeSheetOpen(false)} onSave={saveIncome} currency={currency} isDesktop={isDesktop} incomeType={ctxProfile?.income_type ?? null} />
      <EditFixedExpensesSheet
        open={fixedEditOpen}
        onClose={() => setFixedEditOpen(false)}
        onSave={saveFixedExpenses}
        initialEntries={fixedExpenses?.entries ?? []}
        currency={currency}
        isDesktop={isDesktop}
        saving={savingFixed}
      />
      <EditSpendingBudgetSheet
        open={budgetEditOpen}
        onClose={() => setBudgetEditOpen(false)}
        onSave={saveSpendingBudget}
        initialCategories={spendingBudget?.categories ?? []}
        currency={currency}
        isDesktop={isDesktop}
        saving={savingBudget}
        spendingHistory={spendingHistory}
      />
    </>
  )

  if (isDesktop) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <SideNav />
        <main style={{ flex: 1, maxWidth: 720, margin: '0 auto' }}>{content}</main>
        {sheets}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: T.pageBg, paddingBottom: 88 }}>
      <main>{content}</main>
      <BottomNav />
      {sheets}
    </div>
  )
}
