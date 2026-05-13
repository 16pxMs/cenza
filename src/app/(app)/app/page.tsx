export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAppSession } from '@/lib/auth/app-session'
import { createOverviewProfileSnapshot, loadOverviewCriticalData } from '@/lib/loaders/overview'
import { logPerfSpan, timePerf } from '@/lib/perf/debug'
import AppPageClient from './AppPageClient'

export default async function AppPage() {
  const startedAt = Date.now()
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
  })

  return <AppPageClient overview={overview} overviewProfileSnapshot={createOverviewProfileSnapshot(profile)} />
}
