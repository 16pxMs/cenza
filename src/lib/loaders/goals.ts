import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { GoalId, UserProfile } from '@/types/database'

export interface GoalsPageGoalData {
  id: GoalId
  target: number | null
  totalSaved: number
  monthlyAvg: number
  destination: string | null
}

export interface GoalsPageData {
  currency: string
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
  added_at: string
  destination: string | null
}

interface GoalTransactionRow {
  category_key: string
  amount: number | string
  date: string
}

export async function loadGoalsPageData(userId: string, profile: UserProfile): Promise<GoalsPageData> {
  const supabase = await createServerSupabaseClient()

  const goals = (profile.goals ?? []) as GoalId[]
  const { data: targetsData } = await (supabase.from('goal_targets') as any)
    .select('goal_id, amount, added_at, destination')
    .eq('user_id', userId)

  const targetRows = (targetsData ?? []) as GoalTargetRow[]

  const targets: Record<string, number | null> = {}
  const destinations: Record<string, string | null> = {}
  const addedAtMap: Record<string, string> = {}

  for (const row of targetRows) {
    targets[row.goal_id] = row.amount != null ? Number(row.amount) : null
    destinations[row.goal_id] = row.destination ?? null
    addedAtMap[row.goal_id] = row.added_at
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
    totalSaved: savedByGoal[id] ?? 0,
    monthlyAvg: monthlyAvg[id] ?? 0,
    destination: destinations[id] ?? null,
  }))

  const totalSaved = Object.values(savedByGoal).reduce((sum, value) => sum + value, 0)
  const totalTargets = goals.reduce((sum, id) => sum + (targets[id] ?? 0), 0)

  return {
    currency: profile.currency ?? 'KES',
    goals,
    goalDataList,
    targets,
    savedByGoal,
    totalSaved,
    totalTargets,
  }
}
