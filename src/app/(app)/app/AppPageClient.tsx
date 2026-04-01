'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { OverviewWithData } from '@/components/flows/overview/OverviewWithData'
import { FirstTimeWelcome } from '@/components/flows/overview/FirstTimeWelcome'
import { OverviewLocked } from '@/components/flows/overview/OverviewLocked'
import type { OverviewPageData } from '@/lib/loaders/overview'
import { addGoalContribution } from './actions'

interface AppPageClientProps {
  overview: OverviewPageData
}

export default function AppPageClient({ overview }: AppPageClientProps) {
  const router = useRouter()
  const { isDesktop } = useBreakpoint()
  const [skipCount, setSkipCount] = useState(0)

  useEffect(() => {
    setSkipCount(parseInt(localStorage.getItem('cenza_skip_count') ?? '0', 10))
  }, [])

  const hasIncome = overview.incomeData.total > 0

  const screen = !hasIncome && skipCount === 0
    ? (
      <FirstTimeWelcome
        name={overview.name}
        onStart={() => router.push('/log/first')}
      />
    )
    : !hasIncome && skipCount >= 1
      ? (
        <OverviewLocked
          name={overview.name}
          currency={overview.currency}
          onStart={(category) =>
            router.push(category
              ? `/log/first?category=${encodeURIComponent(category)}`
              : '/log/first'
            )
          }
        />
      )
      : (
        <OverviewWithData
          name={overview.name}
          currency={overview.currency}
          goals={overview.goals}
          incomeData={overview.incomeData}
          goalTargets={overview.goalTargets}
          goalSaved={overview.goalSaved}
          goalLabels={overview.goalLabels}
          onLogExpense={() => router.push('/log/new?isOther=true')}
          onContribGoal={async (goalId, goalLabel, amount, note) => {
            await addGoalContribution({ goalId, goalLabel, amount, note })
            router.refresh()
          }}
          totalSpent={overview.totalSpent}
          fixedTotal={overview.fixedTotal}
          spendingBudget={overview.spendingBudget}
          categorySpend={overview.categorySpend}
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
