export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAppSession } from '@/lib/auth/app-session'
import { loadGoalsPageData } from '@/lib/loaders/goals'
import GoalsPageClient from './GoalsPageClient'

export default async function GoalsPage() {
  const { user, profile } = await getAppSession()

  if (!user || !profile) {
    redirect('/')
  }

  const data = await loadGoalsPageData(user.id, profile)

  return <GoalsPageClient data={data} />
}
