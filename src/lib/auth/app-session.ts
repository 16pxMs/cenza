import { cache } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { UserProfile } from '@/types/database'

async function loadUserProfile(
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<UserProfile | null> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  return profile ?? null
}

export interface AppSession {
  user: User | null
  profile: UserProfile | null
}

export const getAppSession = cache(async (): Promise<AppSession> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, profile: null }
  }

  const profile = await loadUserProfile(user.id, supabase)
  return { user, profile }
})
