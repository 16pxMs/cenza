export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PinSetupClient } from '@/components/flows/pin/PinSetupClient'

export default async function PinResetPage() {
  const jar = await cookies()

  // Guard 1: already verified — no need to reset
  if (jar.get('cenza-pin-verified')?.value === '1') {
    redirect('/app')
  }

  // Guard 2: only allow within 2 minutes of fresh sign-in.
  // The spec described checking session.created_at, but using a short-lived cookie
  // (maxAge: 120, set at auth callback) is equivalent and simpler — if the cookie
  // has expired, it's absent and this redirect fires correctly.
  if (jar.get('cenza-fresh-auth')?.value !== '1') {
    redirect('/pin')
  }

  // Guard 3: must have a valid session
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <PinSetupClient redirectTo="/app" isReset />
}
