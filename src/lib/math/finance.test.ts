import { describe, it, expect } from 'vitest'
import {
  safeNum,
  sumAmounts,
  calculateTotalIncome,
  calculateTotalSpent,
  calculateRemaining,
  calculatePct,
  calculateRemainingPct,
  calculateCategoryBudget,
} from './finance'

// ─── safeNum ──────────────────────────────────────────────────
describe('safeNum', () => {
  it('passes through valid integers', () => {
    expect(safeNum(0)).toBe(0)
    expect(safeNum(100)).toBe(100)
    expect(safeNum(-50)).toBe(-50)
  })

  it('passes through valid decimals', () => {
    expect(safeNum(10.5)).toBe(10.5)
    expect(safeNum(0.01)).toBe(0.01)
  })

  it('coerces numeric strings', () => {
    expect(safeNum('100')).toBe(100)
    expect(safeNum('10.50')).toBe(10.5)
    expect(safeNum('0')).toBe(0)
  })

  it('returns 0 for null', () => expect(safeNum(null)).toBe(0))
  it('returns 0 for undefined', () => expect(safeNum(undefined)).toBe(0))
  it('returns 0 for NaN', () => expect(safeNum(NaN)).toBe(0))
  it('returns 0 for Infinity', () => expect(safeNum(Infinity)).toBe(0))
  it('returns 0 for -Infinity', () => expect(safeNum(-Infinity)).toBe(0))
  it('returns 0 for empty string', () => expect(safeNum('')).toBe(0))
  it('returns 0 for non-numeric string', () => expect(safeNum('abc')).toBe(0))
  it('returns 0 for object', () => expect(safeNum({})).toBe(0))
  it('returns 0 for array', () => expect(safeNum([])).toBe(0))
})

// ─── sumAmounts ───────────────────────────────────────────────
describe('sumAmounts', () => {
  it('returns 0 for empty array', () => {
    expect(sumAmounts([])).toBe(0)
  })

  it('returns 0 for null/undefined input', () => {
    expect(sumAmounts(null as any)).toBe(0)
    expect(sumAmounts(undefined as any)).toBe(0)
  })

  it('sums integer amounts', () => {
    expect(sumAmounts([{ amount: 100 }, { amount: 200 }, { amount: 50 }])).toBe(350)
  })

  it('sums decimal amounts', () => {
    expect(sumAmounts([{ amount: 10.5 }, { amount: 5.25 }])).toBe(15.75)
  })

  it('handles string amounts', () => {
    expect(sumAmounts([{ amount: '100' }, { amount: '200.50' }])).toBe(300.5)
  })

  it('treats null/undefined amounts as 0', () => {
    expect(sumAmounts([{ amount: null }, { amount: undefined }, { amount: 100 }])).toBe(100)
  })

  // ── Floating-point precision ───────────────────────────────
  it('avoids 0.1 + 0.2 floating-point drift', () => {
    // Naive: 0.1 + 0.2 = 0.30000000000000004
    expect(sumAmounts([{ amount: 0.1 }, { amount: 0.2 }])).toBe(0.3)
  })

  it('avoids drift on realistic transaction amounts', () => {
    // Naive: 10.50 + 5.25 + 3.10 = 18.849999999999998 in some engines
    expect(sumAmounts([{ amount: 10.5 }, { amount: 5.25 }, { amount: 3.1 }])).toBe(18.85)
  })

  it('avoids drift on many small amounts', () => {
    const rows = Array.from({ length: 10 }, () => ({ amount: 0.1 }))
    expect(sumAmounts(rows)).toBe(1.0)
  })

  it('handles single-item array', () => {
    expect(sumAmounts([{ amount: 999.99 }])).toBe(999.99)
  })

  it('handles large amounts', () => {
    expect(sumAmounts([{ amount: 1_000_000 }, { amount: 2_500_000 }])).toBe(3_500_000)
  })
})

// ─── calculateTotalIncome ────────────────────────────────────
describe('calculateTotalIncome', () => {
  it('returns base income alone', () => {
    expect(calculateTotalIncome({ income: 50000 })).toBe(50000)
  })

  it('adds extra income sources', () => {
    expect(calculateTotalIncome({
      income: 50000,
      extraIncome: [{ amount: 10000 }, { amount: 5000 }],
    })).toBe(65000)
  })

  it('accepts salary field (database shape)', () => {
    expect(calculateTotalIncome({ salary: 80000 })).toBe(80000)
  })

  it('accepts snake_case extra_income (database shape)', () => {
    expect(calculateTotalIncome({
      salary: 80000,
      extra_income: [{ amount: 20000 }],
    })).toBe(100000)
  })

  it('prefers income over salary if both present', () => {
    expect(calculateTotalIncome({ income: 50000, salary: 80000 })).toBe(50000)
  })

  it('returns 0 for empty object', () => {
    expect(calculateTotalIncome({})).toBe(0)
  })

  it('returns 0 for null input', () => {
    expect(calculateTotalIncome(null as any)).toBe(0)
  })

  it('ignores extras with missing amounts', () => {
    expect(calculateTotalIncome({
      income: 50000,
      extraIncome: [{ amount: null }, { amount: undefined }],
    })).toBe(50000)
  })

  it('handles decimal base + decimal extras precisely', () => {
    // Ensure no floating-point drift with combined amounts
    expect(calculateTotalIncome({
      income: 5000.5,
      extraIncome: [{ amount: 1000.25 }, { amount: 500.25 }],
    })).toBe(6501)
  })
})

