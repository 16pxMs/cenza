'use server'

import { revalidatePath } from 'next/cache'
import { getAppSession } from '@/lib/auth/app-session'
import { clearPinDeviceState } from '@/lib/actions/pin'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { deleteMonthlyStorageForUser } from '@/lib/monthly-reminders/storage'

export async function saveCurrency(code: string): Promise<void> {
  const { user } = await getAppSession()
  if (!user) throw new Error('Not authenticated')

  const supabase = await createServerSupabaseClient()
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

  const supabase = await createServerSupabaseClient()
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

export async function deleteAccountPermanently(): Promise<void> {
  const { user } = await getAppSession()
  if (!user) throw new Error('Not authenticated')

  const admin = createAdminClient()
  const steps = [
    () => (admin.from('transactions') as any).delete().eq('user_id', user.id),
    () => (admin.from('income_entries') as any).delete().eq('user_id', user.id),
    () => (admin.from('goal_targets') as any).delete().eq('user_id', user.id),
    () => deleteMonthlyStorageForUser(admin, user.id).then(() => ({ error: null })),
    () => (admin.from('spending_budgets') as any).delete().eq('user_id', user.id),
    () => (admin.from('spending_categories') as any).delete().eq('user_id', user.id),
    () => (admin.from('subscriptions') as any).delete().eq('user_id', user.id),
    () => (admin.from('cycles') as any).delete().eq('user_id', user.id),
    () => (admin.from('user_profiles') as any).delete().eq('id', user.id),
  ]

  for (const step of steps) {
    const result = await step()
    if (result.error) {
      throw new Error(`Failed to delete account data: ${result.error.message}`)
    }
  }

  const { error: authError } = await admin.auth.admin.deleteUser(user.id)
  if (authError) {
    throw new Error(
      `We deleted your app data, but could not remove your secure login. ${authError.message}`
    )
  }

  await clearPinDeviceState({ forgetDevice: true })

  revalidatePath('/')
  revalidatePath('/login')
  revalidatePath('/settings')
}
