import { createClient } from '@/lib/supabase/server'
import type { GoalId, UserProfile } from '@/types/database'

interface GoalTargetRow {
  goal_id: string
  amount: number | string
  destination: string | null
}

interface IncomeRow {
  salary: number | string | null
  extra_income: Array<{ amount?: number | string }> | null
}

export interface TargetsPageData {
  goals: GoalId[]
  currency: string
  totalIncome: number
  initialStep: number
  existingTargets: Record<string, { amount: number; destination: string | null } | null>
}

export async function loadTargetsPageData(userId: string, profile: UserProfile): Promise<TargetsPageData> {
  const supabase = await createClient()
  const [savedTargetsRes, incomeRes] = await Promise.all([
    (supabase.from('goal_targets') as any)
      .select('goal_id, amount, destination')
      .eq('user_id', userId),
    (supabase.from('income_entries') as any)
      .select('salary, extra_income')
      .eq('user_id', userId)
      .order('month', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const goals = ((profile.goals ?? []) as GoalId[])
  const savedTargets = (savedTargetsRes.data ?? []) as GoalTargetRow[]
  const income = (incomeRes.data ?? null) as IncomeRow | null

  const filledIds = new Set(savedTargets.map(target => target.goal_id))
  const firstUnfilled = goals.findIndex(goalId => !filledIds.has(goalId))
  const existingTargets: Record<string, { amount: number; destination: string | null }> = {}

  for (const target of savedTargets) {
    existingTargets[target.goal_id] = {
      amount: Number(target.amount),
      destination: target.destination ?? null,
    }
  }

  const totalIncome = income
    ? Number(income.salary ?? 0) + (income.extra_income ?? []).reduce(
        (sum, item) => sum + Number(item?.amount ?? 0),
        0
      )
    : 0

  return {
    goals,
    currency: profile.currency ?? 'KES',
    totalIncome,
    initialStep: firstUnfilled === -1 ? 0 : firstUnfilled,
    existingTargets,
  }
}
