export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAppSession } from '@/lib/auth/app-session'
import { loadHistoryPageData } from '@/lib/loaders/history'
import HistoryPageClient from './HistoryPageClient'

export default async function HistoryPage() {
  const { user, profile } = await getAppSession()

  if (!user || !profile) {
    redirect('/')
  }

  const data = await loadHistoryPageData(user.id, profile)

  return <HistoryPageClient data={data} />
}
