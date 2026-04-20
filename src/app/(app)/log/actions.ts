'use server'

import { revalidatePath } from 'next/cache'
import { getAppSession } from '@/lib/auth/app-session'
import { createCycleRefundTransaction } from '@/lib/supabase/transactions-db'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { CategoryType } from '@/types/database'
import { canonicalizeFixedBillKey } from '@/lib/fixed-bills/canonical'
import { getCurrentCycleId } from '@/lib/supabase/cycles-db'
import {
  readTrackedFixedExpenseEntries,
  removeTrackedFixedExpense,
  sumTrackedFixedExpenses,
  upsertTrackedFixedExpense,
} from '@/lib/fixed-bills/tracking'

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
  removeRecurringCategoryKey?: string
}

interface TrackEssentialInput {
  categoryKey: string
  categoryLabel: string
  amount: number
}

interface StopTrackingEssentialInput {
  categoryKey: string
}

interface UpdateTrackedEssentialMonthlyAmountInput {
  categoryKey: string
  monthlyAmount: number
}

interface UpdateTrackedEssentialInput {
  categoryKey: string
  label: string
  monthlyAmount: number
}

async function removeRecurringEntryForCurrentCycle(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  profile: NonNullable<Awaited<ReturnType<typeof getAppSession>>['profile']>,
  categoryKey: string
): Promise<void> {
  const cycleId = await getCurrentCycleId(supabase as any, userId, profile)
  await removeRecurringEntryForCycle(supabase, userId, cycleId, categoryKey)
}

async function removeRecurringEntryForCycle(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  cycleId: string,
  categoryKey: string
): Promise<void> {
  const { data: fixedExpenses, error: fixedExpensesError } = await (supabase.from('fixed_expenses') as any)
    .select('entries')
    .eq('user_id', userId)
    .eq('cycle_id', cycleId)
    .maybeSingle()

  if (fixedExpensesError) {
    throw new Error(`Failed to load recurring essentials: ${fixedExpensesError.message}`)
  }

  const nextEntries = removeTrackedFixedExpense(
    fixedExpenses?.entries ?? null,
    canonicalizeFixedBillKey(categoryKey)
  )

  if (process.env.NODE_ENV !== 'production') {
    console.info(
      `[log.delete] recurring-remove
cycleId: ${cycleId}
requestedKey: ${categoryKey}
canonicalKey: ${canonicalizeFixedBillKey(categoryKey)}
before:
${JSON.stringify(readTrackedFixedExpenseEntries(fixedExpenses?.entries ?? null), null, 2)}
after:
${JSON.stringify(nextEntries, null, 2)}`
    )
  }

  const { error: recurringError } = await (supabase.from('fixed_expenses') as any).upsert({
    user_id: userId,
    cycle_id: cycleId,
    total_monthly: sumTrackedFixedExpenses(nextEntries),
    entries: nextEntries,
  }, { onConflict: 'user_id,cycle_id' })

  if (recurringError) {
    throw new Error(`Failed to update recurring essentials: ${recurringError.message}`)
  }
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

  if (input.removeRecurringCategoryKey?.trim()) {
    if (!profile) throw new Error('Profile is required to update recurring state')
    await removeRecurringEntryForCurrentCycle(
      supabase,
      user.id,
      profile,
      input.removeRecurringCategoryKey
    )
  }

  revalidatePath('/log')
  revalidatePath('/history')
  revalidatePath('/app')
  revalidatePath('/goals')
}

