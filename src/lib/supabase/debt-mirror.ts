import { getCycleIdForDate } from '@/lib/supabase/cycles-db'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { DebtTransactionEntryType } from '@/types/database'

type MirrorableDebtEntryType = Extract<
  DebtTransactionEntryType,
  'principal_increase' | 'payment_in' | 'payment_out'
>

interface MirrorProfile {
  pay_schedule_type: 'monthly' | 'twice_monthly' | null
  pay_schedule_days: number[] | null
}

interface CreateDebtMirrorInput {
  userId: string
  debtName: string
  debtTransactionId: string
  entryType: MirrorableDebtEntryType
  amount: number
  date: string
  note: string | null
  profile: MirrorProfile
}

interface UpdateDebtMirrorInput {
  userId: string
  linkedTransactionId: string
  amount: number
  date: string
  note: string | null
  profile: MirrorProfile
}

function mirrorCategoryKey(entryType: MirrorableDebtEntryType) {
  return entryType === 'principal_increase'
    ? 'debt_opening_balance'
    : 'debt_repayment'
}

export function isMirrorableDebtEntryType(
  entryType: DebtTransactionEntryType
): entryType is MirrorableDebtEntryType {
  return (
    entryType === 'principal_increase' ||
    entryType === 'payment_in' ||
    entryType === 'payment_out'
  )
}

export async function createAndLinkDebtMirrorTransaction(
  input: CreateDebtMirrorInput
): Promise<string> {
  const supabase = await createServerSupabaseClient()
  const txnDate = new Date(`${input.date}T00:00:00`)
  const cycleId = await getCycleIdForDate(supabase as any, input.userId, input.profile, txnDate)

  const { data, error } = await (supabase.from('transactions') as any)
    .insert({
      user_id: input.userId,
      cycle_id: cycleId,
      date: input.date,
      category_type: 'debt',
      category_key: mirrorCategoryKey(input.entryType),
      category_label: input.debtName,
      amount: input.amount,
      note: input.note,
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`Failed to create debt mirror transaction: ${error.message}`)
  }

  const linkedTransactionId = data.id as string

  const { error: linkError } = await (supabase.from('debt_transactions') as any)
    .update({ linked_transaction_id: linkedTransactionId })
    .eq('id', input.debtTransactionId)
    .eq('user_id', input.userId)

  if (linkError) {
    throw new Error(`Failed to link debt mirror transaction: ${linkError.message}`)
  }

  return linkedTransactionId
}

export async function updateDebtMirrorTransaction(
  input: UpdateDebtMirrorInput
): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const txnDate = new Date(`${input.date}T00:00:00`)
  const cycleId = await getCycleIdForDate(supabase as any, input.userId, input.profile, txnDate)

  const { error } = await (supabase.from('transactions') as any)
    .update({
      amount: input.amount,
      date: input.date,
      cycle_id: cycleId,
      note: input.note,
    })
    .eq('id', input.linkedTransactionId)
    .eq('user_id', input.userId)

  if (error) {
    throw new Error(`Failed to update debt mirror transaction: ${error.message}`)
  }
}

export async function deleteDebtMirrorTransaction(
  linkedTransactionId: string,
  userId: string
): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { error } = await (supabase.from('transactions') as any)
    .delete()
    .eq('id', linkedTransactionId)
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Failed to delete debt mirror transaction: ${error.message}`)
  }
}
