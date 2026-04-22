import { describe, expect, it, vi } from 'vitest'
import {
  readMonthlyReminderEntries,
  readPlannedMonthlyEntries,
  saveMonthlyReminderEntryForCycle,
  savePlannedMonthlyEntriesForCycle,
} from './storage'

function makeSupabase(existingEntries: unknown[]) {
  const upsert = vi.fn().mockResolvedValue({ error: null })
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { entries: existingEntries },
    error: null,
  })
  const eqCycle = vi.fn(() => ({ maybeSingle }))
  const eqUser = vi.fn(() => ({ eq: eqCycle }))
  const select = vi.fn(() => ({ eq: eqUser }))

  const supabase = {
    from: vi.fn((table: string) => {
      if (table !== 'fixed_expenses') throw new Error(`Unexpected table ${table}`)
      return { select, upsert }
    }),
  }

  return { supabase, upsert }
}

describe('monthly reminder storage adapter', () => {
  it('marks legacy untyped rows as planned and excludes reminders from planned reads', () => {
    const entries = [
      { key: 'rent', label: 'Rent', monthly: 1000 },
      { key: 'spending_groceries', label: 'Groceries', monthly: 200, reminder: true },
    ]

    expect(readPlannedMonthlyEntries(entries)).toEqual([
      { key: 'rent', label: 'Rent', monthly: 1000, entry_type: 'planned', priority: 'core' },
    ])
    expect(readMonthlyReminderEntries(entries)).toEqual([
      {
        key: 'spending_groceries',
        label: 'Groceries',
        monthly: 200,
        reminder: true,
        entry_type: 'monthly_reminder',
        priority: 'core',
      },
    ])
  })

  it('creating a monthly reminder does not change financial totals', async () => {
    const { supabase, upsert } = makeSupabase([
      { key: 'rent', label: 'Rent', monthly: 1000 },
    ])

    await saveMonthlyReminderEntryForCycle(supabase, 'user-1', '2026-04-01', {
      key: 'spending_groceries',
      label: 'Groceries',
      monthly: 200,
    })

    expect(upsert).toHaveBeenCalledWith({
      user_id: 'user-1',
      cycle_id: '2026-04-01',
      total_monthly: 1000,
      entries: [
        { key: 'rent', label: 'Rent', monthly: 1000, entry_type: 'planned', priority: 'core' },
        {
          key: 'spending_groceries',
          label: 'Groceries',
          monthly: 200,
          reminder: true,
          entry_type: 'monthly_reminder',
          confidence: 'known',
          priority: 'flex',
        },
      ],
    }, { onConflict: 'user_id,cycle_id' })
  })

  it('creating a planned monthly entry changes financial totals', async () => {
    const { supabase, upsert } = makeSupabase([
      {
        key: 'spending_groceries',
        label: 'Groceries',
        monthly: 200,
        reminder: true,
        entry_type: 'monthly_reminder',
      },
    ])

    await savePlannedMonthlyEntriesForCycle(supabase, 'user-1', '2026-04-01', [
      { key: 'rent', label: 'Rent', monthly: 1000, confidence: 'known' },
      { key: 'internet', label: 'Internet', monthly: 250, confidence: 'known' },
    ])

    expect(upsert).toHaveBeenCalledWith({
      user_id: 'user-1',
      cycle_id: '2026-04-01',
      total_monthly: 1250,
      entries: [
        { key: 'rent', label: 'Rent', monthly: 1000, entry_type: 'planned', confidence: 'known', priority: 'core' },
        { key: 'internet', label: 'Internet', monthly: 250, entry_type: 'planned', confidence: 'known', priority: 'core' },
        {
          key: 'spending_groceries',
          label: 'Groceries',
          monthly: 200,
          reminder: true,
          entry_type: 'monthly_reminder',
          priority: 'core',
        },
      ],
    }, { onConflict: 'user_id,cycle_id' })
  })
})
