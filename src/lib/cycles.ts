// ─────────────────────────────────────────────────────────────
// src/lib/cycles.ts — Pay-cycle engine
//
// All cycle date math lives here. No date logic anywhere else.
// Pure functions only — no imports, no side-effects.
// ─────────────────────────────────────────────────────────────

export interface PaySchedule {
  type: 'monthly' | 'twice_monthly'
  days: number[]  // sorted ascending
}

export interface CycleDates {
  startDate: Date
  endDate:   Date
}

// ─── Utilities ────────────────────────────────────────────────

/**
 * Clamp a day number to the last valid day of a given month.
 * @param year  Full year (e.g. 2026)
 * @param month 0-indexed month (0=Jan, 11=Dec)
 * @param day   Day to clamp (1–31)
 */
export function clampDay(year: number, month: number, day: number): number {
  const lastDay = new Date(year, month + 1, 0).getDate()
  return Math.min(day, lastDay)
}

// ─── Core generators ──────────────────────────────────────────

/**
 * Generate all cycles that overlap with [fromDate, toDate].
 * Delegates to the appropriate generator based on schedule type.
 */
export function generateCycles(
  schedule: PaySchedule,
  fromDate: Date,
  toDate:   Date,
): CycleDates[] {
  if (schedule.type === 'twice_monthly') {
    const sorted = [...schedule.days].sort((a, b) => a - b) as [number, number]
    return generateTwiceMonthlyCycles(sorted, fromDate, toDate)
  }
  return generateMonthlyCycles(schedule.days[0], fromDate, toDate)
}

function generateMonthlyCycles(
  payDay:   number,
  fromDate: Date,
  toDate:   Date,
): CycleDates[] {
  const cycles: CycleDates[] = []

  // Find the cycle that contains fromDate.
  // A cycle starts on `payDay` of some month. Find the most recent start <= fromDate.
  let year  = fromDate.getFullYear()
  let month = fromDate.getMonth()

  const clampedThisMonth = clampDay(year, month, payDay)

  // Has this month's payday passed (or is today the payday)?
  let startYear: number
  let startMonth: number

  if (fromDate.getDate() >= clampedThisMonth) {
    startYear  = year
    startMonth = month
  } else {
    // Payday hasn't arrived yet — cycle started last month
    if (month === 0) {
      startYear  = year - 1
      startMonth = 11
    } else {
      startYear  = year
      startMonth = month - 1
    }
  }

  // Generate forward until we exceed toDate
  while (true) {
    const sd  = clampDay(startYear, startMonth, payDay)
    const start = new Date(startYear, startMonth, sd)

    if (start > toDate) break

    // Next cycle start
    const nextMonth = (startMonth + 1) % 12
    const nextYear  = startMonth === 11 ? startYear + 1 : startYear
    const nd        = clampDay(nextYear, nextMonth, payDay)
    const nextStart = new Date(nextYear, nextMonth, nd)

    // End = day before next cycle start
    const end = new Date(nextStart)
    end.setDate(end.getDate() - 1)

    cycles.push({ startDate: start, endDate: end })

    startYear  = nextYear
    startMonth = nextMonth
  }

  return cycles
}

function generateTwiceMonthlyCycles(
  days:     [number, number],  // sorted ascending
  fromDate: Date,
  toDate:   Date,
): CycleDates[] {
  const [d1, d2] = days
  const cycles: CycleDates[] = []

  let year  = fromDate.getFullYear()
  let month = fromDate.getMonth()

  while (true) {
    const cd1     = clampDay(year, month, d1)
    const cd2     = clampDay(year, month, d2)
    const lastDay = new Date(year, month + 1, 0).getDate()

    // Cycle A: d1 → d2-1
    const startA = new Date(year, month, cd1)
    const endA   = new Date(year, month, cd2 - 1)

    if (startA > toDate) break
    cycles.push({ startDate: startA, endDate: endA })

    // Cycle B: d2 → end of month
    const startB = new Date(year, month, cd2)
    const endB   = new Date(year, month, lastDay)

    if (startB > toDate) break
    cycles.push({ startDate: startB, endDate: endB })

    // Advance to next month
    if (month === 11) { year++; month = 0 }
    else              { month++ }
  }

  return cycles
}

// ─── Lookup functions ──────────────────────────────────────────

/**
 * Return the cycle containing the given date.
 * Searches a ±2 year window which covers all practical cases.
 * Throws if no cycle found (indicates a gap in twice_monthly schedule).
 */
export function getCycleByDate(date: Date, schedule: PaySchedule): CycleDates {
  const y    = date.getFullYear()
  const from = new Date(y - 2, 0, 1)
  const to   = new Date(y + 2, 11, 31)

  const cycles = generateCycles(schedule, from, to)

  const found = cycles.find(c =>
    date >= c.startDate && date <= c.endDate
  )

  if (!found) {
    throw new Error(
      `No cycle found for ${date.toDateString()} with schedule ${JSON.stringify(schedule)}`
    )
  }

  return found
}

/**
 * Return the current cycle (cycle containing today).
 * Uses local date (not UTC) to avoid timezone offset issues.
 */
export function getCurrentCycle(schedule: PaySchedule): CycleDates {
  const now      = new Date()
  const localDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return getCycleByDate(localDay, schedule)
}

// ─── Formatting ───────────────────────────────────────────────

/**
 * "Mar 14 – Apr 13"  or  "Mar 1 – Mar 14"
 */
export function formatCycleLabel(cycle: CycleDates): string {
  const s = cycle.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const e = cycle.endDate.toLocaleDateString('en-US',   { month: 'short', day: 'numeric' })
  return `${s} – ${e}`
}

/**
 * "Mar–Apr 2026"  or  "Mar 2026"
 * Uses the end year to handle Dec→Jan correctly.
 */
export function formatCycleMonthLabel(cycle: CycleDates): string {
  const startMonth = cycle.startDate.toLocaleDateString('en-US', { month: 'short' })
  const endMonth   = cycle.endDate.toLocaleDateString('en-US',   { month: 'short' })
  const year       = cycle.endDate.getFullYear()

  if (startMonth === endMonth) return `${startMonth} ${year}`
  return `${startMonth}–${endMonth} ${year}`
}

// ─── Schedule helpers ──────────────────────────────────────────

/**
 * Convert a profile's raw pay_schedule fields to a PaySchedule object.
 * Falls back to monthly/1st if fields are null (new users without schedule set).
 */
export function profileToPaySchedule(profile: {
  pay_schedule_type: 'monthly' | 'twice_monthly' | null
  pay_schedule_days: number[] | null
}): PaySchedule {
  const type = profile.pay_schedule_type ?? 'monthly'
  const days = profile.pay_schedule_days ?? [1]
  return { type, days: [...days].sort((a, b) => a - b) }
}

/**
 * Format a date as 'YYYY-MM-DD' in local time (no UTC conversion).
 * Use this when storing dates in Supabase DATE columns.
 */
export function toLocalDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
