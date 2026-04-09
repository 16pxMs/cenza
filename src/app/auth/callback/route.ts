import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/types/database'
import { getPostAuthDestination } from '@/lib/auth/auth-flow'
import { getCallbackFailureContext } from './failure-context'

const COOKIE_BASE = {
  path: '/',
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
}
const KNOWN_DEVICE_MAX_AGE = 60 * 60 * 24 * 30

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const authError = searchParams.get('error')
  const next = searchParams.get('next') ?? '/'
  const failureContext = getCallbackFailureContext(searchParams.get('source'), authError)
  const source = failureContext.source

  if (code) {
    type CookieEntry = { name: string; value: string; options: object }
    const pendingCookies: CookieEntry[] = []

    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookiesToSet: CookieEntry[]) => {
            pendingCookies.push(...cookiesToSet)
          },
        },
      }
    )

    const {
      data: { user },
      error,
    } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && user) {
      // Check if profile exists
      const { data: profile } = await (supabase as any)
        .from('user_profiles')
        .select('id, name, onboarding_complete, pin_hash, currency, pay_schedule_type, pay_schedule_days')
        .eq('id', user.id)
        .single()

      // First-time user → create profile
      if (!profile) {
        const baseProfile = {
          id:                  user.id,
          // Keep onboarding explicit: blank values force name/currency steps.
          name:                '',
          currency:            '',
          pay_schedule_type:   null,
          pay_schedule_days:   null,
          goals:               [],
          onboarding_complete: false,
        }

        const { error: insertError } = await (supabase as any)
          .from('user_profiles')
          .insert(baseProfile)

        if (insertError) {
          console.error('Profile insert error:', insertError)
          const { error: upsertError } = await (supabase as any)
            .from('user_profiles')
            .upsert(baseProfile, { onConflict: 'id' })

          if (upsertError) {
            console.error('Profile upsert error:', upsertError)
            return await clearSessionAndRedirect(request, `${origin}${failureContext.fallbackPath}?error=auth_callback_failed`)
          }
        }

        return withCookies(
          NextResponse.redirect(`${origin}/onboarding`),
          pendingCookies
        )
      }

      // Existing user
      if (
        profile &&
        !profile.onboarding_complete &&
        profile.pay_schedule_type === 'monthly' &&
        Array.isArray(profile.pay_schedule_days) &&
        profile.pay_schedule_days.length === 1 &&
        Number(profile.pay_schedule_days[0]) === 1
      ) {
        const { error: scrubError } = await (supabase as any)
          .from('user_profiles')
          .update({
            pay_schedule_type: null,
            pay_schedule_days: null,
          })
          .eq('id', user.id)

        if (!scrubError) {
          profile.pay_schedule_type = null
          profile.pay_schedule_days = null
        } else {
          console.error('Legacy seeded pay schedule scrub error:', scrubError)
        }
      }

      const hasPin = !!profile.pin_hash
      const destination = getPostAuthDestination({
        onboardingComplete: profile.onboarding_complete,
        name: profile.name,
        currency: profile.currency,
        hasPin,
        next,
      })

      const redirectResponse = withCookies(
        NextResponse.redirect(`${origin}${destination}`),
        pendingCookies
      )

      redirectResponse.cookies.set('cenza-returning-user', user.id, {
        ...COOKIE_BASE,
        httpOnly: false,
        maxAge: KNOWN_DEVICE_MAX_AGE,
      })

      if (hasPin) {
        redirectResponse.cookies.set('cenza-has-pin', '1', {
          ...COOKIE_BASE,
          httpOnly: false,
          maxAge: KNOWN_DEVICE_MAX_AGE,
        })
      }

      // Set a 2-minute fresh-auth cookie so /pin can offer PIN reset
      // after the forgot-PIN sign-out → sign-in flow.
      if (profile.onboarding_complete) {
        redirectResponse.cookies.set('cenza-fresh-auth', '1', {
          ...COOKIE_BASE,
          httpOnly: false,
          maxAge: 120,
        })
      }

      return redirectResponse
    }
  }

  return await clearSessionAndRedirect(
    request,
    `${origin}${failureContext.fallbackPath}?error=${failureContext.fallbackError}`
  )
}

function withCookies(
  response: NextResponse,
  cookies: Array<{ name: string; value: string; options: object }>
): NextResponse {
  cookies.forEach(({ name, value, options }) => {
    response.cookies.set(
      name,
      value,
      options as Parameters<typeof response.cookies.set>[2]
    )
  })
  return response
}

async function clearSessionAndRedirect(request: NextRequest, destination: string) {
  type CookieEntry = { name: string; value: string; options: object }
  const pendingCookies: CookieEntry[] = []

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: CookieEntry[]) => {
          pendingCookies.push(...cookiesToSet)
        },
      },
    }
  )

  await supabase.auth.signOut()

  const response = withCookies(NextResponse.redirect(destination), pendingCookies)
  response.cookies.set('cenza-pin-verified', '', { ...COOKIE_BASE, maxAge: 0 })
  response.cookies.set('cenza-fresh-auth', '', { ...COOKIE_BASE, maxAge: 0 })
  return response
}
