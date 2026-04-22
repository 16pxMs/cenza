import { beforeEach, describe, expect, it, vi } from 'vitest'

const revalidatePath = vi.fn()
const getAppSession = vi.fn()
const createServerSupabaseClient = vi.fn()
const getCurrentCycleId = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/auth/app-session', () => ({ getAppSession }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient }))
vi.mock('@/lib/supabase/cycles-db', () => ({ getCurrentCycleId }))

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

describe('app actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAppSession.mockResolvedValue({
      user: { id: 'user-1' },
      profile: { pay_schedule_type: 'monthly', pay_schedule_days: [25] },
    })
    getCurrentCycleId.mockResolvedValue('2026-04-01')
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
})
