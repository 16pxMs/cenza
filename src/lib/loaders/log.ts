import { formatCycleLabel, getCycleByDate, profileToPaySchedule } from '@/lib/cycles'
import { createClient } from '@/lib/supabase/server'
import { deriveCurrentCycleId } from '@/lib/supabase/cycles-db'
import type { UserProfile } from '@/types/database'

export interface LogSubItem {
  key: string
  label: string
  sublabel: string | null
  groupType: string
  loggedAmount: number
  plannedAmount?: number
  latestLoggedDate?: string | null
  entryCount?: number
  singleEntryId?: string | null
  singleEntryDate?: string | null
  singleEntryNote?: string | null
  scope?: 'key' | 'label'
}

export interface LogEntry {
  id: string
  name: string
  categoryKey: string
  categoryType: string
  amount: number
  date: string
  note: string | null
  createdAt: string
}

export interface LogPageData {
  cycleLabel: string
  currency: string
  entries: LogEntry[]
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, c => c.toUpperCase())
}

export async function loadLogPageData(userId: string, profile: UserProfile): Promise<LogPageData> {
  const supabase = await createClient()
  const cycleId = deriveCurrentCycleId(profile)
  const schedule = profileToPaySchedule(profile)

  const { data: txns } = await (supabase.from('transactions') as any)
    .select('id, category_key, category_label, category_type, amount, date, note, created_at')
    .eq('user_id', userId)
    .eq('cycle_id', cycleId)
    .order('created_at', { ascending: false })

  const currency = profile.currency ?? 'KES'
  const txRows = (txns ?? []) as Array<{
    id: string
    category_key: string
    category_label: string
    category_type: string
    amount: number | string
    date: string
    note?: string | null
    created_at: string
  }>

  const entries: LogEntry[] = txRows
    .filter((txn) => txn.category_type !== 'goal')
    .map((txn) => ({
      id: txn.id,
      name: txn.category_label || titleCase(txn.category_key),
      categoryKey: txn.category_key,
      categoryType: txn.category_type,
      amount: Number(txn.amount),
      date: txn.date,
      note: txn.note ?? null,
      createdAt: txn.created_at,
    }))

  return {
    cycleLabel: formatCycleLabel(getCycleByDate(new Date(), schedule)),
    currency,
    entries,
  }
}
