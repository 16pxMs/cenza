'use server'

import { revalidatePath } from 'next/cache'
import { getAppSession } from '@/lib/auth/app-session'
import { createClient } from '@/lib/supabase/server'

export async function saveCurrency(code: string): Promise<void> {
  const { user } = await getAppSession()
  if (!user) throw new Error('Not authenticated')

  const supabase = await createClient()
  const { error } = await (supabase.from('user_profiles') as any)
    .update({ currency: code })
    .eq('id', user.id)

  if (error) {
    throw new Error(`Failed to update currency: ${error.message}`)
  }

  revalidatePath('/settings')
  revalidatePath('/income')
  revalidatePath('/app')
  revalidatePath('/plan')
  revalidatePath('/goals')
}

export async function savePaySchedule(
  scheduleType: 'monthly' | 'twice_monthly',
  scheduleDays: number[]
): Promise<void> {
  const { user } = await getAppSession()
  if (!user) throw new Error('Not authenticated')

  const supabase = await createClient()
  const { error } = await (supabase.from('user_profiles') as any)
    .update({ pay_schedule_type: scheduleType, pay_schedule_days: scheduleDays })
    .eq('id', user.id)

  if (error) {
    throw new Error(`Failed to save pay schedule: ${error.message}`)
  }

  revalidatePath('/settings')
  revalidatePath('/income')
  revalidatePath('/app')
  revalidatePath('/plan')
  revalidatePath('/log')
  revalidatePath('/history')
}

export async function deleteAccountData(): Promise<void> {
  const { user } = await getAppSession()
  if (!user) throw new Error('Not authenticated')

  const supabase = await createClient()
  const steps = [
    () => (supabase.from('transactions') as any).delete().eq('user_id', user.id),
    () => (supabase.from('income_entries') as any).delete().eq('user_id', user.id),
    () => (supabase.from('goal_targets') as any).delete().eq('user_id', user.id),
    () => (supabase.from('fixed_expenses') as any).delete().eq('user_id', user.id),
    () => (supabase.from('spending_budgets') as any).delete().eq('user_id', user.id),
    () => (supabase.from('spending_categories') as any).delete().eq('user_id', user.id),
    () => (supabase.from('subscriptions') as any).delete().eq('user_id', user.id),
    () => (supabase.from('cycles') as any).delete().eq('user_id', user.id),
    () => (supabase.from('user_profiles') as any).delete().eq('id', user.id),
  ]

  for (const step of steps) {
    const result = await step()
    if (result.error) {
      throw new Error(`Failed to delete account data: ${result.error.message}`)
    }
  }
}
