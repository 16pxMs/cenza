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
}

export async function saveIncome(input: SaveIncomeInput): Promise<void> {
  const { user, profile } = await getAppSession()
  if (!user || !profile) throw new Error('Not authenticated')

  const supabase = await createClient()
  const cycleId = await getCurrentCycleId(supabase as any, user.id, profile)

  const { error: incomeError } = await (supabase.from('income_entries') as any).upsert({
    user_id: user.id,
    cycle_id: cycleId,
    salary: input.income,
    extra_income: input.extraIncome,
    total: input.total,
  }, { onConflict: 'user_id,cycle_id' })

  if (incomeError) {
    throw new Error(`Failed to save income: ${incomeError.message}`)
  }

  if (input.incomeType && input.incomeType !== profile.income_type) {
    const { error: profileError } = await (supabase.from('user_profiles') as any)
      .update({ income_type: input.incomeType })
      .eq('id', user.id)

    if (profileError) {
      throw new Error(`Failed to save income type: ${profileError.message}`)
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
