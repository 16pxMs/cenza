import { deriveIncomeTotal } from '@/lib/income/derived'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { deriveCurrentCycleId, deriveCycleIdForDate } from '@/lib/supabase/cycles-db'
import { selectTransactionsInCycleDateRange } from '@/lib/loaders/transactions'
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
import { getCategoryLabel } from '@/lib/categories/config'
import type { UserProfile } from '@/types/database'
import type { AmountFormatPreference } from '@/lib/formatting/amount'

export interface HistoryTransaction {
  id: string
  category_type: string
  category_key: string
  category_label: string | null
  custom_category_id: string | null
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
  if (row.category_key === 'debt_opening_balance') {
    return getCategoryLabel(row.category_key, 'Money I owe')
  }

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

function isIncludedHistoryOutflow(row: HistoryTransaction): boolean {
  if (isDebtOpeningBalanceTransaction(row)) return false
  if (row.category_type === 'transfer') return false
  if (!Number.isFinite(row.amount) || row.amount <= 0) return false
  return true
}

async function loadHistoryAvailableCycleIds(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  profile: UserProfile
): Promise<string[]> {
  const [
    { data: txnCycles },
    { data: incomeCycles },
    expenseCycles,
    { data: budgetCycles },
  ] = await Promise.all([
    (supabase.from('transactions') as any)
      .select('cycle_id, date')
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
      .concat(
        (txnCycles ?? [])
          .map((row: any) => {
            if (typeof row?.date !== 'string') return null
            const date = new Date(`${row.date}T00:00:00`)
            if (Number.isNaN(date.getTime())) return null
            return deriveCycleIdForDate(profile, date)
          })
          .filter((cycleId: string | null): cycleId is string => !!cycleId)
      )
  )).sort()
}

export async function loadHistoryAvailableCycleIdsForUser(userId: string, profile: UserProfile): Promise<string[]> {
  const supabase = await createServerSupabaseClient()
  return loadHistoryAvailableCycleIds(supabase, userId, profile)
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
  const transactionSelection = selectTransactionsInCycleDateRange(
    supabase,
    userId,
    profile,
    'id, category_type, category_key, category_label, custom_category_id, display_name, amount, date, created_at',
    targetDate
  )

  const [
    { data: txnRows },
    { data: income },
    monthlyStorage,
    availableCycleIds,
  ] = await Promise.all([
    transactionSelection.query,
    (supabase.from('income_entries') as any)
      .select('salary, extra_income, total, cycle_start_mode, opening_balance')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId)
      .maybeSingle(),
    loadMonthlyStorageSnapshotForCycle(supabase, userId, cycleId),
    availableCycleIdsOverride
      ? Promise.resolve(availableCycleIdsOverride)
      : loadHistoryAvailableCycleIds(supabase, userId, profile),
  ])

  const rows: HistoryTransaction[] = (txnRows ?? []).map((row: any) => ({
    id: String(row.id ?? ''),
    category_type: String(row.category_type ?? ''),
    category_key: String(row.category_key ?? ''),
    category_label: typeof row.category_label === 'string' ? row.category_label : null,
    custom_category_id: typeof row.custom_category_id === 'string' ? row.custom_category_id : null,
    display_name: typeof row.display_name === 'string' ? row.display_name : null,
    amount: Number(row.amount),
    date: String(row.date ?? ''),
    created_at: String(row.created_at ?? ''),
  }))
  const includedExpenseRows = rows.filter(isIncludedHistoryOutflow)
  const labelByCategoryKey = new Map<string, string>()
  for (const row of includedExpenseRows) {
    const identity = row.custom_category_id ? `custom:${row.custom_category_id}` : row.category_key
    if (!labelByCategoryKey.has(identity)) {
      labelByCategoryKey.set(identity, resolveCategoryDisplayLabel(row))
    }
  }

  const categoryRows = deriveCategoryBreakdown(includedExpenseRows).map((row) => ({
    ...row,
    categoryLabel: labelByCategoryKey.get(row.customCategoryId ? `custom:${row.customCategoryId}` : row.categoryKey) ?? row.categoryLabel,
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
