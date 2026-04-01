export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAppSession } from '@/lib/auth/app-session'
import { loadIncomePageData } from '@/lib/loaders/income'
import IncomePageClient from './IncomePageClient'

interface IncomePageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
): string | null {
  const value = searchParams[key]
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
}

export default async function IncomePage({ searchParams }: IncomePageProps) {
  const { user, profile } = await getAppSession()

  if (!user || !profile) {
    redirect('/')
  }

  const resolvedSearchParams = searchParams ? await searchParams : {}
  const preview = readSearchParam(resolvedSearchParams, 'preview') === '1'
  const data = await loadIncomePageData(user.id, profile)

  return <IncomePageClient data={data} preview={preview} />
}
