import { describe, expect, it } from 'vitest'
import { parseSmsBlob } from './parser'

describe('sms import parser', () => {
  it('parses debit rows and skips credit rows', () => {
    const result = parseSmsBlob(
      [
        'Your account was debited KES 2,100 at Naivas on 08/04/2026.',
        'Your account was credited KES 15,000 salary on 08/04/2026.',
      ].join('\n'),
      { defaultCurrency: 'KES', dictionary: [] }
    )

    expect(result.scanned).toBe(2)
    expect(result.skippedCredits).toBe(1)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].amount).toBe(2100)
    expect(result.rows[0].categoryType).toBe('everyday')
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
})
