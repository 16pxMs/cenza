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
  loadMonthlyStorageSnapshotForCycle,
} from '@/lib/monthly-reminders/storage'
import {
  isDebtOpeningBalanceTransaction,
  normalizeOutflowCategoryType,
  type OutflowCategoryType,
} from '@/lib/transactions/outflow'
import { deriveCategoryBreakdown, type CategoryBreakdownRow } from '@/lib/transactions/category-breakdown'
import type { UserProfile } from '@/types/database'
import type { AmountFormatPreference } from '@/lib/formatting/amount'

export interface HistoryTransaction {
  id: string
  category_type: string
  category_key: string
  category_label: string | null
  display_name: string | null
  amount: number
  date: string
  created_at: string
}

export interface HistoryCategoryRow extends CategoryBreakdownRow {}

export interface HistorySpendingGroup {
  key: OutflowCategoryType
  label: string
  amount: number
  percentageOfTotal: number
  transactionCount: number
  description: string
}

export interface HistoryTopTransaction {
  id: string
  title: string
  categoryLabel: string
  amount: number
  date: string
}

export interface HistoryRecurringItem {
  key: string
  label: string
  amount: number
  kind: 'fixed' | 'reminder'
}

export interface HistoryPageData {
  cycleLabel: string
  currency: string
  amountFormatPreference: AmountFormatPreference
  rows: HistoryCategoryRow[]
  spendingGroups: HistorySpendingGroup[]
  topTransactions: HistoryTopTransaction[]
  recurringItems: HistoryRecurringItem[]
  totalSpent: number
  totalIncome: number
  expenseCount: number
  availableCycleIds: string[]
}

interface HistoryIncomeRow {
  salary: number | string | null
  extra_income: Array<{ amount?: number | string | null }> | null
  total: number | string | null
  cycle_start_mode?: 'full_month' | 'mid_month' | null
  opening_balance?: number | string | null
}

function resolveTransactionTitle(row: Pick<HistoryTransaction, 'display_name' | 'category_label' | 'category_key'>) {
  const displayName = typeof row.display_name === 'string' ? row.display_name.trim() : ''
  if (displayName) return displayName

  const categoryLabel = typeof row.category_label === 'string' ? row.category_label.trim() : ''
  if (categoryLabel) return categoryLabel

  return titleFromKey(row.category_key || 'Expense')
}

function resolveCategoryDisplayLabel(row: Pick<HistoryTransaction, 'category_label' | 'category_key'>) {
  const label = typeof row.category_label === 'string' ? row.category_label.trim() : ''
  return label || titleFromKey(row.category_key || 'Expense')
}

function titleFromKey(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

const GROUP_LABELS: Record<OutflowCategoryType, string> = {
  everyday: 'Everyday spending',
  fixed: 'Fixed costs',
  debt: 'Debt payments',
  goal: 'Goals',
}

const GROUP_DESCRIPTIONS: Record<OutflowCategoryType, string> = {
  everyday: 'Day-to-day purchases and flexible spending.',
  fixed: 'Bills and recurring commitments.',
  debt: 'Money used to reduce balances.',
  goal: 'Contributions toward your goals.',
}

function buildSpendingGroups(rows: HistoryTransaction[], totalOutflow: number): HistorySpendingGroup[] {
  const buckets = new Map<OutflowCategoryType, { amount: number; count: number }>()

  for (const row of rows) {
    const type = normalizeOutflowCategoryType(row.category_type)
    const current = buckets.get(type) ?? { amount: 0, count: 0 }
    current.amount += row.amount
    current.count += 1
    buckets.set(type, current)
  }

  return [...buckets.entries()]
    .map(([key, value]) => ({
      key,
      label: GROUP_LABELS[key],
      amount: value.amount,
      percentageOfTotal: totalOutflow > 0 ? (value.amount / totalOutflow) * 100 : 0,
      transactionCount: value.count,
      description: GROUP_DESCRIPTIONS[key],
    }))
    .sort((a, b) => b.amount - a.amount)
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
    monthlyStorage,
    availableCycleIds,
  ] = await Promise.all([
    (supabase.from('transactions') as any)
      .select('id, category_type, category_key, category_label, display_name, amount, date, created_at')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId),
    (supabase.from('income_entries') as any)
      .select('salary, extra_income, total, cycle_start_mode, opening_balance')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId)
      .maybeSingle(),
    loadMonthlyStorageSnapshotForCycle(supabase, userId, cycleId),
    availableCycleIdsOverride
      ? Promise.resolve(availableCycleIdsOverride)
      : loadHistoryAvailableCycleIds(supabase, userId),
  ])

  const rows: HistoryTransaction[] = (txnRows ?? []).map((row: any) => ({
    id: String(row.id ?? ''),
    category_type: String(row.category_type ?? ''),
    category_key: String(row.category_key ?? ''),
    category_label: typeof row.category_label === 'string' ? row.category_label : null,
    display_name: typeof row.display_name === 'string' ? row.display_name : null,
    amount: Number(row.amount),
    date: String(row.date ?? ''),
    created_at: String(row.created_at ?? ''),
  }))
  const includedExpenseRows = rows.filter((row) => (
    !isDebtOpeningBalanceTransaction(row) &&
    Number.isFinite(row.amount) &&
    row.amount > 0
  ))
  const labelByCategoryKey = new Map<string, string>()
  for (const row of includedExpenseRows) {
    if (!labelByCategoryKey.has(row.category_key)) {
      labelByCategoryKey.set(row.category_key, resolveCategoryDisplayLabel(row))
    }
  }

  const categoryRows = deriveCategoryBreakdown(includedExpenseRows).map((row) => ({
    ...row,
    categoryLabel: labelByCategoryKey.get(row.categoryKey) ?? row.categoryLabel,
  }))
  const totalSpent = categoryRows.reduce((sum, row) => sum + row.totalAmount, 0)
  const spendingGroups = buildSpendingGroups(includedExpenseRows, totalSpent)
  const topTransactions = [...includedExpenseRows]
    .sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount
      return String(b.created_at).localeCompare(String(a.created_at))
    })
    .slice(0, 5)
    .map((row) => ({
      id: row.id,
      title: resolveTransactionTitle(row),
      categoryLabel: resolveCategoryDisplayLabel(row),
      amount: row.amount,
      date: row.date,
    }))

  const recurringItems: HistoryRecurringItem[] = [
    ...monthlyStorage.plannedEntries.map((entry) => ({
      key: entry.key,
      label: entry.label,
      amount: entry.monthly,
      kind: 'fixed' as const,
    })),
    ...monthlyStorage.reminderEntries.map((entry) => ({
      key: entry.key,
      label: entry.label,
      amount: entry.monthly,
      kind: 'reminder' as const,
    })),
  ].sort((a, b) => b.amount - a.amount)

  const schedule = profileToPaySchedule(profile)
  const cycle = targetDate ? getCycleByDate(targetDate, schedule) : getCurrentCycle(schedule)

  return {
    cycleLabel: formatCycleLabel(cycle),
    currency: profile.currency ?? 'KES',
    amountFormatPreference: profile.amount_format_preference ?? 'smart',
    rows: categoryRows,
    spendingGroups,
    topTransactions,
    recurringItems,
    totalSpent,
    totalIncome: deriveIncomeTotal((income ?? null) as HistoryIncomeRow | null),
    expenseCount: includedExpenseRows.length,
    availableCycleIds,
  }
}
