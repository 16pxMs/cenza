// ─────────────────────────────────────────────────────────────
// /app — Main app shell
// Handles auth check, profile load, tab routing.
// Mobile: BottomNav. Desktop: SideNav.
// State: profile, incomeData, incomeSheetOpen, tab
// ─────────────────────────────────────────────────────────────
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { OverviewEmpty } from '@/components/flows/overview/OverviewEmpty'
import { OverviewWithData } from '@/components/flows/overview/OverviewWithData'
import { CarryForwardScreen, type CarryForwardData } from '@/components/flows/overview/CarryForwardScreen'
import { AddIncomeSheet } from '@/components/flows/income/AddIncomeSheet'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { getPrevMonth } from '@/lib/finance'

export default function AppPage() {
  const router = useRouter()
  const supabase = createClient()
  const { isDesktop } = useBreakpoint()
  const [tab] = useState('overview')
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [incomeSheetOpen, setIncomeSheetOpen] = useState(false)
  const [incomeData, setIncomeData] = useState<any>(null)
  const [goalTargets, setGoalTargets] = useState<Record<string, any> | null>(null)
  const [goalSaved, setGoalSaved] = useState<Record<string, number>>({})
  const [totalSpent, setTotalSpent] = useState(0)
  const [fixedTotal, setFixedTotal] = useState(0)
  const [carryForwardData, setCarryForwardData] = useState<CarryForwardData | null>(null)
  const [profileSheetOpen, setProfileSheetOpen] = useState(false)

  const currentMonth = new Date().toISOString().slice(0, 7) // "YYYY-MM"
  const CARRY_DISMISSED_KEY = `cenza:carry-dismissed:${currentMonth}`

  // Lightweight re-fetch of totalSpent — runs when page regains visibility
  const refreshSpent = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: txns } = await (supabase.from('transactions') as any)
      .select('amount')
      .eq('user_id', user.id)
      .eq('month', new Date().toISOString().slice(0, 7))
    if (txns) {
      setTotalSpent(txns.reduce((s: number, t: any) => s + Number(t.amount), 0))
    }
  }, [supabase])

  // Re-fetch spent total whenever the user returns to this tab/page
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshSpent()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [refreshSpent])

  const handleContribGoal = useCallback(async (goalId: string, goalLabel: string, amount: number, note: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await (supabase.from('transactions') as any).insert({
      user_id:        user.id,
      date:           new Date().toISOString().slice(0, 10),
      month:          currentMonth,
      category_type:  'goal',
      category_key:   goalId,
      category_label: goalLabel,
      amount,
      note:           note.trim() || null,
    })
    setGoalSaved(prev => ({ ...prev, [goalId]: (prev[goalId] ?? 0) + amount }))
    setTotalSpent(prev => prev + amount)
  }, [supabase, currentMonth])

  const saveIncome = useCallback(async (data: { income: number; extraIncome: any[]; total: number }) => {
    if (!data.income || data.income <= 0) {
      throw new Error('Income must be greater than zero')
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await (supabase.from('income_entries') as any).upsert({
      user_id: user.id,
      month: currentMonth,
      salary: data.income,
      extra_income: data.extraIncome,
      total: data.total,
    }, { onConflict: 'user_id,month' })
    if (!error) {
      setIncomeData(data)
    }
  }, [supabase])

  const loadOverviewData = useCallback(async (user: any) => {
    const [
      { data: income },
      { data: targets },
      { data: goalTxns },
      { data: txns },
      { data: fixedExp },
    ] = await Promise.all([
      (supabase.from('income_entries') as any)
        .select('*').eq('user_id', user.id).eq('month', currentMonth).single(),
      (supabase.from('goal_targets') as any)
        .select('goal_id, amount').eq('user_id', user.id),
      (supabase.from('transactions') as any)
        .select('category_key, amount').eq('user_id', user.id).eq('category_type', 'goal'),
      (supabase.from('transactions') as any)
        .select('amount').eq('user_id', user.id).eq('month', currentMonth),
      (supabase.from('fixed_expenses') as any)
        .select('total_monthly').eq('user_id', user.id).eq('month', currentMonth).maybeSingle(),
    ])

    if (income) setIncomeData(income)

    if (targets && targets.length > 0) {
      const map: Record<string, any> = {}
      for (const t of targets) map[t.goal_id] = t.amount
      setGoalTargets(map)
    }

    if (goalTxns) {
      const saved: Record<string, number> = {}
      for (const t of goalTxns) saved[t.category_key] = (saved[t.category_key] ?? 0) + Number(t.amount)
      setGoalSaved(saved)
    }

    if (txns) setTotalSpent(txns.reduce((s: number, t: any) => s + Number(t.amount), 0))
    if (fixedExp) setFixedTotal(fixedExp.total_monthly ?? 0)

    setLoading(false)
  }, [supabase, currentMonth])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('user_profiles').select('*').eq('id', user.id).single() as { data: any }

      if (!profile || !profile.onboarding_complete) { router.push('/onboarding'); return }
      setProfile(profile)

      // Check if current month already has income
      const { data: currentIncome } = await (supabase.from('income_entries') as any)
        .select('salary')
        .eq('user_id', user.id)
        .eq('month', currentMonth)
        .maybeSingle()

      if (currentIncome) {
        // Normal load — current month has a plan
        await loadOverviewData(user)
        return
      }

      // No plan for current month — check if already dismissed carry-forward
      if (typeof window !== 'undefined' && localStorage.getItem(CARRY_DISMISSED_KEY)) {
        await loadOverviewData(user)
        return
      }

      // Check if previous month has a plan to carry forward
      const prevMonth = getPrevMonth(currentMonth)

      const [{ data: prevIncome }, { data: prevExpenses }, { data: prevBudgets }] = await Promise.all([
        (supabase.from('income_entries') as any)
          .select('salary, extra_income, total')
          .eq('user_id', user.id)
          .eq('month', prevMonth)
          .maybeSingle(),
        (supabase.from('fixed_expenses') as any)
          .select('total_monthly, entries')
          .eq('user_id', user.id)
          .eq('month', prevMonth)
          .maybeSingle(),
        (supabase.from('spending_budgets') as any)
          .select('total_budget, categories')
          .eq('user_id', user.id)
          .eq('month', prevMonth)
          .maybeSingle(),
      ])

      if (prevIncome) {
        setCarryForwardData({
          prevMonth,
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
        })
        setLoading(false)
        return
      }

      // No previous month data either — normal empty state
      await loadOverviewData(user)
    }
    load()
  }, [loadOverviewData])

  // Copy selected items from last month into current month
  const handleCarryForward = async (selectedEntries: any[], selectedCategories: any[]) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !carryForwardData) return

    const income = carryForwardData.income
    await (supabase.from('income_entries') as any).upsert({
      user_id:      user.id,
      month:        currentMonth,
      salary:       income.salary,
      extra_income: income.extra_income,
      total:        income.total,
    }, { onConflict: 'user_id,month' })

    if (carryForwardData.expenses && selectedEntries.length > 0) {
      const totalMonthly = selectedEntries.reduce((s: number, e: any) => s + (e.monthly ?? 0), 0)
      await (supabase.from('fixed_expenses') as any).upsert({
        user_id:       user.id,
        month:         currentMonth,
        total_monthly: totalMonthly,
        entries:       selectedEntries,
      }, { onConflict: 'user_id,month' })
    }

    if (carryForwardData.budgets && selectedCategories.length > 0) {
      const totalBudget = selectedCategories.reduce((s: number, c: any) => s + (c.budget ?? 0), 0)
      await (supabase.from('spending_budgets') as any).upsert({
        user_id:      user.id,
        month:        currentMonth,
        total_budget: totalBudget,
        categories:   selectedCategories,
      }, { onConflict: 'user_id,month' })
    }

    setCarryForwardData(null)
    await loadOverviewData(user)
  }

  // Dismiss carry-forward — remember for this month, go to normal empty state
  const handleCarryForwardFresh = async () => {
    if (typeof window !== 'undefined') localStorage.setItem(CARRY_DISMISSED_KEY, '1')
    setCarryForwardData(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await loadOverviewData(user)
  }

  // Loading state
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

  // Carry-forward screen — shown at start of new month
  if (carryForwardData) {
    const screen = (
      <CarryForwardScreen
        data={carryForwardData}
        currency={profile?.currency || 'KES'}
        currentMonth={currentMonth}
        isDesktop={isDesktop}
        onConfirm={handleCarryForward}
        onFresh={handleCarryForwardFresh}
      />
    )
    if (isDesktop) {
      return (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--page-bg)' }}>
          <SideNav />
          <main style={{ flex: 1, maxWidth: 720 }}>{screen}</main>
        </div>
      )
    }
    return (
      <div style={{ minHeight: '100vh', background: 'var(--page-bg)', paddingBottom: 72 }}>
        <main>{screen}</main>
        <BottomNav />
      </div>
    )
  }

  // Tab content
  const tabContent: Record<string, React.ReactNode> = {
    overview: incomeData ? (
      <OverviewWithData
        name={profile?.name}
        currency={profile?.currency || 'KES'}
        goals={profile?.goals || []}
        incomeData={incomeData}
        goalTargets={goalTargets}
        goalSaved={goalSaved}
        onAddDebts={() => router.push('/debts')}
        onLogExpense={() => router.push(totalSpent === 0 ? '/log/first' : '/log?open=true')}
        onContribGoal={handleContribGoal}
        totalSpent={totalSpent}
        fixedTotal={fixedTotal}
        isDesktop={isDesktop}
      />
    ) : (
      <OverviewEmpty
        name={profile?.name}
        currency={profile?.currency || 'KES'}
        onSave={async (data) => { await saveIncome(data); setIncomeSheetOpen(false) }}
      />
    ),
    spend: (
      <div style={{ padding: '24px 28px', color: 'var(--text-3)', fontSize: 14 }}>
        Spend tab coming soon
      </div>
    ),
    goals: (
      <div style={{ padding: '24px 28px', color: 'var(--text-3)', fontSize: 14 }}>
        Goals tab coming soon
      </div>
    ),
    finance: (
      <div style={{ padding: '24px 28px', color: 'var(--text-3)', fontSize: 14 }}>
        Finance tab coming soon
      </div>
    ),
  }

  const initial = (profile?.name ?? '?')[0].toUpperCase()

  // Persistent avatar button — shown in all states except loading
  const avatar = (
    <button
      onClick={() => setProfileSheetOpen(true)}
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

  // Profile sheet — sign out + future settings home
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

  // Desktop layout
  if (isDesktop) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--page-bg)' }}>
        {avatar}
        {profileSheet}
        <SideNav />
        <main style={{ flex: 1, maxWidth: 720, padding: '0 0 40px' }}>
          {tabContent[tab]}
        </main>
        <AddIncomeSheet
          open={incomeSheetOpen}
          onClose={() => setIncomeSheetOpen(false)}
          onSave={async (data) => { await saveIncome(data); setIncomeSheetOpen(false) }}
          currency={profile?.currency || 'KES'}
          isDesktop={isDesktop}
        />
      </div>
    )
  }

  // Mobile layout
  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', paddingBottom: 72 }}>
      {avatar}
      {profileSheet}
      <main>{tabContent[tab]}</main>
      <BottomNav />
      <AddIncomeSheet
        open={incomeSheetOpen}
        onClose={() => setIncomeSheetOpen(false)}
        onSave={async (data) => { await saveIncome(data); setIncomeSheetOpen(false) }}
        currency={profile?.currency || 'KES'}
        isDesktop={isDesktop}
      />
    </div>
  )
}
