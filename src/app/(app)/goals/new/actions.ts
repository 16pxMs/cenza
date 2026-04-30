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

interface SaveNewGoalInput {
  goalId: GoalId
  targetAmount: number | null
  targetDate?: string | null
  destination?: string | null
  milestones?: GoalMilestoneInput[]
}

export async function saveNewGoal(input: SaveNewGoalInput): Promise<void> {
  const { user, profile } = await getAppSession()
  if (!user || !profile) throw new Error('Not authenticated')
  const targetDate = normalizeGoalTargetDate(input.targetDate)
  if ((input.targetDate?.trim() || null) && !targetDate) {
    throw new Error('Goal target date must be a valid date.')
  }

  const { milestones, error: milestoneError } = validateGoalMilestones(
    input.milestones ?? [],
    input.targetAmount,
    targetDate
  )
  if (milestoneError) {
    throw new Error(milestoneError)
  }

  const supabase = await createServerSupabaseClient()
  const existingGoals = (profile.goals ?? []) as GoalId[]
  const isReAdding = !existingGoals.includes(input.goalId)
  const newGoals = isReAdding ? [...existingGoals, input.goalId] : existingGoals

  const upsertPayload: Record<string, unknown> = {
    user_id: user.id,
    goal_id: input.goalId,
    destination: input.destination?.trim() || null,
    added_at: new Date().toISOString(),
    target_date: targetDate,
  }

  if (input.targetAmount != null && input.targetAmount > 0) {
    upsertPayload.amount = input.targetAmount
  }

  const [profileUpdate, primaryTargetUpsert] = await Promise.all([
    (supabase.from('user_profiles') as any)
      .update({ goals: newGoals })
      .eq('id', user.id),
    (supabase.from('goal_targets') as any)
      .upsert(upsertPayload, { onConflict: 'user_id,goal_id' }),
  ])

  if (profileUpdate.error) {
    throw new Error(`Failed to update goals: ${profileUpdate.error.message}`)
  }

  const targetUpsertError = primaryTargetUpsert.error && isMissingColumnError(primaryTargetUpsert.error, 'target_date') && targetDate == null
    ? (await (supabase.from('goal_targets') as any)
        .upsert(
          {
            user_id: user.id,
            goal_id: input.goalId,
            destination: input.destination?.trim() || null,
            added_at: new Date().toISOString(),
            ...(input.targetAmount != null && input.targetAmount > 0 ? { amount: input.targetAmount } : {}),
          },
          { onConflict: 'user_id,goal_id' }
        )).error
    : primaryTargetUpsert.error

  if (targetUpsertError) {
    throw new Error(`Failed to save target: ${targetUpsertError.message}`)
  }

  const { error: milestoneDeleteError } = await (supabase.from('goal_milestones') as any)
    .delete()
    .eq('user_id', user.id)
    .eq('goal_id', input.goalId)

  if (milestoneDeleteError) {
    throw new Error(`Failed to reset milestones: ${milestoneDeleteError.message}`)
  }

  if (milestones.length > 0) {
    const primaryMilestoneInsert = await (supabase.from('goal_milestones') as any)
      .insert(
        milestones.map((milestone, index) => ({
          user_id: user.id,
          goal_id: input.goalId,
          name: milestone.name,
          amount: milestone.amount,
          target_date: milestone.targetDate,
          sort_order: index,
        }))
      )

    const milestoneInsertError = primaryMilestoneInsert.error && isMissingColumnError(primaryMilestoneInsert.error, 'target_date')
      ? (await (supabase.from('goal_milestones') as any)
          .insert(
            milestones.map((milestone, index) => ({
              user_id: user.id,
              goal_id: input.goalId,
              name: milestone.name,
              amount: milestone.amount,
              sort_order: index,
            }))
          )).error
      : primaryMilestoneInsert.error

    if (milestoneInsertError) {
      throw new Error(`Failed to save milestones: ${milestoneInsertError.message}`)
    }
  }

  if (isReAdding) {
    await deleteTransactionsForCycleDateByCategory(
      supabase,
      user.id,
      profile,
      input.goalId
    )
  }

  revalidatePath('/app')
  revalidatePath('/goals')
  revalidatePath('/goals/new')
  revalidatePath(`/goals/${input.goalId}`)
}