// ─── calculateTotalSpent ─────────────────────────────────────
describe('calculateTotalSpent', () => {
  it('sums transaction amounts', () => {
    expect(calculateTotalSpent([
      { amount: 500 },
      { amount: 250 },
      { amount: 125 },
    ])).toBe(875)
  })

  it('returns 0 for empty array', () => {
    expect(calculateTotalSpent([])).toBe(0)
  })

  it('returns 0 for null', () => {
    expect(calculateTotalSpent(null as any)).toBe(0)
  })

  it('handles decimal transaction amounts precisely', () => {
    expect(calculateTotalSpent([{ amount: 9.99 }, { amount: 0.01 }])).toBe(10)
  })
})

// ─── calculateRemaining ──────────────────────────────────────
describe('calculateRemaining', () => {
  it('returns positive remaining when under budget', () => {
    expect(calculateRemaining(10000, 6000)).toBe(4000)
  })

  it('returns 0 when exactly spent', () => {
    expect(calculateRemaining(10000, 10000)).toBe(0)
  })

  it('returns negative when over budget', () => {
    expect(calculateRemaining(10000, 12000)).toBe(-2000)
  })

  it('returns income when nothing spent', () => {
    expect(calculateRemaining(50000, 0)).toBe(50000)
  })

  it('handles decimal values precisely', () => {
    // Naive: 100.30 - 50.10 = 50.199999999999996
    expect(calculateRemaining(100.3, 50.1)).toBe(50.2)
  })

  it('defaults null inputs to 0', () => {
    expect(calculateRemaining(null as any, null as any)).toBe(0)
  })
})

// ─── calculatePct ────────────────────────────────────────────
describe('calculatePct', () => {
  it('calculates correct percentage', () => {
    expect(calculatePct(500, 1000)).toBe(50)
    expect(calculatePct(250, 1000)).toBe(25)
    expect(calculatePct(1000, 1000)).toBe(100)
  })

  it('caps at 100 when over reference', () => {
    expect(calculatePct(1500, 1000)).toBe(100)
    expect(calculatePct(999999, 1000)).toBe(100)
  })

  it('returns 0 when reference is 0', () => {
    expect(calculatePct(500, 0)).toBe(0)
  })

  it('returns 0 when value is 0', () => {
    expect(calculatePct(0, 1000)).toBe(0)
  })

  it('returns 0 for null reference', () => {
    expect(calculatePct(100, null as any)).toBe(0)
  })

  it('handles fractional percentages', () => {
    expect(calculatePct(1, 3)).toBeCloseTo(33.33, 1)
  })
})

// ─── calculateRemainingPct ───────────────────────────────────
describe('calculateRemainingPct', () => {
  it('returns full 100% when nothing spent', () => {
    expect(calculateRemainingPct(10000, 10000)).toBe(100)
  })

  it('returns 50% when half remains', () => {
    expect(calculateRemainingPct(5000, 10000)).toBe(50)
  })

  it('floors at 0 when over budget', () => {
    expect(calculateRemainingPct(-2000, 10000)).toBe(0)
    expect(calculateRemainingPct(-99999, 1000)).toBe(0)
  })

  it('returns 0 when reference is 0', () => {
    expect(calculateRemainingPct(0, 0)).toBe(0)
  })
})

// ─── calculateCategoryBudget ─────────────────────────────────
describe('calculateCategoryBudget', () => {
  it('returns correct values when under budget', () => {
    const result = calculateCategoryBudget(300, 500)
    expect(result.spent).toBe(300)
    expect(result.budgeted).toBe(500)
    expect(result.pct).toBe(60)
    expect(result.over).toBe(false)
  })

  it('returns over=true when spent exceeds budget', () => {
    const result = calculateCategoryBudget(600, 500)
    expect(result.over).toBe(true)
    expect(result.pct).toBe(100) // capped
  })

  it('returns over=false when exactly at budget', () => {
    const result = calculateCategoryBudget(500, 500)
    expect(result.over).toBe(false)
    expect(result.pct).toBe(100)
  })

  it('returns 0 pct when budget is 0', () => {
    const result = calculateCategoryBudget(100, 0)
    expect(result.pct).toBe(0)
  })

  it('handles zero spent', () => {
    const result = calculateCategoryBudget(0, 1000)
    expect(result.spent).toBe(0)
    expect(result.pct).toBe(0)
    expect(result.over).toBe(false)
  })

  it('handles decimal amounts precisely', () => {
    const result = calculateCategoryBudget(10.1, 20.2)
    expect(result.pct).toBeCloseTo(50, 5)
  })
})

// ─── Cross-function consistency ───────────────────────────────
describe('cross-function consistency', () => {
  it('remaining + spent === income', () => {
    const income = 50000
    const spent  = 18500
    const remaining = calculateRemaining(income, spent)
    // remaining + spent should equal income exactly (no drift)
    expect(remaining + spent).toBe(income)
  })

  it('remaining pct + spent pct sum to 100 when exactly on budget', () => {
    const income = 10000
    const spent  = 4000
    const remaining = calculateRemaining(income, spent)
    const spentPct = calculatePct(spent, income)
    const remainPct = calculateRemainingPct(remaining, income)
    expect(spentPct + remainPct).toBe(100)
  })

  it('calculateTotalIncome result is consistent with sumAmounts on extras', () => {
    const base   = 50000
    const extras = [{ amount: 10000 }, { amount: 5000 }]
    const viaIncome = calculateTotalIncome({ income: base, extraIncome: extras })
    const viaSum    = base + sumAmounts(extras)
    expect(viaIncome).toBe(viaSum)
  })
})
