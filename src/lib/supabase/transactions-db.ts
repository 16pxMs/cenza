import { toLocalDateStr } from '../cycles'
import { getCycleIdForDate } from './cycles-db'
import type { CategoryType } from '../../types/database'
import { canonicalizeFixedBillKey } from '@/lib/fixed-bills/canonical'
import { getCategoryConfig, resolveCategoryKey } from '@/lib/categories/config'

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
  displayName: string
  amount: number
  note?: string | null
}

export interface TransactionDeleteScope {
  userId: string
  cycleId: string
  categoryKey: string
}

export interface ResolvedTransactionCategory {
  categoryType: CategoryType
  categoryKey: string
  categoryLabel: string
}

export function resolveTransactionCategoryForWrite(input: {
  categoryType: CategoryType
  categoryKey: string
  categoryLabel?: string | null
}): ResolvedTransactionCategory {
  const rawKey = input.categoryKey.trim()
  if (!rawKey) {
    throw new Error('Category key is required')
  }

  if (input.categoryType === 'goal') {
    const knownGoalCategory = getCategoryConfig(rawKey)
    if (knownGoalCategory?.type === 'goal') {
      return {
        categoryType: knownGoalCategory.type,
        categoryKey: knownGoalCategory.key,
        categoryLabel: knownGoalCategory.label,
      }
    }

    return {
      categoryType: 'goal',
      categoryKey: rawKey,
      categoryLabel: input.categoryLabel?.trim() || rawKey,
    }
  }

  const normalizedKey =
    input.categoryType === 'fixed'
      ? canonicalizeFixedBillKey(rawKey)
      : rawKey

  const resolvedKey = resolveCategoryKey(normalizedKey)
  if (!resolvedKey) {
    throw new Error(`Unknown category key: ${rawKey}`)
  }

  const config = getCategoryConfig(resolvedKey)
  if (!config) {
    throw new Error(`Unknown category key: ${rawKey}`)
  }

  return {
    categoryType: config.type,
    categoryKey: config.key,
    categoryLabel: config.label,
  }
}

export function buildTransactionRecord(input: TransactionWriteInput) {
  const resolvedCategory = resolveTransactionCategoryForWrite({
    categoryType: input.categoryType,
    categoryKey: input.categoryKey,
    categoryLabel: input.categoryLabel,
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
