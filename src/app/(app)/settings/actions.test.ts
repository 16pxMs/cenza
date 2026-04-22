import { beforeEach, describe, expect, it, vi } from 'vitest'

const revalidatePath = vi.fn()
const getAppSession = vi.fn()
const createServerSupabaseClient = vi.fn()
const createAdminClient = vi.fn()
const clearPinDeviceState = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/auth/app-session', () => ({ getAppSession }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }))
vi.mock('@/lib/actions/pin', () => ({ clearPinDeviceState }))

function makeDeleteBuilder() {
  const eq = vi.fn().mockResolvedValue({ error: null })
  const del = vi.fn(() => ({ eq }))
  return { delete: del, eq }
}

describe('settings actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAppSession.mockResolvedValue({
      user: { id: 'user-1' },
      profile: { id: 'user-1' },
    })
  })

  it('saveCurrency updates the user profile and revalidates dependent routes', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn(() => ({ eq }))
    createServerSupabaseClient.mockResolvedValue({
      from: vi.fn(() => ({ update })),
    })

    const { saveCurrency } = await import('./actions')

    await saveCurrency('USD')

    expect(update).toHaveBeenCalledWith({ currency: 'USD' })
    expect(eq).toHaveBeenCalledWith('id', 'user-1')
    expect(revalidatePath).toHaveBeenCalledWith('/settings')
    expect(revalidatePath).toHaveBeenCalledWith('/plan')
  })

  it('savePaySchedule updates schedule type and days', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn(() => ({ eq }))
    createServerSupabaseClient.mockResolvedValue({
      from: vi.fn(() => ({ update })),
    })

    const { savePaySchedule } = await import('./actions')

    await savePaySchedule('twice_monthly', [1, 15])

    expect(update).toHaveBeenCalledWith({
      pay_schedule_type: 'twice_monthly',
      pay_schedule_days: [1, 15],
    })
  })

  it('deleteAccountPermanently clears user-owned tables, deletes auth, and clears device state', async () => {
    const transactions = makeDeleteBuilder()
    const incomeEntries = makeDeleteBuilder()
    const goalTargets = makeDeleteBuilder()
    const fixedExpenses = makeDeleteBuilder()
    const spendingBudgets = makeDeleteBuilder()
    const spendingCategories = makeDeleteBuilder()
    const subscriptions = makeDeleteBuilder()
    const cycles = makeDeleteBuilder()
    const userProfiles = makeDeleteBuilder()

    const tables: Record<string, any> = {
      transactions,
      income_entries: incomeEntries,
      goal_targets: goalTargets,
      fixed_expenses: fixedExpenses,
      spending_budgets: spendingBudgets,
      spending_categories: spendingCategories,
      subscriptions,
      cycles,
      user_profiles: userProfiles,
    }

    const from = vi.fn((table: string) => tables[table])
    createAdminClient.mockReturnValue({
      from,
      auth: {
        admin: {
          deleteUser: vi.fn().mockResolvedValue({ error: null }),
        },
      },
    })

    const { deleteAccountPermanently } = await import('./actions')

    await deleteAccountPermanently()

    expect(from.mock.calls.map(call => call[0])).toEqual([
      'transactions',
      'income_entries',
      'goal_targets',
      'fixed_expenses',
      'spending_budgets',
      'spending_categories',
      'subscriptions',
      'cycles',
      'user_profiles',
    ])
    expect(userProfiles.eq).toHaveBeenCalledWith('id', 'user-1')
    expect(transactions.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(clearPinDeviceState).toHaveBeenCalledWith({ forgetDevice: true })
  })
})
