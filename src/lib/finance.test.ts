import { describe, it, expect } from 'vitest'
import {
  fmt,
  getPrevMonth,
  formatDate,
  getConfidenceLevel,
  CONFIDENCE_LABEL,
  CONFIDENCE_COLOR,
  getBudgetPace,
} from './finance'

// ─── fmt ──────────────────────────────────────────────────────
describe('fmt', () => {
  it('formats zero', () => {
    expect(fmt(0)).toBe('KES 0')
    expect(fmt(0, 'USD')).toBe('USD 0')
  })

  it('formats values under 1000 as-is', () => {
    expect(fmt(500, 'KES')).toBe('KES 500')
    expect(fmt(999, 'KES')).toBe('KES 999')
  })

  it('abbreviates thousands', () => {
    expect(fmt(1000, 'KES')).toBe('KES 1K')
    expect(fmt(45000, 'KES')).toBe('KES 45K')
    expect(fmt(999999, 'KES')).toBe('KES 1000K')
  })

  it('abbreviates millions', () => {
    expect(fmt(1_000_000, 'KES')).toBe('KES 1.0M')
    expect(fmt(2_500_000, 'KES')).toBe('KES 2.5M')
  })

  it('uses default currency KES', () => {
    expect(fmt(100)).toBe('KES 100')
  })
})

// ─── getPrevMonth ─────────────────────────────────────────────
describe('getPrevMonth', () => {
  it('decrements month', () => {
    expect(getPrevMonth('2026-03')).toBe('2026-02')
    expect(getPrevMonth('2026-12')).toBe('2026-11')
  })

  it('wraps January back to previous year December', () => {
    expect(getPrevMonth('2026-01')).toBe('2025-12')
    expect(getPrevMonth('2000-01')).toBe('1999-12')
  })

  it('zero-pads single-digit months', () => {
    expect(getPrevMonth('2026-10')).toBe('2026-09')
  })
})

// ─── formatDate ───────────────────────────────────────────────
describe('formatDate', () => {
  it('formats a date string as "Mon D"', () => {
    expect(formatDate('2026-03-05')).toBe('Mar 5')
    expect(formatDate('2026-01-15')).toBe('Jan 15')
    expect(formatDate('2026-12-31')).toBe('Dec 31')
  })
})

// ─── getConfidenceLevel ───────────────────────────────────────
describe('getConfidenceLevel', () => {
  it('returns learning for count 1', () => {
    expect(getConfidenceLevel(1)).toBe('learning')
  })

  it('returns known for counts 2–4', () => {
    expect(getConfidenceLevel(2)).toBe('known')
    expect(getConfidenceLevel(3)).toBe('known')
    expect(getConfidenceLevel(4)).toBe('known')
  })

  it('returns trusted for count 5+', () => {
    expect(getConfidenceLevel(5)).toBe('trusted')
    expect(getConfidenceLevel(100)).toBe('trusted')
  })

  it('CONFIDENCE_LABEL maps each level', () => {
    expect(CONFIDENCE_LABEL.learning).toBe('Still learning this one')
    expect(CONFIDENCE_LABEL.known).toBe('We know this one')
    expect(CONFIDENCE_LABEL.trusted).toBe('Trusted')
  })

  it('CONFIDENCE_COLOR maps each level to a hex color', () => {
    expect(CONFIDENCE_COLOR.learning).toMatch(/^#/)
    expect(CONFIDENCE_COLOR.known).toMatch(/^#/)
    expect(CONFIDENCE_COLOR.trusted).toMatch(/^#/)
  })
})

// ─── getBudgetPace ────────────────────────────────────────────
describe('getBudgetPace', () => {
  it('returns null when budget is 0', () => {
    expect(getBudgetPace(1000, 0, 15, 31)).toBeNull()
  })

  it('returns null for the first 2 days (too early)', () => {
    expect(getBudgetPace(500, 10000, 1, 31)).toBeNull()
    expect(getBudgetPace(500, 10000, 2, 31)).toBeNull()
  })

  it('detects over-pace when projected > 110% of budget', () => {
    // Day 15 of 30, spent 8000 of 10000 budget → projects to 16000 (160%)
    const result = getBudgetPace(8000, 10000, 15, 30, 'KES')
    expect(result).not.toBeNull()
    expect(result!.status).toBe('over')
    expect(result!.projectedSpend).toBe(16000)
    expect(result!.note).toContain('Projected')
  })

  it('detects under-pace when projected < 80% of budget', () => {
    // Day 15 of 30, spent 2000 of 10000 budget → projects to 4000 (40%)
    const result = getBudgetPace(2000, 10000, 15, 30, 'KES')
    expect(result).not.toBeNull()
    expect(result!.status).toBe('under')
    expect(result!.note).toContain('On track')
  })

  it('detects on-track pace (80–110% of budget)', () => {
    // Day 15 of 30, spent 4500 of 10000 budget → projects to 9000 (90%)
    const result = getBudgetPace(4500, 10000, 15, 30, 'KES')
    expect(result).not.toBeNull()
    expect(result!.status).toBe('on-track')
    expect(result!.note).toContain('Pacing well')
  })

  it('calculates daysLeft correctly', () => {
    const result = getBudgetPace(4500, 10000, 10, 30, 'KES')
    expect(result!.daysLeft).toBe(20)
  })

  it('uses singular "day" when 1 day left', () => {
    const result = getBudgetPace(4500, 10000, 29, 30, 'KES')
    expect(result!.note).toContain('1 day ')
    expect(result!.note).not.toContain('1 days')
  })
})
