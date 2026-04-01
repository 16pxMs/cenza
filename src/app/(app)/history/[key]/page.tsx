export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAppSession } from '@/lib/auth/app-session'
import { loadHistoryLedgerPageData } from '@/lib/loaders/history-ledger'
import type { CategoryType } from '@/types/database'
import CategoryLedgerPageClient from './CategoryLedgerPageClient'

interface PageProps {
  params: Promise<{ key: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
): string | null {
  const value = searchParams[key]
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export default async function CategoryLedgerPage({ params, searchParams }: PageProps) {
  const [{ key }, resolvedSearchParams, session] = await Promise.all([
    params,
    searchParams,
    getAppSession(),
  ])

  if (!session.user || !session.profile) {
    redirect('/')
  }

  const categoryLabel = readSearchParam(resolvedSearchParams, 'label') ?? key
  const planned = Number(readSearchParam(resolvedSearchParams, 'planned') ?? 0)
  const categoryType = (readSearchParam(resolvedSearchParams, 'type') ?? 'everyday') as CategoryType
  const data = await loadHistoryLedgerPageData(session.user.id, session.profile, key)

  return (
    <CategoryLedgerPageClient
      data={data}
      categoryKey={key}
      categoryLabel={categoryLabel}
      planned={planned}
      categoryType={categoryType}
    />
  )
}