export async function deleteLogEntry(id: string, recurringCategoryKey?: string | null): Promise<void> {
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
  const explicitRecurringKey = recurringCategoryKey?.trim() || null
  const derivedRecurringKey = canonicalizeFixedBillKey(String(txn.category_key ?? '').trim())

  if (process.env.NODE_ENV !== 'production') {
    console.info(
      `[log.delete] request
transactionId: ${id}
receivedRecurringKey: ${explicitRecurringKey}
transaction:
${JSON.stringify({
  id: txn.id,
  category_key: txn.category_key,
  category_label: txn.category_label,
  category_type: txn.category_type,
  cycle_id: txn.cycle_id,
}, null, 2)}
derivedRecurringKey: ${derivedRecurringKey}
currentCycleId: ${currentCycleId}`
    )
  }

  const { error } = await (supabase.from('transactions') as any)
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(`Failed to delete entry: ${error.message}`)

  if (removalCycleId) {
    const { data: fixedExpensesAfterDelete, error: fixedExpensesLookupError } = await (supabase.from('fixed_expenses') as any)
      .select('entries')
      .eq('user_id', user.id)
      .eq('cycle_id', removalCycleId)
      .maybeSingle()

    if (fixedExpensesLookupError) {
      throw new Error(`Failed to load recurring essentials after delete: ${fixedExpensesLookupError.message}`)
    }

    const trackedEntries = readTrackedFixedExpenseEntries(fixedExpensesAfterDelete?.entries ?? null)
    const matchedRecurringKey =
      explicitRecurringKey ||
      trackedEntries.find((entry) => entry.key === derivedRecurringKey)?.key ||
      null

    if (process.env.NODE_ENV !== 'production') {
      console.info(
        `[log.delete] recurring-match
cycleId: ${removalCycleId}
trackedEntries:
${JSON.stringify(trackedEntries, null, 2)}
matchedRecurringKey: ${matchedRecurringKey}`
      )
    }

    if (matchedRecurringKey) {
      await removeRecurringEntryForCycle(
        supabase,
        user.id,
        removalCycleId,
        matchedRecurringKey
      )
    }
  }

  revalidatePath('/log')
  revalidatePath('/history')
  revalidatePath('/app')
  revalidatePath('/income')
  revalidatePath('/goals')
}

export async function trackEssential(input: TrackEssentialInput): Promise<void> {
  const { user, profile } = await getAppSession()
  if (!user || !profile) throw new Error('Not authenticated')

  const amount = Number(input.amount)
  if (!input.categoryKey.trim()) throw new Error('Category key is required')
  if (!input.categoryLabel.trim()) throw new Error('Category label is required')
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than zero')

  const supabase = await createServerSupabaseClient()
  const cycleId = await getCurrentCycleId(supabase as any, user.id, profile)
  const { data: fixedExpenses, error: fixedExpensesError } = await (supabase.from('fixed_expenses') as any)
    .select('entries')
    .eq('user_id', user.id)
    .eq('cycle_id', cycleId)
    .maybeSingle()

  if (fixedExpensesError) throw new Error(`Failed to load tracked essentials: ${fixedExpensesError.message}`)

  const nextEntries = upsertTrackedFixedExpense(fixedExpenses?.entries ?? null, {
    key: canonicalizeFixedBillKey(input.categoryKey),
    label: input.categoryLabel,
    monthly: amount,
  })

  const { error } = await (supabase.from('fixed_expenses') as any).upsert({
    user_id: user.id,
    cycle_id: cycleId,
    total_monthly: sumTrackedFixedExpenses(nextEntries),
    entries: nextEntries,
  }, { onConflict: 'user_id,cycle_id' })

  if (error) throw new Error(`Failed to track essential: ${error.message}`)

  revalidatePath('/app')
  revalidatePath('/log')
  revalidatePath('/income')
  revalidatePath('/history')
}

