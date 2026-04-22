import { createServerSupabaseClient } from '@/lib/supabase/server'
import { deriveCurrentCycleId, deriveCycleIdForDate } from '@/lib/supabase/cycles-db'
import { formatCycleLabel, getCurrentCycle, getCycleByDate, profileToPaySchedule } from '@/lib/cycles'
import { normalizeOutflowCategoryType, type OutflowCategoryType } from '@/lib/transactions/outflow'
import type { CategoryType, UserProfile } from '@/types/database'

export interface LedgerTransaction {
  id: string
  date: string
  amount: number
  note: string | null
  categoryLabel: string | null
  categoryType: CategoryType | null
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
): Promise<HistoryLedgerPageData> {
  const supabase = await createServerSupabaseClient()
  const cycleId = targetDate
    ? deriveCycleIdForDate(profile, targetDate)
    : deriveCurrentCycleId(profile)

  const baseQuery = (supabase.from('transactions') as any)
    .select('id, date, amount, note, category_label, category_type')
    .eq('user_id', userId)
    .eq('cycle_id', cycleId)

  let scopedQuery = baseQuery
  const outflowBucketType =
    scope === 'key'
      ? resolveOutflowBucketType(categoryKey, categoryType)
      : null

  if (scope === 'label' && categoryLabel) {
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
    ? (data ?? []).filter((row: any) => normalizeOutflowCategoryType(row.category_type) === outflowBucketType)
    : (data ?? [])

  const txns: LedgerTransaction[] = filteredRows.map((row: any) => ({
    id: row.id,
    date: row.date,
    note: row.note ?? null,
    categoryLabel: row.category_label ?? null,
    categoryType: row.category_type ?? null,
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
