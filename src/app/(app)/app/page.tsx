'use client'
export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// /app — Main app shell (moved from / to /app)
// Handles auth check, profile load, tab routing.
// Mobile: BottomNav. Desktop: SideNav.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/context/UserContext'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { OverviewEmpty } from '@/components/flows/overview/OverviewEmpty'
import { OverviewWithData } from '@/components/flows/overview/OverviewWithData'
import { FirstTimeWelcome } from '@/components/flows/overview/FirstTimeWelcome'
import { CarryForwardScreen, type CarryForwardData } from '@/components/flows/overview/CarryForwardScreen'
import { MonthRecapScreen, type RecapData } from '@/components/flows/overview/MonthRecapScreen'
import { AddIncomeSheet } from '@/components/flows/income/AddIncomeSheet'
import { ReceivedIncomeSheet } from '@/components/flows/log/ReceivedIncomeSheet'
import { CommittedExpenseConfirmSheet, type CommittedExpense } from '@/components/flows/log/CommittedExpenseConfirmSheet'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { getCurrentCycleId, getPrevCycleId } from '@/lib/supabase/cycles-db'
import { profileToPaySchedule } from '@/lib/cycles'

const MOCK_RECAP: RecapData = {
  prevMonth:   new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7),
  incomeTotal: 200000,
  totalSpent:  87400,
  fixedTotal:  25000,
  categories: [
    { key: 'groceries',     label: 'Groceries',    budgeted: 15000, spent: 12800 },
    { key: 'eating_out',    label: 'Eating out',    budgeted: 8000,  spent: 11200 },
    { key: 'transport',     label: 'Transport',     budgeted: 6000,  spent: 5900  },
    { key: 'entertainment', label: 'Entertainment', budgeted: 5000,  spent: 5000  },
    { key: 'personal_care', label: 'Personal care', budgeted: 4000,  spent: 2100  },
  ],
}

