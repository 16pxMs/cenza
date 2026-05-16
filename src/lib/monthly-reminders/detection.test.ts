import { describe, expect, it } from 'vitest'
import { detectSmartRecurringCandidates } from './detection'

describe('smart recurring detection', () => {
  it('detects similar merchant and amount across multiple cycles', () => {
    const candidates = detectSmartRecurringCandidates([
      { display_name: 'Netflix', amount: 1200, cycle_id: '2026-04-01', category_type: 'fixed', category_key: 'subscriptions' },
      { display_name: 'Netflix', amount: 1250, cycle_id: '2026-05-01', category_type: 'fixed', category_key: 'subscriptions' },
    ])

    expect(candidates).toEqual([
      expect.objectContaining({
        label: 'Netflix',
        categoryType: 'fixed',
        categoryKey: 'subscriptions',
        amount: 1250,
        cycleCount: 2,
        transactionCount: 2,
      }),
    ])
  })

  it('avoids candidates already tracked as monthly reminders', () => {
    const candidates = detectSmartRecurringCandidates([
      { display_name: 'Netflix', amount: 1200, cycle_id: '2026-04-01', category_type: 'fixed', category_key: 'subscriptions' },
      { display_name: 'Netflix', amount: 1200, cycle_id: '2026-05-01', category_type: 'fixed', category_key: 'subscriptions' },
    ], ['subscriptions'])

    expect(candidates).toEqual([])
  })

  it('avoids debt, uncategorized, and likely non-expense rows', () => {
    const candidates = detectSmartRecurringCandidates([
      { display_name: 'Loan repayment', amount: 5000, cycle_id: '2026-04-01', category_type: 'debt', category_key: 'debt_repayment' },
      { display_name: 'Loan repayment', amount: 5000, cycle_id: '2026-05-01', category_type: 'debt', category_key: 'debt_repayment' },
      { display_name: 'Refund from Jumia', amount: 800, cycle_id: '2026-04-01', category_type: 'everyday', category_key: 'shopping' },
      { display_name: 'Refund from Jumia', amount: 800, cycle_id: '2026-05-01', category_type: 'everyday', category_key: 'shopping' },
      { display_name: 'Mystery row', amount: 200, cycle_id: '2026-04-01', category_type: 'other', category_key: 'uncategorized' },
      { display_name: 'Mystery row', amount: 200, cycle_id: '2026-05-01', category_type: 'other', category_key: 'uncategorized' },
    ])

    expect(candidates).toEqual([])
  })

  it('requires close-enough repeated amounts', () => {
    const candidates = detectSmartRecurringCandidates([
      { display_name: 'Carrefour', amount: 1200, cycle_id: '2026-04-01', category_type: 'everyday', category_key: 'groceries' },
      { display_name: 'Carrefour', amount: 9000, cycle_id: '2026-05-01', category_type: 'everyday', category_key: 'groceries' },
    ])

    expect(candidates).toEqual([])
  })

  it('requires at least two distinct cycles before suggesting a recurring candidate', () => {
    const candidates = detectSmartRecurringCandidates([
      { display_name: 'Netflix', amount: 1200, cycle_id: '2026-05-01', category_type: 'fixed', category_key: 'subscriptions' },
      { display_name: 'Netflix', amount: 1200, cycle_id: '2026-05-01', category_type: 'fixed', category_key: 'subscriptions' },
    ])

    expect(candidates).toEqual([])
  })

  it('caps results at three candidates ordered by cycle count then amount', () => {
    const txns = [
      // Three cycles, biggest amount — should rank first.
      { display_name: 'Rent', amount: 50000, cycle_id: '2026-03-01', category_type: 'fixed' as const, category_key: 'rent' },
      { display_name: 'Rent', amount: 50000, cycle_id: '2026-04-01', category_type: 'fixed' as const, category_key: 'rent' },
      { display_name: 'Rent', amount: 50000, cycle_id: '2026-05-01', category_type: 'fixed' as const, category_key: 'rent' },
      // Two cycles, mid amount.
      { display_name: 'Netflix', amount: 1200, cycle_id: '2026-04-01', category_type: 'fixed' as const, category_key: 'subscriptions' },
      { display_name: 'Netflix', amount: 1200, cycle_id: '2026-05-01', category_type: 'fixed' as const, category_key: 'subscriptions' },
      // Two cycles, small amount.
      { display_name: 'Carrefour', amount: 800, cycle_id: '2026-04-01', category_type: 'everyday' as const, category_key: 'groceries' },
      { display_name: 'Carrefour', amount: 800, cycle_id: '2026-05-01', category_type: 'everyday' as const, category_key: 'groceries' },
      // Two cycles, smallest amount — would be the fourth candidate; should be dropped by the cap of 3.
      { display_name: 'Spotify', amount: 600, cycle_id: '2026-04-01', category_type: 'fixed' as const, category_key: 'subscriptions_spotify' },
      { display_name: 'Spotify', amount: 600, cycle_id: '2026-05-01', category_type: 'fixed' as const, category_key: 'subscriptions_spotify' },
    ]

    const candidates = detectSmartRecurringCandidates(txns)

    expect(candidates).toHaveLength(3)
    // Rent has the most cycles. Among the 2-cycle ties, larger amount ranks first.
    expect(candidates.map((c) => c.label)).toEqual(['Rent', 'Netflix', 'Carrefour'])
  })
})
