'use server'

import { revalidatePath } from 'next/cache'
import { getAppSession } from '@/lib/auth/app-session'
import { createServerSupabaseClient } from '@/lib/supabase/server'

interface GoalTargetInput {
  amount: number
  destination: string | null
}

export async function saveTargets(
  targets: Record<string, GoalTargetInput | null>,
  complete: boolean
): Promise<void> {
  const { user } = await getAppSession()
  if (!user) throw new Error('Not authenticated')

  if (complete) {
    const rows = Object.entries(targets)
      .filter(([, value]) => value !== null && value.amount > 0)
      .map(([goalId, value]) => ({
        user_id: user.id,
        goal_id: goalId,
        amount: value!.amount,
        destination: value!.destination,
      }))

    if (rows.length > 0) {
      const supabase = await createServerSupabaseClient()
      const { error } = await (supabase.from('goal_targets') as any).upsert(
        rows,
        { onConflict: 'user_id,goal_id' }
      )

      if (error) {
        throw new Error(`Failed to save targets: ${error.message}`)
      }
    }
  }

  revalidatePath('/targets')
  revalidatePath('/goals')
  revalidatePath('/app')
}
