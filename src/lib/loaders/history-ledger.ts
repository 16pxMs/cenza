import { createClient } from '@/lib/supabase/server'
import { deriveCurrentCycleId } from '@/lib/supabase/cycles-db'
import type { UserProfile } from '@/types/database'

export interface LedgerTransaction {
  id: string
  date: string
  amount: number
  note: string | null
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
  categoryKey: string
): Promise<HistoryLedgerPageData> {
  const supabase = await createClient()
  const cycleId = deriveCurrentCycleId(profile)

  const { data } = await (supabase.from('transactions') as any)
    .select('id, date, amount, note')
    .eq('user_id', userId)
    .eq('cycle_id', cycleId)
    .eq('category_key', categoryKey)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  const txns: LedgerTransaction[] = (data ?? []).map((row: any) => ({
    ...row,
    amount: Number(row.amount),
  }))

  return {
    monthLabel: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    currency: profile.currency ?? 'KES',
    txns,
    totalSpent: txns.reduce((sum, txn) => sum + txn.amount, 0),
  }
}
