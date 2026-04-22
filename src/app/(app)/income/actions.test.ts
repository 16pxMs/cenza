import { beforeEach, describe, expect, it, vi } from 'vitest'

const revalidatePath = vi.fn()
const getAppSession = vi.fn()
const createServerSupabaseClient = vi.fn()
const getCurrentCycleId = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/auth/app-session', () => ({ getAppSession }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient }))
vi.mock('@/lib/supabase/cycles-db', () => ({ getCurrentCycleId }))

function makeSupabase() {
  const profileEq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn(() => ({ eq: profileEq }))

  const incomeUpsert = vi.fn().mockResolvedValue({ error: null })
  const fixedUpsert = vi.fn().mockResolvedValue({ error: null })
  const fixedMaybeSingle = vi.fn().mockResolvedValue({ data: { entries: [] }, error: null })
  const fixedEqCycle = vi.fn(() => ({ maybeSingle: fixedMaybeSingle }))
  const fixedEqUser = vi.fn(() => ({ eq: fixedEqCycle }))
  const fixedSelect = vi.fn(() => ({ eq: fixedEqUser }))
  const budgetUpsert = vi.fn().mockResolvedValue({ error: null })

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'income_entries') return { upsert: incomeUpsert }
      if (table === 'fixed_expenses') return { select: fixedSelect, upsert: fixedUpsert }
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
    createServerSupabaseClient.mockResolvedValue(supabase)

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
      total: 1200,
      cycle_start_mode: 'full_month',
      opening_balance: null,
    }, { onConflict: 'user_id,cycle_id' })
    expect(update).toHaveBeenCalledWith({
      income_type: 'variable',
      pay_schedule_type: null,
      pay_schedule_days: null,
    })
    expect(getCurrentCycleId).toHaveBeenCalledWith(
      supabase,
      'user-1',
      {
        pay_schedule_type: null,
        pay_schedule_days: null,
      }
    )
    expect(revalidatePath).toHaveBeenCalledWith('/settings')
  })

  it('saveIncome persists payday for salaried users', async () => {
    const { supabase, update } = makeSupabase()
    createServerSupabaseClient.mockResolvedValue(supabase)

    const { saveIncome } = await import('./actions')

    await saveIncome({
      income: 3000,
      extraIncome: [],
      total: 3000,
      incomeType: 'salaried',
      paydayDay: 23,
    })

    expect(update).toHaveBeenCalledWith({
      income_type: 'salaried',
      pay_schedule_type: 'monthly',
      pay_schedule_days: [23],
    })
  })

  it('saveIncome infers salaried when payday is provided without income type', async () => {
    const { supabase, update } = makeSupabase()
    createServerSupabaseClient.mockResolvedValue(supabase)

    const { saveIncome } = await import('./actions')

    await saveIncome({
      income: 3000,
      extraIncome: [],
      total: 3000,
      paydayDay: 19,
    })

    expect(update).toHaveBeenCalledWith({
      income_type: 'salaried',
      pay_schedule_type: 'monthly',
      pay_schedule_days: [19],
    })
  })

  it('saveIncome supports mid-month start with opening balance', async () => {
    const { supabase, incomeUpsert } = makeSupabase()
    createServerSupabaseClient.mockResolvedValue(supabase)

    const { saveIncome } = await import('./actions')

    await saveIncome({
      income: 0,
      extraIncome: [],
      total: 1200,
      incomeType: 'salaried',
      paydayDay: 23,
      cycleStartMode: 'mid_month',
      openingBalance: 1200,
    })

    expect(incomeUpsert).toHaveBeenCalledWith({
      user_id: 'user-1',
      cycle_id: '2026-04-01',
      salary: 0,
      extra_income: [],
      total: 1200,
      cycle_start_mode: 'mid_month',
      opening_balance: 1200,
    }, { onConflict: 'user_id,cycle_id' })
  })

  it('saveFixedExpenses writes monthly totals for the current cycle', async () => {
    const { supabase, fixedUpsert } = makeSupabase()
    createServerSupabaseClient.mockResolvedValue(supabase)

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
        { key: 'rent', label: 'Rent', monthly: 800, confidence: 'known', entry_type: 'planned', priority: 'core' },
        { key: 'internet', label: 'Internet', monthly: 50, confidence: 'known', entry_type: 'planned', priority: 'core' },
      ],
    }, { onConflict: 'user_id,cycle_id' })
  })

  it('saveSpendingBudget writes the total budget for the current cycle', async () => {
    const { supabase, budgetUpsert } = makeSupabase()
    createServerSupabaseClient.mockResolvedValue(supabase)

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
