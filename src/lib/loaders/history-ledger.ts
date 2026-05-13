import { createServerSupabaseClient } from '@/lib/supabase/server'
import { deriveCurrentCycleId, deriveCycleIdForDate } from '@/lib/supabase/cycles-db'
import { selectTransactionsInCycleDateRange } from '@/lib/loaders/transactions'
import { formatCycleLabel, getCurrentCycle, getCycleByDate, profileToPaySchedule } from '@/lib/cycles'
import {
  isDebtOpeningBalanceTransaction,
  normalizeOutflowCategoryType,
  type OutflowCategoryType,
} from '@/lib/transactions/outflow'
import type { CategoryType, UserProfile } from '@/types/database'

export interface LedgerTransaction {
  id: string
  date: string
  amount: number
  note: string | null
  displayName: string | null
  categoryLabel: string | null
  categoryType: CategoryType | null
  customCategoryId: string | null
}

export interface HistoryLedgerPageData {
  monthLabel: string
  currency: string
  txns: LedgerTransaction[]
  totalSpent: number
}

function resolveOutflowBucketType(
  categoryKey: string,
  categoryType?: CategoryType,
): OutflowCategoryType | null {
  if (categoryType === 'fixed' && categoryKey === 'fixed') return 'fixed'
  if (categoryType === 'everyday' && categoryKey === 'everyday') return 'everyday'
  if (categoryType === 'goal' && categoryKey === 'goal') return 'goal'
  if (categoryType === 'debt' && (categoryKey === 'debt' || categoryKey === 'debt-entries')) return 'debt'
  return null
}

export async function loadHistoryLedgerPageData(
  userId: string,
  profile: UserProfile,
  categoryKey: string,
  categoryType?: CategoryType,
  scope: 'key' | 'label' = 'key',
  categoryLabel?: string,
  targetDate?: Date,
  customCategoryId?: string | null,
): Promise<HistoryLedgerPageData> {
  const supabase = await createServerSupabaseClient()
  const cycleId = targetDate
    ? deriveCycleIdForDate(profile, targetDate)
    : deriveCurrentCycleId(profile)

  const baseQuery = selectTransactionsInCycleDateRange(
    supabase,
    userId,
    profile,
    'id, date, amount, note, display_name, category_key, category_label, category_type, custom_category_id',
    targetDate
  ).query

  let scopedQuery = baseQuery
  const outflowBucketType =
    scope === 'key'
      ? resolveOutflowBucketType(categoryKey, categoryType)
      : null

  if (customCategoryId) {
    scopedQuery = scopedQuery.eq('custom_category_id', customCategoryId)
  } else if (scope === 'label' && categoryLabel) {
    scopedQuery = scopedQuery
      .eq('category_type', categoryType ?? 'everyday')
      .eq('category_label', categoryLabel)
  } else if (!outflowBucketType) {
    scopedQuery = scopedQuery.eq('category_key', categoryKey)
  }

  const { data } = await scopedQuery
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  const filteredRows = outflowBucketType
    ? (data ?? []).filter((row: any) =>
        !isDebtOpeningBalanceTransaction(row) &&
        normalizeOutflowCategoryType(row.category_type) === outflowBucketType
      )
    : (data ?? [])

  const txns: LedgerTransaction[] = filteredRows.map((row: any) => ({
    id: row.id,
    date: row.date,
    note: row.note ?? null,
    displayName: typeof row.display_name === 'string' && row.display_name.trim() ? row.display_name.trim() : null,
    categoryLabel: row.category_label ?? null,
    categoryType: row.category_type ?? null,
    customCategoryId: row.custom_category_id ?? null,
    amount: Number(row.amount),
  }))

  const schedule = profileToPaySchedule(profile)
  const cycle = targetDate ? getCycleByDate(targetDate, schedule) : getCurrentCycle(schedule)

  return {
    monthLabel: formatCycleLabel(cycle),
    currency: profile.currency ?? 'KES',
    txns,
    totalSpent: txns.reduce((sum, txn) => sum + txn.amount, 0),
  }
}
