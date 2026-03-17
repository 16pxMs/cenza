import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    // Collect cookies written during the exchange so we can attach
    // them to the redirect response — cookies() from next/headers does
    // not reliably propagate to an explicit NextResponse.redirect().
    const pendingCookies: Array<{ name: string; value: string; options: object }> = []

    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookiesToSet) => pendingCookies.push(...cookiesToSet),
        },
      }
    )

    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && user) {
      // Check if user_profile exists — create stub if first sign-in
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, onboarding_complete')
        .eq('id', user.id)
        .single()

      if (!profile) {
        // First sign-in — create minimal profile, onboarding will fill the rest
        await supabase.from('user_profiles').insert({
          id:                  user.id,
          name:                user.user_metadata?.full_name?.split(' ')[0] ?? 'there',
          currency:            'KES',
          month_start:         'first',
          custom_day:          null,
          goals:               [],
          onboarding_complete: false,
        })
        return withCookies(NextResponse.redirect(`${origin}/onboarding`), pendingCookies)
      }

      // Existing user — route based on onboarding status
      const destination = profile.onboarding_complete ? next : '/onboarding'
      return withCookies(NextResponse.redirect(`${origin}${destination}`), pendingCookies)
    }
  }

  // Auth failed
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}

function withCookies(
  response: NextResponse,
  cookies: Array<{ name: string; value: string; options: object }>
): NextResponse {
  cookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
  )
  return response
}
