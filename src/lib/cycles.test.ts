import { describe, it, expect } from 'vitest'
import {
  clampDay,
  generateCycles,
  getCycleByDate,
  getCurrentCycle,
  formatCycleLabel,
  formatCycleMonthLabel,
  profileToPaySchedule,
  toLocalDateStr,
} from './cycles'
import type { PaySchedule } from './cycles'

// ─── clampDay ─────────────────────────────────────────────────
describe('clampDay', () => {
  it('returns day unchanged when valid for month', () => {
    expect(clampDay(2026, 2, 15)).toBe(15)   // March 15
    expect(clampDay(2026, 0, 31)).toBe(31)   // Jan 31
  })

  it('clamps to last day of February (non-leap)', () => {
    expect(clampDay(2026, 1, 30)).toBe(28)   // Feb 30 → 28
    expect(clampDay(2026, 1, 31)).toBe(28)
    expect(clampDay(2026, 1, 29)).toBe(28)
  })

  it('clamps to 29 in leap year February', () => {
    expect(clampDay(2024, 1, 30)).toBe(29)   // 2024 is leap
    expect(clampDay(2024, 1, 31)).toBe(29)
  })

  it('clamps 31 in 30-day months', () => {
    expect(clampDay(2026, 3, 31)).toBe(30)   // April has 30 days
    expect(clampDay(2026, 5, 31)).toBe(30)   // June
    expect(clampDay(2026, 8, 31)).toBe(30)   // September
    expect(clampDay(2026, 10, 31)).toBe(30)  // November
  })
})

// ─── generateCycles (monthly) ─────────────────────────────────
describe('generateCycles — monthly', () => {
  const monthly14: PaySchedule = { type: 'monthly', days: [14] }

  it('generates a cycle starting on payday and ending day before next payday', () => {
    const from = new Date(2026, 2, 14) // Mar 14
    const to   = new Date(2026, 3, 13) // Apr 13
    const cycles = generateCycles(monthly14, from, to)
    expect(cycles).toHaveLength(1)
    expect(cycles[0].startDate).toEqual(new Date(2026, 2, 14))
    expect(cycles[0].endDate).toEqual(new Date(2026, 3, 13))
  })

  it('generates multiple cycles over a range', () => {
    const from = new Date(2026, 0, 14) // Jan 14
    const to   = new Date(2026, 3, 13) // Apr 13
    const cycles = generateCycles(monthly14, from, to)
    expect(cycles).toHaveLength(3)
    expect(cycles[0].startDate).toEqual(new Date(2026, 0, 14)) // Jan 14
    expect(cycles[0].endDate).toEqual(new Date(2026, 1, 13))   // Feb 13
    expect(cycles[1].startDate).toEqual(new Date(2026, 1, 14)) // Feb 14
    expect(cycles[2].startDate).toEqual(new Date(2026, 2, 14)) // Mar 14
    expect(cycles[2].endDate).toEqual(new Date(2026, 3, 13))   // Apr 13
  })

  it('clamps payday 31 in February — non-leap year', () => {
    const monthly31: PaySchedule = { type: 'monthly', days: [31] }
    const from = new Date(2026, 0, 31) // Jan 31
    const to   = new Date(2026, 2, 30) // Mar 30
    const cycles = generateCycles(monthly31, from, to)
    // Jan 31 → Feb 27, Feb 28 → Mar 30
    expect(cycles).toHaveLength(2)
    expect(cycles[0].startDate).toEqual(new Date(2026, 0, 31)) // Jan 31
    expect(cycles[0].endDate).toEqual(new Date(2026, 1, 27))   // Feb 27
    expect(cycles[1].startDate).toEqual(new Date(2026, 1, 28)) // Feb 28 (clamped from 31)
    expect(cycles[1].endDate).toEqual(new Date(2026, 2, 30))   // Mar 30
  })

  it('clamps payday 31 in February — leap year', () => {
    const monthly31: PaySchedule = { type: 'monthly', days: [31] }
    const from = new Date(2024, 0, 31) // Jan 31 (2024 is leap)
    const to   = new Date(2024, 2, 30)
    const cycles = generateCycles(monthly31, from, to)
    expect(cycles[0].endDate).toEqual(new Date(2024, 1, 28))   // Feb 28 (day before Feb 29)
    expect(cycles[1].startDate).toEqual(new Date(2024, 1, 29)) // Feb 29
  })

  it('handles year boundary', () => {
    const from = new Date(2025, 11, 14) // Dec 14
    const to   = new Date(2026, 1, 13)  // Feb 13 2026
    const cycles = generateCycles(monthly14, from, to)
    expect(cycles).toHaveLength(2)
    expect(cycles[0].startDate).toEqual(new Date(2025, 11, 14)) // Dec 14 2025
    expect(cycles[0].endDate).toEqual(new Date(2026, 0, 13))    // Jan 13 2026
    expect(cycles[1].startDate).toEqual(new Date(2026, 0, 14))  // Jan 14 2026
  })
})

