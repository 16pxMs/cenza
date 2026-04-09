import { GOAL_META } from '@/constants/goals'
import { createClient } from '@/lib/supabase/server'
import { deriveCurrentCycleId } from '@/lib/supabase/cycles-db'
import type { GoalId, UserProfile } from '@/types/database'

interface ExtraIncomeItem {
  id: string
  label: string
  amount: number
}

interface IncomeData {
  income: number
  extraIncome: ExtraIncomeItem[]
  total: number
  received: number | null
}

interface SpendingBudgetCategory {
  key: string
  label: string
  budget: number
}

interface SpendingBudgetData {
  total_budget: number
  categories: SpendingBudgetCategory[]
}

interface OverviewTransactionRow {
  id: string | number
  amount: number | string
  category_key: string
  category_type: string
  category_label: string | null
  date: string
}

interface OverviewIncomeRow {
  salary: number | string | null
  extra_income: Array<{ id?: string | number; label?: string; amount?: number | string }> | null
  total: number | string | null
  received: number | string | null
}

interface OverviewGoalTargetRow {
  goal_id: string
  amount: number | string | null
  added_at: string
  destination: string | null
}

export interface OverviewPageData {
  name: string
  currency: string
  goals: GoalId[]
  hasStartedCycleData: boolean
  incomeData: IncomeData
  totalSpent: number
  fixedTotal: number
  spendingBudget: SpendingBudgetData | null
  categorySpend: Record<string, number>
  recentActivity: Array<{
    id: string
    label: string
    amount: number
    date: string
  }>
  goalTargets: Record<string, number>
  goalSaved: Record<string, number>
  goalLabels: Record<string, string>
}

function titleFromKey(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function toGoalLabel(goalId: GoalId, destination: string | null): string {
  if (goalId === 'travel' && destination) return `Travel to ${destination}`
  if (goalId === 'other' && destination) return destination
  return GOAL_META[goalId].label
}

export async function loadOverviewPageData(userId: string, profile: UserProfile): Promise<OverviewPageData> {
  const supabase = await createClient()
  const cycleId = deriveCurrentCycleId(profile)

  const [
    { data: txns },
    { data: income },
    { data: fixedExpenses },
    { data: spendingBudget },
    { data: goalTargets },
  ] = await Promise.all([
    (supabase.from('transactions') as any)
      .select('id, amount, category_key, category_type, category_label, date')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId),
    (supabase.from('income_entries') as any)
      .select('salary, extra_income, total, received')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId)
      .maybeSingle(),
    (supabase.from('fixed_expenses') as any)
      .select('total_monthly')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId)
      .maybeSingle(),
    (supabase.from('spending_budgets') as any)
      .select('total_budget, categories')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId)
      .maybeSingle(),
    (supabase.from('goal_targets') as any)
      .select('goal_id, amount, added_at, destination')
      .eq('user_id', userId),
  ])

  const transactionRows = (txns ?? []) as OverviewTransactionRow[]
  const incomeRow = (income ?? null) as OverviewIncomeRow | null
  const goalTargetRows = (goalTargets ?? []) as OverviewGoalTargetRow[]
  const goalTargetsMap: Record<string, number> = {}
  const goalLabels: Record<string, string> = {}
  const goalAddedAtMap: Record<string, string> = {}

  for (const row of goalTargetRows) {
    const goalId = row.goal_id as GoalId
    if (row.amount != null) {
      goalTargetsMap[goalId] = Number(row.amount)
    }
    goalLabels[goalId] = toGoalLabel(goalId, row.destination ?? null)
    if (row.added_at) {
      goalAddedAtMap[goalId] = row.added_at
    }
  }

  const [
    totalSpent,
    categorySpend,
    goalSavedMap,
  ] = (() => {
    const nextCategorySpend: Record<string, number> = {}
    const nextGoalSavedMap: Record<string, number> = {}
    const nextTotalSpent = transactionRows.reduce((sum, txn) => sum + Number(txn.amount), 0)

    for (const txn of transactionRows) {
      if (txn.category_type === 'goal') {
        const addedAt = goalAddedAtMap[txn.category_key]
        if (!addedAt || txn.date >= addedAt.slice(0, 10)) {
          nextGoalSavedMap[txn.category_key] = (nextGoalSavedMap[txn.category_key] ?? 0) + Number(txn.amount)
        }
      }

      if (txn.category_type === 'everyday' || txn.category_type === 'subscription') {
        nextCategorySpend[txn.category_key] = (nextCategorySpend[txn.category_key] ?? 0) + Number(txn.amount)
      }
    }

    return [nextTotalSpent, nextCategorySpend, nextGoalSavedMap] as const
  })()

  const recentActivity = [...transactionRows]
    .sort((a, b) => {
      if (a.date === b.date) return Number(b.id) - Number(a.id)
      return b.date.localeCompare(a.date)
    })
    .slice(0, 3)
    .map((txn) => ({
      id: String(txn.id),
      label: (txn.category_label && txn.category_label.trim()) || titleFromKey(txn.category_key || 'Expense'),
      amount: Math.abs(Number(txn.amount ?? 0)),
      date: txn.date,
    }))

  const extraIncome = (incomeRow?.extra_income ?? []).map((item, index) => ({
    id: String(item?.id ?? index),
    label: String(item?.label ?? 'Extra income'),
    amount: Number(item?.amount ?? 0),
  }))

  const spendingBudgetData = spendingBudget
    ? {
        total_budget: Number(spendingBudget.total_budget ?? 0),
        categories: ((spendingBudget.categories ?? []) as any[]).map(category => ({
          key: String(category.key),
          label: String(category.label ?? category.key),
          budget: Number(category.budget ?? 0),
        })),
      }
    : null

  const incomeTotal = Number(incomeRow?.total ?? 0)
  const fixedTotal = Number(fixedExpenses?.total_monthly ?? 0)
  const budgetTotal = Number(spendingBudgetData?.total_budget ?? 0)
  const hasStartedCycleData =
    incomeTotal > 0 ||
    totalSpent > 0 ||
    fixedTotal > 0 ||
    budgetTotal > 0

  return {
    name: profile.name ?? 'there',
    currency: profile.currency ?? 'KES',
    goals: (profile.goals ?? []) as GoalId[],
    hasStartedCycleData,
    incomeData: {
      income: Number(incomeRow?.salary ?? 0),
      extraIncome,
      total: incomeTotal,
      received: incomeRow?.received != null ? Number(incomeRow.received) : null,
    },
    totalSpent,
    fixedTotal,
    spendingBudget: spendingBudgetData,
    categorySpend,
    recentActivity,
    goalTargets: goalTargetsMap,
    goalSaved: goalSavedMap,
    goalLabels,
  }
}
