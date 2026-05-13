import { describe, expect, it } from 'vitest'
import { CATEGORY_CONFIG } from './config'
import { getGroupedCategoryOptions } from './options'

describe('category options', () => {
  it('builds selector options from category config', () => {
    const groups = getGroupedCategoryOptions(['everyday', 'fixed'])
    const optionKeys = groups.flatMap((group) => group.options.map((option) => option.key))

    expect(optionKeys).toContain('groceries')
    expect(optionKeys).toContain('internet')
    expect(optionKeys).not.toContain('debt_repayment')
    expect(optionKeys).toEqual(
      expect.arrayContaining(
        Object.values(CATEGORY_CONFIG)
          .filter((category) => category.type === 'everyday' || category.type === 'fixed')
          .map((category) => category.key)
      )
    )
  })

  it('shows both debt categories in the debt group', () => {
    const [debtGroup] = getGroupedCategoryOptions(['debt'])

    expect(debtGroup?.label).toBe('Debt')
    expect(debtGroup?.options).toEqual([
      expect.objectContaining({
        key: 'debt_repayment',
        label: 'Debt repayment',
        type: 'debt',
      }),
      expect.objectContaining({
        key: 'debt_opening_balance',
        label: 'Money I owe',
        type: 'debt',
      }),
    ])
  })
})
