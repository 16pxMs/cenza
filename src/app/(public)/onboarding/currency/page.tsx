export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getOnboardingPageRedirect } from '@/lib/auth/auth-flow'
import { createClient } from '@/lib/supabase/server'
import { CurrencyClient } from '../CurrencyClient'

export default async function OnboardingCurrencyPage() {
  const supabase = await createClient()
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

  const pinVerified = (await cookies()).get('cenza-pin-verified')?.value === '1'
  const redirectPath = getOnboardingPageRedirect({
    requestedStep: 'currency',
    name: profile?.name,
    currency: profile?.currency,
    hasPin: !!profile?.pin_hash,
    onboardingComplete: !!profile?.onboarding_complete,
    pinVerified,
  })

  if (redirectPath) {
    redirect(redirectPath)
  }

  return <CurrencyClient />
}
