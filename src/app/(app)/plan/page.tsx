export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAppSession } from '@/lib/auth/app-session'
import { loadPlanPageData } from '@/lib/loaders/plan'
import PlanPageClient from './PlanPageClient'

export default async function PlanPage() {
  const { user, profile } = await getAppSession()

  if (!user || !profile) {
    redirect('/')
  }

  const data = await loadPlanPageData(user.id, profile)

  return <PlanPageClient data={data} />
}
