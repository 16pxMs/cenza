import {
  getCurrentCycle,
  getCycleByDate,
  profileToPaySchedule,
  toLocalDateStr,
} from '@/lib/cycles'

export interface CycleRangeProfile {
  pay_schedule_type: 'monthly' | 'twice_monthly' | null
  pay_schedule_days: number[] | null
}

export function getCycleDateRange(profile: CycleRangeProfile, targetDate?: Date) {
  const schedule = profileToPaySchedule(profile)
  const cycle = targetDate ? getCycleByDate(targetDate, schedule) : getCurrentCycle(schedule)

  return {
    cycle,
    startDate: toLocalDateStr(cycle.startDate),
    endDate: toLocalDateStr(cycle.endDate),
  }
}

export function selectTransactionsInCycleDateRange(
  supabase: any,
  userId: string,
  profile: CycleRangeProfile,
  columns: string,
  targetDate?: Date
) {
  const range = getCycleDateRange(profile, targetDate)
  const userScopedQuery = (supabase.from('transactions') as any)
    .select(columns)
    .eq('user_id', userId)

  return {
    ...range,
    query: typeof userScopedQuery.gte === 'function'
      ? userScopedQuery
          .gte('date', range.startDate)
          .lte('date', range.endDate)
      : userScopedQuery.eq('cycle_id', range.startDate),
  }
}
