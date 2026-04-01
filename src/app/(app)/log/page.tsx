export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAppSession } from '@/lib/auth/app-session'
import { loadLogPageData } from '@/lib/loaders/log'
import LogPageClient from './LogPageClient'

export default async function LogPage() {
  const { user, profile } = await getAppSession()

  if (!user || !profile) {
    redirect('/')
  }

  const data = await loadLogPageData(user.id, profile)

  return <LogPageClient data={data} />
}
