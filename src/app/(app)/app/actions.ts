'use server'

import { revalidatePath } from 'next/cache'
import { getAppSession } from '@/lib/auth/app-session'
import { createCycleTransaction } from '@/lib/supabase/transactions-db'
import { createClient } from '@/lib/supabase/server'

interface AddGoalContributionInput {
  goalId: string
  goalLabel: string
  amount: number
  note: string
}

export async function addGoalContribution(input: AddGoalContributionInput): Promise<void> {
  const { user, profile } = await getAppSession()

  if (!user || !profile) {
    throw new Error('Not authenticated')
  }

  const amount = Number(input.amount)
  if (!input.goalId.trim()) throw new Error('Goal id is required')
  if (!input.goalLabel.trim()) throw new Error('Goal label is required')
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than zero')

  const supabase = await createClient()
  await createCycleTransaction(supabase as any, user.id, profile, {
    categoryType: 'goal',
    categoryKey: input.goalId,
    categoryLabel: input.goalLabel,
    amount,
    note: input.note,
  })

  revalidatePath('/app')
  revalidatePath('/goals')
  revalidatePath('/history')
}
