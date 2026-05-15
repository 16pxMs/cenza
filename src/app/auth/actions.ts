'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { clearPinDeviceState } from '@/lib/actions/pin'
import { buildOAuthCallbackUrl } from '@/lib/auth/oauth-redirect'
import { tempAuthDebugLog } from '@/lib/auth/temp-auth-debug'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function signInWithGoogle(formData?: FormData) {
  const supabase = await createServerSupabaseClient()
  // Start OAuth from a clean auth state so cancelled/retried attempts
  // cannot inherit a stale existing session.
  await supabase.auth.signOut()
  const rawSource = formData?.get('source')
  const source = rawSource === 'start' ? 'start' : 'login'
  const fallbackPath = source === 'start' ? '/' : '/login'

  const requestHeaders = await headers()
  const redirectTo = buildOAuthCallbackUrl({
    source,
    headers: requestHeaders,
  })
  tempAuthDebugLog('signInWithGoogle called', {
    source,
    requestOrigin: requestHeaders.get('origin'),
    requestHost: requestHeaders.get('host'),
    forwardedHost: requestHeaders.get('x-forwarded-host'),
    forwardedProto: requestHeaders.get('x-forwarded-proto'),
    nextPublicSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    nextPublicSiteUrlUsesProduction: process.env.NEXT_PUBLIC_SITE_URL?.includes('cenza.vercel.app') ?? false,
    computedRedirectTo: redirectTo,
    computedRedirectUsesProduction: redirectTo.includes('cenza.vercel.app'),
  })
  tempAuthDebugLog('signInWithOAuth options', {
    provider: 'google',
    redirectTo,
    redirectToUsesProduction: redirectTo.includes('cenza.vercel.app'),
    queryParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  })

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
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
    tempAuthDebugLog('signInWithOAuth redirect url returned', {
      returnedUrl: data.url,
      returnedUrlUsesProduction: data.url.includes('cenza.vercel.app'),
      returnedUrlUsesLocalhost: data.url.includes('localhost:3000'),
    })
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
