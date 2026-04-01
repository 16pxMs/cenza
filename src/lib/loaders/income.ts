import { createClient } from '@/lib/supabase/server'
import { getCurrentCycleId, getPrevCycleId } from '@/lib/supabase/cycles-db'
import type { UserProfile } from '@/types/database'

interface IncomeEntryRow {
  salary: number | string | null
  extra_income: Array<{ id?: string | number; label?: string; amount?: number | string }> | null
  total: number | string | null
}

interface FixedExpenseRow {
  total_monthly: number | string | null
  entries: unknown[] | null
}

interface SpendingBudgetRow {
  total_budget: number | string | null
  categories: unknown[] | null
}

interface SpendingHistoryRow {
  category_key: string
  amount: number | string
}

export interface IncomePageData {
  currency: string
  incomeType: 'salaried' | 'variable' | null
  incomeData: IncomeEntryRow | null
  fixedExpenses: FixedExpenseRow | null
  spendingBudget: SpendingBudgetRow | null
  spendingHistory: Record<string, number>
}

export async function loadIncomePageData(userId: string, profile: UserProfile): Promise<IncomePageData> {
  const supabase = await createClient()
  const [cycleId, prevCycleId] = await Promise.all([
    getCurrentCycleId(supabase as any, userId, profile),
    getPrevCycleId(supabase as any, userId, profile),
  ])

  const [incomeRes, fixedRes, budgetRes, txnsRes] = await Promise.all([
    (supabase.from('income_entries') as any)
      .select('*')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId)
      .maybeSingle(),
    (supabase.from('fixed_expenses') as any)
      .select('total_monthly, entries')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId)
      .maybeSingle(),
    (supabase.from('spending_budgets') as any)
      .select('total_budget, categories')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId)
      .maybeSingle(),
    prevCycleId
      ? (supabase.from('transactions') as any)
          .select('category_key, amount')
          .eq('user_id', userId)
          .eq('cycle_id', prevCycleId)
          .eq('category_type', 'everyday')
      : Promise.resolve({ data: [] }),
  ])

  const spendingHistory: Record<string, number> = {}
  for (const txn of ((txnsRes.data ?? []) as SpendingHistoryRow[])) {
    spendingHistory[txn.category_key] = (spendingHistory[txn.category_key] ?? 0) + Number(txn.amount)
  }

  return {
    currency: profile.currency ?? 'KES',
    incomeType: profile.income_type ?? null,
    incomeData: (incomeRes.data ?? null) as IncomeEntryRow | null,
    fixedExpenses: (fixedRes.data ?? null) as FixedExpenseRow | null,
    spendingBudget: (budgetRes.data ?? null) as SpendingBudgetRow | null,
    spendingHistory,
  }
}
