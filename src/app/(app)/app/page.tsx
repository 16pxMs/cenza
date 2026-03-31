'use client'
export const dynamic = 'force-dynamic'

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
import { OverviewLocked } from '@/components/flows/overview/OverviewLocked'
import { CarryForwardScreen, type CarryForwardData } from '@/components/flows/overview/CarryForwardScreen'
import { MonthRecapScreen, type RecapData } from '@/components/flows/overview/MonthRecapScreen'
import { AddIncomeSheet } from '@/components/flows/income/AddIncomeSheet'
import { ReceivedIncomeSheet } from '@/components/flows/log/ReceivedIncomeSheet'
import { CommittedExpenseConfirmSheet, type CommittedExpense } from '@/components/flows/log/CommittedExpenseConfirmSheet'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { getCurrentCycleId, getPrevCycleId } from '@/lib/supabase/cycles-db'
import { profileToPaySchedule, getCycleByDate, formatCycleLabel } from '@/lib/cycles'
import { dbWrite } from '@/lib/db'
import styles from './AppPage.module.css'
import { resolve } from 'path'

const formatDate = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function AppPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const { user, profile: ctxProfile } = useUser()
  const { isDesktop } = useBreakpoint()

  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [cycleId, setCycleId] = useState<string | null>(null)

  const [incomeData, setIncomeData] = useState<any>(null)

  const [totalSpent, setTotalSpent] = useState(0)
  const [fixedTotal, setFixedTotal] = useState(0)

  const [categorySpend, setCategorySpend] = useState<Record<string, number>>({})

  const handleContribGoal = useCallback(async (goalId: string, goalLabel: string, amount: number, note: string) => {
    if (!user || !cycleId) return

    const { error } = await dbWrite(
      (supabase.from('transactions') as any).insert({
        user_id: user.id,
        date: formatDate(),
        cycle_id: cycleId,
        category_type: 'goal',
        category_key: goalId,
        category_label: goalLabel,
        amount,
        note: note.trim() || null,
      })
    )

    if (error) return
  }, [supabase, user, cycleId])

  const handleCommittedConfirm = useCallback(async (expense: CommittedExpense, amount: number) => {
    if (!user || !cycleId) return

    const { error } = await dbWrite(
      (supabase.from('transactions') as any).insert({
        user_id: user.id,
        date: formatDate(),
        cycle_id: cycleId,
        category_type: 'subscription',
        category_key: expense.id,
        category_label: expense.label,
        amount,
      })
    )

    if (error) return
  }, [supabase, user, cycleId])

  const loadOverviewData = useCallback(async (user: any, resolvedCycleId: string) => {
  // 1. Get transactions
  const { data: txns } = await (supabase.from('transactions') as any)
    .select('amount, category_key, category_type')
    .eq('user_id', user.id)
    .eq('cycle_id', resolvedCycleId)

  // 2. Get income
  const { data: income } = await (supabase.from('income_entries') as any)
    .select('*')
    .eq('user_id', user.id)
    .eq('cycle_id', resolvedCycleId)
    .maybeSingle()

  setIncomeData({
    income: Number(income?.salary ?? 0),
    extraIncome: income?.extra_income ?? [],
    total: Number(income?.total ?? 0),
    received: income?.received ?? null,
  })

  // 3. Calculate totals
  const total = (txns ?? []).reduce(
    (s: number, t: any) => s + Number(t.amount),
    0
  )

    setTotalSpent(total)
    const catSpend: Record<string, number> = {}


  const spendTypes = ['everyday', 'subscription']
  
  for (const t of txns ?? []) {
    if (spendTypes.includes(t.category_type)) {
      catSpend[t.category_key] =
      (catSpend[t.category_key] ?? 0) + Number(t.amount)
  }

  setCategorySpend(catSpend)
    console.log('income →', income)
    console.log('txns →', txns)
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    async function load() {
      if (!user || !ctxProfile) return

      const resolvedCycleId = await getCurrentCycleId(supabase as any, user.id, ctxProfile as any)
      setCycleId(resolvedCycleId)

      await loadOverviewData(user, resolvedCycleId)
    }

    load()
  }, [user, ctxProfile, loadOverviewData])

  if (loading) {
  return <div>Loading...</div>
}

const screen = (
  <OverviewWithData
    name="User"
    currency={profile?.currency || 'KES'}
    goals={profile?.goals || []}
    incomeData={incomeData}
    goalTargets={{}}
    goalSaved={{}}
    goalLabels={{}}
    onLogExpense={() => router.push('/log/new?isOther=true')}
    onConfirmIncome={() => {}}
    onContribGoal={handleContribGoal}
    totalSpent={totalSpent}
    fixedTotal={fixedTotal}
    spendingBudget={null as any}
    categorySpend={categorySpend}
    isDesktop={isDesktop}
  />
)

if (isDesktop) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <SideNav />
      <main style={{ flex: 1, maxWidth: 720, margin: '0 auto' }}>
        {screen}
      </main>
    </div>
  )
}

return (
  <div style={{ minHeight: '100vh', paddingBottom: 88 }}>
    <main>{screen}</main>
    <BottomNav />
  </div>
)
}