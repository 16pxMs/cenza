export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getAppSession } from '@/lib/auth/app-session'
import { createOverviewProfileSnapshot, loadOverviewCriticalData } from '@/lib/loaders/overview'
import { logPerfSpan, timePerf } from '@/lib/perf/debug'
import AppPageClient from './AppPageClient'

export default async function AppPage() {
  const startedAt = Date.now()
  const pinVerified = (await cookies()).get('cenza-pin-verified')?.value === '1'
  const { user, profile } = await timePerf('overview.page', 'auth-profile-load', async () => getAppSession())

  if (!user || !profile) {
    redirect('/')
  }

  const overview = await timePerf('overview.page', 'critical-loader', async () =>
    loadOverviewCriticalData(user.id, profile)
  )
  logPerfSpan('overview.page', 'total', startedAt, {
    hasStartedCycleData: overview.hasStartedCycleData,
    debtReminderCandidateCount: overview.debtReminderCandidates.length,
    pinVerified,
  })
  if (pinVerified) {
    logPerfSpan('pin.post-unlock-app', 'first-app-load', startedAt, {
      hasStartedCycleData: overview.hasStartedCycleData,
      debtReminderCandidateCount: overview.debtReminderCandidates.length,
    })
  }

  return <AppPageClient overview={overview} overviewProfileSnapshot={createOverviewProfileSnapshot(profile)} />
}
