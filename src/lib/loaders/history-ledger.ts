import { createClient } from '@/lib/supabase/server'
import { deriveCurrentCycleId, deriveCycleIdForDate } from '@/lib/supabase/cycles-db'
import { formatCycleLabel, getCurrentCycle, getCycleByDate, profileToPaySchedule } from '@/lib/cycles'
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

export async function loadHistoryLedgerPageData(
  userId: string,
  profile: UserProfile,
  categoryKey: string,
  categoryType?: CategoryType,
  scope: 'key' | 'label' = 'key',
  categoryLabel?: string,
  targetDate?: Date,
): Promise<HistoryLedgerPageData> {
  const supabase = await createClient()
  const cycleId = targetDate
    ? deriveCycleIdForDate(profile, targetDate)
    : deriveCurrentCycleId(profile)

  const baseQuery = (supabase.from('transactions') as any)
    .select('id, date, amount, note, category_label, category_type')
    .eq('user_id', userId)
    .eq('cycle_id', cycleId)

  let scopedQuery = baseQuery

  if (scope === 'label' && categoryLabel) {
    scopedQuery = scopedQuery
      .eq('category_type', categoryType ?? 'everyday')
      .eq('category_label', categoryLabel)
  } else if (categoryType === 'debt' && categoryKey === 'debt') {
    scopedQuery = scopedQuery.eq('category_type', 'debt')
  } else {
    scopedQuery = scopedQuery.eq('category_key', categoryKey)
  }

  const { data } = await scopedQuery
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  const txns: LedgerTransaction[] = (data ?? []).map((row: any) => ({
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
