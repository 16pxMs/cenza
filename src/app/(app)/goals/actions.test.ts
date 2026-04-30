import { beforeEach, describe, expect, it, vi } from 'vitest'

const revalidatePath = vi.fn()
const getAppSession = vi.fn()
const createServerSupabaseClient = vi.fn()
const deleteTransactionsForCycleDateByCategory = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/auth/app-session', () => ({ getAppSession }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient }))
vi.mock('@/lib/supabase/transactions-db', () => ({ deleteTransactionsForCycleDateByCategory }))

describe('goal actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAppSession.mockResolvedValue({
      user: { id: 'user-1' },
      profile: { goals: ['emergency', 'travel'] },
    })
  })

  it('saveGoalTarget upserts the target amount and date for the current user', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    createServerSupabaseClient.mockResolvedValue({
      from: vi.fn(() => ({ upsert })),
    })

    const { saveGoalTarget } = await import('./actions')

    await saveGoalTarget('emergency', { amount: 5000, targetDate: '2026-12-30' })

    expect(upsert).toHaveBeenCalledWith(
      { user_id: 'user-1', goal_id: 'emergency', amount: 5000, target_date: '2026-12-30' },
      { onConflict: 'user_id,goal_id' }
    )
  })

  it('archiveGoal removes the goal from the profile and clears current-cycle transactions', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn(() => ({ eq }))
    createServerSupabaseClient.mockResolvedValue({
      from: vi.fn(() => ({ update })),
    })

    const { archiveGoal } = await import('./actions')

    await archiveGoal('travel')

    expect(update).toHaveBeenCalledWith({ goals: ['emergency'] })
    expect(deleteTransactionsForCycleDateByCategory).toHaveBeenCalled()
  })

  it('removeGoal deletes the target row and clears current-cycle transactions', async () => {
    const profileEq = vi.fn().mockResolvedValue({ error: null })
    const milestoneEqGoal = vi.fn().mockResolvedValue({ error: null })
    const milestoneEqUser = vi.fn(() => ({ eq: milestoneEqGoal }))
    const targetEqGoal = vi.fn().mockResolvedValue({ error: null })
    const targetEqUser = vi.fn(() => ({ eq: targetEqGoal }))
    const update = vi.fn(() => ({ eq: profileEq }))
    const del = vi.fn(() => ({ eq: targetEqUser }))
    const milestoneDelete = vi.fn(() => ({ eq: milestoneEqUser }))

    createServerSupabaseClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'user_profiles') return { update }
        if (table === 'goal_targets') return { delete: del }
        if (table === 'goal_milestones') return { delete: milestoneDelete }
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const { removeGoal } = await import('./actions')

    await removeGoal('travel')

    expect(update).toHaveBeenCalledWith({ goals: ['emergency'] })
    expect(del).toHaveBeenCalled()
    expect(milestoneDelete).toHaveBeenCalled()
    expect(deleteTransactionsForCycleDateByCategory).toHaveBeenCalled()
  })

  it('saveGoalMilestones replaces milestone rows for the current user', async () => {
    const deleteEqGoal = vi.fn().mockResolvedValue({ error: null })
    const deleteEqUser = vi.fn(() => ({ eq: deleteEqGoal }))
    const del = vi.fn(() => ({ eq: deleteEqUser }))
    const insert = vi.fn().mockResolvedValue({ error: null })

    createServerSupabaseClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'goal_milestones') return { delete: del, insert }
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const { saveGoalMilestones } = await import('./actions')

    await saveGoalMilestones('emergency', [
      { name: 'First 10k', amount: 10000, targetDate: '2026-06-30' },
      { name: 'Halfway', amount: 50000, targetDate: null },
    ], 100000)

    expect(del).toHaveBeenCalled()
    expect(insert).toHaveBeenCalledWith([
      { user_id: 'user-1', goal_id: 'emergency', name: 'First 10k', amount: 10000, target_date: '2026-06-30', sort_order: 0 },
      { user_id: 'user-1', goal_id: 'emergency', name: 'Halfway', amount: 50000, target_date: null, sort_order: 1 },
    ])
  })
})
