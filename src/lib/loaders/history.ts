import { createClient } from '@/lib/supabase/server'
import { deriveCurrentCycleId, deriveCycleIdForDate } from '@/lib/supabase/cycles-db'
import type { UserProfile } from '@/types/database'

export interface HistoryTransaction {
  id: string
  date: string
  category_type: string
  category_key: string
  category_label: string
  amount: number
  note: string | null
}

export interface HistoryCategoryRow {
  key: string
  label: string
  type: 'fixed' | 'goal' | 'everyday' | 'debt' | 'subscription'
  planned: number
  spent: number
  transactions: HistoryTransaction[]
}

export interface HistoryBreakdownItem {
  label: 'Fixed' | 'Goals' | 'Daily' | 'Debts'
  amount: number
  accent: boolean
}

export interface HistoryPageData {
  monthLabel: string
  currency: string
  rows: HistoryCategoryRow[]
  totalBudget: number
  totalSpent: number
  totalIncome: number
  breakdown: HistoryBreakdownItem[]
  availableMonths: string[]
}

function toRows(txns: HistoryTransaction[]): HistoryCategoryRow[] {
  const byType: Record<HistoryCategoryRow['type'], HistoryTransaction[]> = {
    fixed: [],
    debt: [],
    everyday: [],
    goal: [],
    subscription: [],
  }

  for (const txn of txns) {
    const type = (txn.category_type as HistoryCategoryRow['type']) in byType
      ? txn.category_type as HistoryCategoryRow['type']
      : 'everyday'
    byType[type].push(txn)
  }

  return Object.entries(byType)
    .filter(([, transactions]) => transactions.length > 0)
    .map(([type, transactions]) => ({
      key: type,
      type: type as HistoryCategoryRow['type'],
      label:
        type === 'fixed' ? 'Fixed spending' :
        type === 'debt' ? 'Debt' :
        type === 'goal' ? 'Goals' :
        type === 'subscription' ? 'Subscriptions' :
        'Daily',
      planned: 0,
      spent: transactions.reduce((sum, txn) => sum + txn.amount, 0),
      transactions,
    }))
}

export async function loadHistoryPageData(userId: string, profile: UserProfile, targetDate?: Date): Promise<HistoryPageData> {
  const supabase = await createClient()
  const cycleId = targetDate
    ? deriveCycleIdForDate(profile, targetDate)
    : deriveCurrentCycleId(profile)

  const [
    { data: txnRows },
    { data: expenses },
    { data: budgets },
    { data: income },
    { data: txnCycles },
    { data: incomeCycles },
    { data: expenseCycles },
    { data: budgetCycles },
  ] = await Promise.all([
    (supabase.from('transactions') as any)
      .select('id, date, category_type, category_key, category_label, amount, note')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
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
    (supabase.from('income_entries') as any)
      .select('total')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId)
      .maybeSingle(),
    (supabase.from('transactions') as any)
      .select('cycle_id')
      .eq('user_id', userId),
    (supabase.from('income_entries') as any)
      .select('cycle_id')
      .eq('user_id', userId),
    (supabase.from('fixed_expenses') as any)
      .select('cycle_id')
      .eq('user_id', userId),
    (supabase.from('spending_budgets') as any)
      .select('cycle_id')
      .eq('user_id', userId),
  ])

  const rows: HistoryTransaction[] = (txnRows ?? []).map((row: any) => ({
    ...row,
    amount: Number(row.amount),
  }))
  const categoryRows = toRows(rows)

  const totalSpent = rows
    .filter(txn => txn.category_type !== 'goal')
    .reduce((sum, txn) => sum + txn.amount, 0)

  const fixedSpent = categoryRows.filter(row => row.type === 'fixed').reduce((sum, row) => sum + row.spent, 0)
  const goalsSpent = categoryRows.filter(row => row.type === 'goal').reduce((sum, row) => sum + row.spent, 0)
  const dailySpent = categoryRows.filter(row => row.type === 'everyday').reduce((sum, row) => sum + row.spent, 0)
  const debtSpent = categoryRows.filter(row => row.type === 'debt').reduce((sum, row) => sum + row.spent, 0)
  const breakdown = ([
    { label: 'Fixed', amount: fixedSpent, accent: false },
    { label: 'Goals', amount: goalsSpent, accent: false },
    { label: 'Daily', amount: dailySpent, accent: false },
    { label: 'Debts', amount: debtSpent, accent: debtSpent > 0 },
  ] as HistoryBreakdownItem[]).filter(item => item.amount > 0)

  const availableMonths = Array.from(new Set(
    [
      ...(txnCycles ?? []),
      ...(incomeCycles ?? []),
      ...(expenseCycles ?? []),
      ...(budgetCycles ?? []),
    ]
      .map((row: any) => typeof row?.cycle_id === 'string' ? row.cycle_id.slice(0, 7) : null)
      .filter((month): month is string => !!month)
  )).sort()

  return {
    monthLabel: (targetDate ?? new Date()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    currency: profile.currency ?? 'KES',
    rows: categoryRows,
    totalBudget: Number(expenses?.total_monthly ?? 0) + Number(budgets?.total_budget ?? 0),
    totalSpent,
    totalIncome: Number(income?.total ?? 0),
    breakdown,
    availableMonths,
  }
}
