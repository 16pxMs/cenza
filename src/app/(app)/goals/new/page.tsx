export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAppSession } from '@/lib/auth/app-session'
import { loadNewGoalPageData } from '@/lib/loaders/new-goal'
import type { GoalId } from '@/types/database'
import NewGoalClient from './NewGoalClient'

interface NewGoalPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function parseGoalId(value: string | null): GoalId | null {
  const goalIds: GoalId[] = ['emergency', 'car', 'travel', 'home', 'education', 'business', 'family', 'other']
  return value && goalIds.includes(value as GoalId) ? (value as GoalId) : null
}

function parseGoalIdList(value: string | null): GoalId[] {
  if (!value) return []

  return value
    .split(',')
    .map(item => parseGoalId(item.trim()))
    .filter((item): item is GoalId => item != null)
}

export default async function NewGoalPage({ searchParams }: NewGoalPageProps) {
  const { user, profile } = await getAppSession()

  if (!user || !profile) {
    redirect('/')
  }

  const resolvedSearchParams = searchParams ? await searchParams : {}
  const typeParam = Array.isArray(resolvedSearchParams.type) ? resolvedSearchParams.type[0] : resolvedSearchParams.type
  const excludeParam = Array.isArray(resolvedSearchParams.exclude) ? resolvedSearchParams.exclude[0] : resolvedSearchParams.exclude
  const fromParam = Array.isArray(resolvedSearchParams.from) ? resolvedSearchParams.from[0] : resolvedSearchParams.from

  const initialGoalType = parseGoalId(typeParam ?? null)
  const excludeGoalIds = parseGoalIdList(excludeParam ?? null)
  const data = await loadNewGoalPageData(user.id, profile, initialGoalType)

  return (
    <NewGoalClient
      data={data}
      initialGoalType={initialGoalType}
      excludeGoalIds={excludeGoalIds}
      from={fromParam ?? null}
    />
  )
}
