'use client'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { calculateTotalIncome } from '@/lib/math/finance'
import { profileToPaySchedule } from '@/lib/cycles'
import type { PaySchedule, UserProfile } from '@/types/database'
import { fetchProfile, loadCurrentUserState } from './user-session'

interface UserContextValue {
  user:          User | null
  profile:       UserProfile | null
  paySchedule:   PaySchedule   // derived, never null — defaults to monthly/[1]
  loading:       boolean
  error:         string | null
  refreshProfile: () => Promise<void>
  /** Total income derived from profile income data. 0 until income is set. */
  profileIncome: number
}

const UserContext = createContext<UserContextValue>({
  user: null, profile: null,
  paySchedule: { type: 'monthly', days: [1] },
  loading: true,
  error: null,
  refreshProfile: async () => {},
  profileIncome: 0,
})

const EMPTY_INCOME_SHAPE = {}
const EMPTY_SCHEDULE_SHAPE = {
  pay_schedule_type: null,
  pay_schedule_days: null,
} as const

interface UserProviderProps {
  children: React.ReactNode
  initialUser?: User | null
  initialProfile?: UserProfile | null
}

export function UserProvider({
  children,
  initialUser = null,
  initialProfile = null,
}: UserProviderProps) {
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState<User | null>(initialUser)
  const [profile, setProfile] = useState<UserProfile | null>(initialProfile)
  const [loading, setLoading] = useState(!initialUser)
  const [error, setError] = useState<string | null>(null)

  async function refreshProfile() {
    try {
      const { user: currentUser, profile: nextProfile } = await loadCurrentUserState(supabase)
      setUser(currentUser)

      if (!currentUser) {
        setProfile(null)
        setError(null)
        setLoading(false)
        return
      }

      setProfile(nextProfile)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh profile')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    async function syncUserState() {
      try {
        const { user: currentUser, profile: nextProfile } = await loadCurrentUserState(supabase)
        if (!active) return

        if (!currentUser) {
          setUser(null)
          setProfile(null)
          setLoading(false)
          return
        }

        setUser(currentUser)
        setProfile(nextProfile)
        setError(null)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load profile')
      } finally {
        if (active) setLoading(false)
      }
    }

    if (!initialUser) {
      syncUserState()
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active) return

      const nextUser = session?.user ?? null
      setUser(nextUser)

      if (!nextUser) {
        setProfile(null)
        setError(null)
        setLoading(false)
        return
      }

      try {
        const nextProfile = await fetchProfile(supabase, nextUser.id)
        if (!active) return

        setProfile(nextProfile)
        setError(null)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load profile')
      } finally {
        if (active) setLoading(false)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [initialUser, supabase])

  // Compute once — derived from profile income data, consistent everywhere
  const profileIncome = useMemo(
    () => calculateTotalIncome(profile ?? EMPTY_INCOME_SHAPE),
    [profile]
  )

  const paySchedule = useMemo(
    () => profileToPaySchedule(profile ?? EMPTY_SCHEDULE_SHAPE),
    [profile]
  )

  return (
    <UserContext.Provider value={{ user, profile, loading, error, refreshProfile, profileIncome, paySchedule }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext)
