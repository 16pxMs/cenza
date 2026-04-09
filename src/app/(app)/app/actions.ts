'use server'

import { revalidatePath } from 'next/cache'
import { getAppSession } from '@/lib/auth/app-session'
import { createCycleTransaction } from '@/lib/supabase/transactions-db'
import { getCurrentCycleId } from '@/lib/supabase/cycles-db'
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

export async function confirmReceivedIncome(received: number, receivedDate?: string): Promise<void> {
  const { user, profile } = await getAppSession()
  if (!user || !profile) throw new Error('Not authenticated')

  const value = Number(received)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Received income must be greater than zero')
  }

  const supabase = await createClient()
  const cycleId = await getCurrentCycleId(supabase as any, user.id, profile)
  const timestamp = (() => {
    if (!receivedDate) return new Date().toISOString()
    const parsed = new Date(`${receivedDate}T12:00:00`)
    if (Number.isNaN(parsed.getTime())) return new Date().toISOString()
    return parsed.toISOString()
  })()

  const incomeTable = supabase.from('income_entries') as any
  const { data: existingRow, error: readError } = await incomeTable
    .select('id')
    .eq('user_id', user.id)
    .eq('cycle_id', cycleId)
    .maybeSingle()

  if (readError) {
    throw new Error(`Failed to read income before confirmation: ${readError.message}`)
  }

  const { error } = existingRow
    ? await incomeTable
        .update({
          received: value,
          received_confirmed_at: timestamp,
        })
        .eq('user_id', user.id)
        .eq('cycle_id', cycleId)
    : await incomeTable.upsert({
        user_id: user.id,
        cycle_id: cycleId,
        salary: 0,
        extra_income: [],
        received: value,
        received_confirmed_at: timestamp,
      }, { onConflict: 'user_id,cycle_id' })

  if (error) {
    throw new Error(`Failed to confirm received income: ${error.message}`)
  }

  revalidatePath('/app')
  revalidatePath('/income')
  revalidatePath('/plan')
}
