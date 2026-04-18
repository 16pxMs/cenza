'use server'

import { revalidatePath } from 'next/cache'
import { getAppSession } from '@/lib/auth/app-session'
import { createCycleTransaction } from '@/lib/supabase/transactions-db'
import { getCurrentCycleId } from '@/lib/supabase/cycles-db'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { canonicalizeFixedBillKey } from '@/lib/fixed-bills/canonical'

interface SaveFirstExpenseInput {
  resolvedGroupType: 'everyday' | 'fixed' | 'subscription'
  finalKey: string
  finalLabel: string
  amount: number
  note?: string | null
  isSubscription: boolean
  isMonthlyFixed: boolean
}

export async function saveFirstExpense(input: SaveFirstExpenseInput): Promise<void> {
  const { user, profile } = await getAppSession()
  if (!user || !profile) throw new Error('Not authenticated')

  const supabase = await createServerSupabaseClient()
  const persistedKey =
    input.resolvedGroupType === 'fixed'
      ? canonicalizeFixedBillKey(input.finalKey)
      : input.finalKey

  await createCycleTransaction(supabase as any, user.id, profile, {
    categoryType: input.resolvedGroupType,
    categoryKey: persistedKey,
    categoryLabel: input.finalLabel,
    amount: input.amount,
    note: input.note,
  })

  const cycleId = await getCurrentCycleId(supabase as any, user.id, profile)

  if (input.isSubscription) {
    const { error } = await (supabase.from('subscriptions') as any).insert({
      user_id: user.id,
      key: persistedKey,
      label: input.finalLabel,
      amount: input.amount,
      needs_check: true,
    })

    if (error) {
      throw new Error(`Expense saved, but subscription record failed: ${error.message}`)
    }
  }

  if (input.isMonthlyFixed) {
    const { data: existing, error: readError } = await (supabase.from('fixed_expenses') as any)
      .select('total_monthly, entries')
      .eq('user_id', user.id)
      .eq('cycle_id', cycleId)
      .maybeSingle()

    if (readError) {
      throw new Error(`Failed to load existing expenses: ${readError.message}`)
    }

    const existingEntries = (((existing as any)?.entries ?? []) as any[]).map((entry: any) => ({
      ...entry,
      key: canonicalizeFixedBillKey(String(entry?.key ?? '')),
    }))

    if (!existingEntries.some((entry: any) => entry.key === persistedKey)) {
      const newEntries = [
        ...existingEntries,
        {
          key: persistedKey,
          label: input.finalLabel,
          monthly: input.amount,
          confidence: 'known',
          due_day: null,
          priority: 'flex',
        },
      ]

      const { error } = await (supabase.from('fixed_expenses') as any).upsert(
        {
          user_id: user.id,
          cycle_id: cycleId,
          total_monthly: newEntries.reduce((sum: number, entry: any) => sum + (entry.monthly ?? 0), 0),
          entries: newEntries,
        },
        { onConflict: 'user_id,cycle_id' }
      )

      if (error) {
        throw new Error(`Expense saved, but fixed expense record failed: ${error.message}`)
      }
    }
  }

  revalidatePath('/app')
  revalidatePath('/log')
  revalidatePath('/income')
  revalidatePath('/history')
}
