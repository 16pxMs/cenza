import { beforeEach, describe, expect, it, vi } from 'vitest'

const revalidatePath = vi.fn()
const getAppSession = vi.fn()
const createClient = vi.fn()
const deleteTransactionsForCycleDateByCategory = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/auth/app-session', () => ({ getAppSession }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/supabase/transactions-db', () => ({ deleteTransactionsForCycleDateByCategory }))

describe('goal actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAppSession.mockResolvedValue({
      user: { id: 'user-1' },
      profile: { goals: ['emergency', 'travel'] },
    })
  })

  it('saveGoalTarget upserts the target amount for the current user', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    createClient.mockResolvedValue({
      from: vi.fn(() => ({ upsert })),
    })

    const { saveGoalTarget } = await import('./actions')

    await saveGoalTarget('emergency', 5000)

    expect(upsert).toHaveBeenCalledWith(
      { user_id: 'user-1', goal_id: 'emergency', amount: 5000 },
      { onConflict: 'user_id,goal_id' }
    )
  })

  it('archiveGoal removes the goal from the profile and clears current-cycle transactions', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn(() => ({ eq }))
    createClient.mockResolvedValue({
      from: vi.fn(() => ({ update })),
    })

    const { archiveGoal } = await import('./actions')

    await archiveGoal('travel')

    expect(update).toHaveBeenCalledWith({ goals: ['emergency'] })
    expect(deleteTransactionsForCycleDateByCategory).toHaveBeenCalled()
  })

  it('removeGoal deletes the target row and clears current-cycle transactions', async () => {
    const profileEq = vi.fn().mockResolvedValue({ error: null })
    const targetEqGoal = vi.fn().mockResolvedValue({ error: null })
    const targetEqUser = vi.fn(() => ({ eq: targetEqGoal }))
    const update = vi.fn(() => ({ eq: profileEq }))
    const del = vi.fn(() => ({ eq: targetEqUser }))

    createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'user_profiles') return { update }
        if (table === 'goal_targets') return { delete: del }
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const { removeGoal } = await import('./actions')

    await removeGoal('travel')

    expect(update).toHaveBeenCalledWith({ goals: ['emergency'] })
    expect(del).toHaveBeenCalled()
    expect(deleteTransactionsForCycleDateByCategory).toHaveBeenCalled()
  })
})
