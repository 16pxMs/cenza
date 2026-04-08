import { createClient } from '@/lib/supabase/server'
import { deriveCurrentCycleId } from '@/lib/supabase/cycles-db'
import type { UserProfile } from '@/types/database'

interface PlanIncomeRow {
  salary: number | string | null
  extra_income: Array<{ amount?: number | string }> | null
}

interface PlanGoalTargetRow {
  amount: number | string | null
}

interface PlanFixedExpensesRow {
  total_monthly: number | string | null
}

interface PlanSpendingBudgetRow {
  total_budget: number | string | null
}

export interface PlanPageData {
  name: string
  currency: string
  income: number
  goalTotal: number
  goalCount: number
  fixedMonthly: number | null
  spendingTotal: number | null
}

export async function loadPlanPageData(userId: string, profile: UserProfile): Promise<PlanPageData> {
  const supabase = await createClient()
  const cycleId = deriveCurrentCycleId(profile)

  const [incomeRes, targetsRes, expensesRes, budgetsRes] = await Promise.all([
    (supabase.from('income_entries') as any)
      .select('salary, extra_income')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId)
      .maybeSingle(),
    (supabase.from('goal_targets') as any)
      .select('amount')
      .eq('user_id', userId),
    (supabase.from('fixed_expenses') as any)
      .select('total_monthly')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId)
      .maybeSingle(),
    (supabase.from('spending_budgets') as any)
      .select('total_budget')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId)
      .maybeSingle(),
  ])

  const incomeRow = (incomeRes.data ?? null) as PlanIncomeRow | null
  const targetRows = (targetsRes.data ?? []) as PlanGoalTargetRow[]
  const expensesRow = (expensesRes.data ?? null) as PlanFixedExpensesRow | null
  const budgetsRow = (budgetsRes.data ?? null) as PlanSpendingBudgetRow | null

  const income = incomeRow
    ? Number(incomeRow.salary ?? 0) + (incomeRow.extra_income ?? []).reduce(
        (sum, item) => sum + Number(item?.amount ?? 0),
        0
      )
    : 0

  const goalTotal = targetRows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0)

  return {
    name: profile.name ?? '',
    currency: profile.currency ?? 'KES',
    income,
    goalTotal,
    goalCount: targetRows.length,
    fixedMonthly: expensesRow ? Number(expensesRow.total_monthly ?? 0) : null,
    spendingTotal: budgetsRow ? Number(budgetsRow.total_budget ?? 0) : null,
  }
}
