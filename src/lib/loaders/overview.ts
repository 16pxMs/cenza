import { GOAL_META } from '@/constants/goals'
import { deriveIncomeTotal } from '@/lib/income/derived'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { deriveCurrentCycleId, derivePrevCycleId } from '@/lib/supabase/cycles-db'
import { canonicalizeFixedBillKey } from '@/lib/fixed-bills/canonical'
import { readTrackedFixedExpenseEntries, type TrackedFixedExpenseEntry } from '@/lib/fixed-bills/tracking'
import type { Debt, GoalId, UserProfile } from '@/types/database'

interface ExtraIncomeItem {
  id: string
  label: string
  amount: number
}

interface IncomeData {
  income: number
  extraIncome: ExtraIncomeItem[]
  total: number
  cycleStartMode: 'full_month' | 'mid_month'
  openingBalance: number | null
  received: number | null
  receivedConfirmedAt: string | null
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
  cycle_start_mode: 'full_month' | 'mid_month' | null
  opening_balance: number | string | null
  received: number | string | null
  received_confirmed_at: string | null
}

interface OverviewGoalTargetRow {
  goal_id: string
  amount: number | string | null
  added_at: string
  destination: string | null
}

interface OverviewPrevCycleTransactionRow {
  amount: number | string
  category_key: string
  category_label: string | null
  category_type: string
}

export interface BillLeftToPayItem {
  key: string
  label: string
  expected: number
  paid: number
  leftToPay: number
}

export interface BillsLeftToPay {
  items: BillLeftToPayItem[]
  totalLeftToPay: number
}

export interface DebtReminderCandidate {
  debtId: string
  label: string
  dueDate: string
  balance: number
  state: 'upcoming' | 'due' | 'overdue'
  kind: 'financing_target' | 'standard_due'
  expectedMonthly?: number
}

export function deriveBillsLeftToPay(
  fixedEntries: unknown[] | null | undefined,
  cycleTransactions: Array<Pick<OverviewTransactionRow, 'amount' | 'category_key' | 'category_type'>>
): BillsLeftToPay {
  const expectedEntries = readTrackedFixedExpenseEntries(fixedEntries).map((entry) => ({
    key: entry.key,
    expected: Number(entry.monthly ?? 0),
    label: entry.label.trim() || titleFromKey(entry.key),
  }))

  const expectedKeys = new Set(expectedEntries.map((entry) => entry.key))
  const paidByKey = new Map<string, number>()
  for (const txn of cycleTransactions) {
    if (txn.category_type !== 'fixed' && txn.category_type !== 'subscription') continue
    const rawKey = String(txn.category_key ?? '')
    if (!rawKey) continue
    // TODO: remove after full backfill of historical fixed-bill keys (0012).
    // Legacy rows may still carry `wifi`, `kplc`, or `home_wifi_<ts>` — fold
    // them through the canonicalizer at read time so Bills left to pay
    // matches during the transition. Subscriptions keep their stored key.
    const key =
      txn.category_type === 'fixed' ? canonicalizeFixedBillKey(rawKey) : rawKey
    if (!expectedKeys.has(key)) continue
    paidByKey.set(key, (paidByKey.get(key) ?? 0) + Number(txn.amount ?? 0))
  }

  const items: BillLeftToPayItem[] = []
  for (const entry of expectedEntries) {
    const { key, expected, label } = entry
    const paid = paidByKey.get(key) ?? 0
    const leftToPay = Math.max(0, expected - paid)
    items.push({ key, label, expected, paid, leftToPay })
  }

  items.sort((a, b) => b.leftToPay - a.leftToPay)
  const totalLeftToPay = items.reduce((sum, item) => sum + item.leftToPay, 0)
  return { items, totalLeftToPay }
}

export interface OverviewPageData {
  name: string
  currency: string
  incomeType: 'salaried' | 'variable' | null
  paydayDay: number | null
  goals: GoalId[]
  activeDebts: Debt[]
  hasStartedCycleData: boolean
  incomeData: IncomeData
  totalSpent: number
  debtTotal: number
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
  lastCycleRecurringTop: {
    label: string
    amount: number
    total: number
  } | null
  trackedEssentials: TrackedFixedExpenseEntry[]
  billsLeftToPay: BillsLeftToPay
  debtReminderCandidates: DebtReminderCandidate[]
}

