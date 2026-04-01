export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAppSession } from '@/lib/auth/app-session'
import { loadTargetsPageData } from '@/lib/loaders/targets'
import TargetsPageClient from './TargetsPageClient'

export default async function TargetsPage() {
  const { user, profile } = await getAppSession()

  if (!user || !profile) {
    redirect('/')
  }

  const data = await loadTargetsPageData(user.id, profile)

  return <TargetsPageClient data={data} />
}
