import { describe, it, expect } from 'vitest'
import {
  fmt,
  formatDate,
  getConfidenceLevel,
  CONFIDENCE_LABEL,
  CONFIDENCE_COLOR,
  getBudgetPace,
} from './finance'
import { formatAmount } from './formatting/amount'

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
    expect(fmt(1_000_000, 'KES')).toBe('KES 1M')
    expect(fmt(2_500_000, 'KES')).toBe('KES 2.5M')
  })

  it('uses default currency KES', () => {
    expect(fmt(100)).toBe('KES 100')
  })

  it('handles negative values (refunds)', () => {
    expect(fmt(-500, 'KES')).toBe('-KES 500')
    expect(fmt(-1500, 'KES')).toBe('-KES 1.5K')
    expect(fmt(-2_000_000, 'KES')).toBe('-KES 2M')
  })
})

// ─── formatAmount ─────────────────────────────────────────────
describe('formatAmount', () => {
  describe('full variant (default)', () => {
    it('formats zero', () => {
      expect(formatAmount(0)).toBe('KES 0')
      expect(formatAmount(0, { currency: 'USD' })).toBe('USD 0')
    })

    it('formats values under 1000 without abbreviation', () => {
      expect(formatAmount(500)).toBe('KES 500')
      expect(formatAmount(999)).toBe('KES 999')
    })

    it('uses locale thousands separators, no abbreviation', () => {
      expect(formatAmount(1_000)).toBe('KES 1,000')
      expect(formatAmount(24_530)).toBe('KES 24,530')
      expect(formatAmount(1_000_000)).toBe('KES 1,000,000')
    })

    it('handles negative values with sign before currency', () => {
      expect(formatAmount(-500)).toBe('-KES 500')
      expect(formatAmount(-1_500)).toBe('-KES 1,500')
      expect(formatAmount(-1_000_000)).toBe('-KES 1,000,000')
    })

    it('respects custom currency', () => {
      expect(formatAmount(5_000, { currency: 'USD' })).toBe('USD 5,000')
    })
  })

  describe('compact variant', () => {
    it('formats zero', () => {
      expect(formatAmount(0, { variant: 'compact' })).toBe('KES 0')
    })

    it('formats values under 1000 as-is', () => {
      expect(formatAmount(500, { variant: 'compact' })).toBe('KES 500')
      expect(formatAmount(999, { variant: 'compact' })).toBe('KES 999')
    })

    it('abbreviates thousands with 1 decimal, strips .0', () => {
      expect(formatAmount(1_000, { variant: 'compact' })).toBe('KES 1K')
      expect(formatAmount(1_500, { variant: 'compact' })).toBe('KES 1.5K')
      expect(formatAmount(45_000, { variant: 'compact' })).toBe('KES 45K')
    })

    it('never aggressively rounds (2530 → 2.5K, not 3K)', () => {
      expect(formatAmount(2_530, { variant: 'compact' })).toBe('KES 2.5K')
    })

    it('abbreviates millions with 1 decimal, strips .0', () => {
      expect(formatAmount(1_000_000, { variant: 'compact' })).toBe('KES 1M')
      expect(formatAmount(2_500_000, { variant: 'compact' })).toBe('KES 2.5M')
    })

    it('abbreviates billions', () => {
      expect(formatAmount(1_000_000_000, { variant: 'compact' })).toBe('KES 1B')
      expect(formatAmount(1_500_000_000, { variant: 'compact' })).toBe('KES 1.5B')
    })

    it('handles negative values with sign before currency', () => {
      expect(formatAmount(-500, { variant: 'compact' })).toBe('-KES 500')
      expect(formatAmount(-1_500, { variant: 'compact' })).toBe('-KES 1.5K')
      expect(formatAmount(-2_000_000, { variant: 'compact' })).toBe('-KES 2M')
    })

    it('respects custom currency', () => {
      expect(formatAmount(24_530, { currency: 'USD', variant: 'compact' })).toBe('USD 24.5K')
    })
  })

  describe('raw variant', () => {
    it('returns plain number string with no currency or formatting', () => {
      expect(formatAmount(0, { variant: 'raw' })).toBe('0')
      expect(formatAmount(24_530, { variant: 'raw' })).toBe('24530')
      expect(formatAmount(-1_500, { variant: 'raw' })).toBe('-1500')
    })

    it('ignores currency option', () => {
      expect(formatAmount(100, { currency: 'USD', variant: 'raw' })).toBe('100')
    })
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
