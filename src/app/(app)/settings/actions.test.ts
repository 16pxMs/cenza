import { beforeEach, describe, expect, it, vi } from 'vitest'

const revalidatePath = vi.fn()
const getAppSession = vi.fn()
const createClient = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/auth/app-session', () => ({ getAppSession }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))

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
    createClient.mockResolvedValue({
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
    createClient.mockResolvedValue({
      from: vi.fn(() => ({ update })),
    })

    const { savePaySchedule } = await import('./actions')

    await savePaySchedule('twice_monthly', [1, 15])

    expect(update).toHaveBeenCalledWith({
      pay_schedule_type: 'twice_monthly',
      pay_schedule_days: [1, 15],
    })
  })

  it('deleteAccountData clears all user-owned tables before deleting the profile', async () => {
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
    createClient.mockResolvedValue({ from })

    const { deleteAccountData } = await import('./actions')

    await deleteAccountData()

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
  })
})
