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

interface SaveExpenseBatchItem extends SaveExpenseInput {}

async function rememberDictionaryItem(
  supabase: any,
  userId: string,
  item: Pick<SaveExpenseInput, 'categoryLabel' | 'categoryKey' | 'categoryType'>
) {
  const normalized = item.categoryLabel.trim().toLowerCase()
  const table = supabase.from('item_dictionary') as any

  if (typeof table.select !== 'function') {
    const { error } = await table.upsert({
      user_id: userId,
      name_normalized: normalized,
      label: item.categoryLabel,
      category_key: item.categoryKey,
      category_type: item.categoryType,
      usage_count: 1,
    }, {
      onConflict: 'user_id,name_normalized',
    })

    if (error) {
      throw new Error(`Failed to remember item: ${error.message}`)
    }

    return
  }

  const { data: existing, error: existingError } = await table
    .select('usage_count')
    .eq('user_id', userId)
    .eq('name_normalized', normalized)
    .maybeSingle()

  if (existingError) {
    throw new Error(`Failed to load remembered item: ${existingError.message}`)
  }

  const usageCount = Number(existing?.usage_count ?? 0) + 1

  const { error } = await table.upsert({
    user_id: userId,
    name_normalized: normalized,
    label: item.categoryLabel,
    category_key: item.categoryKey,
    category_type: item.categoryType,
    usage_count: usageCount,
  }, {
    onConflict: 'user_id,name_normalized',
  })

  if (error) {
    throw new Error(`Failed to remember item: ${error.message}`)
  }
}

export async function saveExpense(input: SaveExpenseInput): Promise<void> {
  await saveExpenseBatch([input])
}

export async function saveExpenseBatch(items: SaveExpenseBatchItem[]): Promise<void> {
  const { user, profile } = await getAppSession()
  if (!user || !profile) throw new Error('Not authenticated')

  const supabase = await createClient()

  for (const input of items) {
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
      await rememberDictionaryItem(supabase, user.id, input)
    }
  }

  revalidatePath('/log')
  revalidatePath('/history')
  revalidatePath('/app')
}
