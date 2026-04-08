export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAppSession } from '@/lib/auth/app-session'
import { loadSpendingBudgetSetupPageData } from '@/lib/loaders/income'
import SpendingBudgetPageClient from './SpendingBudgetPageClient'

interface SpendingBudgetPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
): string | null {
  const value = searchParams[key]
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
}

export default async function SpendingBudgetPage({ searchParams }: SpendingBudgetPageProps) {
  const { user, profile } = await getAppSession()

  if (!user || !profile) {
    redirect('/')
  }

  const resolvedSearchParams = searchParams ? await searchParams : {}
  const returnTo = readSearchParam(resolvedSearchParams, 'returnTo') ?? '/income'
  const data = await loadSpendingBudgetSetupPageData(user.id, profile)

  return (
    <SpendingBudgetPageClient
      currency={data.currency}
      initialCategories={(data.spendingBudget?.categories ?? []) as import('@/components/flows/plan/EditSpendingBudgetSheet').BudgetCategory[]}
      spendingHistory={data.spendingHistory}
      returnTo={returnTo}
    />
  )
}
