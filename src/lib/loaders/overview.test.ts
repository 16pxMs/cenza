import { beforeEach, describe, expect, it, vi } from 'vitest'

const createServerSupabaseClient = vi.fn()
const deriveCurrentCycleId = vi.fn()
const hasMonthlyStorageForUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient }))
vi.mock('@/lib/supabase/cycles-db', async () => {
  const actual = await vi.importActual<typeof import('@/lib/supabase/cycles-db')>('@/lib/supabase/cycles-db')
  return {
    ...actual,
    deriveCurrentCycleId,
  }
})
vi.mock('@/lib/monthly-reminders/storage', async () => {
  const actual = await vi.importActual<typeof import('@/lib/monthly-reminders/storage')>('@/lib/monthly-reminders/storage')
  return {
    ...actual,
    hasMonthlyStorageForUser,
  }
})

function makeSupabaseForCriticalData() {
  const transactionsCycleQuery = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({
          data: [
            { amount: 80000, category_type: 'debt', category_key: 'debt_opening_balance' },
            { amount: 25000, category_type: 'debt', category_key: 'debt_repayment' },
            { amount: 100000, category_type: 'goal', category_key: 'emergency' },
            { amount: 22300, category_type: 'everyday', category_key: 'food' },
          ],
        }),
      })),
    })),
  }
  const transactionsHistoricalQuery = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        limit: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        })),
      })),
    })),
  }
  const incomeCycleQuery = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              salary: 300000,
              extra_income: [],
              total: 300000,
              cycle_start_mode: 'full_month',
              opening_balance: null,
              received: null,
              received_confirmed_at: null,
            },
          }),
        })),
      })),
    })),
  }
  const incomeHistoricalQuery = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        limit: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        })),
      })),
    })),
  }
  const activeDebtsQuery = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          gt: vi.fn().mockResolvedValue({ data: [] }),
        })),
      })),
    })),
  }
  const historicalDebtsQuery = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        limit: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        })),
      })),
    })),
  }
  const goalTargetsQuery = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        limit: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        })),
      })),
    })),
  }
  let transactionsCalls = 0
  let incomeCalls = 0
  let debtsCalls = 0
  return {
    from: vi.fn((table: string) => {
      if (table === 'transactions') {
        transactionsCalls += 1
        return transactionsCalls === 1 ? transactionsCycleQuery : transactionsHistoricalQuery
      }
      if (table === 'income_entries') {
        incomeCalls += 1
        return incomeCalls === 1 ? incomeCycleQuery : incomeHistoricalQuery
      }
      if (table === 'debts') {
        debtsCalls += 1
        return debtsCalls === 1 ? activeDebtsQuery : historicalDebtsQuery
      }
      if (table === 'goal_targets') return goalTargetsQuery
      throw new Error(`Unexpected table ${table}`)
    }),
  }
}

describe('loadOverviewCriticalData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    deriveCurrentCycleId.mockReturnValue('2026-05-01')
    hasMonthlyStorageForUser.mockResolvedValue(false)
    createServerSupabaseClient.mockResolvedValue(makeSupabaseForCriticalData())
  })

  it('excludes debt opening balance while keeping repayments and goals in outflow', async () => {
    const { loadOverviewCriticalData } = await import('./overview')

    const data = await loadOverviewCriticalData('user-1', {
      name: 'Test User',
      currency: 'KES',
      income_type: 'salaried',
      pay_schedule_days: [25],
      goals: [],
    } as any)

    expect(data.totalSpent).toBe(147300)
    expect(data.incomeData.total).toBe(300000)
  })
})
