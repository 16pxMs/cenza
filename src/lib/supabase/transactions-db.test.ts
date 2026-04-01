import { describe, expect, it } from 'vitest'
import {
  buildCategoryDeleteScope,
  buildTransactionRecord,
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
      amount: 1200,
      note: 'market run',
    })).toEqual({
      user_id: 'user-1',
      cycle_id: '2026-03-14',
      date: '2026-03-20',
      category_type: 'everyday',
      category_key: 'groceries',
      category_label: 'Groceries',
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
      amount: -400,
      note: '   ',
    }).note).toBeNull()
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
