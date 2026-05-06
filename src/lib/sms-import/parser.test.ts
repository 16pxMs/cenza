import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  INCOME_SMS_BLOCKED_MESSAGE,
  parsePaymentImportText,
  parseSimpleExpenseLines,
  parseSmsBlob,
} from './parser'

afterEach(() => {
  vi.useRealTimers()
})

describe('sms import parser', () => {
  it('parses debit rows and returns visible blocked credit rows', () => {
    const result = parseSmsBlob(
      [
        'Your account was debited KES 2,100 at Naivas on 08/04/2026.',
        'Your account was credited KES 15,000 salary on 08/04/2026.',
      ].join('\n'),
      { defaultCurrency: 'KES', dictionary: [] }
    )

    expect(result.scanned).toBe(2)
    expect(result.skippedCredits).toBe(1)
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].amount).toBe(2100)
    expect(result.rows[0].categoryType).toBe('everyday')
    expect(result.rows[1].blockedReason).toBe(INCOME_SMS_BLOCKED_MESSAGE)
  })

  it('uses dictionary match to classify and label', () => {
    const result = parseSmsBlob(
      'Payment confirmed. Debited KES 45,000 to HOUSE RENT on Apr 2.',
      {
        defaultCurrency: 'KES',
        dictionary: [
          {
            nameNormalized: 'house rent',
            label: 'Rent',
            categoryType: 'fixed',
            categoryKey: 'rent',
            usageCount: 2,
          },
        ],
      }
    )

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].label).toBe('Rent')
    expect(result.rows[0].categoryType).toBe('fixed')
    expect(result.rows[0].categoryKey).toBe('rent')
    expect(result.rows[0].confidence).toBe('high')
  })

  it('falls back to unknown label when merchant cannot be inferred', () => {
    const result = parseSmsBlob(
      'Debit alert: KES 750 on 09/04/2026. Ref 889201.',
      { defaultCurrency: 'KES', dictionary: [] }
    )

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].label).toBe('Unknown item')
    expect(result.rows[0].categoryType).toBe('everyday')
    expect(result.rows[0].amount).toBe(750)
  })

  it('uses the SMS transaction date when the message includes day month year', () => {
    const result = parseSmsBlob(
      'Confirmed. KES 1,850 paid to Java on 29 Apr 2026.',
      { defaultCurrency: 'KES', dictionary: [] }
    )

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].date).toBe('2026-04-29')
  })

  it('falls back to today when no transaction date is present', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-30T12:00:00.000Z'))

    const rows = parseSimpleExpenseLines('food 500', { defaultCurrency: 'KES' })

    expect(rows).toHaveLength(1)
    expect(rows[0].date).toBe('2026-04-30')
  })

  it('blocks credit-like plain text rows in the single-input fallback path', () => {
    const rows = parseSimpleExpenseLines('received KES 5,000 from John', { defaultCurrency: 'KES' })

    expect(rows).toHaveLength(1)
    expect(rows[0].blockedReason).toBe(INCOME_SMS_BLOCKED_MESSAGE)
    expect(rows[0].amount).toBe(5000)
  })

  it('blocks common incoming-money wording with word boundaries only', () => {
    const received = parseSmsBlob(
      'You have received KES 5,000 from John',
      { defaultCurrency: 'KES', dictionary: [] }
    )
    const credited = parseSmsBlob(
      'Account credited with KES 2,000',
      { defaultCurrency: 'KES', dictionary: [] }
    )
    const deposit = parseSmsBlob(
      'Deposit KES 1,000 confirmed',
      { defaultCurrency: 'KES', dictionary: [] }
    )
    const paidRent = parseSmsBlob(
      'Paid rent KES 10,000',
      { defaultCurrency: 'KES', dictionary: [] }
    )
    const accredited = parseSmsBlob(
      'Accredited training KES 500',
      { defaultCurrency: 'KES', dictionary: [] }
    )

    expect(received.rows[0].blockedReason).toBe(INCOME_SMS_BLOCKED_MESSAGE)
    expect(credited.rows[0].blockedReason).toBe(INCOME_SMS_BLOCKED_MESSAGE)
    expect(deposit.rows[0].blockedReason).toBe(INCOME_SMS_BLOCKED_MESSAGE)
    expect(paidRent.rows[0].blockedReason).toBeFalsy()
    expect(accredited.rows[0].blockedReason).toBeFalsy()
  })

  it('keeps simple expense input editable', () => {
    const rows = parseSimpleExpenseLines('food 500', { defaultCurrency: 'KES' })

    expect(rows).toHaveLength(1)
    expect(rows[0].label).toBe('food')
    expect(rows[0].blockedReason).toBeFalsy()
  })

  it('parses payment import text amount, date, and reference when present', () => {
    const parsed = parsePaymentImportText(
      'Confirmed. KES 2,000 paid to Equity on 29 Apr 2026. Ref ABC123.',
      { defaultCurrency: 'KES' }
    )

    expect(parsed).toEqual({
      amount: 2000,
      currency: 'KES',
      date: '2026-04-29',
      note: 'Ref ABC123',
    })
  })

  it('returns null when payment import text has no readable amount', () => {
    const parsed = parsePaymentImportText(
      'Thanks for your payment.',
      { defaultCurrency: 'KES' }
    )

    expect(parsed).toBeNull()
  })
})
