import { createServerSupabaseClient } from '@/lib/supabase/server'
import type {
  Debt,
  DebtDirection,
  DebtKind,
  DebtTransaction,
  DebtTransactionEntryType,
} from '@/types/database'

export type { Debt, DebtDirection, DebtKind, DebtTransaction, DebtTransactionEntryType }

export interface CreateDebtInput {
  name: string
  direction: DebtDirection
  currency: string
  note?: string | null
  standardDueDate?: string | null
}

export interface CreateFinancingDebtInput {
  name: string
  totalCost: number
  upfrontPaid: number
  currency: string
  targetDate?: string | null
  note?: string | null
}

export interface AddDebtTransactionInput {
  debtId: string
  entryType: DebtTransactionEntryType
  amount: number
  currency: string
  transactionDate: string
  note?: string | null
  linkedTransactionId?: string | null
}

export interface UpdateDebtTransactionInput {
  transactionId: string
  userId: string
  entryType: DebtTransactionEntryType
  amount: number
  transactionDate: string
  note?: string | null
}

export interface UpdateDebtDetailsInput {
  debtId: string
  userId: string
  name: string
  note?: string | null
  standardDueDate?: string | null
}

type RpcErrorLike = { message?: string; code?: string } | null

const ERRORS = {
  debtNameRequired: 'Debt name is required',
  debtIdRequired: 'Debt id is required',
  debtDirectionRequired: 'Debt direction is required',
  transactionIdRequired: 'Transaction id is required',
  entryTypeRequired: 'Entry type is required',
  currencyRequired: 'Currency is required',
  amountInvalid: 'Amount must be greater than zero',
} as const

function isMissingRpc(error: RpcErrorLike): boolean {
  if (!error) return false
  const message = String(error.message ?? '').toLowerCase()
  return (
    message.includes('could not find the function') ||
    (message.includes('function') && message.includes('does not exist')) ||
    error.code === 'PGRST202'
  )
}

function isMissingColumnError(error: RpcErrorLike, column: string): boolean {
  if (!error) return false
  const message = String(error.message ?? '').toLowerCase()
  const normalizedColumn = column.toLowerCase()
  return (
    message.includes(`could not find the '${normalizedColumn}' column`) ||
    message.includes(`column "${normalizedColumn}" does not exist`) ||
    (message.includes('schema cache') && message.includes(normalizedColumn))
  )
}

function isDuplicateActiveDebtNameError(error: RpcErrorLike): boolean {
  if (!error) return false
  const message = String(error.message ?? '').toLowerCase()
  return (
    message.includes('debts_user_active_name_idx') ||
    message.includes('duplicate key value') ||
    message.includes('unique constraint')
  )
}

function normalizeDebtName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function normalizeSingleRow<T>(data: T[] | T | null): T | null {
  if (Array.isArray(data)) return data[0] ?? null
  return data ?? null
}

async function callDebtRpc<T>(
  name: string,
  args: Record<string, unknown>
): Promise<T> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await (supabase.rpc as any)(name, args)

  if (!error) return data as T

  if (isMissingRpc(error)) {
    throw new Error(`Debt RPC not found: ${name}`)
  }

  throw new Error(`Debt RPC ${name} failed: ${error.message}`)
}

export async function createDebt(input: CreateDebtInput): Promise<Debt | null> {
  const name = input.name.trim()
  const currency = input.currency.trim()

  if (!name) throw new Error(ERRORS.debtNameRequired)
  if (!input.direction) throw new Error(ERRORS.debtDirectionRequired)
  if (!currency) throw new Error(ERRORS.currencyRequired)

  const data = await callDebtRpc<Debt>(
    'create_my_debt',
    {
      p_name: name,
      p_direction: input.direction,
      p_currency: currency,
      p_note: input.note ?? null,
    }
  )

  return normalizeSingleRow(data)
}

export async function updateStandardDebtDueDate(
  debtId: string,
  userId: string,
  standardDueDate: string | null
): Promise<boolean> {
  const normalizedDebtId = debtId.trim()
  const normalizedUserId = userId.trim()

  if (!normalizedDebtId) throw new Error(ERRORS.debtIdRequired)
  if (!normalizedUserId) throw new Error('User id is required')

  const supabase = await createServerSupabaseClient()
  const { error } = await (supabase.from('debts') as any)
    .update({ standard_due_date: standardDueDate })
    .eq('id', normalizedDebtId)
    .eq('user_id', normalizedUserId)

  if (!error) return true
  if (isMissingColumnError(error, 'standard_due_date')) return false
  throw new Error(`Failed to update debt due date: ${error.message}`)
}

export function isStandardDebtDueDateUnsupportedError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return message === 'Debt due dates are not available yet.'
}

export async function isStandardDebtDueDateSupported(): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  const { error } = await (supabase.from('debts') as any)
    .select('standard_due_date')
    .limit(1)

  if (!error) return true
  if (isMissingColumnError(error, 'standard_due_date')) return false
  throw new Error(`Failed to check debt due date support: ${error.message}`)
}

