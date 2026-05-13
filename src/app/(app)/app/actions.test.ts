import { beforeEach, describe, expect, it, vi } from 'vitest'

const revalidatePath = vi.fn()
const getAppSession = vi.fn()
const createServerSupabaseClient = vi.fn()
const getCurrentCycleId = vi.fn()
const deriveCurrentCycleId = vi.fn()
const derivePrevCycleId = vi.fn()
const createCycleTransaction = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/auth/app-session', () => ({ getAppSession }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient }))
vi.mock('@/lib/supabase/cycles-db', () => ({ getCurrentCycleId, deriveCurrentCycleId, derivePrevCycleId }))
vi.mock('@/lib/supabase/transactions-db', () => ({ createCycleTransaction }))

function makeSupabase(existingRow: { id: string } | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: existingRow, error: null })
  const select = vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(() => ({ maybeSingle })),
    })),
  }))

  const updateEqCycle = vi.fn().mockResolvedValue({ error: null })
  const updateEqUser = vi.fn(() => ({ eq: updateEqCycle }))
  const update = vi.fn(() => ({ eq: updateEqUser }))

  const upsert = vi.fn().mockResolvedValue({ error: null })

  const incomeTable = { select, update, upsert }
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'income_entries') return incomeTable
      throw new Error(`Unexpected table ${table}`)
    }),
  }

  return { supabase, update, upsert, maybeSingle }
}

function makeOverviewSupabase(options: {
  userId?: string
  fallbackProfile?: Record<string, unknown> | null
} = {}) {
  const userId = options.userId ?? 'user-1'
  const fallbackProfile = options.fallbackProfile ?? {
    id: userId,
    currency: 'KES',
    pay_schedule_type: 'monthly',
    pay_schedule_days: [25],
    amount_format_preference: 'smart',
    goals: [],
  }
  const userProfilesMaybeSingle = vi.fn().mockResolvedValue({ data: fallbackProfile, error: null })
  const userProfilesEq = vi.fn(() => ({ maybeSingle: userProfilesMaybeSingle }))
  const fixedExpensesMaybeSingle = vi.fn().mockResolvedValue({ data: { entries: [] }, error: null })
  const fixedExpensesEqCycle = vi.fn(() => ({ maybeSingle: fixedExpensesMaybeSingle }))
  const fixedExpensesEqUser = vi.fn(() => ({ eq: fixedExpensesEqCycle }))
  const spendingBudgetMaybeSingle = vi.fn().mockResolvedValue({ data: null })
  const spendingBudgetEqCycle = vi.fn(() => ({ maybeSingle: spendingBudgetMaybeSingle }))
  const spendingBudgetEqUser = vi.fn(() => ({ eq: spendingBudgetEqCycle }))
  const debtBalanceGt = vi.fn().mockResolvedValue({ data: [] })
  const debtStatusEq = vi.fn(() => ({ gt: debtBalanceGt }))
  const debtUserEq = vi.fn(() => ({ eq: debtStatusEq }))

  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }),
    },
    from: vi.fn((table: string) => {
      if (table === 'user_profiles') {
        return {
          select: vi.fn(() => ({ eq: userProfilesEq })),
        }
      }
      if (table === 'transactions') {
        return {
          select: vi.fn((query: string) => {
            if (query === 'id, amount, category_key, category_type, category_label, custom_category_id, display_name, date') {
              return {
                eq: vi.fn(() => ({
                  eq: vi.fn().mockResolvedValue({ data: [] }),
                })),
              }
            }
            if (query === 'category_key, amount, date, created_at') {
              return {
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    in: vi.fn().mockResolvedValue({ data: [] }),
                  })),
                })),
              }
            }
            if (query === 'amount, category_key, category_label, category_type, custom_category_id') {
              return {
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    in: vi.fn().mockResolvedValue({ data: [] }),
                  })),
                })),
              }
            }
            throw new Error(`Unexpected transactions select ${query}`)
          }),
        }
      }
      if (table === 'fixed_expenses') {
        return {
          select: vi.fn(() => ({ eq: fixedExpensesEqUser })),
        }
      }
      if (table === 'spending_budgets') {
        return {
          select: vi.fn(() => ({ eq: spendingBudgetEqUser })),
        }
      }
      if (table === 'goal_targets') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: [] }),
          })),
        }
      }
      if (table === 'debts') {
        return {
          select: vi.fn(() => ({ eq: debtUserEq })),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    }),
  }

  return { supabase, userProfilesMaybeSingle }
}