// ─── generateCycles (twice_monthly) ───────────────────────────
describe('generateCycles — twice_monthly', () => {
  const twice115: PaySchedule = { type: 'twice_monthly', days: [1, 15] }

  it('generates two cycles per month: 1→14 and 15→end', () => {
    const from = new Date(2026, 2, 1)  // Mar 1
    const to   = new Date(2026, 2, 31) // Mar 31
    const cycles = generateCycles(twice115, from, to)
    expect(cycles).toHaveLength(2)
    expect(cycles[0].startDate).toEqual(new Date(2026, 2, 1))
    expect(cycles[0].endDate).toEqual(new Date(2026, 2, 14))
    expect(cycles[1].startDate).toEqual(new Date(2026, 2, 15))
    expect(cycles[1].endDate).toEqual(new Date(2026, 2, 31))
  })

  it('generates four cycles over two months', () => {
    const from = new Date(2026, 2, 1)  // Mar 1
    const to   = new Date(2026, 3, 30) // Apr 30
    const cycles = generateCycles(twice115, from, to)
    expect(cycles).toHaveLength(4)
  })

  it('clamps in February', () => {
    const from = new Date(2026, 1, 1)  // Feb 1
    const to   = new Date(2026, 1, 28) // Feb 28
    const cycles = generateCycles(twice115, from, to)
    expect(cycles).toHaveLength(2)
    expect(cycles[0].endDate).toEqual(new Date(2026, 1, 14))  // Feb 14
    expect(cycles[1].startDate).toEqual(new Date(2026, 1, 15))
    expect(cycles[1].endDate).toEqual(new Date(2026, 1, 28))  // Feb 28 (last day)
  })
})

// ─── getCycleByDate ────────────────────────────────────────────
describe('getCycleByDate', () => {
  const monthly14: PaySchedule = { type: 'monthly', days: [14] }
  const twice115:  PaySchedule = { type: 'twice_monthly', days: [1, 15] }

  it('returns the cycle containing the given date (monthly)', () => {
    const date  = new Date(2026, 2, 20) // Mar 20
    const cycle = getCycleByDate(date, monthly14)
    expect(cycle.startDate).toEqual(new Date(2026, 2, 14)) // Mar 14
    expect(cycle.endDate).toEqual(new Date(2026, 3, 13))   // Apr 13
  })

  it('returns the correct cycle when date is before payday (monthly)', () => {
    const date  = new Date(2026, 2, 5) // Mar 5 — before Mar 14
    const cycle = getCycleByDate(date, monthly14)
    expect(cycle.startDate).toEqual(new Date(2026, 1, 14)) // Feb 14
    expect(cycle.endDate).toEqual(new Date(2026, 2, 13))   // Mar 13
  })

  it('returns correct cycle for twice_monthly', () => {
    const dateA = new Date(2026, 2, 10) // Mar 10 → cycle A
    const cycleA = getCycleByDate(dateA, twice115)
    expect(cycleA.startDate).toEqual(new Date(2026, 2, 1))
    expect(cycleA.endDate).toEqual(new Date(2026, 2, 14))

    const dateB = new Date(2026, 2, 20) // Mar 20 → cycle B
    const cycleB = getCycleByDate(dateB, twice115)
    expect(cycleB.startDate).toEqual(new Date(2026, 2, 15))
    expect(cycleB.endDate).toEqual(new Date(2026, 2, 31))
  })

  it('returns cycle for date exactly on start boundary', () => {
    const date  = new Date(2026, 2, 14) // Exactly Mar 14
    const cycle = getCycleByDate(date, monthly14)
    expect(cycle.startDate).toEqual(new Date(2026, 2, 14))
  })

  it('returns cycle for date exactly on end boundary', () => {
    const date  = new Date(2026, 3, 13) // Exactly Apr 13 (end of Mar 14 cycle)
    const cycle = getCycleByDate(date, monthly14)
    expect(cycle.startDate).toEqual(new Date(2026, 2, 14))
    expect(cycle.endDate).toEqual(new Date(2026, 3, 13))
  })
})

