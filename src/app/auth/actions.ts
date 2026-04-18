'use server'

import { redirect } from 'next/navigation'
import { clearPinDeviceState } from '@/lib/actions/pin'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function signInWithGoogle(formData?: FormData) {
  const supabase = await createServerSupabaseClient()
  // Start OAuth from a clean auth state so cancelled/retried attempts
  // cannot inherit a stale existing session.
  await supabase.auth.signOut()
  const rawSource = formData?.get('source')
  const source = rawSource === 'start' ? 'start' : 'login'
  const fallbackPath = source === 'start' ? '/' : '/login'

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000'

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?source=${source}`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })

  if (error) {
    console.error('OAuth error:', error)
    redirect(`${fallbackPath}?error=oauth_start_failed`)
  }

  if (data?.url) {
    redirect(data.url)
  }
}

export async function signOut() {
  await clearPinDeviceState()
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  redirect('/login?tab=login')
}

export async function reconnectWithGoogle() {
  const formData = new FormData()
  formData.set('source', 'login')
  await signInWithGoogle(formData)
}

export async function signOutAndForgetDevice() {
  await clearPinDeviceState({ forgetDevice: true })
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  redirect('/login?tab=login')
}
