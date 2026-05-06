import { describe, expect, it } from 'vitest'
import {
  DUPLICATE_MESSAGE,
  getSmsImportReviewState,
  isBlockedIncomeRow,
  isDuplicateBlockedRow,
} from './state'

describe('sms import review state', () => {
  it('treats duplicate rows as hard-blocked and not valid to save', () => {
    const state = getSmsImportReviewState({
      rows: [{ id: 'row-1', blockedReason: null }],
      rowErrors: { 'row-1': [DUPLICATE_MESSAGE] },
      getClientIssues: () => [],
    })

    expect(state.savableRows).toHaveLength(1)
    expect(state.validSavableRows).toHaveLength(0)
    expect(state.hasHardBlockedRows).toBe(true)
    expect(state.hasDuplicateBlockedRows).toBe(true)
    expect(isDuplicateBlockedRow('row-1', { 'row-1': [DUPLICATE_MESSAGE] })).toBe(true)
  })

  it('allows valid rows to save while income-blocked rows stay excluded', () => {
    const state = getSmsImportReviewState({
      rows: [
        { id: 'income', blockedReason: 'This looks like money received, so it can’t be saved as an expense.' },
        { id: 'expense', blockedReason: null },
      ],
      rowErrors: {},
      getClientIssues: () => [],
    })

    expect(isBlockedIncomeRow({ id: 'income', blockedReason: 'blocked' })).toBe(true)
    expect(state.savableRows.map((row) => row.id)).toEqual(['expense'])
    expect(state.validSavableRows.map((row) => row.id)).toEqual(['expense'])
    expect(state.hasHardBlockedRows).toBe(false)
  })
})
