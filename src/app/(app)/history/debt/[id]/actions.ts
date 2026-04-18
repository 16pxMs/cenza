'use server'

import { revalidatePath } from 'next/cache'
import { getAppSession } from '@/lib/auth/app-session'
import {
  addDebtTransaction,
  deleteDebt,
  deleteDebtTransaction,
  getDebt,
  getDebtTransactions,
  updateStandardDebtDueDate,
  updateDebtTransaction,
} from '@/lib/supabase/debt-db'
import {
  createAndLinkDebtMirrorTransaction,
  deleteDebtMirrorTransaction,
  isMirrorableDebtEntryType,
  updateDebtMirrorTransaction,
} from '@/lib/supabase/debt-mirror'
import type { DebtTransactionEntryType } from '@/types/database'

interface AddRepaymentInput {
  debtId: string
  amount: number
  date: string
  note?: string
}

interface AddOpeningBalanceInput {
  debtId: string
  amount: number
  date: string
  note?: string
}

function repaymentEntryType(direction: 'owed_by_me' | 'owed_to_me'): 'payment_out' | 'payment_in' {
  return direction === 'owed_by_me' ? 'payment_out' : 'payment_in'
}

function normalizeDebtComparisonNote(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function normalizeDebtComparisonDate(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const parsed = new Date(`${trimmed}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return trimmed
  return parsed.toISOString().slice(0, 10)
}

function normalizeDebtComparisonAmount(value: number) {
  return Math.round(Number(value) * 100)
}

export async function addRepayment(input: AddRepaymentInput): Promise<void> {
  const { user, profile } = await getAppSession()
  if (!user || !profile) throw new Error('Not authenticated')

  const debtId = input.debtId.trim()
  const amount = Number(input.amount)
  const date = input.date.trim()

  if (!debtId) throw new Error('Debt id is required')
  if (!date) throw new Error('Repayment date is required')
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be greater than zero')
  }

  const debt = await getDebt(debtId)
  if (!debt) throw new Error('Debt not found')
  if (amount > debt.current_balance) {
    throw new Error('Repayment cannot be more than the current balance')
  }

  const entryType = repaymentEntryType(debt.direction)
  const noteText = input.note?.trim() || null
  const existingTransactions = await getDebtTransactions(debtId)
  const duplicateRepayment = existingTransactions.find((transaction) =>
    transaction.entry_type === entryType &&
    normalizeDebtComparisonDate(transaction.transaction_date) === normalizeDebtComparisonDate(date) &&
    normalizeDebtComparisonAmount(transaction.amount) === normalizeDebtComparisonAmount(amount) &&
    normalizeDebtComparisonNote(transaction.note) === normalizeDebtComparisonNote(noteText)
  )

  if (duplicateRepayment) {
    return
  }

  const debtTxn = await addDebtTransaction({
    debtId,
    entryType,
    amount,
    currency: debt.currency,
    transactionDate: date,
    note: noteText,
  })

  if (debtTxn) {
    try {
      await createAndLinkDebtMirrorTransaction({
        userId: user.id,
        debtName: debt.name,
        debtTransactionId: debtTxn.id,
        entryType,
        amount,
        date,
        note: noteText,
        profile,
      })
    } catch {
      // Debt transaction already committed. Mirror is best-effort;
      // a missing log entry is acceptable, an orphan is not.
    }
  }

  revalidatePath(`/history/debt/${debtId}`)
  revalidatePath('/history')
  revalidatePath('/app')
  revalidatePath('/log')
}

export async function addOpeningBalance(input: AddOpeningBalanceInput): Promise<void> {
  const { user, profile } = await getAppSession()
  if (!user || !profile) throw new Error('Not authenticated')

  const debtId = input.debtId.trim()
  const amount = Number(input.amount)
  const date = input.date.trim()

  if (!debtId) throw new Error('Debt id is required')
  if (!isValidDateString(date)) {
    throw new Error('Enter a valid date')
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be greater than zero')
  }

  const debt = await getDebt(debtId)
  if (!debt) throw new Error('Debt not found')

  const noteText = input.note?.trim() || null

  const debtTxn = await addDebtTransaction({
    debtId,
    entryType: 'principal_increase',
    amount,
    currency: debt.currency,
    transactionDate: date,
    note: noteText,
  })

  if (debtTxn) {
    try {
      await createAndLinkDebtMirrorTransaction({
        userId: user.id,
        debtName: debt.name,
        debtTransactionId: debtTxn.id,
        entryType: 'principal_increase',
        amount,
        date,
        note: noteText,
        profile,
      })
    } catch {
      // Opening balance already committed. Mirror is best-effort.
    }
  }

  revalidatePath(`/history/debt/${debtId}`)
  revalidatePath('/history')
  revalidatePath('/app')
}

interface DeleteDebtTransactionInput {
  debtId: string
  transactionId: string
}

interface DeleteDebtTransactionResult {
  deletedDebt: boolean
  redirectTo: string | null
}

export async function deleteDebtTransactionForDebt(
  input: DeleteDebtTransactionInput
): Promise<DeleteDebtTransactionResult> {
  const { user } = await getAppSession()
  if (!user) throw new Error('Not authenticated')

  const debtId = input.debtId.trim()
  const transactionId = input.transactionId.trim()

  if (!debtId) throw new Error('Debt id is required')
  if (!transactionId) throw new Error('Transaction id is required')

  const transactions = await getDebtTransactions(debtId)
  const debtTxn = transactions.find(
    transaction => transaction.id === transactionId
  )

  if (!debtTxn) {
    throw new Error('Debt transaction not found for this debt')
  }

  const deletingLastTransaction = transactions.length === 1

  await deleteDebtTransaction(transactionId)

  if (debtTxn.linked_transaction_id && isMirrorableDebtEntryType(debtTxn.entry_type)) {
    await deleteDebtMirrorTransaction(debtTxn.linked_transaction_id, user.id)
  }

  let deletedDebt = false
  if (deletingLastTransaction) {
    await deleteDebt(debtId, user.id)
    deletedDebt = true
  } else {
    const remainingTransactions = await getDebtTransactions(debtId)
    if (remainingTransactions.length === 0) {
      await deleteDebt(debtId, user.id)
      deletedDebt = true
    }
  }

  if (!deletedDebt) {
    revalidatePath(`/history/debt/${debtId}`)
  }
  revalidatePath('/history')
  revalidatePath('/history/debt')
  revalidatePath('/app')
  revalidatePath('/log')

  return {
    deletedDebt,
    redirectTo: deletedDebt ? '/history/debt' : null,
  }
}

interface UpdateDebtTransactionForDebtInput {
  debtId: string
  transactionId: string
  amount: number
  date: string
  note?: string
}

interface UpdateStandardDebtDueDateInput {
  debtId: string
  dueDate: string | null
}

function isValidDateString(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00`)
  return !Number.isNaN(parsed.getTime())
}

export async function updateStandardDebtDueDateAction(
  input: UpdateStandardDebtDueDateInput
): Promise<void> {
  const { user } = await getAppSession()
  if (!user) throw new Error('Not authenticated')

  const debtId = input.debtId.trim()
  const dueDate = input.dueDate?.trim() || null

  if (!debtId) throw new Error('Debt id is required')
  if (dueDate && !isValidDateString(dueDate)) {
    throw new Error('Enter a valid due date')
  }

  const debt = await getDebt(debtId)
  if (!debt) throw new Error('Debt not found')
  if (debt.debt_kind !== 'standard') {
    throw new Error('Due dates are only available for standard debts')
  }

  await updateStandardDebtDueDate(debtId, user.id, dueDate)

  revalidatePath(`/history/debt/${debtId}`)
  revalidatePath('/history/debt')
  revalidatePath('/app')
}

export async function updateDebtTransactionForDebt(
  input: UpdateDebtTransactionForDebtInput
): Promise<void> {
  const { user, profile } = await getAppSession()
  if (!user || !profile) throw new Error('Not authenticated')

  const debtId = input.debtId.trim()
  const transactionId = input.transactionId.trim()
  const amount = Number(input.amount)
  const date = input.date.trim()

  if (!debtId) throw new Error('Debt id is required')
  if (!transactionId) throw new Error('Transaction id is required')
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be greater than zero')
  }
  if (!isValidDateString(date)) {
    throw new Error('Enter a valid date')
  }

  const transactions = await getDebtTransactions(debtId)
  const debtTxn = transactions.find(item => item.id === transactionId)

  if (!debtTxn) {
    throw new Error('Debt transaction not found for this debt')
  }

  const noteText = input.note?.trim() || null

  await updateDebtTransaction({
    transactionId,
    userId: user.id,
    entryType: debtTxn.entry_type,
    amount,
    transactionDate: date,
    note: noteText,
  })

  if (debtTxn.linked_transaction_id && isMirrorableDebtEntryType(debtTxn.entry_type)) {
    await updateDebtMirrorTransaction({
      userId: user.id,
      linkedTransactionId: debtTxn.linked_transaction_id,
      amount,
      date,
      note: noteText,
      profile,
    })
  }

  revalidatePath(`/history/debt/${debtId}`)
  revalidatePath('/history')
  revalidatePath('/app')
  revalidatePath('/log')
}
