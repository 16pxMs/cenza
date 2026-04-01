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
