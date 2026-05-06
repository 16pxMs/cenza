import { describe, expect, it } from 'vitest'
import {
  buildNeedsCategoryMetaLabel,
  buildRowMetaLabel,
  getInitialEditStepForRow,
  getNextEditableRowIndex,
  getPreviousStepForActiveRow,
  getSuggestedCategoryOptions,
  shouldShowRawMessageToggle,
} from './presentation'

describe('sms import presentation helpers', () => {
  it('shows View message only for imported message rows', () => {
    expect(shouldShowRawMessageToggle({ isImportedMessage: true })).toBe(true)
    expect(shouldShowRawMessageToggle({ isImportedMessage: false })).toBe(false)
  })

  it('excludes date from quick typed metadata', () => {
    expect(
      buildRowMetaLabel({
        amount: 200,
        currency: 'KES',
        categoryKey: 'groceries',
        categoryType: 'everyday',
        date: '2026-05-06',
        isImportedMessage: false,
      })
    ).toBe('KES 200 · Groceries')
  })

  it('includes date in imported message metadata', () => {
    expect(
      buildRowMetaLabel({
        amount: 2100,
        currency: 'KES',
        categoryKey: 'transport',
        categoryType: 'everyday',
        date: '2026-05-06',
        isImportedMessage: true,
      })
    ).toBe('KES 2,100 · Transport · May 6')
  })

  it('keeps quick typed missing-category metadata date-free', () => {
    expect(
      buildNeedsCategoryMetaLabel({
        amount: 500,
        currency: 'KES',
        date: '2026-05-06',
        isImportedMessage: false,
      })
    ).toBe('KES 500 · Choose a category')
  })

  it('finds the next editable row and skips blocked ones', () => {
    const rows = [
      { id: 'row-1', blockedReason: null },
      { id: 'row-2', blockedReason: 'blocked' },
      { id: 'row-3', blockedReason: null },
    ]

    expect(
      getNextEditableRowIndex(0, rows, (row) => !row.blockedReason)
    ).toBe(2)
    expect(
      getNextEditableRowIndex(2, rows, (row) => !row.blockedReason)
    ).toBe(-1)
  })

  it('suggests a small set of likely categories from the row label', () => {
    const groups = [
      {
        type: 'everyday' as const,
        label: 'Everyday',
        options: [
          { key: 'transport', label: 'Transport', type: 'everyday' as const },
          { key: 'eatingOut', label: 'Eating out', type: 'everyday' as const },
          { key: 'groceries', label: 'Groceries', type: 'everyday' as const },
        ],
      },
      {
        type: 'fixed' as const,
        label: 'Fixed',
        options: [
          { key: 'internet', label: 'Internet', type: 'fixed' as const },
          { key: 'water', label: 'Water', type: 'fixed' as const },
        ],
      },
    ]

    expect(
      getSuggestedCategoryOptions('uber lunch wifi', groups).map((option) => option.key)
    ).toEqual(['transport', 'eatingOut', 'internet'])
  })

  it('sends quick typed rows with no category straight to category step', () => {
    expect(
      getInitialEditStepForRow({
        isImportedMessage: false,
        label: 'groceries',
        amount: 500,
        categoryType: null,
        categoryKey: '',
      })
    ).toBe('category')
  })

  it('sends quick typed rows with a category straight to review step', () => {
    expect(
      getInitialEditStepForRow({
        isImportedMessage: false,
        label: 'uber',
        amount: 1200,
        categoryType: 'everyday',
        categoryKey: 'transport',
      })
    ).toBe('review')
  })

  it('keeps quick typed rows without a real selected category on category step even if a key exists', () => {
    expect(
      getInitialEditStepForRow({
        isImportedMessage: false,
        label: 'volani',
        amount: 199,
        categoryType: null,
        categoryKey: 'volani',
      })
    ).toBe('category')
  })

  it('sends invalid quick typed rows to details first', () => {
    expect(
      getInitialEditStepForRow({
        isImportedMessage: false,
        label: 'groceries',
        amount: 0,
        categoryType: null,
        categoryKey: '',
      })
    ).toBe('details')
  })

  it('keeps imported rows on the full details flow', () => {
    expect(
      getInitialEditStepForRow({
        isImportedMessage: true,
        label: 'Naivas',
        amount: 2100,
        categoryType: 'everyday',
        categoryKey: 'groceries',
      })
    ).toBe('details')
  })

  it('sends quick typed category back to the review list', () => {
    expect(
      getPreviousStepForActiveRow({
        currentStep: 'category',
        isImportedMessage: false,
      })
    ).toBeNull()
  })

  it('sends imported category back to details', () => {
    expect(
      getPreviousStepForActiveRow({
        currentStep: 'category',
        isImportedMessage: true,
      })
    ).toBe('details')
  })

  it('sends review back to category', () => {
    expect(
      getPreviousStepForActiveRow({
        currentStep: 'review',
        isImportedMessage: false,
      })
    ).toBe('category')
  })
})
