import { deriveIncomeTotal } from '@/lib/income/derived'
import { createClient } from '@/lib/supabase/server'
import { deriveCurrentCycleId } from '@/lib/supabase/cycles-db'
import type { GoalId, UserProfile } from '@/types/database'

export interface NewGoalPageData {
  cycleId: string
  currency: string
  totalIncome: number
  fixedMonthly: number
  existingGoals: GoalId[]
  alreadySaved: number
}

export async function loadNewGoalPageData(
  userId: string,
  profile: UserProfile,
  goalType: GoalId | null
): Promise<NewGoalPageData> {
  const supabase = await createClient()
  const cycleId = deriveCurrentCycleId(profile)

  const fetchSaved = goalType
    ? (supabase.from('transactions') as any)
        .select('amount')
        .eq('user_id', userId)
        .eq('category_type', 'goal')
        .eq('category_key', goalType)
    : Promise.resolve({ data: [] })

  const [incomeRes, expensesRes, savedRes] = await Promise.all([
    (supabase.from('income_entries') as any)
      .select('total')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId)
      .maybeSingle(),
    (supabase.from('fixed_expenses') as any)
      .select('total_monthly')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId)
      .maybeSingle(),
    fetchSaved,
  ])

  return {
    cycleId,
    currency: profile.currency ?? '',
    totalIncome: deriveIncomeTotal(incomeRes.data ?? null),
    fixedMonthly: Number(expensesRes.data?.total_monthly ?? 0),
    existingGoals: (profile.goals ?? []) as GoalId[],
    alreadySaved: (savedRes.data ?? []).reduce((sum: number, txn: any) => sum + Number(txn.amount), 0),
  }
}
