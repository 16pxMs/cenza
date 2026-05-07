import { describe, expect, it } from 'vitest'

import {
  canEditSave,
  getEditCategorySummary,
  getEditDetailsPrimaryLabel,
  getEditDetailsSecondaryLabel,
  isEditDetailsValid,
  resolveEditSuccessHref,
} from './presentation'

describe('EditEntryFlowClient helpers', () => {
  it('shows Save instead of Continue on the details screen', () => {
    expect(getEditDetailsPrimaryLabel()).toBe('Save')
    expect(getEditDetailsSecondaryLabel()).toBe('Cancel')
  })

  it('shows the existing saved category on the details screen', () => {
    expect(getEditCategorySummary({
      name: 'Tennis court',
      amount: '500',
      date: '2026-05-06',
      note: 'Imported from SMS',
      categoryKey: 'transport',
    })).toBe('Transport')
  })

  it('requires explicit category selection before the edit can save', () => {
    expect(canEditSave({
      name: 'Tennis court',
      amount: '500',
      date: '2026-05-06',
      note: '',
      categoryKey: null,
    })).toBe(false)

    expect(canEditSave({
      name: 'Tennis court',
      amount: '500',
      date: '2026-05-06',
      note: '',
      categoryKey: 'sports',
    })).toBe(true)
  })

  it('still validates details before save', () => {
    expect(isEditDetailsValid({
      name: '   ',
      amount: '500',
      date: '2026-05-06',
      note: '',
      categoryKey: 'sports',
    })).toBe(false)
  })

  it('resolves cancel/save navigation back to returnTo when provided', () => {
    expect(resolveEditSuccessHref('txn-1', '/log')).toBe('/log')
    expect(resolveEditSuccessHref('txn-1')).toBe('/log/txn-1')
  })
})
