'use server'

import { revalidatePath } from 'next/cache'
import { getAppSession } from '@/lib/auth/app-session'
import { getCurrentCycleId } from '@/lib/supabase/cycles-db'
import { createClient } from '@/lib/supabase/server'
import type { FixedEntry } from '@/components/flows/plan/EditFixedExpensesSheet'
import type { BudgetCategory } from '@/components/flows/plan/EditSpendingBudgetSheet'

interface SaveIncomeInput {
  income: number
  extraIncome: { id: string; label: string; amount: number }[]
  total: number
  incomeType?: 'salaried' | 'variable'
  paydayDay?: number | null
  cycleStartMode?: 'full_month' | 'mid_month'
  openingBalance?: number | null
}

export async function saveIncome(input: SaveIncomeInput): Promise<void> {
  const { user, profile } = await getAppSession()
  if (!user || !profile) throw new Error('Not authenticated')

  const supabase = await createClient()
  const cycleId = await getCurrentCycleId(supabase as any, user.id, profile)

  const salary = Number(input.income)
  const cycleStartMode = input.cycleStartMode === 'mid_month' ? 'mid_month' : 'full_month'
  const openingBalance = input.openingBalance != null ? Number(input.openingBalance) : null

  if (cycleStartMode === 'mid_month') {
    if (!Number.isFinite(openingBalance) || (openingBalance ?? 0) <= 0) {
      throw new Error('Opening balance must be greater than zero')
    }
  } else if (!Number.isFinite(salary) || salary <= 0) {
    throw new Error('Income must be greater than zero')
  }

  const extraIncome = cycleStartMode === 'mid_month'
    ? []
    : (input.extraIncome ?? [])
    .filter((item) => item.label.trim() && Number(item.amount) > 0)
    .map((item) => ({
      id: String(item.id),
      label: item.label.trim(),
      amount: Number(item.amount),
    }))

  const { error: incomeError } = await (supabase.from('income_entries') as any).upsert({
    user_id: user.id,
    cycle_id: cycleId,
    salary: cycleStartMode === 'mid_month' ? 0 : salary,
    extra_income: extraIncome,
    cycle_start_mode: cycleStartMode,
    opening_balance: cycleStartMode === 'mid_month' ? openingBalance : null,
  }, { onConflict: 'user_id,cycle_id' })

  if (incomeError) {
    throw new Error(`Failed to save income: ${incomeError.message}`)
  }

  const nextIncomeType = input.incomeType ?? profile.income_type ?? (input.paydayDay != null ? 'salaried' : null)
  const nextPaydayDay = (() => {
    if (nextIncomeType !== 'salaried') return null
    if (input.paydayDay != null && Number.isFinite(Number(input.paydayDay))) {
      return Number(input.paydayDay)
    }
    if (Array.isArray(profile.pay_schedule_days) && profile.pay_schedule_days.length > 0) {
      const existing = Number(profile.pay_schedule_days[0])
      return Number.isFinite(existing) ? existing : null
    }
    return null
  })()

  if (nextIncomeType === 'salaried' && (!nextPaydayDay || nextPaydayDay <= 0)) {
    throw new Error('Pay day is required for salaried income')
  }

  const profilePatch: Record<string, unknown> = {}
  if (nextIncomeType && nextIncomeType !== profile.income_type) {
    profilePatch.income_type = nextIncomeType
  }
  if (nextIncomeType === 'salaried' && nextPaydayDay) {
    profilePatch.pay_schedule_type = 'monthly'
    profilePatch.pay_schedule_days = [Math.min(Math.max(Math.round(nextPaydayDay), 1), 28)]
  }
  if (nextIncomeType === 'variable') {
    profilePatch.pay_schedule_type = null
    profilePatch.pay_schedule_days = null
  }

  if (Object.keys(profilePatch).length > 0) {
    const { error: profileError } = await (supabase.from('user_profiles') as any)
      .update(profilePatch)
      .eq('id', user.id)

    if (profileError) {
      throw new Error(`Failed to save income settings: ${profileError.message}`)
    }
  }

  revalidatePath('/income')
  revalidatePath('/plan')
  revalidatePath('/app')
  revalidatePath('/settings')
}

export async function saveFixedExpenses(entries: FixedEntry[]): Promise<void> {
  const { user, profile } = await getAppSession()
  if (!user || !profile) throw new Error('Not authenticated')

  const supabase = await createClient()
  const cycleId = await getCurrentCycleId(supabase as any, user.id, profile)
  const totalMonthly = entries.reduce((sum, entry) => sum + entry.monthly, 0)

  const { error } = await (supabase.from('fixed_expenses') as any).upsert({
    user_id: user.id,
    cycle_id: cycleId,
    total_monthly: totalMonthly,
    entries,
  }, { onConflict: 'user_id,cycle_id' })

  if (error) {
    throw new Error(`Failed to save fixed expenses: ${error.message}`)
  }

  revalidatePath('/income')
  revalidatePath('/plan')
  revalidatePath('/app')
}

export async function saveSpendingBudget(categories: BudgetCategory[]): Promise<void> {
  const { user, profile } = await getAppSession()
  if (!user || !profile) throw new Error('Not authenticated')

  const supabase = await createClient()
  const cycleId = await getCurrentCycleId(supabase as any, user.id, profile)
  const totalBudget = categories.reduce((sum, category) => sum + category.budget, 0)

  const { error } = await (supabase.from('spending_budgets') as any).upsert({
    user_id: user.id,
    cycle_id: cycleId,
    total_budget: totalBudget,
    categories,
  }, { onConflict: 'user_id,cycle_id' })

  if (error) {
    throw new Error(`Failed to save spending budget: ${error.message}`)
  }

  revalidatePath('/income')
  revalidatePath('/plan')
  revalidatePath('/app')
}