export async function updateDebtDetails(input: UpdateDebtDetailsInput): Promise<{ dueDateSupported: boolean }> {
  const debtId = input.debtId.trim()
  const userId = input.userId.trim()
  const name = input.name.trim()

  if (!debtId) throw new Error(ERRORS.debtIdRequired)
  if (!userId) throw new Error('User id is required')
  if (!name) throw new Error(ERRORS.debtNameRequired)

  const supabase = await createServerSupabaseClient()
  const payload: Record<string, unknown> = {
    name,
    normalized_name: normalizeDebtName(name),
    note: input.note?.trim() || null,
  }

  const wantsDueDateUpdate = Object.prototype.hasOwnProperty.call(input, 'standardDueDate')
  if (wantsDueDateUpdate) {
    payload.standard_due_date = input.standardDueDate ?? null
  }

  let dueDateSupported = true
  let { error } = await (supabase.from('debts') as any)
    .update(payload)
    .eq('id', debtId)
    .eq('user_id', userId)

  if (error && wantsDueDateUpdate && isMissingColumnError(error, 'standard_due_date')) {
    dueDateSupported = false
    delete payload.standard_due_date
    const retry = await (supabase.from('debts') as any)
      .update(payload)
      .eq('id', debtId)
      .eq('user_id', userId)
    error = retry.error
  }

  if (isDuplicateActiveDebtNameError(error)) {
    throw new Error('You already have an active debt with this name.')
  }
  if (error) {
    throw new Error(`Failed to update debt: ${error.message}`)
  }

  return { dueDateSupported }
}

export async function createFinancingDebt(input: CreateFinancingDebtInput): Promise<Debt | null> {
  const name = input.name.trim()
  const currency = input.currency.trim()
  const totalCost = Number(input.totalCost)
  const upfrontPaid = Number(input.upfrontPaid)

  if (!name) throw new Error(ERRORS.debtNameRequired)
  if (!currency) throw new Error(ERRORS.currencyRequired)
  if (!Number.isFinite(totalCost) || totalCost <= 0) {
    throw new Error('Total cost must be greater than zero')
  }
  if (!Number.isFinite(upfrontPaid) || upfrontPaid < 0) {
    throw new Error('Upfront paid must be zero or greater')
  }
  if (upfrontPaid >= totalCost) {
    throw new Error('Upfront paid must be less than total cost')
  }

  const data = await callDebtRpc<Debt>(
    'create_financing_debt',
    {
      p_name: name,
      p_total_cost: totalCost,
      p_upfront_paid: upfrontPaid,
      p_currency: currency,
      p_target_date: input.targetDate ?? null,
      p_note: input.note ?? null,
    }
  )

  return normalizeSingleRow(data)
}

export async function getDebt(debtId: string): Promise<Debt | null> {
  const normalizedDebtId = debtId.trim()
  if (!normalizedDebtId) throw new Error(ERRORS.debtIdRequired)

  const data = await callDebtRpc<Debt[]>(
    'get_my_debt',
    { p_debt_id: normalizedDebtId }
  )

  return normalizeSingleRow(data)
}

export async function getDebts(userId: string): Promise<Debt[]> {
  const normalizedUserId = userId.trim()
  if (!normalizedUserId) throw new Error('User id is required')

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('debts')
    .select('*')
    .eq('user_id', normalizedUserId)
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to load debts: ${error.message}`)
  }

  return data ?? []
}

export async function getDebtTransactions(debtId: string): Promise<DebtTransaction[]> {
  const normalizedDebtId = debtId.trim()
  if (!normalizedDebtId) throw new Error(ERRORS.debtIdRequired)

  return callDebtRpc<DebtTransaction[]>(
    'get_my_debt_transactions',
    { p_debt_id: normalizedDebtId }
  )
}

export async function addDebtTransaction(input: AddDebtTransactionInput): Promise<DebtTransaction | null> {
  const debtId = input.debtId.trim()
  const currency = input.currency.trim()
  if (!debtId) throw new Error(ERRORS.debtIdRequired)
  if (!input.entryType) throw new Error(ERRORS.entryTypeRequired)
  if (!currency) throw new Error(ERRORS.currencyRequired)

  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(ERRORS.amountInvalid)
  }

  const data = await callDebtRpc<DebtTransaction>(
    'add_my_debt_transaction',
    {
      p_debt_id: debtId,
      p_entry_type: input.entryType,
      p_amount: amount,
      p_currency: currency,
      p_transaction_date: input.transactionDate,
      p_note: input.note ?? null,
      p_linked_transaction_id: input.linkedTransactionId ?? null,
    }
  )

  return normalizeSingleRow(data)
}

export async function deleteDebtTransaction(transactionId: string): Promise<void> {
  const normalizedTransactionId = transactionId.trim()
  if (!normalizedTransactionId) throw new Error(ERRORS.transactionIdRequired)

  await callDebtRpc<null>(
    'delete_my_debt_transaction',
    { p_transaction_id: normalizedTransactionId }
  )
}

export async function deleteDebt(debtId: string, userId: string): Promise<void> {
  const normalizedDebtId = debtId.trim()
  const normalizedUserId = userId.trim()

  if (!normalizedDebtId) throw new Error(ERRORS.debtIdRequired)
  if (!normalizedUserId) throw new Error('User id is required')

  const supabase = await createServerSupabaseClient()
  const { data, error } = await (supabase.from('debts') as any)
    .delete()
    .eq('id', normalizedDebtId)
    .eq('user_id', normalizedUserId)
    .select('id')

  if (error) {
    throw new Error(`Failed to delete debt: ${error.message}`)
  }
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`Failed to delete debt: Debt ${normalizedDebtId} does not exist`)
  }
}

export async function updateDebtTransaction(input: UpdateDebtTransactionInput): Promise<DebtTransaction | null> {
  const transactionId = input.transactionId.trim()
  const userId = input.userId.trim()

  if (!transactionId) throw new Error(ERRORS.transactionIdRequired)
  if (!userId) throw new Error('User id is required')
  if (!input.entryType) throw new Error(ERRORS.entryTypeRequired)

  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(ERRORS.amountInvalid)
  }

  const data = await callDebtRpc<DebtTransaction>(
    'update_debt_transaction',
    {
      p_transaction_id: transactionId,
      p_user_id: userId,
      p_entry_type: input.entryType,
      p_amount: amount,
      p_transaction_date: input.transactionDate,
      p_note: input.note ?? null,
    }
  )

  return normalizeSingleRow(data)
}
