'use server'

import { revalidatePath } from 'next/cache'
import { getAppSession } from '@/lib/auth/app-session'
import { createCycleRefundTransaction } from '@/lib/supabase/transactions-db'
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
  label?: string
  categoryKey?: string
}

function slugifyCategoryKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
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
  const nextLabel = input.label?.trim()
  const nextCategoryKey = nextLabel ? slugifyCategoryKey(nextLabel) : null

  const patch: Record<string, unknown> = {
    amount,
    date: input.date,
    note: input.note?.trim() || null,
  }

  if (nextLabel) {
    patch.category_label = nextLabel
    patch.category_key = nextCategoryKey || input.categoryKey || null
  }

  const { error } = await (supabase.from('transactions') as any)
    .update(patch)
    .eq('id', input.id)
    .eq('user_id', user.id)

  if (error) throw new Error(`Failed to update entry: ${error.message}`)

  revalidatePath('/log')
  revalidatePath('/history')
  revalidatePath('/app')
}

export async function deleteLogEntry(id: string): Promise<void> {
  const { user } = await getAppSession()
  if (!user) throw new Error('Not authenticated')
  if (!id.trim()) throw new Error('Entry id is required')

  const supabase = await createClient()
  const { error } = await (supabase.from('transactions') as any)
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(`Failed to delete entry: ${error.message}`)

  revalidatePath('/log')
  revalidatePath('/history')
  revalidatePath('/app')
}

