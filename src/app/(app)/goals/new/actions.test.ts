import { beforeEach, describe, expect, it, vi } from 'vitest'

const revalidatePath = vi.fn()
const getAppSession = vi.fn()
const createServerSupabaseClient = vi.fn()
const deleteTransactionsForCycleDateByCategory = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/auth/app-session', () => ({ getAppSession }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient }))
vi.mock('@/lib/supabase/transactions-db', () => ({ deleteTransactionsForCycleDateByCategory }))

describe('new goal actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAppSession.mockResolvedValue({
      user: { id: 'user-1' },
      profile: { goals: [] },
    })
  })

  it('creates a goal without a deadline when none is provided', async () => {
    const profileEq = vi.fn().mockResolvedValue({ error: null })
    const targetUpsert = vi.fn().mockResolvedValue({ error: null })
    const milestoneEqGoal = vi.fn().mockResolvedValue({ error: null })
    const milestoneEqUser = vi.fn(() => ({ eq: milestoneEqGoal }))
    const milestoneDelete = vi.fn(() => ({ eq: milestoneEqUser }))

    createServerSupabaseClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'user_profiles') return { update: vi.fn(() => ({ eq: profileEq })) }
        if (table === 'goal_targets') return { upsert: targetUpsert }
        if (table === 'goal_milestones') return { delete: milestoneDelete, insert: vi.fn() }
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const { saveNewGoal } = await import('./actions')

    await saveNewGoal({
      goalId: 'emergency',
      targetAmount: 50000,
      milestones: [],
    })

    expect(targetUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        goal_id: 'emergency',
        amount: 50000,
        target_date: null,
      }),
      { onConflict: 'user_id,goal_id' }
    )
  })
})
