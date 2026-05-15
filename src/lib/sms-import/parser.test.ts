import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  INCOME_SMS_BLOCKED_MESSAGE,
  parsePaymentImportText,
  parsePastExpenseCsv,
  parsePastExpenseLines,
  parseSimpleExpenseLines,
  parseSmsBlob,
  getCsvMappingRequest,
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

  it('preserves remembered custom category ids from dictionary matches', () => {
    const result = parseSmsBlob(
      'Payment confirmed. Debited KES 875 to DOG FOOD on Apr 2.',
      {
        defaultCurrency: 'KES',
        dictionary: [
          {
            nameNormalized: 'dog food',
            label: 'Dog food',
            categoryType: 'everyday',
            categoryKey: 'pets',
            customCategoryId: 'custom-pets',
            usageCount: 1,
          },
        ],
      }
    )

    expect(result.rows[0]).toEqual(expect.objectContaining({
      label: 'Dog food',
      categoryType: 'everyday',
      categoryKey: 'pets',
      customCategoryId: 'custom-pets',
      confidence: 'high',
    }))
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
    expect(rows[0].isImportedMessage).toBe(false)
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
    expect(rows[0].isImportedMessage).toBe(false)
  })

  it('splits amount-first multi-entry quick input into separate rows', () => {
    const rows = parseSimpleExpenseLines('200 water testbite 500', { defaultCurrency: 'KES' })

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ label: 'water', amount: 200, isImportedMessage: false })
    expect(rows[1]).toMatchObject({ label: 'testbite', amount: 500, isImportedMessage: false })
    expect(rows[0].sourceHash).not.toBe(rows[1].sourceHash)
  })

  it('splits label-first multi-entry quick input into separate rows', () => {
    const rows = parseSimpleExpenseLines('uber 500 lunch 300', { defaultCurrency: 'KES' })

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ label: 'uber', amount: 500 })
    expect(rows[1]).toMatchObject({ label: 'lunch', amount: 300 })
  })

  it('keeps existing one-entry formats intact', () => {
    const labelFirst = parseSimpleExpenseLines('groceries 200', { defaultCurrency: 'KES' })
    const amountFirst = parseSimpleExpenseLines('200 groceries', { defaultCurrency: 'KES' })

    expect(labelFirst).toHaveLength(1)
    expect(labelFirst[0]).toMatchObject({ label: 'groceries', amount: 200 })
    expect(amountFirst).toHaveLength(1)
    expect(amountFirst[0]).toMatchObject({ label: 'groceries', amount: 200 })
  })

  it('keeps two-word labels as a single entry when there is one amount', () => {
    const rows = parseSimpleExpenseLines('water bill 200', { defaultCurrency: 'KES' })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ label: 'water bill', amount: 200 })
  })

  it('marks parsed SMS rows as imported messages', () => {
    const result = parseSmsBlob(
      'Your account was debited KES 2,100 at Naivas on 08/04/2026.',
      { defaultCurrency: 'KES', dictionary: [] }
    )

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].isImportedMessage).toBe(true)
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

  it('parses dated past expense text rows without defaulting missing dates to today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'))

    const rows = parsePastExpenseLines(
      ['Jan 5 Uber 1200', 'Feb 2 Rent 25000', 'Uber 900'].join('\n'),
      { defaultCurrency: 'KES' }
    )

    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({
      label: 'Uber',
      amount: 1200,
      date: '2026-01-05',
      dateSource: 'explicit',
      isImportedMessage: true,
      sourceHash: '',
      sourceType: 'past_text',
    })
    expect(rows[1]).toMatchObject({
      label: 'Rent',
      amount: 25000,
      date: '2026-02-02',
    })
    expect(rows[2]).toMatchObject({
      label: 'Uber',
      amount: 900,
      date: '',
      dateSource: null,
    })
  })

  it('applies a default import month only to undated past rows', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'))

    const rows = parsePastExpenseLines(
      ['Uber 500', 'Mar 2 Rent 25000', 'Food 1200'].join('\n'),
      { defaultCurrency: 'KES', defaultImportMonth: '2026-02' }
    )

    expect(rows.map((row) => ({
      label: row.label,
      date: row.date,
      dateSource: row.dateSource,
    }))).toEqual([
      { label: 'Uber', date: '2026-02-01', dateSource: 'default_month' },
      { label: 'Rent', date: '2026-03-02', dateSource: 'explicit' },
      { label: 'Food', date: '2026-02-01', dateSource: 'default_month' },
    ])
  })

  it('parses comma-separated past expense rows', () => {
    const rows = parsePastExpenseLines('2026-01-05, Uber, 1200', { defaultCurrency: 'KES' })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      label: 'Uber',
      amount: 1200,
      date: '2026-01-05',
      sourceType: 'pasted_table',
    })
  })

  it('parses tab-separated pasted spreadsheet rows with a header and category', () => {
    const rows = parsePastExpenseLines(
      ['Date\tName\tAmount\tCategory', '2026-03-12\tNaivas\t3400\tGroceries'].join('\n'),
      { defaultCurrency: 'KES' }
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      label: 'Naivas',
      amount: 3400,
      date: '2026-03-12',
      categoryType: 'everyday',
      categoryKey: 'groceries',
      confidence: 'high',
      sourceType: 'pasted_table',
    })
  })

  it('parses CSV headers, quoted values, escaped quotes, and category columns', () => {
    const rows = parsePastExpenseCsv(
      ['Transaction Date,Description,Amount,Category,Note', '2026-01-05,"Uber, airport",1200,Transport,"Driver said ""thanks"""'].join('\n'),
      { defaultCurrency: 'KES' }
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      label: 'Uber, airport',
      amount: 1200,
      date: '2026-01-05',
      dateSource: 'explicit',
      categoryType: 'everyday',
      categoryKey: 'transport',
      confidence: 'high',
      sourceType: 'csv',
    })
  })

  it('applies the default month only to undated CSV rows', () => {
    const rows = parsePastExpenseCsv(
      ['Date,Payee,Debit', ',Uber,500', '2026-03-02,Rent,25000'].join('\n'),
      { defaultCurrency: 'KES', defaultImportMonth: '2026-02' }
    )

    expect(rows.map((row) => ({
      label: row.label,
      date: row.date,
      dateSource: row.dateSource,
    }))).toEqual([
      { label: 'Uber', date: '2026-02-01', dateSource: 'default_month' },
      { label: 'Rent', date: '2026-03-02', dateSource: 'explicit' },
    ])
  })

  it('detects when a CSV header needs manual column mapping', () => {
    expect(getCsvMappingRequest(['When,Thing,Cost', '2026-01-05,Uber,1200'].join('\n'))).toEqual({
      headers: ['When', 'Thing', 'Cost'],
      missing: ['name'],
    })
  })
})
