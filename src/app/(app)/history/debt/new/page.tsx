export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAppSession } from '@/lib/auth/app-session'
import CreateDebtClient from './CreateDebtClient'

interface NewDebtPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function NewDebtPage({ searchParams }: NewDebtPageProps) {
  const { user, profile } = await getAppSession()

  if (!user || !profile) {
    redirect('/')
  }

  const resolvedSearchParams = searchParams ? await searchParams : {}
  const returnTo = firstValue(resolvedSearchParams.returnTo) ?? '/app'

  return (
    <CreateDebtClient
      currency={profile.currency}
      returnTo={returnTo}
    />
  )
}
