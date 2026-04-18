export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getOnboardingDestination } from '@/lib/auth/auth-flow'

export default async function OnboardingIndexPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?tab=login')
  }

  const { data: profile } = await (supabase as any)
    .from('user_profiles')
    .select('name, currency, pin_hash, onboarding_complete')
    .eq('id', user.id)
    .single()

  if (profile?.onboarding_complete) {
    redirect(profile.pin_hash ? '/pin' : '/app')
  }

  redirect(
    getOnboardingDestination({
      name: profile?.name,
      currency: profile?.currency,
      hasPin: !!profile?.pin_hash,
    })
  )
}
