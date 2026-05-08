import { beforeEach, describe, expect, it, vi } from 'vitest'

const createServerSupabaseClient = vi.fn()
const deriveCurrentCycleId = vi.fn()
const loadMonthlyReminderEntriesForCycle = vi.fn()

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient }))
vi.mock('@/lib/supabase/cycles-db', async () => {
  const actual = await vi.importActual<typeof import('@/lib/supabase/cycles-db')>('@/lib/supabase/cycles-db')
  return {
    ...actual,
    deriveCurrentCycleId,
  }
})
vi.mock('@/lib/monthly-reminders/storage', () => ({
  loadMonthlyReminderEntriesForCycle,
}))

function makeLogSupabase(rows: any[]) {
  return {
    from: vi.fn((table: string) => {
      if (table !== 'transactions') {
        throw new Error(`Unexpected table ${table}`)
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: rows }),
              maybeSingle: vi.fn().mockResolvedValue({ data: rows[0] ?? null }),
            })),
          })),
        })),
      }
    }),
  }
}

describe('log loader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    deriveCurrentCycleId.mockReturnValue('2026-05-01')
    loadMonthlyReminderEntriesForCycle.mockResolvedValue([])
  })

  it('keeps the original transaction name and exposes category label separately', async () => {
    createServerSupabaseClient.mockResolvedValue(
      makeLogSupabase([
        {
          id: 'txn-1',
          display_name: 'Uber for Ciiku',
          category_key: 'transport',
          category_label: 'Transport',
          category_type: 'everyday',
          amount: 1200,
          date: '2026-05-06',
          note: null,
          created_at: '2026-05-06T08:00:00Z',
        },
        {
          id: 'txn-2',
          display_name: 'tennis court',
          category_key: 'sports',
          category_label: 'Sports',
          category_type: 'everyday',
          amount: 3000,
          date: '2026-05-06',
          note: null,
          created_at: '2026-05-06T09:00:00Z',
        },
        {
          id: 'txn-3',
          display_name: 'Boda to town',
          category_key: 'transport',
          category_label: 'Transport',
          category_type: 'everyday',
          amount: 800,
          date: '2026-05-05',
          note: null,
          created_at: '2026-05-05T09:00:00Z',
        },
        {
          id: 'txn-4',
          display_name: 'Opening balance',
          category_key: 'debt_opening_balance',
          category_label: 'Debt opening balance',
          category_type: 'debt',
          amount: 80000,
          date: '2026-05-01',
          note: null,
          created_at: '2026-05-01T09:00:00Z',
        },
      ])
    )

    const { loadLogPageData } = await import('./log')

    const data = await loadLogPageData('user-1', {
      currency: 'KES',
      pay_schedule_type: 'monthly',
      pay_schedule_days: [25],
    } as any)

    expect(data.entries[0]).toMatchObject({
      name: 'Uber for Ciiku',
      categoryLabel: 'Transport',
      categoryKey: 'transport',
      categoryType: 'everyday',
    })
    expect(data.totalOutflow).toBe(5000)
  })

  it('falls back to category label as title when no original name is present', async () => {
    createServerSupabaseClient.mockResolvedValue(
      makeLogSupabase([
        {
          id: 'txn-2',
          display_name: null,
          category_key: 'sports',
          category_label: 'Sports',
          category_type: 'everyday',
          amount: 3000,
          date: '2026-05-06',
          note: null,
          created_at: '2026-05-06T08:00:00Z',
        },
      ])
    )

    const { loadEntryById } = await import('./log')

    const result = await loadEntryById('user-1', {
      currency: 'KES',
      pay_schedule_type: 'monthly',
      pay_schedule_days: [25],
    } as any, 'txn-2')

    expect(result?.entry).toMatchObject({
      name: 'Sports',
      categoryLabel: 'Sports',
      categoryKey: 'sports',
    })
  })
})
