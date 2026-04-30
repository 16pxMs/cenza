import { describe, expect, it } from 'vitest'
import {
  groupContributionsByMonth,
  totalContributions,
  type GoalContributionItem,
} from './contributions'

function makeItem(partial: Partial<GoalContributionItem> & { id: string; date: string; amount: number }): GoalContributionItem {
  return {
    note: null,
    createdAt: `${partial.date}T00:00:00Z`,
    ...partial,
  }
}

describe('groupContributionsByMonth', () => {
  it('returns an empty array for no items', () => {
    expect(groupContributionsByMonth([])).toEqual([])
  })

  it('groups contributions by their YYYY-MM month key', () => {
    const groups = groupContributionsByMonth([
      makeItem({ id: 'a', date: '2026-04-12', amount: 1000 }),
      makeItem({ id: 'b', date: '2026-04-28', amount: 500 }),
      makeItem({ id: 'c', date: '2026-03-15', amount: 2000 }),
    ])

    expect(groups).toHaveLength(2)
    expect(groups[0].monthKey).toBe('2026-04')
    expect(groups[0].items.map(item => item.id)).toEqual(['a', 'b'])
    expect(groups[1].monthKey).toBe('2026-03')
    expect(groups[1].items.map(item => item.id)).toEqual(['c'])
  })

  it('orders groups newest first', () => {
    const groups = groupContributionsByMonth([
      makeItem({ id: 'old', date: '2025-12-01', amount: 100 }),
      makeItem({ id: 'mid', date: '2026-02-01', amount: 100 }),
      makeItem({ id: 'new', date: '2026-04-01', amount: 100 }),
    ])

    expect(groups.map(group => group.monthKey)).toEqual(['2026-04', '2026-02', '2025-12'])
  })

  it('produces a human month label', () => {
    const groups = groupContributionsByMonth([
      makeItem({ id: 'a', date: '2026-04-12', amount: 1000 }),
    ])

    expect(groups[0].monthLabel).toBe('April 2026')
  })

  it('preserves the input order within a month', () => {
    const groups = groupContributionsByMonth([
      makeItem({ id: 'first', date: '2026-04-01', amount: 100 }),
      makeItem({ id: 'second', date: '2026-04-15', amount: 200 }),
      makeItem({ id: 'third', date: '2026-04-30', amount: 300 }),
    ])

    expect(groups[0].items.map(item => item.id)).toEqual(['first', 'second', 'third'])
  })
})

describe('totalContributions', () => {
  it('returns 0 for an empty list', () => {
    expect(totalContributions([])).toBe(0)
  })

  it('sums all amounts', () => {
    const total = totalContributions([
      makeItem({ id: 'a', date: '2026-04-01', amount: 1000 }),
      makeItem({ id: 'b', date: '2026-04-02', amount: 250 }),
      makeItem({ id: 'c', date: '2026-03-01', amount: 750 }),
    ])

    expect(total).toBe(2000)
  })

  it('skips non-finite amounts', () => {
    const total = totalContributions([
      makeItem({ id: 'a', date: '2026-04-01', amount: 1000 }),
      makeItem({ id: 'b', date: '2026-04-02', amount: Number.NaN }),
    ])

    expect(total).toBe(1000)
  })
})
