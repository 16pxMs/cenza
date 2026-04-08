export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAppSession } from '@/lib/auth/app-session'
import { loadFixedExpensesSetupPageData } from '@/lib/loaders/income'
import FixedExpensesPageClient from './FixedExpensesPageClient'

interface FixedExpensesPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
): string | null {
  const value = searchParams[key]
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
}

export default async function FixedExpensesPage({ searchParams }: FixedExpensesPageProps) {
  const { user, profile } = await getAppSession()

  if (!user || !profile) {
    redirect('/')
  }

  const resolvedSearchParams = searchParams ? await searchParams : {}
  const returnTo = readSearchParam(resolvedSearchParams, 'returnTo') ?? '/income'
  const data = await loadFixedExpensesSetupPageData(user.id, profile)

  return (
    <FixedExpensesPageClient
      currency={data.currency}
      initialEntries={(data.fixedExpenses?.entries ?? []) as import('@/components/flows/plan/EditFixedExpensesSheet').FixedEntry[]}
      returnTo={returnTo}
    />
  )
}
