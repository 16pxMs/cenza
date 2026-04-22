import { beforeEach, describe, expect, it, vi } from 'vitest'

const revalidatePath = vi.fn()
const getAppSession = vi.fn()
const createServerSupabaseClient = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/auth/app-session', () => ({ getAppSession }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient }))

describe('targets actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAppSession.mockResolvedValue({
      user: { id: 'user-1' },
      profile: { id: 'user-1' },
    })
  })

  it('saveTargets upserts only completed positive targets', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    createServerSupabaseClient.mockResolvedValue({
      from: vi.fn(() => ({ upsert })),
    })

    const { saveTargets } = await import('./actions')

    await saveTargets({
      emergency: { amount: 3000, destination: null },
      travel: null,
      home: { amount: 0, destination: null },
      other: { amount: 500, destination: 'Laptop' },
    }, true)

    expect(upsert).toHaveBeenCalledWith([
      { user_id: 'user-1', goal_id: 'emergency', amount: 3000, destination: null },
      { user_id: 'user-1', goal_id: 'other', amount: 500, destination: 'Laptop' },
    ], { onConflict: 'user_id,goal_id' })
  })

  it('saveTargets skips writes when the flow is incomplete', async () => {
    const upsert = vi.fn()
    createServerSupabaseClient.mockResolvedValue({
      from: vi.fn(() => ({ upsert })),
    })

    const { saveTargets } = await import('./actions')

    await saveTargets({ emergency: { amount: 3000, destination: null } }, false)

    expect(upsert).not.toHaveBeenCalled()
    expect(revalidatePath).toHaveBeenCalledWith('/app')
  })
})
