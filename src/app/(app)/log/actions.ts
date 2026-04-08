'use server'

import { revalidatePath } from 'next/cache'
import { getAppSession } from '@/lib/auth/app-session'
import {
  createCycleRefundTransaction,
  deleteTransactionsForCycleDateByCategory,
} from '@/lib/supabase/transactions-db'
import { createClient } from '@/lib/supabase/server'
import type { CategoryType } from '@/types/database'

interface RecordRefundInput {
  categoryType: CategoryType
  categoryKey: string
  categoryLabel: string
  amount: number
  note?: string
}

interface UpdateLogEntryInput {
  id: string
  amount: number
  date: string
  note?: string
}

export async function recordRefund(input: RecordRefundInput): Promise<void> {
  const { user, profile } = await getAppSession()

  if (!user || !profile) {
    throw new Error('Not authenticated')
  }

  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Refund amount must be greater than zero')
  }

  const supabase = await createClient()
  await createCycleRefundTransaction(supabase as any, user.id, profile, {
    categoryType: input.categoryType,
    categoryKey: input.categoryKey,
    categoryLabel: input.categoryLabel,
    amount,
    note: input.note,
  })

  revalidatePath('/log')
  revalidatePath('/history')
  revalidatePath('/app')
}

export async function updateLogEntry(input: UpdateLogEntryInput): Promise<void> {
  const { user } = await getAppSession()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const amount = Number(input.amount)
  if (!input.id.trim()) throw new Error('Entry id is required')
  if (!input.date.trim()) throw new Error('Entry date is required')
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than zero')

  const supabase = await createClient()
  const { error } = await (supabase.from('transactions') as any)
    .update({ amount, date: input.date, note: input.note?.trim() || null })
    .eq('id', input.id)
    .eq('user_id', user.id)

  if (error) throw new Error(`Failed to update entry: ${error.message}`)

  revalidatePath('/log')
  revalidatePath('/history')
  revalidatePath('/app')
}

export async function deleteCurrentCycleCategoryEntries(categoryKey: string): Promise<void> {
  const { user, profile } = await getAppSession()

  if (!user || !profile) {
    throw new Error('Not authenticated')
  }

  if (!categoryKey.trim()) {
    throw new Error('Category key is required')
  }

  const supabase = await createClient()
  await deleteTransactionsForCycleDateByCategory(supabase as any, user.id, profile, categoryKey)

  revalidatePath('/log')
  revalidatePath('/history')
  revalidatePath('/app')
}
