'use client'
import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { calculateTotalIncome } from '@/lib/math/finance'

interface Profile {
  id:       string
  currency: string
  pay_day:  number | null
  [key: string]: any
}

interface UserContextValue {
  user:    User | null
  profile: Profile | null
  loading: boolean
  /** Total income derived from profile income data. 0 until income is set. */
  profileIncome: number
}

const UserContext = createContext<UserContextValue>({ user: null, profile: null, loading: true, profileIncome: 0 })

export function UserProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const [user,    setUser]    = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUser(user)

      const { data: profile } = await (supabase.from('user_profiles') as any)
        .select('*')
        .eq('id', user.id)
        .single()

      setProfile(profile ?? null)
      setLoading(false)
    })()
  }, [])

  // Compute once — derived from profile income data, consistent everywhere
  const profileIncome = useMemo(
    () => calculateTotalIncome(profile as any ?? {}),
    [profile]
  )

  return (
    <UserContext.Provider value={{ user, profile, loading, profileIncome }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext)
