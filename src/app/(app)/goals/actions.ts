'use server'

import { revalidatePath } from 'next/cache'
import { getAppSession } from '@/lib/auth/app-session'
import { deleteTransactionsForCycleDateByCategory } from '@/lib/supabase/transactions-db'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { GoalId } from '@/types/database'

function revalidateGoalPaths() {
  revalidatePath('/goals')
  revalidatePath('/app')
  revalidatePath('/history')
}

export async function saveGoalTarget(goalId: GoalId, amount: number | null): Promise<void> {
  const { user } = await getAppSession()
  if (!user) throw new Error('Not authenticated')

  const supabase = await createServerSupabaseClient()
  const { error } = await (supabase.from('goal_targets') as any).upsert(
    { user_id: user.id, goal_id: goalId, amount },
    { onConflict: 'user_id,goal_id' }
  )

  if (error) throw new Error(`Failed to save target: ${error.message}`)

  revalidateGoalPaths()
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
    deleteTransactionsForCycleDateByCategory(supabase as any, user.id, profile, goalId),
  ])

  revalidateGoalPaths()
}
