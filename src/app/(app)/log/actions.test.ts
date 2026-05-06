import { beforeEach, describe, expect, it, vi } from 'vitest'

const revalidatePath = vi.fn()
const getAppSession = vi.fn()
const createServerSupabaseClient = vi.fn()
const createCycleRefundTransaction = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/auth/app-session', () => ({ getAppSession }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient }))
vi.mock('@/lib/supabase/transactions-db', () => ({
  createCycleRefundTransaction,
}))

describe('log actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAppSession.mockResolvedValue({
      user: { id: 'user-1' },
      profile: { pay_schedule_type: 'monthly', pay_schedule_days: [25] },
    })
    createServerSupabaseClient.mockResolvedValue({})
  })

  it('recordRefund validates amount and delegates to the cycle-aware refund writer', async () => {
    const { recordRefund } = await import('./actions')

    await recordRefund({
      categoryType: 'everyday',
      categoryKey: 'groceries',
      categoryLabel: 'Groceries',
      amount: 200,
      note: 'Returned item',
    })

    expect(createCycleRefundTransaction).toHaveBeenCalledWith(
      {},
      'user-1',
      { pay_schedule_type: 'monthly', pay_schedule_days: [25] },
      {
        categoryType: 'everyday',
        categoryKey: 'groceries',
        categoryLabel: 'Groceries',
        amount: 200,
        note: 'Returned item',
      }
    )
  })

  it('updateLogEntry derives category metadata from config for non-goal edits', async () => {
    const eqUser = vi.fn().mockResolvedValue({ error: null })
    const eqId = vi.fn(() => ({ eq: eqUser }))
    const update = vi.fn(() => ({ eq: eqId }))
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { category_type: 'everyday' },
      error: null,
    })
    const selectEqUser = vi.fn(() => ({ maybeSingle }))
    const selectEqId = vi.fn(() => ({ eq: selectEqUser }))
    const select = vi.fn(() => ({ eq: selectEqId }))

    createServerSupabaseClient.mockResolvedValue({
      from: vi.fn(() => ({
        select,
        update,
      })),
    })

    const { updateLogEntry } = await import('./actions')

    await updateLogEntry({
      id: 'txn-1',
      amount: 200,
      date: '2026-05-06',
      note: 'updated',
      categoryKey: 'wifi',
    })

    expect(update).toHaveBeenCalledWith({
      amount: 200,
      date: '2026-05-06',
      note: 'updated',
      category_type: 'fixed',
      category_key: 'internet',
      category_label: 'Internet',
    })
  })

  it('updateLogEntry rejects unknown category keys', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { category_type: 'everyday' },
      error: null,
    })
    const selectEqUser = vi.fn(() => ({ maybeSingle }))
    const selectEqId = vi.fn(() => ({ eq: selectEqUser }))
    const select = vi.fn(() => ({ eq: selectEqId }))
    const update = vi.fn()

    createServerSupabaseClient.mockResolvedValue({
      from: vi.fn(() => ({
        select,
        update,
      })),
    })

    const { updateLogEntry } = await import('./actions')

    await expect(updateLogEntry({
      id: 'txn-1',
      amount: 200,
      date: '2026-05-06',
      categoryKey: 'totally_unknown_key',
    })).rejects.toThrow('Unknown category key: totally_unknown_key')

    expect(update).not.toHaveBeenCalled()
  })

})
