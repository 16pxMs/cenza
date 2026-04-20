'use server'

import { revalidatePath } from 'next/cache'
import { getAppSession } from '@/lib/auth/app-session'
import { createAndLinkDebtMirrorTransaction } from '@/lib/supabase/debt-mirror'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  addDebtTransaction,
  createDebt,
  createFinancingDebt,
  type DebtDirection,
  updateStandardDebtDueDate,
} from '@/lib/supabase/debt-db'

interface StandardCreateDebtFlowInput {
  mode?: 'standard'
  name: string
  direction: DebtDirection
  openingAmount: number
  dueDate?: string | null
  note?: string
}

interface FinancingCreateDebtFlowInput {
  mode: 'financing'
  name: string
  totalCost: number
  upfrontPaid: number
  targetDate?: string | null
  note?: string
}

type CreateDebtFlowInput =
  | StandardCreateDebtFlowInput
  | FinancingCreateDebtFlowInput

const DUPLICATE_ACTIVE_DEBT_MESSAGE = 'You already have an active debt with this name.'

function todayDateString() {
  return new Date().toISOString().slice(0, 10)
}

function isValidDateString(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00`)
  return !Number.isNaN(parsed.getTime())
}

function normalizeDebtNameForMatch(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function isDuplicateDebtNameError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  return lower.includes('debts_user_active_name_idx') ||
    lower.includes('duplicate key value') ||
    lower.includes('unique constraint')
}

async function assertActiveDebtNameAvailable(userId: string, name: string) {
  const normalizedName = normalizeDebtNameForMatch(name)
  const supabase = await createServerSupabaseClient()
  const { data, error } = await (supabase.from('debts') as any)
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('normalized_name', normalizedName)
    .limit(1)

  if (error) {
    throw new Error(`Failed to check debt name: ${error.message}`)
  }

  if ((data ?? []).length > 0) {
    throw new Error(DUPLICATE_ACTIVE_DEBT_MESSAGE)
  }
}

export async function createDebtWithOpeningBalance(
  input: CreateDebtFlowInput
): Promise<string> {
  const { user, profile } = await getAppSession()
  if (!user || !profile) throw new Error('Not authenticated')

  const name = input.name.trim()
  const note = input.note?.trim() || null

  if (!name) throw new Error('Debt name is required')
  if (!profile.currency?.trim()) {
    throw new Error('Set your currency before creating a debt')
  }

  await assertActiveDebtNameAvailable(user.id, name)

  if (input.mode === 'financing') {
    const totalCost = Number(input.totalCost)
    const upfrontPaid = Number(input.upfrontPaid)

    if (!Number.isFinite(totalCost) || totalCost <= 0) {
      throw new Error('Total cost must be greater than zero')
    }
    if (!Number.isFinite(upfrontPaid) || upfrontPaid < 0) {
      throw new Error('Upfront paid must be zero or greater')
    }
    if (upfrontPaid >= totalCost) {
      throw new Error('Upfront paid must be less than total cost')
    }

    const financingDebt = await (async () => {
      try {
        return await createFinancingDebt({
          name,
          totalCost,
          upfrontPaid,
          currency: profile.currency,
          targetDate: input.targetDate ?? null,
          note,
        })
      } catch (error) {
        if (isDuplicateDebtNameError(error)) {
          throw new Error(DUPLICATE_ACTIVE_DEBT_MESSAGE)
        }
        throw error
      }
    })()

    if (!financingDebt) {
      throw new Error('Failed to create financing debt')
    }

    const remaining = totalCost - upfrontPaid

    if (financingDebt.financing_principal_tx_id) {
      try {
        await createAndLinkDebtMirrorTransaction({
          userId: user.id,
          debtName: financingDebt.name,
          debtTransactionId: financingDebt.financing_principal_tx_id,
          entryType: 'principal_increase',
          amount: remaining,
          date: todayDateString(),
          note,
          profile,
        })
      } catch {
        // Financing debt already committed. Mirror is best-effort.
      }
    }

    revalidatePath('/app')
    revalidatePath('/history')
    revalidatePath('/history/debt')
    revalidatePath(`/history/debt/${financingDebt.id}`)
    revalidatePath('/log')

    return financingDebt.id
  }

  const amount = Number(input.openingAmount)
  const dueDate = input.dueDate?.trim() || null

  if (!input.direction) throw new Error('Debt direction is required')
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Opening amount must be greater than zero')
  }
  if (dueDate && !isValidDateString(dueDate)) {
    throw new Error('Enter a valid due date')
  }

  const debt = await (async () => {
    try {
      return await createDebt({
        name,
        direction: input.direction,
        currency: profile.currency,
        note,
      })
    } catch (error) {
      if (isDuplicateDebtNameError(error)) {
        throw new Error(DUPLICATE_ACTIVE_DEBT_MESSAGE)
      }
      throw error
    }
  })()

  if (!debt) {
    throw new Error('Failed to create debt')
  }

  const openingTransaction = await addDebtTransaction({
    debtId: debt.id,
    entryType: 'principal_increase',
    amount,
    currency: debt.currency,
    transactionDate: todayDateString(),
    note,
  })

  if (!openingTransaction) {
    throw new Error('Failed to create opening debt balance')
  }

  try {
    await createAndLinkDebtMirrorTransaction({
      userId: user.id,
      debtName: debt.name,
      debtTransactionId: openingTransaction.id,
      entryType: 'principal_increase',
      amount,
      date: todayDateString(),
      note,
      profile,
    })
  } catch {
    // Debt and opening balance already committed. Mirror is best-effort.
  }

  if (dueDate) {
    await updateStandardDebtDueDate(debt.id, user.id, dueDate)
  }

  revalidatePath('/app')
  revalidatePath('/history')
  revalidatePath('/history/debt')
  revalidatePath(`/history/debt/${debt.id}`)
  revalidatePath('/log')

  return debt.id
}
