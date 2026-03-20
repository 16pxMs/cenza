'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

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
}

const UserContext = createContext<UserContextValue>({ user: null, profile: null, loading: true })

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

  return (
    <UserContext.Provider value={{ user, profile, loading }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext)
