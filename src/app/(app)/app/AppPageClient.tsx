'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { OverviewWithData } from '@/components/flows/overview/OverviewWithData'
import { ReceivedIncomeSheet } from '@/components/flows/log/ReceivedIncomeSheet'
import type { OverviewPageData } from '@/lib/loaders/overview'
import { addGoalContribution, confirmReceivedIncome } from './actions'

interface AppPageClientProps {
  overview: OverviewPageData
}

export default function AppPageClient({ overview }: AppPageClientProps) {
  const router = useRouter()
  const { isDesktop } = useBreakpoint()
  const [receivedSheetOpen, setReceivedSheetOpen] = useState(false)
  const screen = (
    <>
      <OverviewWithData
        name={overview.name}
        currency={overview.currency}
        incomeType={overview.incomeType}
        paydayDay={overview.paydayDay}
        goals={overview.goals}
        incomeData={overview.incomeData}
        goalTargets={overview.goalTargets}
        goalSaved={overview.goalSaved}
        goalLabels={overview.goalLabels}
        debtTotal={overview.debtTotal}
        onAddDebts={() => router.push('/log/new?label=Debt&type=debt&key=debt&returnTo=/app')}
        onReviewDebts={() => router.push('/history/debt?label=Debt&type=debt&returnTo=/app')}
        onLogExpense={() => router.push('/log/new?returnTo=/app')}
        onConfirmIncome={() => setReceivedSheetOpen(true)}
        onContribGoal={async (goalId, goalLabel, amount, note) => {
          await addGoalContribution({ goalId, goalLabel, amount, note })
          router.refresh()
        }}
        totalSpent={overview.totalSpent}
        fixedTotal={overview.fixedTotal}
        spendingBudget={overview.spendingBudget}
        categorySpend={overview.categorySpend}
        recentActivity={overview.recentActivity}
        lastCycleRecurringTop={overview.lastCycleRecurringTop}
        isDesktop={isDesktop}
      />
      <ReceivedIncomeSheet
        open={receivedSheetOpen}
        onClose={() => setReceivedSheetOpen(false)}
        declaredTotal={overview.incomeData.total}
        currency={overview.currency}
        incomeType={overview.incomeType}
        paydayDay={overview.paydayDay}
        onConfirm={async (received, receivedDate) => {
          await confirmReceivedIncome(received, receivedDate)
          setReceivedSheetOpen(false)
          router.refresh()
        }}
      />
    </>
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
