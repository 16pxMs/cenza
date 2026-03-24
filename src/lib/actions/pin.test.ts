import { describe, it, expect } from 'vitest'

// PIN validation regex — extracted here so we can test it without mocking Next.js internals
const PIN_REGEX = /^\d{4}$/

describe('PIN validation', () => {
  it('accepts 4-digit strings', () => {
    expect(PIN_REGEX.test('1234')).toBe(true)
    expect(PIN_REGEX.test('0000')).toBe(true)
    expect(PIN_REGEX.test('9999')).toBe(true)
  })

  it('rejects fewer than 4 digits', () => {
    expect(PIN_REGEX.test('123')).toBe(false)
    expect(PIN_REGEX.test('')).toBe(false)
  })

  it('rejects more than 4 digits', () => {
    expect(PIN_REGEX.test('12345')).toBe(false)
  })

  it('rejects non-digit characters', () => {
    expect(PIN_REGEX.test('abcd')).toBe(false)
    expect(PIN_REGEX.test('12ab')).toBe(false)
    expect(PIN_REGEX.test('12 4')).toBe(false)
  })
})
