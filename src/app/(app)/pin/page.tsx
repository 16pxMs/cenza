export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getAppSession } from '@/lib/auth/app-session'
import { PinEntryClient } from './PinEntryClient'

export default async function PinPage() {
  const { user, profile } = await getAppSession()
  if (!user || !profile) {
    redirect('/login?tab=login')
  }

  const jar = await cookies()
  if (jar.get('cenza-pin-verified')?.value === '1') {
    redirect('/app')
  }

  if (!profile.pin_hash) {
    redirect('/app')
  }

  const isFreshSession = jar.get('cenza-fresh-auth')?.value === '1'

  return <PinEntryClient isFreshSession={isFreshSession} name={profile.name ?? ''} />
}
