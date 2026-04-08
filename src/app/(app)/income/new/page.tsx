export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAppSession } from '@/lib/auth/app-session'
import { loadIncomePageData } from '@/lib/loaders/income'
import IncomeFlowPageClient from './IncomeFlowPageClient'

interface IncomeFlowPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
): string | null {
  const value = searchParams[key]
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
}

export default async function IncomeFlowPage({ searchParams }: IncomeFlowPageProps) {
  const { user, profile } = await getAppSession()

  if (!user || !profile) {
    redirect('/')
  }

  const resolvedSearchParams = searchParams ? await searchParams : {}
  const returnTo = readSearchParam(resolvedSearchParams, 'returnTo') ?? '/income'
  const data = await loadIncomePageData(user.id, profile)

  return (
    <IncomeFlowPageClient
      currency={data.currency}
      incomeType={data.incomeType}
      returnTo={returnTo}
    />
  )
}
