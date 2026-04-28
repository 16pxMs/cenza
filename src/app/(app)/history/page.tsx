export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAppSession } from '@/lib/auth/app-session'
import { loadHistoryAvailableCycleIdsForUser, loadHistoryPageData } from '@/lib/loaders/history'
import { deriveCurrentCycleId } from '@/lib/supabase/cycles-db'
import HistoryPageClient from './HistoryPageClient'

interface HistoryPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function isValidCycleParam(value: string | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function resolveRequestedCycle(
  requested: string | undefined,
  availableCycleIds: string[],
  currentCycleId: string,
): string | undefined {
  if (availableCycleIds.length === 0) {
    return undefined
  }

  if (!requested) {
    return availableCycleIds.includes(currentCycleId)
      ? undefined
      : availableCycleIds[availableCycleIds.length - 1]
  }

  if (requested > currentCycleId) {
    return availableCycleIds.includes(currentCycleId)
      ? undefined
      : availableCycleIds[availableCycleIds.length - 1]
  }

  if (availableCycleIds.includes(requested)) {
    return requested === currentCycleId ? undefined : requested
  }

  const nearestPast = [...availableCycleIds].reverse().find(cycleId => cycleId < requested)
  if (nearestPast) return nearestPast === currentCycleId ? undefined : nearestPast

  return availableCycleIds[0] === currentCycleId ? undefined : availableCycleIds[0]
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const { user, profile } = await getAppSession()

  if (!user || !profile) {
    redirect('/')
  }

  const resolved = searchParams ? await searchParams : {}
  const rawCycleParam = typeof resolved.cycle === 'string' ? resolved.cycle : undefined
  const cycleParam = isValidCycleParam(rawCycleParam) ? rawCycleParam : undefined

  const currentCycleId = deriveCurrentCycleId(profile)
  const availableCycleIds = await loadHistoryAvailableCycleIdsForUser(user.id)
  const resolvedCycle = resolveRequestedCycle(cycleParam, availableCycleIds, currentCycleId)

  if (rawCycleParam && cycleParam !== rawCycleParam) {
    redirect('/history')
  }

  if (resolvedCycle !== cycleParam) {
    redirect(resolvedCycle ? `/history?cycle=${resolvedCycle}` : '/history')
  }

  const targetDate = resolvedCycle ? new Date(`${resolvedCycle}T00:00:00`) : undefined

  const data = await loadHistoryPageData(user.id, profile, targetDate, availableCycleIds)

  return <HistoryPageClient data={data} targetCycleId={resolvedCycle} currentCycleId={currentCycleId} />
}
