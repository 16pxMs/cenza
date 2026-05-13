import { describe, expect, it } from 'vitest'
import {
  deriveCategoryBreakdown,
  type CategoryBreakdownTransaction,
} from './category-breakdown'

function txn(partial: CategoryBreakdownTransaction): CategoryBreakdownTransaction {
  return partial
}

describe('deriveCategoryBreakdown', () => {
  it('returns an empty list for no input', () => {
    expect(deriveCategoryBreakdown([])).toEqual([])
  })

  it('groups transport transactions under one canonical row', () => {
    const rows = deriveCategoryBreakdown([
      txn({ category_type: 'everyday', category_key: 'transport', amount: 200 }),
      txn({ category_type: 'everyday', category_key: 'transport', amount: 350 }),
      txn({ category_type: 'everyday', category_key: 'transport', amount: 150 }),
    ])

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      categoryKey: 'transport',
      categoryLabel: 'Transport',
      categoryType: 'everyday',
      totalAmount: 700,
      transactionCount: 3,
    })
  })

  it('uses CATEGORY_CONFIG labels rather than the row label field', () => {
    const rows = deriveCategoryBreakdown([
      txn({ category_type: 'fixed', category_key: 'internet', category_label: 'My ISP', amount: 4000 }),
    ])

    expect(rows[0].categoryLabel).toBe('Internet')
    expect(rows[0].categoryType).toBe('fixed')
  })

  it('excludes debt_opening_balance from the breakdown', () => {
    const rows = deriveCategoryBreakdown([
      txn({ category_type: 'debt', category_key: 'debt_opening_balance', amount: 50000 }),
      txn({ category_type: 'debt', category_key: 'debt_repayment', amount: 5000 }),
      txn({ category_type: 'everyday', category_key: 'groceries', amount: 2500 }),
    ])

    expect(rows.map((row) => row.categoryKey)).toEqual(['debt_repayment', 'groceries'])
    expect(rows.find((row) => row.categoryKey === 'debt_opening_balance')).toBeUndefined()
  })

  it('excludes non-positive amounts (refunds/credits)', () => {
    const rows = deriveCategoryBreakdown([
      txn({ category_type: 'everyday', category_key: 'groceries', amount: 1000 }),
      txn({ category_type: 'everyday', category_key: 'groceries', amount: -200 }),
      txn({ category_type: 'everyday', category_key: 'groceries', amount: 0 }),
    ])

    expect(rows).toHaveLength(1)
    expect(rows[0].totalAmount).toBe(1000)
    expect(rows[0].transactionCount).toBe(1)
  })

  it('excludes transfers represented as transactions', () => {
    const rows = deriveCategoryBreakdown([
      txn({ category_type: 'transfer', category_key: 'savings_transfer', amount: 5000 }),
      txn({ category_type: 'everyday', category_key: 'groceries', amount: 1000 }),
    ])

    expect(rows.map((row) => row.categoryKey)).toEqual(['groceries'])
  })

  it('skips rows without a category_key', () => {
    const rows = deriveCategoryBreakdown([
      txn({ category_type: 'everyday', category_key: null, amount: 500 }),
      txn({ category_type: 'everyday', category_key: '   ', amount: 500 }),
      txn({ category_type: 'everyday', category_key: 'groceries', amount: 800 }),
    ])

    expect(rows).toHaveLength(1)
    expect(rows[0].categoryKey).toBe('groceries')
  })

  it('sorts rows by totalAmount descending', () => {
    const rows = deriveCategoryBreakdown([
      txn({ category_type: 'everyday', category_key: 'groceries', amount: 1500 }),
      txn({ category_type: 'fixed',    category_key: 'rent',      amount: 45000 }),
      txn({ category_type: 'everyday', category_key: 'transport', amount: 3000 }),
      txn({ category_type: 'fixed',    category_key: 'internet',  amount: 4000 }),
    ])

    expect(rows.map((row) => row.categoryKey)).toEqual([
      'rent',
      'internet',
      'transport',
      'groceries',
    ])
  })

  it('breaks ties by categoryKey ascending', () => {
    const rows = deriveCategoryBreakdown([
      txn({ category_type: 'everyday', category_key: 'transport', amount: 1000 }),
      txn({ category_type: 'everyday', category_key: 'groceries', amount: 1000 }),
      txn({ category_type: 'fixed',    category_key: 'internet',  amount: 1000 }),
    ])

    expect(rows.map((row) => row.categoryKey)).toEqual(['groceries', 'internet', 'transport'])
  })

  it('counts transactions per category bucket', () => {
    const rows = deriveCategoryBreakdown([
      txn({ category_type: 'everyday', category_key: 'eatingOut', amount: 500 }),
      txn({ category_type: 'everyday', category_key: 'eatingOut', amount: 700 }),
      txn({ category_type: 'everyday', category_key: 'eatingOut', amount: 1200 }),
      txn({ category_type: 'fixed',    category_key: 'rent',      amount: 45000 }),
    ])

    const eatingOut = rows.find((row) => row.categoryKey === 'eatingOut')
    expect(eatingOut?.transactionCount).toBe(3)
    expect(rows.find((row) => row.categoryKey === 'rent')?.transactionCount).toBe(1)
  })

  it('produces percentages that sum to 100 across included rows', () => {
    const rows = deriveCategoryBreakdown([
      txn({ category_type: 'fixed',    category_key: 'rent',      amount: 30000 }),
      txn({ category_type: 'everyday', category_key: 'groceries', amount: 10000 }),
      txn({ category_type: 'everyday', category_key: 'transport', amount: 10000 }),
    ])

    const total = rows.reduce((sum, row) => sum + row.percentageOfTotal, 0)
    expect(total).toBeCloseTo(100, 6)
    expect(rows.find((row) => row.categoryKey === 'rent')?.percentageOfTotal).toBeCloseTo(60, 6)
    expect(rows.find((row) => row.categoryKey === 'groceries')?.percentageOfTotal).toBeCloseTo(20, 6)
  })

  it('excluded rows do not contribute to the percentage denominator', () => {
    const rows = deriveCategoryBreakdown([
      txn({ category_type: 'debt', category_key: 'debt_opening_balance', amount: 90000 }),
      txn({ category_type: 'everyday', category_key: 'groceries',         amount: 4000 }),
      txn({ category_type: 'everyday', category_key: 'transport',         amount: 1000 }),
    ])

    expect(rows.find((row) => row.categoryKey === 'groceries')?.percentageOfTotal).toBeCloseTo(80, 6)
    expect(rows.find((row) => row.categoryKey === 'transport')?.percentageOfTotal).toBeCloseTo(20, 6)
  })

  it('coerces string amounts to numbers', () => {
    const rows = deriveCategoryBreakdown([
      txn({ category_type: 'everyday', category_key: 'groceries', amount: '1500.50' }),
      txn({ category_type: 'everyday', category_key: 'groceries', amount: '500' }),
    ])

    expect(rows[0].totalAmount).toBeCloseTo(2000.5, 6)
  })

  it('can produce a category total greater than any single transaction in that category', () => {
    const rows = deriveCategoryBreakdown([
      txn({ category_type: 'everyday', category_key: 'family_support', category_label: 'Family support', amount: 18400 }),
      txn({ category_type: 'everyday', category_key: 'family_support', category_label: 'Family support', amount: 6000 }),
      txn({ category_type: 'everyday', category_key: 'family_support', category_label: 'Family support', amount: 3500 }),
      txn({ category_type: 'everyday', category_key: 'family_support', category_label: 'Family support', amount: 2000 }),
    ])

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      categoryKey: 'family_support',
      categoryLabel: 'Family support',
      totalAmount: 29900,
      transactionCount: 4,
    })
  })

  it('falls back to row label/type when key is unknown to CATEGORY_CONFIG', () => {
    const rows = deriveCategoryBreakdown([
      txn({
        category_type: 'everyday',
        category_key: 'made_up_category',
        category_label: 'Made up',
        amount: 500,
      }),
    ])

    expect(rows[0]).toMatchObject({
      categoryKey: 'made_up_category',
      categoryLabel: 'Made up',
      categoryType: 'everyday',
    })
  })

  it('groups custom category transactions by custom category id before key', () => {
    const rows = deriveCategoryBreakdown([
      txn({
        category_type: 'everyday',
        category_key: 'custom_pet_bucket',
        category_label: 'Pets',
        custom_category_id: 'custom-pets',
        amount: 500,
      }),
      txn({
        category_type: 'everyday',
        category_key: 'custom_pet_bucket',
        category_label: 'Pet supplies',
        custom_category_id: 'custom-pets',
        amount: 700,
      }),
      txn({
        category_type: 'everyday',
        category_key: 'custom_pet_bucket',
        category_label: 'Pets canonical-ish',
        amount: 300,
      }),
    ])

    expect(rows).toEqual([
      expect.objectContaining({
        categoryKey: 'custom_pet_bucket',
        customCategoryId: 'custom-pets',
        categoryLabel: 'Pets',
        totalAmount: 1200,
        transactionCount: 2,
      }),
      expect.objectContaining({
        categoryKey: 'custom_pet_bucket',
        customCategoryId: null,
        categoryLabel: 'Pets canonical-ish',
        totalAmount: 300,
        transactionCount: 1,
      }),
    ])
  })
})
