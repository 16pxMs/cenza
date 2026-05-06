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

describe('history actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAppSession.mockResolvedValue({
      user: { id: 'user-1' },
      profile: { pay_schedule_type: 'monthly', pay_schedule_days: [25] },
    })
  })

  it('updateHistoryEntry derives category metadata from config', async () => {
    const eqUser = vi.fn().mockResolvedValue({ error: null })
    const eqId = vi.fn(() => ({ eq: eqUser }))
    const update = vi.fn(() => ({ eq: eqId }))

    createServerSupabaseClient.mockResolvedValue({
      from: vi.fn(() => ({ update })),
    })

    const { updateHistoryEntry } = await import('./actions')

    await updateHistoryEntry({
      id: 'txn-1',
      amount: 100,
      date: '2026-05-06',
      note: 'updated',
      categoryKey: 'wifi',
      currentCategoryKey: 'rent',
    })

    expect(update).toHaveBeenCalledWith({
      amount: 100,
      date: '2026-05-06',
      note: 'updated',
      category_type: 'fixed',
      category_key: 'internet',
      category_label: 'Internet',
    })
  })

  it('updateHistoryEntry rejects unknown category keys', async () => {
    const update = vi.fn()

    createServerSupabaseClient.mockResolvedValue({
      from: vi.fn(() => ({ update })),
    })

    const { updateHistoryEntry } = await import('./actions')

    await expect(updateHistoryEntry({
      id: 'txn-1',
      amount: 100,
      date: '2026-05-06',
      categoryKey: 'totally_unknown_key',
      currentCategoryKey: 'rent',
    })).rejects.toThrow('Unknown category key: totally_unknown_key')

    expect(update).not.toHaveBeenCalled()
  })
})