export default function AppPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createClient()
  const { user, profile: ctxProfile } = useUser()
  const { isDesktop } = useBreakpoint()
  const [tab] = useState('overview')
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [incomeSheetOpen, setIncomeSheetOpen] = useState(false)
  const [incomeData, setIncomeData] = useState<any>(null)
  const [freshGoals,  setFreshGoals]  = useState<string[]>([])
  const [goalTargets, setGoalTargets] = useState<Record<string, any> | null>(null)
  const [goalSaved, setGoalSaved] = useState<Record<string, number>>({})
  const [goalLabels, setGoalLabels] = useState<Record<string, string>>({})
  const [totalSpent,     setTotalSpent]     = useState(0)
  const [fixedTotal,     setFixedTotal]     = useState(0)
  const [spendingBudget, setSpendingBudget] = useState<{ categories: any[] } | null>(null)
  const [categorySpend,  setCategorySpend]  = useState<Record<string, number>>({})
  const [carryForwardData, setCarryForwardData] = useState<CarryForwardData | null>(null)
  const [recapData,        setRecapData]        = useState<RecapData | null>(null)
  const [profileSheetOpen, setProfileSheetOpen] = useState(false)
  const [incomeCheckOpen, setIncomeCheckOpen] = useState(false)
  const [declaredTotal, setDeclaredTotal] = useState(0)
  const [pendingLogNavigation, setPendingLogNavigation] = useState(false)
  const [committedCheckOpen,  setCommittedCheckOpen]  = useState(false)
  const [pendingCommitted,    setPendingCommitted]    = useState<CommittedExpense[]>([])

  const [cycleId,     setCycleId]     = useState<string | null>(null)
  const [prevCycleId, setPrevCycleId] = useState<string | null>(null)

  useEffect(() => {
    if (ctxProfile) setProfile(ctxProfile)
  }, [ctxProfile])

  const refreshSpent = useCallback(async () => {
    if (!user || !cycleId) return
    const { data: txns } = await (supabase.from('transactions') as any)
      .select('amount')
      .eq('user_id', user.id)
      .eq('cycle_id', cycleId)
      .neq('category_type', 'goal')
    if (txns) {
      setTotalSpent(txns.reduce((s: number, t: any) => s + Number(t.amount), 0))
    }
  }, [supabase, user, cycleId])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshSpent()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [refreshSpent])

  const handleContribGoal = useCallback(async (goalId: string, goalLabel: string, amount: number, note: string) => {
    if (!user || !cycleId) return
    await (supabase.from('transactions') as any).insert({
      user_id:        user.id,
      date:           new Date().toISOString().slice(0, 10),
      month:          new Date().toISOString().slice(0, 7),
      cycle_id:       cycleId,
      category_type:  'goal',
      category_key:   goalId,
      category_label: goalLabel,
      amount,
      note:           note.trim() || null,
    })
    setGoalSaved(prev => ({ ...prev, [goalId]: (prev[goalId] ?? 0) + amount }))
  }, [supabase, cycleId, user])

  const handleCommittedConfirm = useCallback(async (expense: CommittedExpense, amount: number) => {
    if (!user || !cycleId) return
    if (expense.source === 'subscription') {
      await Promise.all([
        (supabase.from('transactions') as any).insert({
          user_id:        user.id,
          date:           new Date().toISOString().slice(0, 10),
          month:          new Date().toISOString().slice(0, 7),
          cycle_id:       cycleId,
          category_type:  'subscription',
          category_key:   expense.id,
          category_label: expense.label,
          amount,
          note:           null,
        }),
        (supabase.from('subscriptions') as any)
          .update({ last_confirmed_cycle_id: cycleId })
          .eq('id', expense.id),
      ])
    }
  }, [supabase, cycleId, user])

  const handleCommittedSkip = useCallback(async (expense: CommittedExpense) => {
    if (!user || !cycleId) return
    if (expense.source === 'subscription') {
      await (supabase.from('subscriptions') as any)
        .update({ last_confirmed_cycle_id: cycleId })
        .eq('id', expense.id)
    }
  }, [supabase, cycleId, user])

  const handleIncomeConfirm = useCallback(async (received: number, day: number | null) => {
    if (!user || !cycleId) return
    const ops: Promise<unknown>[] = [
      (supabase.from('income_entries') as any).update({
        received,
        received_confirmed_at: new Date().toISOString(),
      }).eq('user_id', user.id).eq('cycle_id', cycleId),
    ]
    if (day !== null && !profile?.pay_day) {
      ops.push(
        (supabase.from('user_profiles') as any).update({ pay_day: day }).eq('id', user.id)
      )
    }
    await Promise.all(ops)
    setIncomeCheckOpen(false)
    setIncomeData((prev: any) => prev ? { ...prev, received, received_confirmed_at: new Date().toISOString() } : prev)
    if (pendingLogNavigation) {
      setPendingLogNavigation(false)
      router.push('/log?open=true')
    }
  }, [supabase, cycleId, profile, pendingLogNavigation, router])

  const saveIncome = useCallback(async (data: { income: number; extraIncome: any[]; total: number; incomeType?: string }) => {
    if (!data.income || data.income <= 0) {
      throw new Error('Income must be greater than zero')
    }
    if (!user || !cycleId) return
    const ops: Promise<any>[] = [
      (supabase.from('income_entries') as any).upsert({
        user_id:      user.id,
        month:        new Date().toISOString().slice(0, 7),
        cycle_id:     cycleId,
        salary:       data.income,
        extra_income: data.extraIncome,
        total:        data.total,
      }, { onConflict: 'user_id,cycle_id' }),
    ]
    if (data.incomeType) {
      ops.push(
        (supabase.from('user_profiles') as any)
          .update({ income_type: data.incomeType })
          .eq('id', user.id)
      )
    }
    const [{ error }] = await Promise.all(ops)
    if (!error) {
      setIncomeData(data)
      if (data.incomeType) setProfile((p: any) => p ? { ...p, income_type: data.incomeType } : p)
    }
  }, [supabase, cycleId, user])

  const loadOverviewData = useCallback(async (user: any, resolvedCycleId: string) => {
    const [
      { data: income },
      { data: targets },
      { data: goalTxns },
      { data: txns },
      { data: fixedExp },
      { data: budgetData },
      { data: profileRow },
    ] = await Promise.all([
      (supabase.from('income_entries') as any)
        .select('*').eq('user_id', user.id).eq('cycle_id', resolvedCycleId).maybeSingle(),
      (supabase.from('goal_targets') as any)
        .select('goal_id, amount, destination').eq('user_id', user.id),
      (supabase.from('transactions') as any)
        .select('category_key, amount').eq('user_id', user.id).eq('category_type', 'goal'),
      (supabase.from('transactions') as any)
        .select('amount, category_key, category_type').eq('user_id', user.id).eq('cycle_id', resolvedCycleId).neq('category_type', 'goal'),
      (supabase.from('fixed_expenses') as any)
        .select('total_monthly').eq('user_id', user.id).eq('cycle_id', resolvedCycleId).maybeSingle(),
      (supabase.from('spending_budgets') as any)
        .select('total_budget, categories').eq('user_id', user.id).eq('cycle_id', resolvedCycleId).maybeSingle(),
      // Always fetch goals fresh — ctxProfile.goals is cached in UserContext and goes stale
      // after the user adds a goal and navigates back to this page.
      (supabase.from('user_profiles') as any)
        .select('goals').eq('id', user.id).single(),
    ])

    if (profileRow?.goals) setFreshGoals(profileRow.goals)

    if (income) {
      setIncomeData(income)
      setDeclaredTotal(Number(income.total ?? 0))
      if (income.received_confirmed_at === null && ctxProfile?.income_type !== 'variable') {
        setIncomeCheckOpen(true)
      }
    }

    if (targets && targets.length > 0) {
      const amountMap: Record<string, any>  = {}
      const labelMap: Record<string, string> = {}
      for (const t of targets) {
        amountMap[t.goal_id] = t.amount
        if (t.goal_id === 'travel' && t.destination) labelMap[t.goal_id] = `Travel to ${t.destination}`
        else if (t.goal_id === 'other'  && t.destination) labelMap[t.goal_id] = t.destination
      }
      setGoalTargets(amountMap)
      setGoalLabels(labelMap)
    }

    if (goalTxns) {
      const saved: Record<string, number> = {}
      for (const t of goalTxns) saved[t.category_key] = (saved[t.category_key] ?? 0) + Number(t.amount)
      setGoalSaved(saved)
    }

    if (txns) {
      setTotalSpent(txns.reduce((s: number, t: any) => s + Number(t.amount), 0))
      const catSpend: Record<string, number> = {}
      for (const t of txns) {
        if (t.category_type === 'variable') {
          catSpend[t.category_key] = (catSpend[t.category_key] ?? 0) + Number(t.amount)
        }
      }
      setCategorySpend(catSpend)
    }
    if (fixedExp)   setFixedTotal(fixedExp.total_monthly ?? 0)
    if (budgetData) setSpendingBudget(budgetData)

    // Load subscriptions that haven't been confirmed this cycle
    const { data: subs } = await (supabase.from('subscriptions') as any)
      .select('id, key, label, amount, last_confirmed_cycle_id')
      .eq('user_id', user.id)
      .eq('needs_check', true)

    if (subs && subs.length > 0) {
      const unconfirmed: CommittedExpense[] = subs
        .filter((s: any) => s.last_confirmed_cycle_id !== resolvedCycleId)
        .map((s: any) => ({
          id:     s.id,
          label:  s.label,
          amount: s.amount ?? null,
          source: 'subscription' as const,
        }))
      if (unconfirmed.length > 0) {
        setPendingCommitted(unconfirmed)
        setCommittedCheckOpen(true)
      }
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    async function load() {
      if (!user) return
      if (!ctxProfile) return
      if (!ctxProfile.onboarding_complete) { router.push('/onboarding'); return }

      const resolvedCycleId = await getCurrentCycleId(supabase as any, user.id, ctxProfile as any)
      setCycleId(resolvedCycleId)

      const CARRY_DISMISSED_KEY = `cenza:carry-dismissed:${resolvedCycleId}`

      const { data: currentIncome } = await (supabase.from('income_entries') as any)
        .select('salary')
        .eq('user_id', user.id)
        .eq('cycle_id', resolvedCycleId)
        .maybeSingle()

      if (currentIncome) {
        await loadOverviewData(user, resolvedCycleId)
        return
      }

      if (typeof window !== 'undefined' && localStorage.getItem(CARRY_DISMISSED_KEY)) {
        await loadOverviewData(user, resolvedCycleId)
        return
      }

      const resolvedPrevCycleId = await getPrevCycleId(supabase as any, user.id, ctxProfile as any)
      setPrevCycleId(resolvedPrevCycleId)

      const [{ data: prevIncome }, { data: prevExpenses }, { data: prevBudgets }] = await Promise.all([
        resolvedPrevCycleId
          ? (supabase.from('income_entries') as any)
              .select('salary, extra_income, total')
              .eq('user_id', user.id).eq('cycle_id', resolvedPrevCycleId).maybeSingle()
          : Promise.resolve({ data: null }),
        resolvedPrevCycleId
          ? (supabase.from('fixed_expenses') as any)
              .select('total_monthly, entries')
              .eq('user_id', user.id).eq('cycle_id', resolvedPrevCycleId).maybeSingle()
          : Promise.resolve({ data: null }),
        resolvedPrevCycleId
          ? (supabase.from('spending_budgets') as any)
              .select('total_budget, categories')
              .eq('user_id', user.id).eq('cycle_id', resolvedPrevCycleId).maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      if (prevIncome) {
        const carryData: CarryForwardData = {
          prevMonth: resolvedPrevCycleId ?? '',
          income: {
            salary:       prevIncome.salary,
            extra_income: prevIncome.extra_income ?? [],
            total:        prevIncome.total,
          },
          expenses: prevExpenses
            ? { total_monthly: prevExpenses.total_monthly, entries: prevExpenses.entries ?? [] }
            : null,
          budgets: prevBudgets
            ? { total_budget: prevBudgets.total_budget, categories: prevBudgets.categories ?? [] }
            : null,
        }
        setCarryForwardData(carryData)

        const { data: prevTxns } = resolvedPrevCycleId
          ? await (supabase.from('transactions') as any)
              .select('category_key, category_label, category_type, amount')
              .eq('user_id', user.id).eq('cycle_id', resolvedPrevCycleId).neq('category_type', 'goal')
          : { data: null }

        if (prevTxns && prevTxns.length > 0) {
          const variableSpend: Record<string, number> = {}
          let fixedTotalPrev = 0

          for (const t of prevTxns) {
            if (t.category_type === 'fixed') {
              fixedTotalPrev += Number(t.amount)
            } else {
              variableSpend[t.category_key] = (variableSpend[t.category_key] ?? 0) + Number(t.amount)
            }
          }

          const totalSpentPrev = Object.values(variableSpend).reduce((s, v) => s + v, 0)
          const budgetCats: any[] = prevBudgets?.categories ?? []

          const categories = budgetCats
            .filter((c: any) => c.budget > 0 || (variableSpend[c.key] ?? 0) > 0)
            .map((c: any) => ({
              key:      c.key,
              label:    c.label ?? c.key,
              budgeted: Number(c.budget ?? 0),
              spent:    variableSpend[c.key] ?? 0,
            }))

          setRecapData({
            prevMonth: resolvedPrevCycleId ?? '',
            incomeTotal: Number(prevIncome.total ?? 0),
            totalSpent:  totalSpentPrev,
            fixedTotal:  fixedTotalPrev,
            categories,
          })
        }

        setLoading(false)
        return
      }

      await loadOverviewData(user, resolvedCycleId)
    }
    if (user && ctxProfile) load()
  }, [user, ctxProfile, loadOverviewData])

  const handleCarryForward = async (selectedEntries: any[], selectedCategories: any[]) => {
    if (!user || !carryForwardData || !cycleId) return

    const income = carryForwardData.income
    await (supabase.from('income_entries') as any).upsert({
      user_id:      user.id,
      month:        new Date().toISOString().slice(0, 7),
      cycle_id:     cycleId,
      salary:       income.salary,
      extra_income: income.extra_income,
      total:        income.total,
    }, { onConflict: 'user_id,cycle_id' })

    if (carryForwardData.expenses && selectedEntries.length > 0) {
      const totalMonthly = selectedEntries.reduce((s: number, e: any) => s + (e.monthly ?? 0), 0)
      await (supabase.from('fixed_expenses') as any).upsert({
        user_id:       user.id,
        month:         new Date().toISOString().slice(0, 7),
        cycle_id:      cycleId,
        total_monthly: totalMonthly,
        entries:       selectedEntries,
      }, { onConflict: 'user_id,cycle_id' })
    }

    if (carryForwardData.budgets && selectedCategories.length > 0) {
      const totalBudget = selectedCategories.reduce((s: number, c: any) => s + (c.budget ?? 0), 0)
      await (supabase.from('spending_budgets') as any).upsert({
        user_id:      user.id,
        month:        new Date().toISOString().slice(0, 7),
        cycle_id:     cycleId,
        total_budget: totalBudget,
        categories:   selectedCategories,
      }, { onConflict: 'user_id,cycle_id' })
    }

    setCarryForwardData(null)
    await loadOverviewData(user, cycleId)
  }

  const handleRecapContinue = () => setRecapData(null)

  const handleCarryForwardFresh = async () => {
    if (typeof window !== 'undefined' && cycleId) {
      localStorage.setItem(`cenza:carry-dismissed:${cycleId}`, '1')
    }
    setCarryForwardData(null)
    if (user && cycleId) await loadOverviewData(user, cycleId)
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--page-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 14,
      }}>
        Loading...
      </div>
    )
  }

  if (recapData || searchParams.get('recap') === '1') {
    const screen = (
      <MonthRecapScreen
        data={recapData ?? MOCK_RECAP}
        currency={profile?.currency || 'KES'}
        currentMonth={cycleId ?? ''}
        isDesktop={isDesktop}
        onContinue={handleRecapContinue}
      />
    )
    if (isDesktop) {
      return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <SideNav />
          <main style={{ flex: 1, maxWidth: 720, margin: '0 auto' }}>{screen}</main>
        </div>
      )
    }
    return (
      <div style={{ minHeight: '100vh', background: 'var(--page-bg)', paddingBottom: 88 }}>
        <main>{screen}</main>
        <BottomNav />
      </div>
    )
  }

  if (carryForwardData) {
    const screen = (
      <CarryForwardScreen
        data={carryForwardData}
        currency={profile?.currency || 'KES'}
        currentMonth={cycleId ?? ''}
        isDesktop={isDesktop}
        onConfirm={handleCarryForward}
        onFresh={handleCarryForwardFresh}
      />
    )
    if (isDesktop) {
      return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <SideNav />
          <main style={{ flex: 1, maxWidth: 720, margin: '0 auto' }}>{screen}</main>
        </div>
      )
    }
    return (
      <div style={{ minHeight: '100vh', background: 'var(--page-bg)', paddingBottom: 88 }}>
        <main>{screen}</main>
        <BottomNav />
      </div>
    )
  }

  const firstName = profile?.name?.split(' ')[0] ?? ''

  // 3-way overview state:
  //  1. No income + no transactions → first-time user, log expense first
  //  2. No income + has transactions → needs to add income (OverviewEmpty)
  //  3. Has income → full overview
  const overviewContent = incomeData ? (
    <OverviewWithData
      name={firstName}
      currency={profile?.currency || 'KES'}
      goals={freshGoals.length > 0 ? freshGoals : (profile?.goals || [])}
      incomeData={incomeData}
      goalTargets={goalTargets}
      goalSaved={goalSaved}
      goalLabels={goalLabels}
      onLogExpense={() => {
        const incomeConfirmed = incomeData?.received != null && (incomeData as any).received > 0
        if (totalSpent > 0 && !incomeConfirmed) {
          setPendingLogNavigation(true)
          setIncomeCheckOpen(true)
        } else {
          router.push(totalSpent === 0 ? '/log/first' : '/log?open=true')
        }
      }}
      onConfirmIncome={() => setIncomeCheckOpen(true)}
      onContribGoal={handleContribGoal}
      totalSpent={totalSpent}
      fixedTotal={fixedTotal}
      spendingBudget={spendingBudget}
      categorySpend={categorySpend}
      isDesktop={isDesktop}
    />
  ) : totalSpent === 0 ? (
    <FirstTimeWelcome
      name={firstName}
      onStart={() => router.push('/log/first')}
    />
  ) : (
    <OverviewEmpty
      name={firstName}
      currency={profile?.currency || 'KES'}
      onSave={async (data) => { await saveIncome(data); setIncomeSheetOpen(false) }}
    />
  )

  const tabContent: Record<string, React.ReactNode> = {
    overview: overviewContent,
  }

  const initial = (firstName || '?')[0].toUpperCase()

  const avatar = (
    <button
      onClick={() => router.push('/settings')}
      style={{
        position: 'fixed', top: 14, right: 16, zIndex: 9999,
        width: 36, height: 36, borderRadius: '50%',
        background: 'var(--brand-dark)', border: 'none',
        color: '#fff', fontSize: 14, fontWeight: 600,
        cursor: 'pointer', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {initial}
    </button>
  )

  const profileSheet = (
    <Sheet open={profileSheetOpen} onClose={() => setProfileSheetOpen(false)} title="Account">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: 'var(--brand-dark)', color: '#fff',
          fontSize: 18, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {initial}
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>{profile?.name}</p>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-3)' }}>{profile?.currency} account</p>
        </div>
      </div>
      <button
        onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}
        style={{
          width: '100%', height: 48, borderRadius: 'var(--radius-md)',
          background: '#FEF2F2', border: '1px solid #FECACA',
          color: '#DC2626', fontSize: 15, fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        Sign out
      </button>
    </Sheet>
  )

  if (isDesktop) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        {avatar}
        {profileSheet}
        <SideNav />
        <main style={{ flex: 1, maxWidth: 720, margin: '0 auto', padding: '0 0 40px' }}>
          {tabContent[tab]}
        </main>
        <AddIncomeSheet
          open={incomeSheetOpen}
          onClose={() => setIncomeSheetOpen(false)}
          onSave={async (data) => { await saveIncome(data); setIncomeSheetOpen(false) }}
          currency={profile?.currency || 'KES'}
          isDesktop={isDesktop}
          incomeType={profile?.income_type ?? null}
        />
        <ReceivedIncomeSheet
          open={incomeCheckOpen}
          onClose={() => { setIncomeCheckOpen(false); setPendingLogNavigation(false) }}
          declaredTotal={declaredTotal}
          currency={profile?.currency || 'KES'}
          payDay={profile?.pay_day ?? null}
          onConfirm={handleIncomeConfirm}
        />
        <CommittedExpenseConfirmSheet
          open={committedCheckOpen}
          onClose={() => setCommittedCheckOpen(false)}
          expenses={pendingCommitted}
          currency={profile?.currency || 'KES'}
          currentMonth={cycleId ?? ''}
          onConfirm={handleCommittedConfirm}
          onSkip={handleCommittedSkip}
        />
      </div>
    )
  }

  const isFirstTimeUser = !incomeData && totalSpent === 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', paddingBottom: isFirstTimeUser ? 0 : 88 }}>
      {avatar}
      {profileSheet}
      <main>{tabContent[tab]}</main>
      {!isFirstTimeUser && <BottomNav />}
      <AddIncomeSheet
        open={incomeSheetOpen}
        onClose={() => setIncomeSheetOpen(false)}
        onSave={async (data) => { await saveIncome(data); setIncomeSheetOpen(false) }}
        currency={profile?.currency || 'KES'}
        isDesktop={isDesktop}
        incomeType={profile?.income_type ?? null}
      />
      <ReceivedIncomeSheet
        open={incomeCheckOpen}
        onClose={() => { setIncomeCheckOpen(false); setPendingLogNavigation(false) }}
        declaredTotal={declaredTotal}
        currency={profile?.currency || 'KES'}
        payDay={profile?.pay_day ?? null}
        onConfirm={handleIncomeConfirm}
      />
      <CommittedExpenseConfirmSheet
        open={committedCheckOpen}
        onClose={() => setCommittedCheckOpen(false)}
        expenses={pendingCommitted}
        currency={profile?.currency || 'KES'}
        currentMonth={cycleId ?? ''}
        onConfirm={handleCommittedConfirm}
        onSkip={handleCommittedSkip}
      />
    </div>
  )
}