describe('app actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAppSession.mockResolvedValue({
      user: { id: 'user-1' },
      profile: { pay_schedule_type: 'monthly', pay_schedule_days: [25] },
    })
    getCurrentCycleId.mockResolvedValue('2026-04-01')
    deriveCurrentCycleId.mockReturnValue('2026-04-01')
    derivePrevCycleId.mockReturnValue(null)
  })

  it('confirmReceivedIncome updates received fields without overwriting saved income row', async () => {
    const { supabase, update, upsert } = makeSupabase({ id: 'income-row-1' })
    createServerSupabaseClient.mockResolvedValue(supabase)

    const { confirmReceivedIncome } = await import('./actions')
    await confirmReceivedIncome(45000)

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        received: 45000,
        received_confirmed_at: expect.any(String),
      })
    )
    expect(upsert).not.toHaveBeenCalled()
  })

  it('confirmReceivedIncome inserts a new cycle row only when none exists', async () => {
    const { supabase, upsert } = makeSupabase(null)
    createServerSupabaseClient.mockResolvedValue(supabase)

    const { confirmReceivedIncome } = await import('./actions')
    await confirmReceivedIncome(12000)

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        cycle_id: '2026-04-01',
        salary: 0,
        extra_income: [],
        received: 12000,
        received_confirmed_at: expect.any(String),
      }),
      { onConflict: 'user_id,cycle_id' }
    )
  })

  it('addGoalContribution writes display_name from the goal label', async () => {
    createServerSupabaseClient.mockResolvedValue({})

    const { addGoalContribution } = await import('./actions')
    await addGoalContribution({
      goalId: 'emergency',
      goalLabel: 'Emergency Fund',
      amount: 3200,
      note: 'May top-up',
    })

    expect(createCycleTransaction).toHaveBeenCalledWith(
      {},
      'user-1',
      { pay_schedule_type: 'monthly', pay_schedule_days: [25] },
      {
        categoryType: 'goal',
        categoryKey: 'emergency',
        categoryLabel: 'Emergency Fund',
        displayName: 'Emergency Fund',
        amount: 3200,
        note: 'May top-up',
      }
    )
  })

  it('loadOverviewSecondary reuses a valid profile snapshot without fetching user_profiles', async () => {
    const { supabase, userProfilesMaybeSingle } = makeOverviewSupabase()
    createServerSupabaseClient.mockResolvedValue(supabase)

    const { loadOverviewSecondary } = await import('./actions')
    const data = await loadOverviewSecondary({
      id: 'user-1',
      currency: 'KES',
      pay_schedule_type: 'monthly',
      pay_schedule_days: [25],
      amount_format_preference: 'smart',
      goals: [],
    })

    expect(data.recentActivity).toEqual([])
    expect(supabase.auth.getUser).toHaveBeenCalled()
    expect(userProfilesMaybeSingle).not.toHaveBeenCalled()
  })

  it('loadOverviewSecondary falls back to a profile fetch for a mismatched snapshot', async () => {
    const { supabase, userProfilesMaybeSingle } = makeOverviewSupabase()
    createServerSupabaseClient.mockResolvedValue(supabase)

    const { loadOverviewSecondary } = await import('./actions')
    await loadOverviewSecondary({
      id: 'other-user',
      currency: 'KES',
      pay_schedule_type: 'monthly',
      pay_schedule_days: [25],
      amount_format_preference: 'smart',
      goals: [],
    })

    expect(supabase.auth.getUser).toHaveBeenCalled()
    expect(userProfilesMaybeSingle).toHaveBeenCalled()
  })

  it('loadOverviewSecondary falls back to a profile fetch for a malformed snapshot', async () => {
    const { supabase, userProfilesMaybeSingle } = makeOverviewSupabase()
    createServerSupabaseClient.mockResolvedValue(supabase)

    const { loadOverviewSecondary } = await import('./actions')
    await loadOverviewSecondary({ id: '' } as any)

    expect(supabase.auth.getUser).toHaveBeenCalled()
    expect(userProfilesMaybeSingle).toHaveBeenCalled()
  })
})
