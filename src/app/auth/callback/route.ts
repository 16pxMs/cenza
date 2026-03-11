import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get('code')
  const next  = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
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
        return NextResponse.redirect(`${origin}/onboarding`)
      }

      // Existing user — route based on onboarding status
      const destination = profile.onboarding_complete ? next : '/onboarding'
      return NextResponse.redirect(`${origin}${destination}`)
    }
  }

  // Auth failed
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
