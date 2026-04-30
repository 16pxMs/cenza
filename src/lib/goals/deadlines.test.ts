import { describe, expect, it } from 'vitest'
import { deriveGoalTargetDateFromMonths, getGoalMonthlySavingSuggestion, getGoalPaceStatus } from './deadlines'

describe('goal deadlines', () => {
  it('derives a date from a month shortcut', () => {
    const result = deriveGoalTargetDateFromMonths(12, new Date('2026-01-15T00:00:00Z'))
    expect(result).toBe('2027-01-15')
  })

  it('returns a monthly saving suggestion when target date exists', () => {
    const result = getGoalMonthlySavingSuggestion(
      20000,
      80000,
      '2026-07-15',
      new Date('2026-04-15T00:00:00Z')
    )

    expect(result).toBe(15000)
  })

  it('returns null pace when the goal is already complete', () => {
    const result = getGoalPaceStatus({
      totalSaved: 100000,
      targetAmount: 100000,
      targetDate: '2026-12-31',
      addedAt: '2026-01-01',
      today: new Date('2026-04-01T00:00:00Z'),
    })

    expect(result).toBeNull()
  })

  it('classifies pace as behind when actual progress trails expected progress', () => {
    const result = getGoalPaceStatus({
      totalSaved: 10000,
      targetAmount: 100000,
      targetDate: '2026-12-31',
      addedAt: '2026-01-01',
      today: new Date('2026-10-01T00:00:00Z'),
    })

    expect(result).toBe('behind')
  })
})