// ─── formatCycleLabel ─────────────────────────────────────────
describe('formatCycleLabel', () => {
  it('formats a cross-month cycle', () => {
    const label = formatCycleLabel({
      startDate: new Date(2026, 2, 14),  // Mar 14
      endDate:   new Date(2026, 3, 13),  // Apr 13
    })
    expect(label).toBe('Mar 14 – Apr 13')
  })

  it('formats a within-month cycle', () => {
    const label = formatCycleLabel({
      startDate: new Date(2026, 2, 1),   // Mar 1
      endDate:   new Date(2026, 2, 14),  // Mar 14
    })
    expect(label).toBe('Mar 1 – Mar 14')
  })
})

// ─── formatCycleMonthLabel ────────────────────────────────────
describe('formatCycleMonthLabel', () => {
  it('shows two months when cycle spans a month boundary', () => {
    const label = formatCycleMonthLabel({
      startDate: new Date(2026, 2, 14),  // Mar
      endDate:   new Date(2026, 3, 13),  // Apr
    })
    expect(label).toBe('Mar–Apr 2026')
  })

  it('shows single month when cycle is within one month', () => {
    const label = formatCycleMonthLabel({
      startDate: new Date(2026, 2, 1),
      endDate:   new Date(2026, 2, 14),
    })
    expect(label).toBe('Mar 2026')
  })

  it('uses end year when cycle spans Dec → Jan', () => {
    const label = formatCycleMonthLabel({
      startDate: new Date(2025, 11, 14), // Dec 2025
      endDate:   new Date(2026, 0, 13),  // Jan 2026
    })
    expect(label).toBe('Dec–Jan 2026')
  })
})

// ─── profileToPaySchedule ─────────────────────────────────────
describe('profileToPaySchedule', () => {
  it('converts monthly profile fields to PaySchedule', () => {
    const schedule = profileToPaySchedule({
      pay_schedule_type: 'monthly',
      pay_schedule_days: [14],
    })
    expect(schedule).toEqual({ type: 'monthly', days: [14] })
  })

  it('falls back to monthly/1st when fields are null', () => {
    const schedule = profileToPaySchedule({
      pay_schedule_type: null,
      pay_schedule_days: null,
    })
    expect(schedule).toEqual({ type: 'monthly', days: [1] })
  })

  it('sorts days ascending', () => {
    const schedule = profileToPaySchedule({
      pay_schedule_type: 'twice_monthly',
      pay_schedule_days: [16, 1],
    })
    expect(schedule.days).toEqual([1, 16])
  })
})

// ─── toLocalDateStr ───────────────────────────────────────────
describe('toLocalDateStr', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(toLocalDateStr(new Date(2026, 2, 14))).toBe('2026-03-14')  // Mar 14
  })

  it('zero-pads single-digit months and days', () => {
    expect(toLocalDateStr(new Date(2026, 0, 5))).toBe('2026-01-05')   // Jan 5
    expect(toLocalDateStr(new Date(2026, 8, 9))).toBe('2026-09-09')   // Sep 9
  })
})

// ─── getCurrentCycle ─────────────────────────────────────────
describe('getCurrentCycle', () => {
  it('returns a cycle whose range contains today', () => {
    const schedule: PaySchedule = { type: 'monthly', days: [14] }
    const cycle = getCurrentCycle(schedule)
    const today = new Date()
    const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    expect(cycle.startDate <= localToday).toBe(true)
    expect(cycle.endDate   >= localToday).toBe(true)
  })
})
