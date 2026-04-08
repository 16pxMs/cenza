import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/types/database'
import { getPostAuthDestination } from './route-helpers'

const COOKIE_BASE = {
  path: '/',
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

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
        .select('id, onboarding_complete, pin_hash')
        .eq('id', user.id)
        .single()

      // First-time user → create profile
      if (!profile) {
        const safeName =
          typeof user.user_metadata?.full_name === 'string'
            ? user.user_metadata.full_name.split(' ')[0]
            : 'there'

        const { error: insertError } = await (supabase as any)
          .from('user_profiles')
          .insert({
            id:                  user.id,
            name:                safeName,
            pay_schedule_type:   'monthly',
            pay_schedule_days:   [1],
            goals:               [],
            onboarding_complete: false,
          })

        if (insertError) {
          console.error('Profile insert error:', insertError)
        }

        return withCookies(
          NextResponse.redirect(`${origin}/onboarding`),
          pendingCookies
        )
      }

      // Existing user
      const hasPin = !!profile.pin_hash
      const destination = getPostAuthDestination({
        onboardingComplete: profile.onboarding_complete,
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
      })

      if (hasPin) {
        redirectResponse.cookies.set('cenza-has-pin', '1', {
          ...COOKIE_BASE,
          httpOnly: false,
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

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
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
