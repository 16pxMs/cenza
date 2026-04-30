import { describe, expect, it } from 'vitest'
import { isStandardDueDateSchemaMismatch } from './route-state'

describe('isStandardDueDateSchemaMismatch', () => {
  it('recognizes the optional due date schema-mismatch error', () => {
    expect(
      isStandardDueDateSchemaMismatch(
        new Error(
          "Failed to check debt due date support: Could not find the 'standard_due_date' column of 'debts' in the schema cache"
        )
      )
    ).toBe(true)
  })

  it('does not hide unrelated probe errors', () => {
    expect(
      isStandardDueDateSchemaMismatch(
        new Error('Failed to check debt due date support: network error')
      )
    ).toBe(false)
  })
})
