// ─────────────────────────────────────────────────────────────
// src/lib/supabase/cycles-db.ts
//
// Wraps cycles table interactions. Uses passed-in supabase client
// so it works in both client components and server actions.
// ─────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getCurrentCycle,
  getCycleByDate,
  toLocalDateStr,
  profileToPaySchedule,
} from '@/lib/cycles'
import type { PaySchedule } from '@/lib/cycles'

/**
 * Get or create the cycles row for the given schedule and date.
 * Defaults to today's cycle when `date` is not provided.
 *
 * Returns the cycle's start_date string ('YYYY-MM-DD') — use it as `cycle_id` in all queries.
 * cycle_id IS the start_date; no UUID lookup needed.
 */
export async function getOrCreateCycle(
  supabase:  SupabaseClient,
  userId:    string,
  schedule:  PaySchedule,
  date?:     Date,
): Promise<string> {
  const cycleDates = date
    ? getCycleByDate(date, schedule)
    : getCurrentCycle(schedule)

  const startStr = toLocalDateStr(cycleDates.startDate)
  const endStr   = toLocalDateStr(cycleDates.endDate)

  // Upsert — idempotent on composite PK (user_id, start_date)
  const { error } = await (supabase as any)
    .from('cycles')
    .upsert(
      {
        user_id:    userId,
        start_date: startStr,
        end_date:   endStr,
        is_current: !date, // true only when getting today's cycle
      },
      { onConflict: 'user_id,start_date' }
    )

  if (error) throw new Error(`getOrCreateCycle failed: ${error.message}`)

  return startStr  // cycle_id IS the start_date string
}

/**
 * Convenience: derive schedule from profile and get current cycle id.
 * This is the main entry point used by page components.
 */
export async function getCurrentCycleId(
  supabase: SupabaseClient,
  userId:   string,
  profile:  { pay_schedule_type: 'monthly' | 'twice_monthly' | null; pay_schedule_days: number[] | null },
): Promise<string> {
  const schedule = profileToPaySchedule(profile)
  return getOrCreateCycle(supabase, userId, schedule)
}

/**
 * Get the cycle_id for an arbitrary local date.
 * Use this for writes so a transaction is always attached to the
 * correct cycle for that date instead of relying on callers to
 * manually pass cycle_id around.
 */
export async function getCycleIdForDate(
  supabase: SupabaseClient,
  userId: string,
  profile: { pay_schedule_type: 'monthly' | 'twice_monthly' | null; pay_schedule_days: number[] | null },
  date: Date,
): Promise<string> {
  const schedule = profileToPaySchedule(profile)
  return getOrCreateCycle(supabase, userId, schedule, date)
}

/**
 * Get the cycle_id for the cycle before the current one.
 * Used for carry-forward logic (replaces getPrevMonth).
 * Returns null if no previous cycle can be determined.
 */
export async function getPrevCycleId(
  supabase: SupabaseClient,
  userId:   string,
  profile:  { pay_schedule_type: 'monthly' | 'twice_monthly' | null; pay_schedule_days: number[] | null },
): Promise<string | null> {
  try {
    const schedule     = profileToPaySchedule(profile)
    const currentCycle = getCurrentCycle(schedule)

    // Day before current cycle start = last day of previous cycle
    const prevDate = new Date(currentCycle.startDate)
    prevDate.setDate(prevDate.getDate() - 1)

    return await getOrCreateCycle(supabase, userId, schedule, prevDate)
  } catch {
    return null
  }
}
