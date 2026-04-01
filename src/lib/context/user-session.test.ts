import { describe, expect, it, vi } from 'vitest'
import { loadCurrentUserState } from './user-session'

describe('loadCurrentUserState', () => {
  it('returns null state when there is no authenticated user', async () => {
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as any

    await expect(loadCurrentUserState(supabase)).resolves.toEqual({
      user: null,
      profile: null,
    })
  })

  it('loads the matching profile for the authenticated user', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'user-1', currency: 'KES' },
    })
    const eq = vi.fn(() => ({ maybeSingle }))
    const select = vi.fn(() => ({ eq }))

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn(() => ({ select })),
    } as any

    const result = await loadCurrentUserState(supabase)

    expect(result.user).toEqual({ id: 'user-1' })
    expect(result.profile).toEqual({ id: 'user-1', currency: 'KES' })
    expect(supabase.from).toHaveBeenCalledWith('user_profiles')
    expect(eq).toHaveBeenCalledWith('id', 'user-1')
  })
})
