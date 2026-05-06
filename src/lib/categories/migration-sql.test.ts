import { describe, expect, it } from 'vitest'
import { buildCategoryMigrationSqlPlan } from './migration-sql'

describe('category migration sql', () => {
  it('skips valid rows and creates deterministic updates for non-valid rows', () => {
    const plan = buildCategoryMigrationSqlPlan([
      {
        id: 'txn-valid',
        category_type: 'everyday',
        category_key: 'transport',
        category_label: 'Transport',
      },
      {
        id: 'txn-key',
        category_type: 'everyday',
        category_key: 'uber',
        category_label: 'Uber',
      },
      {
        id: 'txn-label',
        category_type: 'fixed',
        category_key: 'rent',
        category_label: 'House payment',
      },
      {
        id: 'txn-type',
        category_type: 'essentials',
        category_key: 'transport',
        category_label: 'Transport',
      },
    ])

    expect(plan.summary).toEqual({
      total_updates: 3,
      key_updates: 1,
      label_updates: 2,
      type_updates: 2,
    })
    expect(plan.updateRows.map((row) => row.id)).toEqual(['txn-key', 'txn-label', 'txn-type'])
    expect(plan.previewQuery).toContain(`'txn-key'`)
    expect(plan.previewQuery).toContain(`'txn-label'`)
    expect(plan.previewQuery).toContain(`'txn-type'`)
    expect(plan.previewQuery).not.toContain(`'txn-valid'`)
    expect(plan.transactionSql).toContain('BEGIN;')
    expect(plan.transactionSql).toContain('COMMIT;')
  })

  it('groups identical update statements safely by id', () => {
    const plan = buildCategoryMigrationSqlPlan([
      {
        id: 'txn-1',
        category_type: 'everyday',
        category_key: 'uber',
        category_label: 'Uber',
      },
      {
        id: 'txn-2',
        category_type: 'everyday',
        category_key: 'boda',
        category_label: 'Boda',
      },
    ])

    expect(plan.updateQueries).toHaveLength(1)
    expect(plan.updateQueries[0]).toContain(`WHERE id IN ('txn-1', 'txn-2');`)
    expect(plan.updateQueries[0]).toContain(`category_key = 'transport'`)
    expect(plan.updateQueries[0]).toContain(`category_label = 'Transport'`)
    expect(plan.updateQueries[0]).toContain(`category_type = 'everyday'`)
  })

  it('generates family_support everyday updates for blackTax rows', () => {
    const plan = buildCategoryMigrationSqlPlan([
      {
        id: 'txn-black-tax',
        category_type: 'fixed',
        category_key: 'blackTax',
        category_label: 'Family support',
      },
    ])

    expect(plan.summary).toEqual({
      total_updates: 1,
      key_updates: 1,
      label_updates: 1,
      type_updates: 1,
    })
    expect(plan.updateQueries[0]).toContain(`category_key = 'family_support'`)
    expect(plan.updateQueries[0]).toContain(`category_label = 'Family support'`)
    expect(plan.updateQueries[0]).toContain(`category_type = 'everyday'`)
    expect(plan.updateQueries[0]).not.toContain(`category_key = 'blackTax'`)
  })
})
