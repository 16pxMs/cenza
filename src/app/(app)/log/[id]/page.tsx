export const dynamic = 'force-dynamic'

import { redirect, notFound } from 'next/navigation'
import { Suspense } from 'react'
import { getAppSession } from '@/lib/auth/app-session'
import { loadEntryById } from '@/lib/loaders/log'
import { EntryActionsClient } from './EntryActionsClient'

export default async function EntryActionsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { user, profile } = await getAppSession()
  if (!user || !profile) redirect('/')

  const { id } = await params
  const result = await loadEntryById(user.id, profile, id)
  if (!result) notFound()

  return (
    <Suspense>
      <EntryActionsClient entry={result.entry} currency={result.currency} />
    </Suspense>
  )
}
