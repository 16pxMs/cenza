import { describe, expect, it } from 'vitest'
import { validateGoalMilestones } from './milestones'

describe('validateGoalMilestones', () => {
  it('allows milestones without target dates', () => {
    const result = validateGoalMilestones([
      { name: 'First 10k', amount: 10000, targetDate: null },
    ], 50000)

    expect(result.error).toBeNull()
    expect(result.milestones).toEqual([
      { name: 'First 10k', amount: 10000, targetDate: null },
    ])
  })

  it('requires a name when a target date is entered', () => {
    const result = validateGoalMilestones([
      { name: '', amount: 10000, targetDate: '2026-06-30' },
    ], 50000)

    expect(result.error).toBe('Milestone 1 needs a name.')
  })

  it('requires an amount when a target date is entered', () => {
    const result = validateGoalMilestones([
      { name: 'Checkpoint', amount: null, targetDate: '2026-06-30' },
    ], 50000)

    expect(result.error).toBe('Milestone 1 needs a target amount.')
  })

  it('rejects invalid milestone dates', () => {
    const result = validateGoalMilestones([
      { name: 'Checkpoint', amount: 10000, targetDate: '2026-02-30' },
    ], 50000)

    expect(result.error).toBe('Milestone 1 needs a valid target date.')
  })

  it('sorts milestones by amount while preserving dates', () => {
    const result = validateGoalMilestones([
      { name: 'Halfway', amount: 50000, targetDate: '2026-08-01' },
      { name: 'Start', amount: 10000, targetDate: '2026-06-01' },
    ], 100000)

    expect(result.error).toBeNull()
    expect(result.milestones).toEqual([
      { name: 'Start', amount: 10000, targetDate: '2026-06-01' },
      { name: 'Halfway', amount: 50000, targetDate: '2026-08-01' },
    ])
  })

  it('rejects milestone dates after the goal target date', () => {
    const result = validateGoalMilestones([
      { name: 'Late checkpoint', amount: 10000, targetDate: '2026-09-01' },
    ], 50000, '2026-08-31')

    expect(result.error).toBe('Milestone 1 cannot be after the goal target date.')
  })
})
