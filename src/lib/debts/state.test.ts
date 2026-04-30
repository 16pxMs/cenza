import { describe, expect, it } from 'vitest'
import { getDebtDetailState, getDebtListVisibility, isDebtSettled } from './state'

describe('debt state helpers', () => {
  it('shows positive-balance active debts in the active list', () => {
    expect(getDebtListVisibility({ status: 'active', current_balance: 1200 })).toBe('active')
  })

  it('shows cleared debts only in settled view', () => {
    expect(getDebtListVisibility({ status: 'cleared', current_balance: 0 })).toBe('settled')
    expect(isDebtSettled({ status: 'cleared', current_balance: 0 })).toBe(true)
  })

  it('shows zero-balance active debts in settled view', () => {
    expect(getDebtListVisibility({ status: 'active', current_balance: 0 })).toBe('settled')
  })

  it('hides cancelled debts from both list views', () => {
    expect(getDebtListVisibility({ status: 'cancelled', current_balance: 0 })).toBe('hidden')
    expect(getDebtListVisibility({ status: 'cancelled', current_balance: 500 })).toBe('hidden')
  })

  it('keeps orphaned active debt behavior separate from settled debt behavior', () => {
    expect(getDebtDetailState({ status: 'active', current_balance: 500 }, false)).toBe('orphaned')
    expect(getDebtDetailState({ status: 'cleared', current_balance: 0 }, false)).toBe('settled')
    expect(getDebtDetailState({ status: 'active', current_balance: 500 }, true)).toBe('active')
  })
})
