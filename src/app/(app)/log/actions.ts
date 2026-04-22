'use server'

import { revalidatePath } from 'next/cache'
import { getAppSession } from '@/lib/auth/app-session'
import { createCycleRefundTransaction } from '@/lib/supabase/transactions-db'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { CategoryType } from '@/types/database'
import { canonicalizeFixedBillKey, recurringExpenseKey } from '@/lib/fixed-bills/canonical'
import { getCurrentCycleId } from '@/lib/supabase/cycles-db'
import {
  loadMonthlyReminderEntriesForCycle,
  removeMonthlyReminderEntryForCycle,
  saveMonthlyReminderEntryForCycle,
} from '@/lib/monthly-reminders/storage'

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
  categoryType?: CategoryType
  removeMonthlyReminderKey?: string
}

interface SetMonthlyReminderInput {
  categoryType: CategoryType
  categoryKey: string
  categoryLabel: string
  amount: number
}

interface RemoveMonthlyReminderInput {
  categoryKey: string
}

interface UpdateMonthlyReminderAmountInput {
  categoryKey: string
  monthlyAmount: number
}

interface UpdateMonthlyReminderInput {
  categoryKey: string
  label: string
  monthlyAmount: number
}

async function removeMonthlyReminderForCurrentCycle(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  profile: NonNullable<Awaited<ReturnType<typeof getAppSession>>['profile']>,
  categoryKey: string
): Promise<void> {
  const cycleId = await getCurrentCycleId(supabase as any, userId, profile)
  await removeMonthlyReminderForCycle(supabase, userId, cycleId, categoryKey)
}

async function removeMonthlyReminderForCycle(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  cycleId: string,
  categoryKey: string
): Promise<void> {
  const monthlyReminderEntries = await loadMonthlyReminderEntriesForCycle(supabase, userId, cycleId)

  if (process.env.NODE_ENV !== 'production') {
    console.info(
      `[log.delete] monthly-reminder-remove
cycleId: ${cycleId}
requestedKey: ${categoryKey}
canonicalKey: ${canonicalizeFixedBillKey(categoryKey)}
monthlyReminderEntries:
${JSON.stringify(monthlyReminderEntries, null, 2)}`
    )
  }

  await removeMonthlyReminderEntryForCycle(supabase, userId, cycleId, categoryKey)
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

  const supabase = await createServerSupabaseClient()
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
  revalidatePath('/goals')
}

export async function updateLogEntry(input: UpdateLogEntryInput): Promise<void> {
  const { user, profile } = await getAppSession()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const amount = Number(input.amount)
  if (!input.id.trim()) throw new Error('Entry id is required')
  if (!input.date.trim()) throw new Error('Entry date is required')
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than zero')

  const supabase = await createServerSupabaseClient()
  const nextLabel = input.label?.trim()
  const nextCategoryKey = nextLabel ? slugifyCategoryKey(nextLabel) : null
  const baseCategoryKey = nextCategoryKey || input.categoryKey || null
  const persistedCategoryKey =
    input.categoryType === 'fixed' && baseCategoryKey
      ? canonicalizeFixedBillKey(baseCategoryKey)
      : baseCategoryKey

  const patch: Record<string, unknown> = {
    amount,
    date: input.date,
    note: input.note?.trim() || null,
  }

  if (input.categoryType) {
    patch.category_type = input.categoryType
  }

  if (nextLabel) {
    patch.category_label = nextLabel
    patch.category_key = persistedCategoryKey
  } else if (persistedCategoryKey) {
    patch.category_key = persistedCategoryKey
  }

  const { error } = await (supabase.from('transactions') as any)
    .update(patch)
    .eq('id', input.id)
    .eq('user_id', user.id)

  if (error) throw new Error(`Failed to update entry: ${error.message}`)

  if (input.removeMonthlyReminderKey?.trim()) {
    if (!profile) throw new Error('Profile is required to update monthly reminder')
    await removeMonthlyReminderForCurrentCycle(
      supabase,
      user.id,
      profile,
      input.removeMonthlyReminderKey
    )
  }

  revalidatePath('/log')
  revalidatePath('/history')
  revalidatePath('/app')
  revalidatePath('/goals')
}

