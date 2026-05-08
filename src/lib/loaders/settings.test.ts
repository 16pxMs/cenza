import { beforeEach, describe, expect, it, vi } from 'vitest'

const createServerSupabaseClient = vi.fn()

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient }))

function makeSettingsSupabase() {
  let selectCall = 0

  return {
    from: vi.fn(() => ({
      select: vi.fn(() => {
        selectCall += 1

        if (selectCall === 1) {
          return {
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              })),
            })),
          }
        }

        return {
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              })),
            })),
          })),
        }
      }),
    })),
  }
}

describe('settings loader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createServerSupabaseClient.mockResolvedValue(makeSettingsSupabase())
  })

  it('defaults amount format preference to smart when unset', async () => {
    const { loadSettingsPageData } = await import('./settings')
    const data = await loadSettingsPageData(
      { id: 'user-1', email: 'user@example.com', user_metadata: {} } as any,
      {
        id: 'user-1',
        name: 'Test User',
        currency: 'KES',
        amount_format_preference: null,
        pay_schedule_type: 'monthly',
        pay_schedule_days: [1],
        income_type: null,
      } as any
    )

    expect(data.amountFormatPreference).toBe('smart')
  })

  it('returns the saved amount format preference', async () => {
    const { loadSettingsPageData } = await import('./settings')
    const data = await loadSettingsPageData(
      { id: 'user-1', email: 'user@example.com', user_metadata: {} } as any,
      {
        id: 'user-1',
        name: 'Test User',
        currency: 'KES',
        amount_format_preference: 'full',
        pay_schedule_type: 'monthly',
        pay_schedule_days: [1],
        income_type: null,
      } as any
    )

    expect(data.amountFormatPreference).toBe('full')
  })
})
