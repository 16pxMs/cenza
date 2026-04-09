import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { deriveCurrentCycleId } from '@/lib/supabase/cycles-db'
import type { UserProfile } from '@/types/database'

interface IncomeRow {
  total: number | string | null
}

export interface SettingsPageData {
  name: string
  email: string
  currency: string
  payScheduleType: 'monthly' | 'twice_monthly' | null
  payScheduleDays: number[]
  incomeType: 'salaried' | 'variable' | null
  monthlyTotal: number | null
}

export async function loadSettingsPageData(user: User, profile: UserProfile): Promise<SettingsPageData> {
  const supabase = await createClient()
  const cycleId = deriveCurrentCycleId(profile)

  const { data: income } = await (supabase.from('income_entries') as any)
    .select('total')
    .eq('user_id', user.id)
    .eq('cycle_id', cycleId)
    .maybeSingle()

  const incomeRow = (income ?? null) as IncomeRow | null

  return {
    name: profile.name || user.user_metadata?.full_name || user.email?.split('@')[0] || '',
    email: user.email ?? '',
    currency: profile.currency ?? '',
    payScheduleType: profile.pay_schedule_type ?? null,
    payScheduleDays: profile.pay_schedule_days ?? [],
    incomeType: profile.income_type ?? null,
    monthlyTotal: incomeRow?.total != null ? Number(incomeRow.total) : null,
  }
}