export async function stopTrackingEssential(input: StopTrackingEssentialInput): Promise<void> {
  const { user, profile } = await getAppSession()
  if (!user || !profile) throw new Error('Not authenticated')
  if (!input.categoryKey.trim()) throw new Error('Category key is required')

  const supabase = await createServerSupabaseClient()
  const cycleId = await getCurrentCycleId(supabase as any, user.id, profile)
  const { data: fixedExpenses, error: fixedExpensesError } = await (supabase.from('fixed_expenses') as any)
    .select('entries')
    .eq('user_id', user.id)
    .eq('cycle_id', cycleId)
    .maybeSingle()

  if (fixedExpensesError) throw new Error(`Failed to load tracked essentials: ${fixedExpensesError.message}`)

  const nextEntries = removeTrackedFixedExpense(fixedExpenses?.entries ?? null, input.categoryKey)

  const { error } = await (supabase.from('fixed_expenses') as any).upsert({
    user_id: user.id,
    cycle_id: cycleId,
    total_monthly: sumTrackedFixedExpenses(nextEntries),
    entries: nextEntries,
  }, { onConflict: 'user_id,cycle_id' })

  if (error) throw new Error(`Failed to stop tracking essential: ${error.message}`)

  revalidatePath('/app')
  revalidatePath('/log')
  revalidatePath('/income')
  revalidatePath('/history')
}

export async function updateTrackedEssentialMonthlyAmount(
  input: UpdateTrackedEssentialMonthlyAmountInput
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
  const { data: fixedExpenses, error: fixedExpensesError } = await (supabase.from('fixed_expenses') as any)
    .select('entries')
    .eq('user_id', user.id)
    .eq('cycle_id', cycleId)
    .maybeSingle()

  if (fixedExpensesError) throw new Error(`Failed to load tracked essentials: ${fixedExpensesError.message}`)

  const existingEntries = readTrackedFixedExpenseEntries(fixedExpenses?.entries ?? null)
  const canonicalKey = canonicalizeFixedBillKey(input.categoryKey)
  const existingEntry = existingEntries.find((entry) => entry.key === canonicalKey)
  if (!existingEntry) {
    throw new Error('Tracked essential not found')
  }

  const nextEntries = upsertTrackedFixedExpense(existingEntries, {
    key: canonicalKey,
    label: existingEntry.label,
    monthly: monthlyAmount,
  })

  const { error } = await (supabase.from('fixed_expenses') as any).upsert({
    user_id: user.id,
    cycle_id: cycleId,
    total_monthly: sumTrackedFixedExpenses(nextEntries),
    entries: nextEntries,
  }, { onConflict: 'user_id,cycle_id' })

  if (error) throw new Error(`Failed to update tracked essential: ${error.message}`)

  revalidatePath('/app')
  revalidatePath('/log')
  revalidatePath('/income')
  revalidatePath('/history')
}

export async function updateTrackedEssential(
  input: UpdateTrackedEssentialInput
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
  const { data: fixedExpenses, error: fixedExpensesError } = await (supabase.from('fixed_expenses') as any)
    .select('entries')
    .eq('user_id', user.id)
    .eq('cycle_id', cycleId)
    .maybeSingle()

  if (fixedExpensesError) throw new Error(`Failed to load tracked essentials: ${fixedExpensesError.message}`)

  const existingEntries = readTrackedFixedExpenseEntries(fixedExpenses?.entries ?? null)
  const canonicalKey = canonicalizeFixedBillKey(input.categoryKey)
  const existingEntry = existingEntries.find((entry) => entry.key === canonicalKey)
  if (!existingEntry) {
    throw new Error('Tracked essential not found')
  }

  const nextEntries = upsertTrackedFixedExpense(existingEntries, {
    key: canonicalKey,
    label,
    monthly: monthlyAmount,
  })

  const { error } = await (supabase.from('fixed_expenses') as any).upsert({
    user_id: user.id,
    cycle_id: cycleId,
    total_monthly: sumTrackedFixedExpenses(nextEntries),
    entries: nextEntries,
  }, { onConflict: 'user_id,cycle_id' })

  if (error) throw new Error(`Failed to update tracked essential: ${error.message}`)

  revalidatePath('/app')
  revalidatePath('/log')
  revalidatePath('/income')
  revalidatePath('/history')
}
