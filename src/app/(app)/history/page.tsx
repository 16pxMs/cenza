export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAppSession } from '@/lib/auth/app-session'
import { loadHistoryPageData } from '@/lib/loaders/history'
import HistoryPageClient from './HistoryPageClient'

interface HistoryPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function currentYM() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function isValidMonthParam(value: string | undefined): value is string {
  return !!value && /^\d{4}-\d{2}$/.test(value)
}

function resolveRequestedMonth(
  requested: string | undefined,
  availableMonths: string[],
): string | undefined {
  const currentMonth = currentYM()

  if (availableMonths.length === 0) {
    return undefined
  }

  if (!requested) {
    return availableMonths.includes(currentMonth)
      ? undefined
      : availableMonths[availableMonths.length - 1]
  }

  if (requested > currentMonth) {
    return availableMonths.includes(currentMonth)
      ? undefined
      : availableMonths[availableMonths.length - 1]
  }

  if (availableMonths.includes(requested)) {
    return requested === currentMonth ? undefined : requested
  }

  const nearestPast = [...availableMonths].reverse().find(month => month < requested)
  if (nearestPast) return nearestPast === currentMonth ? undefined : nearestPast

  return availableMonths[0] === currentMonth ? undefined : availableMonths[0]
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const { user, profile } = await getAppSession()

  if (!user || !profile) {
    redirect('/')
  }

  const resolved = searchParams ? await searchParams : {}
  const rawMonthParam = typeof resolved.month === 'string' ? resolved.month : undefined
  const monthParam = isValidMonthParam(rawMonthParam) ? rawMonthParam : undefined

  const currentData = await loadHistoryPageData(user.id, profile)
  const resolvedMonth = resolveRequestedMonth(monthParam, currentData.availableMonths)

  if (rawMonthParam && monthParam !== rawMonthParam) {
    redirect('/history')
  }

  if (resolvedMonth !== monthParam) {
    redirect(resolvedMonth ? `/history?month=${resolvedMonth}` : '/history')
  }

  const targetDate = resolvedMonth ? new Date(`${resolvedMonth}-01T00:00:00`) : undefined

  const data = targetDate ? await loadHistoryPageData(user.id, profile, targetDate) : currentData

  return <HistoryPageClient data={data} targetMonth={resolvedMonth} />
}
