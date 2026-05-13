export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getAppSession } from '@/lib/auth/app-session'
import { logPerfSpan, timePerf } from '@/lib/perf/debug'
import { PinEntryClient } from './PinEntryClient'

export default async function PinPage() {
  const startedAt = Date.now()
  const { user, profile } = await timePerf('pin.page', 'auth-profile-load', async () => getAppSession())
  if (!user || !profile) {
    logPerfSpan('pin.page', 'redirect', startedAt, { destination: '/login', reason: 'unauthenticated' })
    redirect('/login?tab=login')
  }

  const jar = await timePerf('pin.page', 'cookie-read', async () => cookies())
  if (jar.get('cenza-pin-verified')?.value === '1') {
    logPerfSpan('pin.page', 'redirect', startedAt, { destination: '/app', reason: 'already-verified' })
    redirect('/app')
  }

  if (!profile.pin_hash) {
    logPerfSpan('pin.page', 'redirect', startedAt, { destination: '/app', reason: 'no-pin' })
    redirect('/app')
  }

  const displayFirstName = profile.name?.trim().split(/\s+/)[0] || ''
  logPerfSpan('pin.page', 'render-client', startedAt, {
    hasName: !!displayFirstName,
    hasPin: true,
  })

  return <PinEntryClient name={displayFirstName} />
}
