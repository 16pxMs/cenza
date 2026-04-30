import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { GoalContributionItem } from '@/lib/goals/contributions'

export async function loadGoalContributions(
  userId: string,
  goalId: string,
  addedAt: string | null,
): Promise<GoalContributionItem[]> {
  const supabase = await createServerSupabaseClient()
  const cutoff = addedAt ? addedAt.slice(0, 10) : '1900-01-01'

  const { data, error } = await (supabase.from('transactions') as any)
    .select('id, amount, date, note, created_at')
    .eq('user_id', userId)
    .eq('category_type', 'goal')
    .eq('category_key', goalId)
    .gte('date', cutoff)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to load goal contributions: ${error.message}`)
  }

  return ((data ?? []) as Array<{
    id: string | number
    amount: number | string
    date: string
    note: string | null
    created_at: string
  }>).map((row) => ({
    id: String(row.id),
    amount: Number(row.amount) || 0,
    date: String(row.date),
    note: row.note?.trim() || null,
    createdAt: String(row.created_at),
  }))
}
