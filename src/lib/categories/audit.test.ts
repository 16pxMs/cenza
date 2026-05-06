import { describe, expect, it } from 'vitest'
import { analyzeCategoryRow, buildCategoryAuditReport } from './audit'

describe('category audit', () => {
  it('flags legacy and mismatched category rows', () => {
    const row = analyzeCategoryRow({
      id: 'txn-1',
      category_type: 'essentials',
      category_key: 'transport',
      category_label: 'Transport',
    })

    expect(row?.flags).toContain('legacy_category_type')
    expect(row?.flags).toContain('category_type_mismatch')
    expect(row?.expectedType).toBe('everyday')
  })

  it('flags unknown label-derived keys', () => {
    const row = analyzeCategoryRow({
      id: 'txn-2',
      category_type: 'everyday',
      category_key: 'dog_food',
      category_label: 'Dog food',
    })

    expect(row?.flags).toContain('unknown_category_key')
    expect(row?.flags).toContain('likely_label_derived_key')
  })

  it('counts uniques and combinations', () => {
    const report = buildCategoryAuditReport([
      { id: '1', category_type: 'everyday', category_key: 'transport', category_label: 'Transport' },
      { id: '2', category_type: 'fixed', category_key: 'rent', category_label: 'Rent' },
      { id: '3', category_type: 'fixed', category_key: 'rent', category_label: 'Rent' },
    ])

    expect(report.totalRows).toBe(3)
    expect(report.categoryTypes[0]).toEqual({ value: 'fixed', count: 2 })
    expect(report.categoryKeys[0]).toEqual({ value: 'rent', count: 2 })
    expect(report.combinations[0]).toMatchObject({
      categoryType: 'fixed',
      categoryKey: 'rent',
      categoryLabel: 'Rent',
      count: 2,
    })
  })
})
