import { describe, expect, it } from 'vitest'
import {
  buildNeedsCategoryMetaLabel,
  buildRowMetaLabel,
  getInitialEditStepForRow,
  getNextEditableRowIndex,
  getPreviousStepForActiveRow,
  getQueueGuidanceCopy,
  getQueueSaveHelperCopy,
  getReviewRowActionLabel,
  getSuggestedCategoryOptions,
  shouldAutoOpenSingleQuickTypedCategoryRow,
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

  it('returns single unresolved queue guidance copy', () => {
    expect(getQueueGuidanceCopy(1)).toEqual({
      summary: null,
      instruction: 'Tap the expense below to choose a category.',
    })
    expect(getQueueSaveHelperCopy(1)).toBe('Choose a category to continue.')
  })

  it('returns multi-entry queue guidance copy', () => {
    expect(getQueueGuidanceCopy(3)).toEqual({
      summary: '3 expenses need categories',
      instruction: 'Tap each expense to finish setup.',
    })
    expect(getQueueSaveHelperCopy(2)).toBe('Choose categories for 2 expenses to continue.')
  })

  it('returns actionable labels for unresolved and resolved rows', () => {
    expect(
      getReviewRowActionLabel({
        needsCategory: true,
        hasHardError: false,
        isBlocked: false,
      })
    ).toBe('Add category')

    expect(
      getReviewRowActionLabel({
        needsCategory: false,
        hasHardError: false,
        isBlocked: false,
      })
    ).toBe('Ready')
  })

  it('auto-opens the category step for a single quick typed unresolved row', () => {
    expect(
      shouldAutoOpenSingleQuickTypedCategoryRow([
        {
          isImportedMessage: false,
          label: 'rice',
          amount: 200,
          categoryType: null,
          categoryKey: '',
          blockedReason: null,
        },
      ])
    ).toBe(true)
  })

  it('also auto-opens single quick typed rows that will land on details or review instead of the review list', () => {
    expect(
      shouldAutoOpenSingleQuickTypedCategoryRow([
        {
          isImportedMessage: false,
          label: 'rice',
          amount: 0,
          categoryType: null,
          categoryKey: '',
          blockedReason: null,
        },
      ])
    ).toBe(true)

    expect(
      shouldAutoOpenSingleQuickTypedCategoryRow([
        {
          isImportedMessage: false,
          label: 'uber',
          amount: 1200,
          categoryType: 'everyday',
          categoryKey: 'transport',
          blockedReason: null,
        },
      ])
    ).toBe(true)
  })

  it('does not auto-open category for imported, blocked, or multi-row results', () => {
    expect(
      shouldAutoOpenSingleQuickTypedCategoryRow([
        {
          isImportedMessage: true,
          label: 'Naivas',
          amount: 200,
          categoryType: null,
          categoryKey: '',
          blockedReason: null,
        },
      ])
    ).toBe(false)

    expect(
      shouldAutoOpenSingleQuickTypedCategoryRow([
        {
          isImportedMessage: false,
          label: 'rice',
          amount: 200,
          categoryType: null,
          categoryKey: '',
          blockedReason: null,
        },
        {
          isImportedMessage: false,
          label: 'beans',
          amount: 100,
          categoryType: null,
          categoryKey: '',
          blockedReason: null,
        },
      ])
    ).toBe(false)

    expect(
      shouldAutoOpenSingleQuickTypedCategoryRow([
        {
          isImportedMessage: false,
          label: 'rice',
          amount: 200,
          categoryType: null,
          categoryKey: '',
          blockedReason: 'blocked',
        },
      ])
    ).toBe(false)
  })

  it('returns details back to the step that opened it when provided', () => {
    expect(
      getPreviousStepForActiveRow({
        currentStep: 'details',
        isImportedMessage: false,
        detailsReturnStep: 'category',
      })
    ).toBe('category')

    expect(
      getPreviousStepForActiveRow({
        currentStep: 'details',
        isImportedMessage: false,
        detailsReturnStep: 'review',
      })
    ).toBe('review')
  })
})
