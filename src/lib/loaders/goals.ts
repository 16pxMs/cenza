import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { GoalId, UserProfile } from '@/types/database'
import type { AmountFormatPreference } from '@/lib/formatting/amount'

export interface GoalsPageGoalData {
  id: GoalId
  target: number | null
  targetDate: string | null
  addedAt: string | null
  totalSaved: number
  monthlyAvg: number
  destination: string | null
  milestones: GoalMilestoneData[]
}

export interface GoalMilestoneData {
  id: string
  name: string
  amount: number
  targetDate: string | null
  sortOrder: number
}

export interface GoalsPageData {
  currency: string
  amountFormatPreference: AmountFormatPreference
  goals: GoalId[]
  goalDataList: GoalsPageGoalData[]
  targets: Record<string, number | null>
  savedByGoal: Record<string, number>
  totalSaved: number
  totalTargets: number
}

interface GoalTargetRow {
  goal_id: GoalId
  amount: number | string | null
  target_date: string | null
  added_at: string
  destination: string | null
}

interface GoalTransactionRow {
  category_key: string
  amount: number | string
  date: string
}

interface GoalMilestoneRow {
  id: string
  goal_id: GoalId
  name: string
  amount: number | string
  target_date: string | null
  sort_order: number | null
}

function isMissingColumnError(error: { message?: string } | null | undefined, column: string) {
  return (error?.message ?? '').toLowerCase().includes(column.toLowerCase())
}

export async function loadGoalsPageData(userId: string, profile: UserProfile): Promise<GoalsPageData> {
  const supabase = await createServerSupabaseClient()

  const goals = (profile.goals ?? []) as GoalId[]
  const [targetsRes, milestonesRes] = await Promise.all([
    loadGoalTargetRows(supabase, userId),
    goals.length === 0
      ? Promise.resolve({ data: [] })
      : loadGoalMilestoneRows(supabase, userId),
  ])

  const targetRows = (targetsRes.data ?? []) as GoalTargetRow[]
  const milestoneRows = (milestonesRes.data ?? []) as GoalMilestoneRow[]

  const targets: Record<string, number | null> = {}
  const targetDates: Record<string, string | null> = {}
  const destinations: Record<string, string | null> = {}
  const addedAtMap: Record<string, string> = {}
  const milestonesByGoal: Record<string, GoalMilestoneData[]> = {}

  for (const row of targetRows) {
    targets[row.goal_id] = row.amount != null ? Number(row.amount) : null
    targetDates[row.goal_id] = row.target_date ?? null
    destinations[row.goal_id] = row.destination ?? null
    addedAtMap[row.goal_id] = row.added_at
  }

  for (const row of milestoneRows) {
    if (!milestonesByGoal[row.goal_id]) milestonesByGoal[row.goal_id] = []
    milestonesByGoal[row.goal_id].push({
      id: row.id,
      name: row.name,
      amount: Number(row.amount),
      targetDate: row.target_date,
      sortOrder: row.sort_order ?? 0,
    })
  }

  const trackedGoalIds = goals.filter(id => id in addedAtMap || targets[id] != null)
  const earliestAddedAt = Object.values(addedAtMap)
    .filter(Boolean)
    .sort()[0]

  const transactionRows = trackedGoalIds.length === 0
    ? []
    : ((await (supabase.from('transactions') as any)
        .select('category_key, amount, date')
        .eq('user_id', userId)
        .eq('category_type', 'goal')
        .in('category_key', trackedGoalIds)
        .gte('date', earliestAddedAt ? earliestAddedAt.slice(0, 10) : '1900-01-01')).data ?? []) as GoalTransactionRow[]

  const savedByGoal: Record<string, number> = {}
  const monthBuckets: Record<string, Record<string, number>> = {}

  for (const txn of transactionRows) {
    const addedAt = addedAtMap[txn.category_key]
    if (addedAt && txn.date < addedAt.slice(0, 10)) continue

    savedByGoal[txn.category_key] = (savedByGoal[txn.category_key] ?? 0) + Number(txn.amount)
    if (!monthBuckets[txn.category_key]) monthBuckets[txn.category_key] = {}
    const monthKey = txn.date.slice(0, 7)
    monthBuckets[txn.category_key][monthKey] = (monthBuckets[txn.category_key][monthKey] ?? 0) + Number(txn.amount)
  }

  const monthlyAvg: Record<string, number> = {}
  for (const [key, months] of Object.entries(monthBuckets)) {
    const values = Object.values(months)
    monthlyAvg[key] = values.reduce((sum, value) => sum + value, 0) / values.length
  }

  const goalDataList: GoalsPageGoalData[] = goals.map(id => ({
    id,
    target: targets[id] ?? null,
    targetDate: targetDates[id] ?? null,
    addedAt: addedAtMap[id] ?? null,
    totalSaved: savedByGoal[id] ?? 0,
    monthlyAvg: monthlyAvg[id] ?? 0,
    destination: destinations[id] ?? null,
    milestones: milestonesByGoal[id] ?? [],
  }))

  const totalSaved = Object.values(savedByGoal).reduce((sum, value) => sum + value, 0)
  const totalTargets = goals.reduce((sum, id) => sum + (targets[id] ?? 0), 0)

  return {
    currency: profile.currency ?? 'KES',
    amountFormatPreference: profile.amount_format_preference ?? 'smart',
    goals,
    goalDataList,
    targets,
    savedByGoal,
    totalSaved,
    totalTargets,
  }
}

async function loadGoalTargetRows(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, userId: string) {
  const primary = await (supabase.from('goal_targets') as any)
    .select('goal_id, amount, target_date, added_at, destination')
    .eq('user_id', userId)

  if (!primary.error || !isMissingColumnError(primary.error, 'target_date')) {
    return primary
  }

  const fallback = await (supabase.from('goal_targets') as any)
    .select('goal_id, amount, added_at, destination')
    .eq('user_id', userId)

  if (!fallback.error) {
    return {
      data: (fallback.data ?? []).map((row: Omit<GoalTargetRow, 'target_date'>) => ({
        ...row,
        target_date: null,
      })),
      error: null,
    }
  }

  return fallback
}

async function loadGoalMilestoneRows(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, userId: string) {
  const primary = await (supabase.from('goal_milestones') as any)
    .select('id, goal_id, name, amount, target_date, sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('amount', { ascending: true })

  if (!primary.error || !isMissingColumnError(primary.error, 'target_date')) {
    return primary
  }

  const fallback = await (supabase.from('goal_milestones') as any)
    .select('id, goal_id, name, amount, sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('amount', { ascending: true })

  if (!fallback.error) {
    return {
      data: (fallback.data ?? []).map((row: Omit<GoalMilestoneRow, 'target_date'>) => ({
        ...row,
        target_date: null,
      })),
      error: null,
    }
  }

  return fallback
}
