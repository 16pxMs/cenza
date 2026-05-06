import { beforeEach, describe, expect, it, vi } from 'vitest'

const createServerSupabaseClient = vi.fn()
const deriveCurrentCycleId = vi.fn()

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient }))
vi.mock('@/lib/supabase/cycles-db', async () => {
  const actual = await vi.importActual<typeof import('@/lib/supabase/cycles-db')>('@/lib/supabase/cycles-db')
  return {
    ...actual,
    deriveCurrentCycleId,
  }
})

function makeHistorySupabase(rows: any[]) {
  return {
    from: vi.fn((table: string) => {
      if (table !== 'transactions') {
        throw new Error(`Unexpected table ${table}`)
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  order: vi.fn().mockResolvedValue({ data: rows }),
                })),
              })),
            })),
          })),
        })),
      }
    }),
  }
}

describe('history ledger loader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    deriveCurrentCycleId.mockReturnValue('2026-05-01')
  })

  it('returns display_name as the visible title while keeping category label separate', async () => {
    createServerSupabaseClient.mockResolvedValue(
      makeHistorySupabase([
        {
          id: 'txn-1',
          date: '2026-05-06',
          amount: 3000,
          note: null,
          display_name: 'tennis court',
          category_key: 'sports',
          category_label: 'Sports',
          category_type: 'everyday',
        },
      ])
    )

    const { loadHistoryLedgerPageData } = await import('./history-ledger')

    const data = await loadHistoryLedgerPageData(
      'user-1',
      {
        currency: 'KES',
        pay_schedule_type: 'monthly',
        pay_schedule_days: [25],
      } as any,
      'sports',
      'everyday',
      'key'
    )

    expect(data.txns[0]).toMatchObject({
      displayName: 'tennis court',
      categoryLabel: 'Sports',
      categoryType: 'everyday',
    })
  })

  it('keeps category label available when display_name is blank', async () => {
    createServerSupabaseClient.mockResolvedValue(
      makeHistorySupabase([
        {
          id: 'txn-2',
          date: '2026-05-06',
          amount: 1200,
          note: null,
          display_name: '   ',
          category_key: 'transport',
          category_label: 'Transport',
          category_type: 'everyday',
        },
      ])
    )

    const { loadHistoryLedgerPageData } = await import('./history-ledger')

    const data = await loadHistoryLedgerPageData(
      'user-1',
      {
        currency: 'KES',
        pay_schedule_type: 'monthly',
        pay_schedule_days: [25],
      } as any,
      'transport',
      'everyday',
      'key'
    )

    expect(data.txns[0]).toMatchObject({
      displayName: null,
      categoryLabel: 'Transport',
    })
  })
})
