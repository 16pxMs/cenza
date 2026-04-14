import { beforeEach, describe, expect, it, vi } from 'vitest'

const revalidatePath = vi.fn()
const getAppSession = vi.fn()
const createClient = vi.fn()
const createCycleRefundTransaction = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/auth/app-session', () => ({ getAppSession }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))
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
    createClient.mockResolvedValue({})
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

})
