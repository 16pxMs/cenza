export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAppSession } from '@/lib/auth/app-session'
import { loadOverviewCriticalData } from '@/lib/loaders/overview'
import AppPageClient from './AppPageClient'

export default async function AppPage() {
  const { user, profile } = await getAppSession()

  if (!user || !profile) {
    redirect('/')
  }

  const overview = await loadOverviewCriticalData(user.id, profile)

  return <AppPageClient overview={overview} />
}
