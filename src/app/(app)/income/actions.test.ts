import { beforeEach, describe, expect, it, vi } from 'vitest'

const revalidatePath = vi.fn()
const getAppSession = vi.fn()
const createClient = vi.fn()
const getCurrentCycleId = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/auth/app-session', () => ({ getAppSession }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/supabase/cycles-db', () => ({ getCurrentCycleId }))

function makeSupabase() {
  const profileEq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn(() => ({ eq: profileEq }))

  const incomeUpsert = vi.fn().mockResolvedValue({ error: null })
  const fixedUpsert = vi.fn().mockResolvedValue({ error: null })
  const budgetUpsert = vi.fn().mockResolvedValue({ error: null })

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'income_entries') return { upsert: incomeUpsert }
      if (table === 'fixed_expenses') return { upsert: fixedUpsert }
      if (table === 'spending_budgets') return { upsert: budgetUpsert }
      if (table === 'user_profiles') return { update }
      throw new Error(`Unexpected table ${table}`)
    }),
  }

  return { supabase, incomeUpsert, fixedUpsert, budgetUpsert, update, profileEq }
}

describe('income actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAppSession.mockResolvedValue({
      user: { id: 'user-1' },
      profile: { income_type: null, pay_schedule_type: 'monthly', pay_schedule_days: [25] },
    })
    getCurrentCycleId.mockResolvedValue('2026-04-01')
  })

  it('saveIncome writes the cycle-scoped income row and persists first-time income type', async () => {
    const { supabase, incomeUpsert, update } = makeSupabase()
    createClient.mockResolvedValue(supabase)

    const { saveIncome } = await import('./actions')

    await saveIncome({
      income: 1000,
      extraIncome: [{ id: 'bonus', label: 'Bonus', amount: 200 }],
      total: 1200,
      incomeType: 'variable',
    })

    expect(incomeUpsert).toHaveBeenCalledWith({
      user_id: 'user-1',
      cycle_id: '2026-04-01',
      salary: 1000,
      extra_income: [{ id: 'bonus', label: 'Bonus', amount: 200 }],
    }, { onConflict: 'user_id,cycle_id' })
    expect(update).toHaveBeenCalledWith({ income_type: 'variable' })
    expect(revalidatePath).toHaveBeenCalledWith('/settings')
  })

  it('saveFixedExpenses writes monthly totals for the current cycle', async () => {
    const { supabase, fixedUpsert } = makeSupabase()
    createClient.mockResolvedValue(supabase)

    const { saveFixedExpenses } = await import('./actions')

    await saveFixedExpenses([
      { key: 'rent', label: 'Rent', monthly: 800, confidence: 'known' },
      { key: 'internet', label: 'Internet', monthly: 50, confidence: 'known' },
    ])

    expect(fixedUpsert).toHaveBeenCalledWith({
      user_id: 'user-1',
      cycle_id: '2026-04-01',
      total_monthly: 850,
      entries: [
        { key: 'rent', label: 'Rent', monthly: 800, confidence: 'known' },
        { key: 'internet', label: 'Internet', monthly: 50, confidence: 'known' },
      ],
    }, { onConflict: 'user_id,cycle_id' })
  })

  it('saveSpendingBudget writes the total budget for the current cycle', async () => {
    const { supabase, budgetUpsert } = makeSupabase()
    createClient.mockResolvedValue(supabase)

    const { saveSpendingBudget } = await import('./actions')

    await saveSpendingBudget([
      { key: 'groceries', label: 'Groceries', budget: 300 },
      { key: 'transport', label: 'Transport', budget: 100 },
    ])

    expect(budgetUpsert).toHaveBeenCalledWith({
      user_id: 'user-1',
      cycle_id: '2026-04-01',
      total_budget: 400,
      categories: [
        { key: 'groceries', label: 'Groceries', budget: 300 },
        { key: 'transport', label: 'Transport', budget: 100 },
      ],
    }, { onConflict: 'user_id,cycle_id' })
  })
})
