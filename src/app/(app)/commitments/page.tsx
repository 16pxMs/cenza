export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAppSession } from '@/lib/auth/app-session'
import { loadCommitmentsPageData } from '@/lib/loaders/commitments'
import CommitmentsPageClient from './CommitmentsPageClient'

export default async function CommitmentsPage() {
  const { user, profile } = await getAppSession()

  if (!user || !profile) {
    redirect('/')
  }

  const data = await loadCommitmentsPageData(user.id, profile)

  return <CommitmentsPageClient data={data} />
}
