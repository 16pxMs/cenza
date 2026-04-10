import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { deriveCurrentCycleId } from '@/lib/supabase/cycles-db'
import type { UserProfile } from '@/types/database'

interface IncomeRow {
  salary: number | string | null
  extra_income: Array<{ amount?: number | string | null }> | null
  cycle_start_mode?: 'full_month' | 'mid_month' | null
  opening_balance?: number | string | null
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
    .select('salary,extra_income,cycle_start_mode,opening_balance')
    .eq('user_id', user.id)
    .eq('cycle_id', cycleId)
    .maybeSingle()

  let incomeRow = (income ?? null) as IncomeRow | null
  if (!incomeRow) {
    const { data: fallbackIncome } = await (supabase.from('income_entries') as any)
      .select('salary,extra_income,cycle_start_mode,opening_balance')
      .eq('user_id', user.id)
      .order('cycle_id', { ascending: false })
      .limit(1)
      .maybeSingle()
    incomeRow = (fallbackIncome ?? null) as IncomeRow | null
  }

  const salary = Number(incomeRow?.salary ?? 0)
  const openingBalance = Number(incomeRow?.opening_balance ?? 0)
  const extras = Array.isArray(incomeRow?.extra_income) ? incomeRow!.extra_income : []
  const extrasTotal = extras.reduce((sum, item) => sum + Number(item?.amount ?? 0), 0)
  const monthlyTotal = incomeRow
    ? (incomeRow.cycle_start_mode === 'mid_month' ? openingBalance : salary + extrasTotal)
    : null

  return {
    name: profile.name || user.user_metadata?.full_name || user.email?.split('@')[0] || '',
    email: user.email ?? '',
    currency: profile.currency ?? '',
    payScheduleType: profile.pay_schedule_type ?? null,
    payScheduleDays: profile.pay_schedule_days ?? [],
    incomeType: profile.income_type ?? null,
    monthlyTotal: monthlyTotal != null && Number.isFinite(monthlyTotal) ? monthlyTotal : null,
  }
}
