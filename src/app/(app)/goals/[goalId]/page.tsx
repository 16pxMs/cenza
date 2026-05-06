export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import { getAppSession } from '@/lib/auth/app-session'
import { loadGoalsPageData } from '@/lib/loaders/goals'
import type { GoalId } from '@/types/database'
import GoalDetailPageClient from './GoalDetailPageClient'

interface PageProps {
  params: Promise<{ goalId: string }>
}

function isGoalId(value: string): value is GoalId {
  return ['emergency', 'car', 'travel', 'home', 'education', 'business', 'family', 'other'].includes(value)
}

export default async function GoalDetailPage({ params }: PageProps) {
  const { user, profile } = await getAppSession()

  if (!user || !profile) {
    redirect('/')
  }

  const { goalId } = await params
  if (!isGoalId(goalId)) notFound()

  const data = await loadGoalsPageData(user.id, profile)
  const goal = data.goalDataList.find(entry => entry.id === goalId)

  if (!goal || !data.goals.includes(goalId)) {
    notFound()
  }

  return (
    <GoalDetailPageClient
      currency={data.currency}
      amountFormatPreference={data.amountFormatPreference}
      goal={goal}
    />
  )
}
