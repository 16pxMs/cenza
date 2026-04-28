import { deriveIncomeTotal } from '@/lib/income/derived'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { deriveCurrentCycleId, deriveCycleIdForDate } from '@/lib/supabase/cycles-db'
import {
  formatCycleLabel,
  getCurrentCycle,
  getCycleByDate,
  profileToPaySchedule,
} from '@/lib/cycles'
import {
  loadMonthlyStorageCycleIdsForUser,
} from '@/lib/monthly-reminders/storage'
import {
  deriveOutflowCategoryRows,
  deriveOutflowTotalFromCategories,
  type OutflowCategoryRow,
} from '@/lib/transactions/outflow'
import type { UserProfile } from '@/types/database'

export interface HistoryTransaction {
  category_type: string
  amount: number
}

export type HistoryCategoryRow = OutflowCategoryRow

export interface HistoryPageData {
  cycleLabel: string
  currency: string
  rows: HistoryCategoryRow[]
  totalSpent: number
  totalIncome: number
  availableCycleIds: string[]
}

interface HistoryIncomeRow {
  salary: number | string | null
  extra_income: Array<{ amount?: number | string | null }> | null
  total: number | string | null
  cycle_start_mode?: 'full_month' | 'mid_month' | null
  opening_balance?: number | string | null
}

async function loadHistoryAvailableCycleIds(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string
): Promise<string[]> {
  const [
    { data: txnCycles },
    { data: incomeCycles },
    expenseCycles,
    { data: budgetCycles },
  ] = await Promise.all([
    (supabase.from('transactions') as any)
      .select('cycle_id')
      .eq('user_id', userId),
    (supabase.from('income_entries') as any)
      .select('cycle_id')
      .eq('user_id', userId),
    loadMonthlyStorageCycleIdsForUser(supabase, userId),
    (supabase.from('spending_budgets') as any)
      .select('cycle_id')
      .eq('user_id', userId),
  ])

  return Array.from(new Set(
    [
      ...(txnCycles ?? []),
      ...(incomeCycles ?? []),
      ...expenseCycles.map((cycle_id) => ({ cycle_id })),
      ...(budgetCycles ?? []),
    ]
      .map((row: any) => typeof row?.cycle_id === 'string' ? row.cycle_id : null)
      .filter((cycleId): cycleId is string => !!cycleId)
  )).sort()
}

export async function loadHistoryAvailableCycleIdsForUser(userId: string): Promise<string[]> {
  const supabase = await createServerSupabaseClient()
  return loadHistoryAvailableCycleIds(supabase, userId)
}

export async function loadHistoryPageData(
  userId: string,
  profile: UserProfile,
  targetDate?: Date,
  availableCycleIdsOverride?: string[]
): Promise<HistoryPageData> {
  const supabase = await createServerSupabaseClient()
  const cycleId = targetDate
    ? deriveCycleIdForDate(profile, targetDate)
    : deriveCurrentCycleId(profile)

  const [
    { data: txnRows },
    { data: income },
    availableCycleIds,
  ] = await Promise.all([
    (supabase.from('transactions') as any)
      .select('category_type, amount')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId),
    (supabase.from('income_entries') as any)
      .select('salary, extra_income, total, cycle_start_mode, opening_balance')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId)
      .maybeSingle(),
    availableCycleIdsOverride
      ? Promise.resolve(availableCycleIdsOverride)
      : loadHistoryAvailableCycleIds(supabase, userId),
  ])

  const rows: HistoryTransaction[] = (txnRows ?? []).map((row: any) => ({
    ...row,
    amount: Number(row.amount),
  }))
  const categoryRows = deriveOutflowCategoryRows(rows)

  const totalSpent = deriveOutflowTotalFromCategories(categoryRows)

  const schedule = profileToPaySchedule(profile)
  const cycle = targetDate ? getCycleByDate(targetDate, schedule) : getCurrentCycle(schedule)

  return {
    cycleLabel: formatCycleLabel(cycle),
    currency: profile.currency ?? 'KES',
    rows: categoryRows,
    totalSpent,
    totalIncome: deriveIncomeTotal((income ?? null) as HistoryIncomeRow | null),
    availableCycleIds,
  }
}
