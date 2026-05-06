export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getAppSession } from '@/lib/auth/app-session'
import { loadEntryById } from '@/lib/loaders/log'
import { EditEntryFlowClient } from './EditEntryFlowClient'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function firstSearchParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function resolveReturnTo(value: string | string[] | undefined, fallback: string): string {
  const candidate = firstSearchParam(value)?.trim()
  if (!candidate) return fallback
  if (!candidate.startsWith('/')) return fallback
  if (candidate.startsWith('//')) return fallback
  if (candidate.includes('://')) return fallback
  return candidate
}

export default async function EditEntryPage({ params, searchParams }: PageProps) {
  const { user, profile } = await getAppSession()
  if (!user || !profile) redirect('/')

  const { id } = await params
  const result = await loadEntryById(user.id, profile, id)
  if (!result) notFound()

  const resolvedSearchParams = searchParams ? await searchParams : {}
  const returnTo = resolveReturnTo(resolvedSearchParams.returnTo, `/log/${id}`)

  return (
    <Suspense>
      <EditEntryFlowClient
        entry={result.entry}
        currency={result.currency}
        returnTo={returnTo}
      />
    </Suspense>
  )
}