export async function deleteLogEntry(id: string, monthlyReminderKey?: string | null): Promise<void> {
  const { user, profile } = await getAppSession()
  if (!user) throw new Error('Not authenticated')
  if (!id.trim()) throw new Error('Entry id is required')

  const supabase = await createServerSupabaseClient()
  const { data: txn, error: txnError } = await (supabase.from('transactions') as any)
    .select('id, category_key, category_label, category_type, cycle_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (txnError) throw new Error(`Failed to load entry before delete: ${txnError.message}`)
  if (!txn) throw new Error('Entry not found')

  const currentCycleId = profile
    ? await getCurrentCycleId(supabase as any, user.id, profile)
    : null
  const removalCycleId = txn.cycle_id || currentCycleId
  const explicitMonthlyReminderKey = monthlyReminderKey?.trim() || null
  const derivedMonthlyReminderKey = recurringExpenseKey(
    String(txn.category_type ?? '').trim(),
    String(txn.category_key ?? '').trim()
  )

  if (process.env.NODE_ENV !== 'production') {
    console.info(
      `[log.delete] request
transactionId: ${id}
receivedMonthlyReminderKey: ${explicitMonthlyReminderKey}
transaction:
${JSON.stringify({
  id: txn.id,
  category_key: txn.category_key,
  category_label: txn.category_label,
  category_type: txn.category_type,
  cycle_id: txn.cycle_id,
}, null, 2)}
derivedMonthlyReminderKey: ${derivedMonthlyReminderKey}
currentCycleId: ${currentCycleId}`
    )
  }

  const { error } = await (supabase.from('transactions') as any)
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(`Failed to delete entry: ${error.message}`)

  if (removalCycleId) {
    const monthlyReminderEntries = await loadMonthlyReminderEntriesForCycle(supabase, user.id, removalCycleId)
    const matchedMonthlyReminderKey =
      explicitMonthlyReminderKey ||
      monthlyReminderEntries.find((entry) => entry.key === derivedMonthlyReminderKey)?.key ||
      null

    if (process.env.NODE_ENV !== 'production') {
      console.info(
        `[log.delete] monthly-reminder-match
cycleId: ${removalCycleId}
monthlyReminderEntries:
${JSON.stringify(monthlyReminderEntries, null, 2)}
matchedMonthlyReminderKey: ${matchedMonthlyReminderKey}`
      )
    }

    if (matchedMonthlyReminderKey) {
      await removeMonthlyReminderForCycle(
        supabase,
        user.id,
        removalCycleId,
        matchedMonthlyReminderKey
      )
    }
  }

  revalidatePath('/log')
  revalidatePath('/history')
  revalidatePath('/app')
  revalidatePath('/income')
  revalidatePath('/goals')
}

export async function setMonthlyReminder(input: SetMonthlyReminderInput): Promise<void> {
  const { user, profile } = await getAppSession()
  if (!user || !profile) throw new Error('Not authenticated')

  const amount = Number(input.amount)
  if (!input.categoryKey.trim()) throw new Error('Category key is required')
  if (!input.categoryLabel.trim()) throw new Error('Category label is required')
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than zero')

  const supabase = await createServerSupabaseClient()
  const cycleId = await getCurrentCycleId(supabase as any, user.id, profile)
  await saveMonthlyReminderEntryForCycle(supabase, user.id, cycleId, {
    key: recurringExpenseKey(input.categoryType, input.categoryKey),
    label: input.categoryLabel,
    monthly: amount,
  })

  revalidatePath('/app')
  revalidatePath('/log')
  revalidatePath('/income')
  revalidatePath('/history')
}

export async function removeMonthlyReminder(input: RemoveMonthlyReminderInput): Promise<void> {
  const { user, profile } = await getAppSession()
  if (!user || !profile) throw new Error('Not authenticated')
  if (!input.categoryKey.trim()) throw new Error('Category key is required')

  const supabase = await createServerSupabaseClient()
  const cycleId = await getCurrentCycleId(supabase as any, user.id, profile)
  await removeMonthlyReminderEntryForCycle(supabase, user.id, cycleId, input.categoryKey)

  revalidatePath('/app')
  revalidatePath('/log')
  revalidatePath('/income')
  revalidatePath('/history')
}

export async function updateMonthlyReminderAmount(
  input: UpdateMonthlyReminderAmountInput
): Promise<void> {
  const { user, profile } = await getAppSession()
  if (!user || !profile) throw new Error('Not authenticated')

  const monthlyAmount = Number(input.monthlyAmount)
  if (!input.categoryKey.trim()) throw new Error('Category key is required')
  if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0) {
    throw new Error('Monthly amount must be greater than zero')
  }

  const supabase = await createServerSupabaseClient()
  const cycleId = await getCurrentCycleId(supabase as any, user.id, profile)
  const canonicalKey = canonicalizeFixedBillKey(input.categoryKey)
  const existingEntry = (await loadMonthlyReminderEntriesForCycle(supabase, user.id, cycleId)).find((entry) => entry.key === canonicalKey)
  if (!existingEntry) {
    throw new Error('Monthly reminder not found')
  }

  await saveMonthlyReminderEntryForCycle(supabase, user.id, cycleId, {
    key: canonicalKey,
    label: existingEntry.label,
    monthly: monthlyAmount,
  })

  revalidatePath('/app')
  revalidatePath('/log')
  revalidatePath('/income')
  revalidatePath('/history')
}

export async function updateMonthlyReminder(
  input: UpdateMonthlyReminderInput
): Promise<void> {
  const { user, profile } = await getAppSession()
  if (!user || !profile) throw new Error('Not authenticated')

  const monthlyAmount = Number(input.monthlyAmount)
  const label = input.label.trim()
  if (!input.categoryKey.trim()) throw new Error('Category key is required')
  if (!label) throw new Error('Name is required')
  if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0) {
    throw new Error('Monthly amount must be greater than zero')
  }

  const supabase = await createServerSupabaseClient()
  const cycleId = await getCurrentCycleId(supabase as any, user.id, profile)
  const canonicalKey = canonicalizeFixedBillKey(input.categoryKey)
  const existingEntry = (await loadMonthlyReminderEntriesForCycle(supabase, user.id, cycleId)).find((entry) => entry.key === canonicalKey)
  if (!existingEntry) {
    throw new Error('Monthly reminder not found')
  }

  await saveMonthlyReminderEntryForCycle(supabase, user.id, cycleId, {
    key: canonicalKey,
    label,
    monthly: monthlyAmount,
  })

  revalidatePath('/app')
  revalidatePath('/log')
  revalidatePath('/income')
  revalidatePath('/history')
}
