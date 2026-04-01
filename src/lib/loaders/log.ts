import { GOAL_META } from '@/constants/goals'
import { formatCycleLabel, getCycleByDate, profileToPaySchedule } from '@/lib/cycles'
import { fmt } from '@/lib/finance'
import { createClient } from '@/lib/supabase/server'
import { getCurrentCycleId } from '@/lib/supabase/cycles-db'
import type { UserProfile } from '@/types/database'

export type LogGroupKey = 'fixed' | 'goals' | 'daily' | 'debts' | 'other'

export interface LogSubItem {
  key: string
  label: string
  sublabel: string | null
  groupType: string
  loggedAmount: number
  plannedAmount?: number
}

export interface LogSection {
  key: LogGroupKey
  label: string
  groupType: string
  items: LogSubItem[]
}

interface LogTransactionRow {
  category_key: string
  category_label: string
  category_type: string
  amount: number | string
  date: string
}

const EXPENSE_LABELS: Record<string, string> = {
  rent: 'Rent',
  electricity: 'Electricity',
  water: 'Water',
  gas: 'Cooking fuel',
  internet: 'Internet',
  phone: 'Phone',
  houseKeeping: 'Housekeeping',
  blackTax: 'Black tax',
  schoolFees: 'School fees',
  childcare: 'Childcare',
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, c => c.toUpperCase())
}

function toSubItems(
  map: Record<string, { label: string; amount: number }>,
  groupType: string
): LogSubItem[] {
  return Object.entries(map).map(([key, { label, amount }]) => ({
    key,
    label,
    sublabel: null,
    groupType,
    loggedAmount: amount,
  }))
}

export interface LogPageData {
  cycleLabel: string
  currency: string
  sections: LogSection[]
  isFirstTime: boolean
}

export async function loadLogPageData(userId: string, profile: UserProfile): Promise<LogPageData> {
  const supabase = await createClient()
  const cycleId = await getCurrentCycleId(supabase as any, userId, profile)
  const schedule = profileToPaySchedule(profile)

  const [
    { data: txns },
    { data: expenses },
    { data: targets },
    { data: budgets },
  ] = await Promise.all([
    (supabase.from('transactions') as any)
      .select('category_key, category_label, category_type, amount, date')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId),
    (supabase.from('fixed_expenses') as any)
      .select('entries')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId)
      .maybeSingle(),
    (supabase.from('goal_targets') as any)
      .select('goal_id, amount, added_at')
      .eq('user_id', userId),
    (supabase.from('spending_budgets') as any)
      .select('categories')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId)
      .maybeSingle(),
  ])

  const currency = profile.currency ?? 'KES'
  const txRows = (txns ?? []) as LogTransactionRow[]

  const addedAtMap: Record<string, string> = {}
  for (const row of targets ?? []) {
    if (row.added_at) addedAtMap[row.goal_id] = row.added_at
  }

  const logged: Record<string, number> = {}
  for (const txn of txRows) {
    if (txn.category_type === 'goal') {
      const addedAt = addedAtMap[txn.category_key]
      if (addedAt && txn.date < addedAt.slice(0, 10)) continue
    }
    logged[txn.category_key] = (logged[txn.category_key] ?? 0) + Number(txn.amount)
  }

  const fixedItems: LogSubItem[] = (expenses?.entries ?? [])
    .filter((entry: any) => entry.confidence === 'known' && entry.monthly > 0)
    .map((entry: any) => ({
      key: entry.key,
      label: EXPENSE_LABELS[entry.key] ?? titleCase(entry.label ?? entry.key),
      sublabel: fmt(entry.monthly, currency),
      groupType: 'fixed',
      loggedAmount: logged[entry.key] ?? 0,
      plannedAmount: entry.monthly,
    }))

  const goalItems: LogSubItem[] = (profile.goals ?? [])
    .filter((goalId: string) => !!GOAL_META[goalId as keyof typeof GOAL_META])
    .map((goalId: string) => {
      const target = (targets ?? []).find((row: any) => row.goal_id === goalId)
      return {
        key: goalId,
        label: GOAL_META[goalId as keyof typeof GOAL_META].label,
        sublabel: target?.amount ? fmt(target.amount, currency) : null,
        groupType: 'goal',
        loggedAmount: logged[goalId] ?? 0,
      }
    })

  const dailyItems: LogSubItem[] = ((budgets?.categories ?? []) as any[]).map(category => ({
    key: category.key,
    label: titleCase(category.label ?? category.key),
    sublabel: category.budget ? fmt(category.budget, currency) : null,
    groupType: 'everyday',
    loggedAmount: logged[category.key] ?? 0,
  }))

  const debtMap: Record<string, { label: string; amount: number }> = {}
  for (const txn of txRows) {
    if (txn.category_type !== 'debt') continue
    if (!debtMap[txn.category_key]) {
      debtMap[txn.category_key] = {
        label: titleCase(txn.category_label ?? txn.category_key),
        amount: 0,
      }
    }
    debtMap[txn.category_key].amount += Number(txn.amount)
  }
  const debtItems = toSubItems(debtMap, 'debt')

  const knownKeys = new Set([
    ...fixedItems.map(item => item.key),
    ...goalItems.map(item => item.key),
    ...dailyItems.map(item => item.key),
    ...debtItems.map(item => item.key),
  ])

  const orphanFixedMap: Record<string, { label: string; amount: number }> = {}
  const orphanDailyMap: Record<string, { label: string; amount: number }> = {}
  const otherMap: Record<string, { label: string; amount: number }> = {}

  for (const txn of txRows) {
    if (knownKeys.has(txn.category_key)) continue
    if (txn.category_type === 'debt' || txn.category_type === 'goal') continue

    const key = txn.category_key
    const label = titleCase(txn.category_label ?? key)
    const amount = Number(txn.amount)

    if (txn.category_type === 'fixed') {
      if (!orphanFixedMap[key]) orphanFixedMap[key] = { label, amount: 0 }
      orphanFixedMap[key].amount += amount
    } else if (txn.category_type === 'everyday') {
      if (!orphanDailyMap[key]) orphanDailyMap[key] = { label, amount: 0 }
      orphanDailyMap[key].amount += amount
    } else {
      if (!otherMap[key]) otherMap[key] = { label, amount: 0 }
      otherMap[key].amount += amount
    }
  }

  const otherItems = toSubItems(otherMap, 'everyday')

  return {
    cycleLabel: formatCycleLabel(getCycleByDate(new Date(), schedule)),
    currency,
    sections: [
      { key: 'fixed', label: 'Fixed spending', groupType: 'fixed', items: [...fixedItems, ...toSubItems(orphanFixedMap, 'fixed')] },
      { key: 'goals', label: 'Goals', groupType: 'goal', items: goalItems },
      { key: 'daily', label: 'Daily expenses', groupType: 'everyday', items: [...dailyItems, ...toSubItems(orphanDailyMap, 'everyday')] },
      { key: 'debts', label: 'Debts', groupType: 'debt', items: debtItems },
      ...(otherItems.length > 0
        ? [{ key: 'other' as LogGroupKey, label: 'Other', groupType: 'everyday', items: otherItems }]
        : []),
    ],
    isFirstTime: txRows.filter(txn => txn.category_type !== 'goal').length === 0,
  }
}
