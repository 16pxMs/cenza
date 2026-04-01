export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAppSession } from '@/lib/auth/app-session'
import { loadSettingsPageData } from '@/lib/loaders/settings'
import SettingsPageClient from './SettingsPageClient'

export default async function SettingsPage() {
  const { user, profile } = await getAppSession()

  if (!user || !profile) {
    redirect('/')
  }

  const data = await loadSettingsPageData(user, profile)

  return <SettingsPageClient data={data} />
}
