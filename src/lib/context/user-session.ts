import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { UserProfile } from '@/types/database'

export async function fetchProfile(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<UserProfile | null> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  return profile ?? null
}

export async function loadCurrentUserState(supabase: ReturnType<typeof createClient>): Promise<{
  user: User | null
  profile: UserProfile | null
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, profile: null }
  }

  const profile = await fetchProfile(supabase, user.id)
  return { user, profile }
}
