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
  getReviewRowPrimaryLabel,
  getReviewRowPrimaryOutcome,
  getSuggestedCategoryOptions,
  replaceEditedReviewRow,
  shouldShowReviewReminder,
  shouldSaveSingleCompletedReviewRow,
  shouldAutoOpenSingleEntryEditFlow,
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

  it('sends multi-entry quick typed rows with a category straight to per-row review step', () => {
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

  it('sends single-entry quick typed rows with a category straight to edit details, skipping per-row review', () => {
    expect(
      getInitialEditStepForRow(
        {
          isImportedMessage: false,
          label: 'uber',
          amount: 1200,
          categoryType: 'everyday',
          categoryKey: 'transport',
        },
        { isSingleEntry: true }
      )
    ).toBe('details')
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

  it('sends multi-entry imported rows with a category straight to per-row review step', () => {
    expect(
      getInitialEditStepForRow({
        isImportedMessage: true,
        label: 'Naivas',
        amount: 2100,
        categoryType: 'everyday',
        categoryKey: 'groceries',
      })
    ).toBe('review')
  })

  it('sends single-entry imported rows with a category straight to edit details', () => {
    expect(
      getInitialEditStepForRow(
        {
          isImportedMessage: true,
          label: 'Naivas',
          amount: 2100,
          categoryType: 'everyday',
          categoryKey: 'groceries',
        },
        { isSingleEntry: true }
      )
    ).toBe('details')
  })

  it('sends imported rows without a selected category to category step', () => {
    expect(
      getInitialEditStepForRow({
        isImportedMessage: true,
        label: 'Naivas',
        amount: 2100,
        categoryType: null,
        categoryKey: '',
      })
    ).toBe('category')
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

  it('skips the details detour for single-entry imported category and falls through to close', () => {
    expect(
      getPreviousStepForActiveRow({
        currentStep: 'category',
        isImportedMessage: true,
        isSingleEntry: true,
      })
    ).toBeNull()
  })

  it('returns null from single-entry quick typed category as well so back closes to input', () => {
    expect(
      getPreviousStepForActiveRow({
        currentStep: 'category',
        isImportedMessage: false,
        isSingleEntry: true,
      })
    ).toBeNull()
  })

  it('does not send review back to category selection', () => {
    expect(
      getPreviousStepForActiveRow({
        currentStep: 'review',
        isImportedMessage: false,
      })
    ).toBeNull()
  })

  it('sends change category back to details', () => {
    expect(
      getPreviousStepForActiveRow({
        currentStep: 'changeCategory',
        isImportedMessage: false,
      })
    ).toBe('details')
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

  it('uses Save expense for one complete editable review row', () => {
    const savesImmediately = shouldSaveSingleCompletedReviewRow({
      totalRows: 1,
      editableRowCount: 1,
      isCurrentRowEditable: true,
      hasNextEditableRow: false,
      currentRowHasErrors: false,
      currentRowHasWarnings: false,
    })

    expect(savesImmediately).toBe(true)
    expect(
      getReviewRowPrimaryOutcome({
        hasNextEditableRow: false,
        savesImmediately,
      })
    ).toBe('save-expense')
    expect(
      getReviewRowPrimaryLabel({
        hasNextEditableRow: false,
        savesImmediately,
      })
    ).toBe('Save expense')
  })

  it('keeps multi-entry review row primary behavior unchanged', () => {
    expect(
      shouldSaveSingleCompletedReviewRow({
        totalRows: 2,
        editableRowCount: 2,
        isCurrentRowEditable: true,
        hasNextEditableRow: true,
        currentRowHasErrors: false,
        currentRowHasWarnings: false,
      })
    ).toBe(false)

    expect(
      getReviewRowPrimaryOutcome({
        hasNextEditableRow: true,
        savesImmediately: false,
      })
    ).toBe('next-entry')
    expect(
      getReviewRowPrimaryLabel({
        hasNextEditableRow: true,
        savesImmediately: false,
      })
    ).toBe('Next entry')
  })

  it('keeps Done for single rows that must return to review list states', () => {
    expect(
      shouldSaveSingleCompletedReviewRow({
        totalRows: 1,
        editableRowCount: 1,
        isCurrentRowEditable: true,
        hasNextEditableRow: false,
        currentRowHasErrors: false,
        currentRowHasWarnings: true,
      })
    ).toBe(false)

    expect(
      getReviewRowPrimaryOutcome({
        hasNextEditableRow: false,
        savesImmediately: false,
      })
    ).toBe('done')
    expect(
      getReviewRowPrimaryLabel({
        hasNextEditableRow: false,
        savesImmediately: false,
      })
    ).toBe('Done')
  })

  it('preserves reminder state in the immediate-save row snapshot', () => {
    const rows = [
      {
        id: 'row-1',
        label: 'Water',
        repeatsMonthly: false,
      },
    ]
    const nextRow = {
      ...rows[0],
      repeatsMonthly: true,
    }

    expect(replaceEditedReviewRow(rows, nextRow)).toEqual([
      {
        id: 'row-1',
        label: 'Water',
        repeatsMonthly: true,
      },
    ])
  })

  it('shows reminder option for eligible review rows', () => {
    expect(
      shouldShowReviewReminder({
        categoryType: 'everyday',
        hasExistingMonthlyReminder: false,
      })
    ).toBe(true)

    expect(
      shouldShowReviewReminder({
        categoryType: 'fixed',
        hasExistingMonthlyReminder: false,
      })
    ).toBe(true)

    expect(
      shouldShowReviewReminder({
        categoryType: 'debt',
        hasExistingMonthlyReminder: false,
      })
    ).toBe(false)

    expect(
      shouldShowReviewReminder({
        categoryType: 'everyday',
        hasExistingMonthlyReminder: true,
      })
    ).toBe(false)
  })

  it('auto-opens single-entry quick typed rows so they skip the review-list wrapper', () => {
    expect(
      shouldAutoOpenSingleEntryEditFlow([
        { blockedReason: null },
      ])
    ).toBe(true)
  })

  it('auto-opens single-entry imported rows so single-entry never goes through the review-list', () => {
    expect(
      shouldAutoOpenSingleEntryEditFlow([
        { blockedReason: null },
      ])
    ).toBe(true)
  })

  it('does not auto-open multi-row or blocked single rows', () => {
    expect(
      shouldAutoOpenSingleEntryEditFlow([
        { blockedReason: null },
        { blockedReason: null },
      ])
    ).toBe(false)

    expect(
      shouldAutoOpenSingleEntryEditFlow([
        { blockedReason: 'blocked' },
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