function parseDate(value: string | null) {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function monthsBetween(fromDate: Date, toDate: Date) {
  const yearDiff = toDate.getFullYear() - fromDate.getFullYear()
  const monthDiff = toDate.getMonth() - fromDate.getMonth()
  let months = yearDiff * 12 + monthDiff

  if (toDate.getDate() < fromDate.getDate()) {
    months -= 1
  }

  return months
}

function deriveDebtReminderCandidates(debts: Debt[]): DebtReminderCandidate[] {
  const today = parseDate(new Date().toISOString().slice(0, 10))
  if (!today) return []

  const candidates: DebtReminderCandidate[] = []

  for (const debt of debts) {
    if (debt.status !== 'active' || Number(debt.current_balance) <= 0) continue

    if (debt.debt_kind === 'financing') {
      if (!debt.financing_target_date) continue
      const targetDate = parseDate(debt.financing_target_date)
      if (!targetDate) continue

      const monthsLeft = monthsBetween(today, targetDate)
      const state: DebtReminderCandidate['state'] =
        monthsLeft < 0 ? 'overdue' : monthsLeft === 0 ? 'due' : 'upcoming'

      candidates.push({
        debtId: debt.id,
        label: debt.name.trim() || 'Untitled debt',
        dueDate: debt.financing_target_date,
        balance: Number(debt.current_balance),
        state,
        kind: 'financing_target',
        expectedMonthly:
          monthsLeft > 0 ? Math.max(0, Number(debt.current_balance) / monthsLeft) : undefined,
      })
      continue
    }

    if (!debt.standard_due_date) continue
    const dueDate = parseDate(debt.standard_due_date)
    if (!dueDate) continue

    const state: DebtReminderCandidate['state'] =
      dueDate < today ? 'overdue' : dueDate.getTime() === today.getTime() ? 'due' : 'upcoming'

    candidates.push({
      debtId: debt.id,
      label: debt.name.trim() || 'Untitled debt',
      dueDate: debt.standard_due_date,
      balance: Number(debt.current_balance),
      state,
      kind: 'standard_due',
    })
  }

  const stateRank: Record<DebtReminderCandidate['state'], number> = {
    overdue: 0,
    due: 1,
    upcoming: 2,
  }

  return candidates.sort((a, b) => {
    const byState = stateRank[a.state] - stateRank[b.state]
    if (byState !== 0) return byState
    return a.dueDate.localeCompare(b.dueDate)
  })
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
  const supabase = await createServerSupabaseClient()
  const cycleId = deriveCurrentCycleId(profile)
  const prevCycleId = derivePrevCycleId(profile)
  const prevCycleRecurringPromise = prevCycleId
    ? (supabase.from('transactions') as any)
        .select('amount, category_key, category_label, category_type')
        .eq('user_id', userId)
        .eq('cycle_id', prevCycleId)
        .in('category_type', ['fixed', 'subscription'])
    : Promise.resolve({ data: [] as OverviewPrevCycleTransactionRow[] })

  const [
    { data: txns },
    { data: income },
    { data: fixedExpenses },
    { data: spendingBudget },
    { data: goalTargets },
    { data: debts },
    { data: prevCycleRecurringRows },
  ] = await Promise.all([
    (supabase.from('transactions') as any)
      .select('id, amount, category_key, category_type, category_label, date')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId),
    (supabase.from('income_entries') as any)
      .select('salary, extra_income, total, cycle_start_mode, opening_balance, received, received_confirmed_at')
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
    (supabase.from('goal_targets') as any)
      .select('goal_id, amount, added_at, destination')
      .eq('user_id', userId),
    (supabase.from('debts') as any)
      .select('*')
      .eq('user_id', userId),
    prevCycleRecurringPromise,
  ])

  const transactionRows = (txns ?? []) as OverviewTransactionRow[]
  const incomeRow = (income ?? null) as OverviewIncomeRow | null
  const goalTargetRows = (goalTargets ?? []) as OverviewGoalTargetRow[]
  const debtRows = (debts ?? []) as Debt[]

  if (process.env.NODE_ENV !== 'production') {
    const fixedTxnDebug = transactionRows
      .filter((txn) => txn.category_type === 'fixed' || txn.category_type === 'subscription')
      .map((txn) => ({
        id: String(txn.id),
        category_type: txn.category_type,
        category_key: txn.category_key,
        category_label: txn.category_label,
        amount: Number(txn.amount ?? 0),
        date: txn.date,
      }))

    console.info(
      `[overview] bills-left-to-pay debug
cycleId: ${cycleId}
fixedExpensesRow.entries:
${JSON.stringify((fixedExpenses?.entries ?? null) as unknown[] | null, null, 2)}
fixedCycleTransactions:
${JSON.stringify(fixedTxnDebug, null, 2)}`
    )
  }
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

  const activeDebts = debtRows.filter(
    (debt) => debt.status === 'active' && Number(debt.current_balance) > 0
  )
  const debtTotal = activeDebts.reduce(
    (sum, debt) => sum + Number(debt.current_balance),
    0
  )

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

  const incomeTotal = deriveIncomeTotal(incomeRow)
  const openingBalance = incomeRow?.opening_balance != null ? Number(incomeRow.opening_balance) : null
  const cycleStartMode = (incomeRow?.cycle_start_mode === 'mid_month' ? 'mid_month' : 'full_month') as 'full_month' | 'mid_month'
  const fixedTotal = Number(fixedExpenses?.total_monthly ?? 0)
  const budgetTotal = Number(spendingBudgetData?.total_budget ?? 0)
  const hasStartedCycleData =
    incomeTotal > 0 ||
    (cycleStartMode === 'mid_month' && (openingBalance ?? 0) > 0) ||
    totalSpent > 0 ||
    fixedTotal > 0 ||
    budgetTotal > 0

  const lastCycleRecurringTop = (() => {
    const rows = (prevCycleRecurringRows ?? []) as OverviewPrevCycleTransactionRow[]
    if (rows.length === 0) return null

    const bucket = new Map<string, { label: string; amount: number }>()
    for (const row of rows) {
      const key = row.category_key || 'recurring'
      const label = (row.category_label && row.category_label.trim()) || titleFromKey(key)
      const amount = Number(row.amount ?? 0)
      const current = bucket.get(key)
      if (current) {
        current.amount += amount
      } else {
        bucket.set(key, { label, amount })
      }
    }

    const entries = [...bucket.values()].filter((row) => row.amount > 0)
    if (entries.length === 0) return null
    entries.sort((a, b) => b.amount - a.amount)
    const top = entries[0]
    const total = entries.reduce((sum, row) => sum + row.amount, 0)
    return {
      label: top.label,
      amount: top.amount,
      total,
    }
  })()

  const displayFirstName = profile.name?.trim().split(/\s+/)[0] || 'there'
  const debtReminderCandidates = deriveDebtReminderCandidates(debtRows)

  return {
    name: displayFirstName,
    currency: profile.currency ?? 'KES',
    incomeType: profile.income_type ?? null,
    paydayDay:
      profile.income_type === 'salaried' &&
      Array.isArray(profile.pay_schedule_days) &&
      profile.pay_schedule_days.length > 0 &&
      Number.isFinite(Number(profile.pay_schedule_days[0]))
        ? Number(profile.pay_schedule_days[0])
        : null,
    goals: (profile.goals ?? []) as GoalId[],
    activeDebts,
    hasStartedCycleData,
    incomeData: {
      income: Number(incomeRow?.salary ?? 0),
      extraIncome,
      total: incomeTotal,
      cycleStartMode,
      openingBalance,
      received: incomeRow?.received != null ? Number(incomeRow.received) : null,
      receivedConfirmedAt: incomeRow?.received_confirmed_at ?? null,
    },
    totalSpent,
    debtTotal,
    fixedTotal,
    spendingBudget: spendingBudgetData,
    categorySpend,
    recentActivity,
    goalTargets: goalTargetsMap,
    goalSaved: goalSavedMap,
    goalLabels,
    lastCycleRecurringTop,
    trackedEssentials: readTrackedFixedExpenseEntries(fixedExpenses?.entries ?? null),
    billsLeftToPay: deriveBillsLeftToPay(
      (fixedExpenses?.entries ?? null) as unknown[] | null,
      transactionRows
    ),
    debtReminderCandidates,
  }
}
