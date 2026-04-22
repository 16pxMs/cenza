import { createServerSupabaseClient } from '@/lib/supabase/server'
import { deriveCurrentCycleId, derivePrevCycleId } from '@/lib/supabase/cycles-db'
import { loadPlannedMonthlyEntriesForCycle, type PlannedMonthlyEntry } from '@/lib/monthly-reminders/storage'
import type { UserProfile } from '@/types/database'

interface IncomeEntryRow {
  salary: number | string | null
  extra_income: Array<{ id?: string | number; label?: string; amount?: number | string }> | null
  total: number | string | null
}

interface FixedExpenseRow {
  total_monthly: number | string | null
  entries: PlannedMonthlyEntry[] | null
}

interface SpendingBudgetRow {
  total_budget: number | string | null
  categories: unknown[] | null
}

interface SpendingHistoryRow {
  category_key: string
  amount: number | string
}

function toPlannedFixedExpenseRow(row: unknown, entries: PlannedMonthlyEntry[]): FixedExpenseRow | null {
  if (!row) return null
  const fixedRow = row as FixedExpenseRow
  return {
    ...fixedRow,
    entries,
  }
}

export interface IncomePageData {
  currency: string
  incomeType: 'salaried' | 'variable' | null
  incomeData: IncomeEntryRow | null
  fixedExpenses: FixedExpenseRow | null
  spendingBudget: SpendingBudgetRow | null
  spendingHistory: Record<string, number>
}

export interface IncomeSetupPageData {
  currency: string
  incomeType: 'salaried' | 'variable' | null
  paydayDay: number | null
  incomeData: IncomeEntryRow | null
}

export interface FixedExpensesSetupPageData {
  currency: string
  fixedExpenses: FixedExpenseRow | null
}

export interface SpendingBudgetSetupPageData {
  currency: string
  spendingBudget: SpendingBudgetRow | null
  spendingHistory: Record<string, number>
}

export async function loadIncomeSetupPageData(userId: string, profile: UserProfile): Promise<IncomeSetupPageData> {
  const supabase = await createServerSupabaseClient()
  const cycleId = deriveCurrentCycleId(profile)

  const { data: currentIncome } = await (supabase.from('income_entries') as any)
    .select('salary, extra_income, total, cycle_start_mode, opening_balance')
    .eq('user_id', userId)
    .eq('cycle_id', cycleId)
    .maybeSingle()

  let incomeData = (currentIncome ?? null) as IncomeEntryRow | null

  if (!incomeData) {
    const { data: fallbackIncome } = await (supabase.from('income_entries') as any)
      .select('salary, extra_income, total, cycle_start_mode, opening_balance')
      .eq('user_id', userId)
      .order('cycle_id', { ascending: false })
      .limit(1)
      .maybeSingle()

    incomeData = (fallbackIncome ?? null) as IncomeEntryRow | null
  }

  return {
    currency: profile.currency ?? 'KES',
    incomeType: profile.income_type ?? null,
    paydayDay:
      profile.income_type === 'salaried' &&
      Array.isArray(profile.pay_schedule_days) &&
      profile.pay_schedule_days.length > 0 &&
      Number.isFinite(Number(profile.pay_schedule_days[0]))
        ? Number(profile.pay_schedule_days[0])
        : null,
    incomeData,
  }
}

export async function loadFixedExpensesSetupPageData(
  userId: string,
  profile: UserProfile
): Promise<FixedExpensesSetupPageData> {
  const supabase = await createServerSupabaseClient()
  const cycleId = deriveCurrentCycleId(profile)

  const [{ data }, plannedEntries] = await Promise.all([
    (supabase.from('fixed_expenses') as any)
    .select('total_monthly')
    .eq('user_id', userId)
    .eq('cycle_id', cycleId)
    .maybeSingle()
    ,
    loadPlannedMonthlyEntriesForCycle(supabase, userId, cycleId),
  ])

  return {
    currency: profile.currency ?? 'KES',
    fixedExpenses: toPlannedFixedExpenseRow(data ?? null, plannedEntries),
  }
}

export async function loadSpendingBudgetSetupPageData(
  userId: string,
  profile: UserProfile
): Promise<SpendingBudgetSetupPageData> {
  const supabase = await createServerSupabaseClient()
  const cycleId = deriveCurrentCycleId(profile)
  const prevCycleId = derivePrevCycleId(profile)

  const [budgetRes, txnsRes] = await Promise.all([
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
    spendingBudget: (budgetRes.data ?? null) as SpendingBudgetRow | null,
    spendingHistory,
  }
}

export async function loadIncomePageData(userId: string, profile: UserProfile): Promise<IncomePageData> {
  const supabase = await createServerSupabaseClient()
  const cycleId = deriveCurrentCycleId(profile)
  const prevCycleId = derivePrevCycleId(profile)

  const [incomeRes, fixedRes, budgetRes, txnsRes, plannedEntries] = await Promise.all([
    (supabase.from('income_entries') as any)
      .select('*')
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
    prevCycleId
      ? (supabase.from('transactions') as any)
          .select('category_key, amount')
          .eq('user_id', userId)
          .eq('cycle_id', prevCycleId)
          .eq('category_type', 'everyday')
      : Promise.resolve({ data: [] }),
    loadPlannedMonthlyEntriesForCycle(supabase, userId, cycleId),
  ])

  const spendingHistory: Record<string, number> = {}
  for (const txn of ((txnsRes.data ?? []) as SpendingHistoryRow[])) {
    spendingHistory[txn.category_key] = (spendingHistory[txn.category_key] ?? 0) + Number(txn.amount)
  }

  return {
    currency: profile.currency ?? 'KES',
    incomeType: profile.income_type ?? null,
    incomeData: (incomeRes.data ?? null) as IncomeEntryRow | null,
    fixedExpenses: toPlannedFixedExpenseRow(fixedRes.data ?? null, plannedEntries),
    spendingBudget: (budgetRes.data ?? null) as SpendingBudgetRow | null,
    spendingHistory,
  }
}
