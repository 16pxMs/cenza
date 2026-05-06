import { beforeEach, describe, expect, it, vi } from 'vitest'

const createServerSupabaseClient = vi.fn()
const getCycleIdForDate = vi.fn()

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient }))
vi.mock('@/lib/supabase/cycles-db', () => ({ getCycleIdForDate }))

describe('debt mirror transactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCycleIdForDate.mockResolvedValue('2026-05-01')
  })

  it('writes repayment display_name as "{debt name} payment"', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'txn-1' }, error: null })
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    const linkEqUser = vi.fn().mockResolvedValue({ error: null })
    const linkEqId = vi.fn(() => ({ eq: linkEqUser }))
    const update = vi.fn(() => ({ eq: linkEqId }))

    createServerSupabaseClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'transactions') return { insert }
        if (table === 'debt_transactions') return { update }
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const { createAndLinkDebtMirrorTransaction } = await import('./debt-mirror')

    await createAndLinkDebtMirrorTransaction({
      userId: 'user-1',
      debtName: 'KCB loan',
      debtTransactionId: 'debt-txn-1',
      entryType: 'payment_out',
      amount: 2500,
      date: '2026-05-06',
      note: 'Manual payment',
      profile: { pay_schedule_type: 'monthly', pay_schedule_days: [25] },
    })

    expect(insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      cycle_id: '2026-05-01',
      date: '2026-05-06',
      category_type: 'debt',
      category_key: 'debt_repayment',
      category_label: 'Debt repayment',
      display_name: 'KCB loan payment',
      amount: 2500,
      note: 'Manual payment',
    })
  })

  it('writes opening-balance display_name as "{debt name} balance"', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'txn-2' }, error: null })
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    const linkEqUser = vi.fn().mockResolvedValue({ error: null })
    const linkEqId = vi.fn(() => ({ eq: linkEqUser }))
    const update = vi.fn(() => ({ eq: linkEqId }))

    createServerSupabaseClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'transactions') return { insert }
        if (table === 'debt_transactions') return { update }
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const { createAndLinkDebtMirrorTransaction } = await import('./debt-mirror')

    await createAndLinkDebtMirrorTransaction({
      userId: 'user-1',
      debtName: 'Visa card',
      debtTransactionId: 'debt-txn-2',
      entryType: 'principal_increase',
      amount: 12000,
      date: '2026-05-06',
      note: null,
      profile: { pay_schedule_type: 'monthly', pay_schedule_days: [25] },
    })

    expect(insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      cycle_id: '2026-05-01',
      date: '2026-05-06',
      category_type: 'debt',
      category_key: 'debt_opening_balance',
      category_label: 'Debt opening balance',
      display_name: 'Visa card balance',
      amount: 12000,
      note: null,
    })
  })
})
