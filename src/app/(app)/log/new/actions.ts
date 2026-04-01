'use server'

import { revalidatePath } from 'next/cache'
import { getAppSession } from '@/lib/auth/app-session'
import { createCycleTransaction } from '@/lib/supabase/transactions-db'
import { createClient } from '@/lib/supabase/server'

type CategoryType = 'everyday' | 'fixed' | 'debt' | 'goal'

interface SaveExpenseInput {
  mode: 'add' | 'update'
  priorEntryId?: string | null
  categoryType: CategoryType
  categoryKey: string
  categoryLabel: string
  amount: number
  note?: string | null
  rememberItem: boolean
}

export async function saveExpense(input: SaveExpenseInput): Promise<void> {
  const { user, profile } = await getAppSession()
  if (!user || !profile) throw new Error('Not authenticated')

  const supabase = await createClient()

  if (input.mode === 'update' && input.priorEntryId) {
    const { error } = await (supabase.from('transactions') as any)
      .delete()
      .eq('id', input.priorEntryId)

    if (error) {
      throw new Error(`Failed to delete prior entry: ${error.message}`)
    }
  }

  await createCycleTransaction(supabase as any, user.id, profile, {
    categoryType: input.categoryType,
    categoryKey: input.categoryKey,
    categoryLabel: input.categoryLabel,
    amount: input.amount,
    note: input.note,
  })

  if (input.rememberItem) {
    const normalized = input.categoryLabel.trim().toLowerCase()
    const { error } = await (supabase.from('item_dictionary') as any).upsert({
      user_id: user.id,
      name_normalized: normalized,
      label: input.categoryLabel,
      category_key: input.categoryKey,
      category_type: input.categoryType,
      usage_count: 1,
    }, {
      onConflict: 'user_id,name_normalized',
    })

    if (error) {
      throw new Error(`Failed to remember item: ${error.message}`)
    }
  }

  revalidatePath('/log')
  revalidatePath('/history')
  revalidatePath('/app')
}
