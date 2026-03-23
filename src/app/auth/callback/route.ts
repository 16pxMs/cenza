import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

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
        .select('id, onboarding_complete')
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
            id: user.id,
            name: safeName,
            month_start: 'first',
            custom_day: null,
            goals: [],
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
      const destination = profile.onboarding_complete ? next : '/onboarding'

      return withCookies(
        NextResponse.redirect(`${origin}${destination}`),
        pendingCookies
      )
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