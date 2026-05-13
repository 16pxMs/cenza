import { describe, expect, it } from 'vitest'
import {
  buildCategoryDeleteScope,
  buildTransactionRecord,
  resolveTransactionCategoryForWrite,
} from './transactions-db'

describe('buildTransactionRecord', () => {
  it('includes the full transaction contract fields', () => {
    expect(buildTransactionRecord({
      userId: 'user-1',
      cycleId: '2026-03-14',
      date: '2026-03-20',
      categoryType: 'everyday',
      categoryKey: 'groceries',
      categoryLabel: 'Groceries',
      displayName: 'Market run',
      amount: 1200,
      note: 'market run',
    })).toEqual({
      user_id: 'user-1',
      cycle_id: '2026-03-14',
      date: '2026-03-20',
      category_type: 'everyday',
      category_key: 'groceries',
      category_label: 'Groceries',
      custom_category_id: null,
      display_name: 'Market run',
      amount: 1200,
      note: 'market run',
    })
  })

  it('normalizes empty note values to null', () => {
    expect(buildTransactionRecord({
      userId: 'user-1',
      cycleId: '2026-03-14',
      date: '2026-03-20',
      categoryType: 'goal',
      categoryKey: 'emergency',
      categoryLabel: 'Emergency Fund',
      displayName: 'Emergency Fund',
      amount: -400,
      note: '   ',
    }).note).toBeNull()
  })

  it('derives canonical type and label from the category config', () => {
    expect(buildTransactionRecord({
      userId: 'user-1',
      cycleId: '2026-03-14',
      date: '2026-03-20',
      categoryType: 'fixed',
      categoryKey: 'wifi',
      categoryLabel: 'Home WiFi',
      displayName: 'Home WiFi',
      amount: 1200,
      note: 'market run',
    })).toEqual({
      user_id: 'user-1',
      cycle_id: '2026-03-14',
      date: '2026-03-20',
      category_type: 'fixed',
      category_key: 'internet',
      category_label: 'Internet',
      custom_category_id: null,
      display_name: 'Home WiFi',
      amount: 1200,
      note: 'market run',
    })
  })

  it('rejects unknown category keys before insert', () => {
    expect(() =>
      buildTransactionRecord({
        userId: 'user-1',
        cycleId: '2026-03-14',
        date: '2026-03-20',
        categoryType: 'everyday',
        categoryKey: 'custom_dog_food',
        categoryLabel: 'Dog Food',
        displayName: 'Dog Food',
        amount: 1200,
        note: null,
      })
    ).toThrow('Unknown category key: custom_dog_food')
  })

  it('writes custom category snapshots when a validated custom category is supplied', () => {
    expect(buildTransactionRecord({
      userId: 'user-1',
      cycleId: '2026-03-14',
      date: '2026-03-20',
      categoryType: 'everyday',
      categoryKey: 'pets',
      categoryLabel: 'Pets',
      customCategory: {
        categoryType: 'everyday',
        categoryKey: 'pets',
        categoryLabel: 'Pets',
        customCategoryId: 'custom-1',
      },
      displayName: 'Dog food',
      amount: 1200,
      note: null,
    })).toEqual({
      user_id: 'user-1',
      cycle_id: '2026-03-14',
      date: '2026-03-20',
      category_type: 'everyday',
      category_key: 'pets',
      category_label: 'Pets',
      custom_category_id: 'custom-1',
      display_name: 'Dog food',
      amount: 1200,
      note: null,
    })
  })

  it('rejects blank display names before insert', () => {
    expect(() =>
      buildTransactionRecord({
        userId: 'user-1',
        cycleId: '2026-03-14',
        date: '2026-03-20',
        categoryType: 'everyday',
        categoryKey: 'groceries',
        categoryLabel: 'Groceries',
        displayName: '   ',
        amount: 1200,
        note: null,
      })
    ).toThrow('Display name is required')
  })
})

describe('resolveTransactionCategoryForWrite', () => {
  it('resolves a valid key to the canonical type and label', () => {
    expect(resolveTransactionCategoryForWrite({
      categoryType: 'everyday',
      categoryKey: 'groceries',
      categoryLabel: 'Anything',
    })).toEqual({
      categoryType: 'everyday',
      categoryKey: 'groceries',
      categoryLabel: 'Groceries',
      customCategoryId: null,
    })
  })

  it('rejects unknown keys', () => {
    expect(() =>
      resolveTransactionCategoryForWrite({
        categoryType: 'everyday',
        categoryKey: 'totally_unknown_key',
        categoryLabel: 'Anything',
      })
    ).toThrow('Unknown category key: totally_unknown_key')
  })
})

describe('buildCategoryDeleteScope', () => {
  it('scopes deletes to user, cycle, and category key', () => {
    expect(buildCategoryDeleteScope({
      userId: 'user-1',
      cycleId: '2026-03-14',
      categoryKey: 'rent',
    })).toEqual({
      user_id: 'user-1',
      cycle_id: '2026-03-14',
      category_key: 'rent',
    })
  })
})
