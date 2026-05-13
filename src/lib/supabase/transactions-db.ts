import { toLocalDateStr } from '../cycles'
import { getCycleIdForDate } from './cycles-db'
import type { CategoryType } from '../../types/database'
import {
  resolveCanonicalCategoryForWrite,
  type ResolvedWriteCategory,
} from '@/lib/categories/catalog'

type SupabaseLike = any

interface TransactionProfile {
  pay_schedule_type: 'monthly' | 'twice_monthly' | null
  pay_schedule_days: number[] | null
}

export interface TransactionWriteInput {
  userId: string
  cycleId: string
  date: string
  categoryType: CategoryType
  categoryKey: string
  categoryLabel: string
  customCategoryId?: string | null
  customCategory?: ResolvedWriteCategory | null
  displayName: string
  amount: number
  note?: string | null
}

export interface TransactionDeleteScope {
  userId: string
  cycleId: string
  categoryKey: string
}

export interface ResolvedTransactionCategory extends ResolvedWriteCategory {}

export function resolveTransactionCategoryForWrite(input: {
  categoryType: CategoryType
  categoryKey: string
  categoryLabel?: string | null
  customCategory?: ResolvedWriteCategory | null
}): ResolvedTransactionCategory {
  if (input.customCategory) {
    return input.customCategory
  }
  return resolveCanonicalCategoryForWrite(input)
}

export function buildTransactionRecord(input: TransactionWriteInput) {
  const resolvedCategory = resolveTransactionCategoryForWrite({
    categoryType: input.categoryType,
    categoryKey: input.categoryKey,
    categoryLabel: input.categoryLabel,
    customCategory: input.customCategory,
  })
  const displayName = input.displayName.trim()
  if (!displayName) {
    throw new Error('Display name is required')
  }

  return {
    user_id: input.userId,
    cycle_id: input.cycleId,
    date: input.date,
    category_type: resolvedCategory.categoryType,
    category_key: resolvedCategory.categoryKey,
    category_label: resolvedCategory.categoryLabel,
    custom_category_id: resolvedCategory.customCategoryId,
    display_name: displayName,
    amount: input.amount,
    note: input.note?.trim() || null,
  }
}

export function buildCategoryDeleteScope(input: TransactionDeleteScope) {
  return {
    user_id: input.userId,
    cycle_id: input.cycleId,
    category_key: input.categoryKey,
  }
}

async function insertTransactionRecord(supabase: SupabaseLike, input: TransactionWriteInput): Promise<void> {
  const { error } = await (supabase.from('transactions') as any).insert(
    buildTransactionRecord(input)
  )

  if (error) {
    throw new Error(`Failed to insert transaction: ${error.message}`)
  }
}

export async function createCycleTransaction(
  supabase: SupabaseLike,
  userId: string,
  profile: TransactionProfile,
  input: Omit<TransactionWriteInput, 'userId' | 'cycleId' | 'date'> & { date?: Date }
): Promise<void> {
  const date = input.date ?? new Date()
  const cycleId = await getCycleIdForDate(supabase, userId, profile, date)

  await insertTransactionRecord(supabase, {
    userId,
    cycleId,
    date: toLocalDateStr(date),
    categoryType: input.categoryType,
    categoryKey: input.categoryKey,
    categoryLabel: input.categoryLabel,
    displayName: input.displayName,
    amount: input.amount,
    note: input.note,
  })
}

export async function createCycleRefundTransaction(
  supabase: SupabaseLike,
  userId: string,
  profile: TransactionProfile,
  input: Omit<TransactionWriteInput, 'userId' | 'cycleId' | 'date' | 'amount'> & { amount: number; date?: Date }
): Promise<void> {
  await createCycleTransaction(supabase, userId, profile, {
    date: input.date,
    categoryType: input.categoryType,
    categoryKey: input.categoryKey,
    categoryLabel: input.categoryLabel,
    displayName: input.displayName,
    amount: -Math.abs(input.amount),
    note: input.note,
  })
}

export async function deleteCycleTransactionsByCategory(
  supabase: SupabaseLike,
  input: TransactionDeleteScope
): Promise<void> {
  const scope = buildCategoryDeleteScope(input)
  const { error } = await (supabase.from('transactions') as any)
    .delete()
    .eq('user_id', scope.user_id)
    .eq('cycle_id', scope.cycle_id)
    .eq('category_key', scope.category_key)

  if (error) {
    throw new Error(`Failed to delete transactions: ${error.message}`)
  }
}

export async function deleteTransactionsForCycleDateByCategory(
  supabase: SupabaseLike,
  userId: string,
  profile: TransactionProfile,
  categoryKey: string,
  date: Date = new Date()
): Promise<void> {
  const cycleId = await getCycleIdForDate(supabase, userId, profile, date)
  await deleteCycleTransactionsByCategory(supabase, { userId, cycleId, categoryKey })
}
