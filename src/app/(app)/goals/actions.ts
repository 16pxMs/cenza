'use server'

import { revalidatePath } from 'next/cache'
import { getAppSession } from '@/lib/auth/app-session'
import { normalizeGoalTargetDate } from '@/lib/goals/deadlines'
import { validateGoalMilestones, type GoalMilestoneInput } from '@/lib/goals/milestones'
import { deleteTransactionsForCycleDateByCategory } from '@/lib/supabase/transactions-db'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { GoalId } from '@/types/database'

function isMissingColumnError(error: { message?: string } | null | undefined, column: string) {
  return (error?.message ?? '').toLowerCase().includes(column.toLowerCase())
}

function revalidateGoalPaths() {
  revalidatePath('/goals')
  revalidatePath('/app')
  revalidatePath('/history')
}

function revalidateGoalDetailPaths(goalId: GoalId) {
  revalidateGoalPaths()
  revalidatePath(`/goals/${goalId}`)
  revalidatePath(`/goals/${goalId}/milestones`)
}

export async function saveGoalTarget(goalId: GoalId, input: { amount: number | null; targetDate: string | null }): Promise<void> {
  const { user } = await getAppSession()
  if (!user) throw new Error('Not authenticated')
  const targetDate = normalizeGoalTargetDate(input.targetDate)
  if ((input.targetDate?.trim() || null) && !targetDate) {
    throw new Error('Goal target date must be a valid date.')
  }

  const supabase = await createServerSupabaseClient()
  const primary = await (supabase.from('goal_targets') as any).upsert(
    { user_id: user.id, goal_id: goalId, amount: input.amount, target_date: targetDate },
    { onConflict: 'user_id,goal_id' }
  )

  const error = primary.error && isMissingColumnError(primary.error, 'target_date') && targetDate == null
    ? (await (supabase.from('goal_targets') as any).upsert(
        { user_id: user.id, goal_id: goalId, amount: input.amount },
        { onConflict: 'user_id,goal_id' }
      )).error
    : primary.error

  if (error) throw new Error(`Failed to save target: ${error.message}`)

  revalidateGoalDetailPaths(goalId)
}

export async function saveGoalMilestones(goalId: GoalId, rows: GoalMilestoneInput[], targetAmount: number | null, goalTargetDate: string | null = null): Promise<void> {
  const { user } = await getAppSession()
  if (!user) throw new Error('Not authenticated')

  const { milestones, error } = validateGoalMilestones(rows, targetAmount, goalTargetDate)
  if (error) throw new Error(error)

  const supabase = await createServerSupabaseClient()

  const { error: deleteError } = await (supabase.from('goal_milestones') as any)
    .delete()
    .eq('user_id', user.id)
    .eq('goal_id', goalId)

  if (deleteError) {
    throw new Error(`Failed to reset milestones: ${deleteError.message}`)
  }

  if (milestones.length > 0) {
    const primaryInsert = await (supabase.from('goal_milestones') as any)
      .insert(
        milestones.map((milestone, index) => ({
          user_id: user.id,
          goal_id: goalId,
          name: milestone.name,
          amount: milestone.amount,
          target_date: milestone.targetDate,
          sort_order: index,
        }))
      )

    const insertError = primaryInsert.error && isMissingColumnError(primaryInsert.error, 'target_date')
      ? (await (supabase.from('goal_milestones') as any)
          .insert(
            milestones.map((milestone, index) => ({
              user_id: user.id,
              goal_id: goalId,
              name: milestone.name,
              amount: milestone.amount,
              sort_order: index,
            }))
          )).error
      : primaryInsert.error

    if (insertError) {
      throw new Error(`Failed to save milestones: ${insertError.message}`)
    }
  }

  revalidateGoalDetailPaths(goalId)
}

export async function archiveGoal(goalId: GoalId): Promise<void> {
  const { user, profile } = await getAppSession()
  if (!user || !profile) throw new Error('Not authenticated')

  const newGoals = (profile.goals ?? []).filter(goal => goal !== goalId)
  const supabase = await createServerSupabaseClient()

  await Promise.all([
    (async () => {
      const { error } = await (supabase.from('user_profiles') as any)
        .update({ goals: newGoals })
        .eq('id', user.id)
      if (error) throw new Error(`Failed to update goals: ${error.message}`)
    })(),
    deleteTransactionsForCycleDateByCategory(supabase as any, user.id, profile, goalId),
  ])

  revalidateGoalPaths()
}

export async function removeGoal(goalId: GoalId): Promise<void> {
  const { user, profile } = await getAppSession()
  if (!user || !profile) throw new Error('Not authenticated')

  const newGoals = (profile.goals ?? []).filter(goal => goal !== goalId)
  const supabase = await createServerSupabaseClient()

  await Promise.all([
    (async () => {
      const { error } = await (supabase.from('user_profiles') as any)
        .update({ goals: newGoals })
        .eq('id', user.id)
      if (error) throw new Error(`Failed to update goals: ${error.message}`)
    })(),
    (async () => {
      const { error } = await (supabase.from('goal_targets') as any)
        .delete()
        .eq('user_id', user.id)
        .eq('goal_id', goalId)
      if (error) throw new Error(`Failed to remove target: ${error.message}`)
    })(),
    (async () => {
      const { error } = await (supabase.from('goal_milestones') as any)
        .delete()
        .eq('user_id', user.id)
        .eq('goal_id', goalId)
      if (error) throw new Error(`Failed to remove milestones: ${error.message}`)
    })(),
    deleteTransactionsForCycleDateByCategory(supabase as any, user.id, profile, goalId),
  ])

  revalidateGoalDetailPaths(goalId)
}
