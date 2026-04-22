import { beforeEach, describe, expect, it, vi } from 'vitest'

const revalidatePath = vi.fn()
const getAppSession = vi.fn()
const createServerSupabaseClient = vi.fn()
const createCycleTransaction = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/auth/app-session', () => ({ getAppSession }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient }))
vi.mock('@/lib/supabase/transactions-db', () => ({ createCycleTransaction }))

describe('log/new actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAppSession.mockResolvedValue({
      user: { id: 'user-1' },
      profile: { pay_schedule_type: 'monthly', pay_schedule_days: [25] },
    })
  })

  function makeReadQuery(data: unknown) {
    const maybeSingle = vi.fn().mockResolvedValue({ data, error: null })
    const eqCycle = vi.fn(() => ({ maybeSingle }))
    const eqUser = vi.fn(() => ({ eq: eqCycle }))
    return { select: vi.fn(() => ({ eq: eqUser })) }
  }

  function makeTransactionTable(deleteBuilder: ReturnType<typeof vi.fn>) {
    const eqCycle = vi.fn().mockResolvedValue({ data: [], error: null })
    const eqUser = vi.fn(() => ({ eq: eqCycle }))
    return {
      delete: deleteBuilder,
      select: vi.fn(() => ({ eq: eqUser })),
    }
  }

  it('saveExpense writes a cycle-aware transaction using the provided category key', async () => {
    const deleteEq = vi.fn().mockResolvedValue({ error: null })
    const deleteBuilder = vi.fn(() => ({ eq: deleteEq }))
    const upsert = vi.fn().mockResolvedValue({ error: null })

    createServerSupabaseClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'income_entries') return makeReadQuery({ total: 1000, opening_balance: null, received: true })
        if (table === 'transactions') return makeTransactionTable(deleteBuilder)
        if (table === 'item_dictionary') return { upsert }
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const { saveExpense } = await import('./actions')

    await saveExpense({
      mode: 'add',
      categoryType: 'everyday',
      categoryKey: 'custom_dog_food',
      categoryLabel: 'Dog Food',
      amount: 450,
      note: 'bulk buy',
      rememberItem: true,
    })

    expect(createCycleTransaction).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      { pay_schedule_type: 'monthly', pay_schedule_days: [25] },
      {
        categoryType: 'everyday',
        categoryKey: 'custom_dog_food',
        categoryLabel: 'Dog Food',
        amount: 450,
        note: 'bulk buy',
      }
    )
    expect(upsert).toHaveBeenCalledWith({
      user_id: 'user-1',
      name_normalized: 'dog food',
      label: 'Dog Food',
      category_key: 'custom_dog_food',
      category_type: 'everyday',
      usage_count: 1,
    }, { onConflict: 'user_id,name_normalized' })
  })

  it('saveExpense deletes the prior entry in update mode before inserting the replacement', async () => {
    const deleteEq = vi.fn().mockResolvedValue({ error: null })
    const deleteBuilder = vi.fn(() => ({ eq: deleteEq }))

    createServerSupabaseClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'income_entries') return makeReadQuery({ total: 1000, opening_balance: null, received: true })
        if (table === 'transactions') return makeTransactionTable(deleteBuilder)
        if (table === 'item_dictionary') return { upsert: vi.fn() }
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const { saveExpense } = await import('./actions')

    await saveExpense({
      mode: 'update',
      priorEntryId: 'txn-1',
      categoryType: 'fixed',
      categoryKey: 'rent',
      categoryLabel: 'Rent',
      amount: 1000,
      note: null,
      rememberItem: false,
    })

    expect(deleteEq).toHaveBeenCalledWith('id', 'txn-1')
    expect(createCycleTransaction).toHaveBeenCalled()
  })
})
