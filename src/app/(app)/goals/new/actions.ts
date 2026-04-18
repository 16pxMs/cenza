'use server'

import { revalidatePath } from 'next/cache'
import { getAppSession } from '@/lib/auth/app-session'
import { deleteTransactionsForCycleDateByCategory } from '@/lib/supabase/transactions-db'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { GoalId } from '@/types/database'

interface SaveNewGoalInput {
  goalId: GoalId
  targetAmount: number | null
  destination?: string | null
}

export async function saveNewGoal(input: SaveNewGoalInput): Promise<void> {
  const { user, profile } = await getAppSession()
  if (!user || !profile) throw new Error('Not authenticated')

  const supabase = await createServerSupabaseClient()
  const existingGoals = (profile.goals ?? []) as GoalId[]
  const isReAdding = !existingGoals.includes(input.goalId)
  const newGoals = isReAdding ? [...existingGoals, input.goalId] : existingGoals

  const upsertPayload: Record<string, unknown> = {
    user_id: user.id,
    goal_id: input.goalId,
    destination: input.destination?.trim() || null,
    added_at: new Date().toISOString(),
  }

  if (input.targetAmount != null && input.targetAmount > 0) {
    upsertPayload.amount = input.targetAmount
  }

  const [profileUpdate, targetUpsert] = await Promise.all([
    (supabase.from('user_profiles') as any)
      .update({ goals: newGoals })
      .eq('id', user.id),
    (supabase.from('goal_targets') as any)
      .upsert(upsertPayload, { onConflict: 'user_id,goal_id' }),
  ])

  if (profileUpdate.error) {
    throw new Error(`Failed to update goals: ${profileUpdate.error.message}`)
  }

  if (targetUpsert.error) {
    throw new Error(`Failed to save target: ${targetUpsert.error.message}`)
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
}
