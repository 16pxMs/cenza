import { describe, expect, it } from 'vitest'
import { deriveOutflowCategoryRows, deriveOutflowTotalFromCategories } from './outflow'

describe('outflow bucket grouping', () => {
  it('groups transactions into canonical top-level buckets', () => {
    const rows = deriveOutflowCategoryRows([
      { category_type: 'fixed', amount: 100 },
      { category_type: 'essentials', amount: 50 },
      { category_type: 'subscription', amount: 25 },
      { category_type: 'goal', amount: 75 },
      { category_type: 'debt', amount: 40 },
      { category_type: 'everyday', amount: 30 },
      { category_type: 'other', amount: 20 },
      { category_type: 'uncategorized', amount: 10 },
    ])

    expect(rows).toEqual([
      { key: 'fixed', type: 'fixed', label: 'Fixed', spent: 175 },
      { key: 'goal', type: 'goal', label: 'Goals', spent: 75 },
      { key: 'everyday', type: 'everyday', label: 'Spending', spent: 60 },
      { key: 'debt-entries', type: 'debt', label: 'Debt', spent: 40 },
    ])
  })

  it('keeps debt outflow drilldown separate from the debt object route', () => {
    const rows = deriveOutflowCategoryRows([
      { category_type: 'debt', amount: 500 },
    ])

    expect(rows[0]).toMatchObject({
      key: 'debt-entries',
      type: 'debt',
      label: 'Debt',
      spent: 500,
    })
  })

  it('uses category rows as the outflow total source', () => {
    const rows = deriveOutflowCategoryRows([
      { category_type: 'goal', amount: 100 },
      { category_type: 'everyday', amount: 200 },
      { category_type: 'debt', amount: 300 },
    ])

    expect(deriveOutflowTotalFromCategories(rows)).toBe(600)
  })
})
