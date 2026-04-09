'use client'

import { useRouter } from 'next/navigation'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { OverviewWithData } from '@/components/flows/overview/OverviewWithData'
import type { OverviewPageData } from '@/lib/loaders/overview'
import { addGoalContribution } from './actions'

interface AppPageClientProps {
  overview: OverviewPageData
}

export default function AppPageClient({ overview }: AppPageClientProps) {
  const router = useRouter()
  const { isDesktop } = useBreakpoint()
  const screen = (
    <OverviewWithData
      name={overview.name}
      currency={overview.currency}
      goals={overview.goals}
      incomeData={overview.incomeData}
      goalTargets={overview.goalTargets}
      goalSaved={overview.goalSaved}
      goalLabels={overview.goalLabels}
      onLogExpense={() => router.push('/log/new?returnTo=/app')}
      onContribGoal={async (goalId, goalLabel, amount, note) => {
        await addGoalContribution({ goalId, goalLabel, amount, note })
        router.refresh()
      }}
      totalSpent={overview.totalSpent}
      fixedTotal={overview.fixedTotal}
      spendingBudget={overview.spendingBudget}
      categorySpend={overview.categorySpend}
      recentActivity={overview.recentActivity}
      isDesktop={isDesktop}
    />
  )

  if (isDesktop) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <SideNav />
        <main style={{ flex: 1, maxWidth: 720, margin: '0 auto' }}>{screen}</main>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 88 }}>
      <main>{screen}</main>
      <BottomNav />
    </div>
  )
}
