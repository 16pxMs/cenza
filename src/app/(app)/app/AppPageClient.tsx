'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { GlobalAddButton } from '@/components/layout/GlobalAddButton'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { OverviewWithData } from '@/components/flows/overview/OverviewWithData'
import { ReceivedIncomeSheet } from '@/components/flows/log/ReceivedIncomeSheet'
import type { OverviewCriticalData, OverviewSecondaryData } from '@/lib/loaders/overview'
import { addGoalContribution, confirmReceivedIncome, loadOverviewSecondary } from './actions'

interface AppPageClientProps {
  overview: OverviewCriticalData
}

export default function AppPageClient({ overview }: AppPageClientProps) {
  const router = useRouter()
  const { isDesktop } = useBreakpoint()
  const [receivedSheetOpen, setReceivedSheetOpen] = useState(false)
  const [secondaryOverview, setSecondaryOverview] = useState<OverviewSecondaryData | null>(null)

  useEffect(() => {
    if (!overview.hasStartedCycleData) return

    let cancelled = false
    loadOverviewSecondary()
      .then((data) => {
        if (!cancelled) {
          setSecondaryOverview(data)
        }
      })
      .catch((error) => {
        console.error('[overview] failed to load secondary data', error)
      })

    return () => {
      cancelled = true
    }
  }, [
    overview.hasStartedCycleData,
    overview.totalSpent,
    overview.incomeData.total,
    overview.incomeData.receivedConfirmedAt,
  ])

  const screen = (
    <>
      <OverviewWithData
        name={overview.name}
        currency={overview.currency}
        hasStartedCycleData={overview.hasStartedCycleData}
        incomeType={overview.incomeType}
        paydayDay={overview.paydayDay}
        goals={secondaryOverview?.goals ?? []}
        activeDebts={secondaryOverview?.activeDebts ?? []}
        incomeData={overview.incomeData}
        goalTargets={secondaryOverview?.goalTargets ?? null}
        goalSaved={secondaryOverview?.goalSaved ?? {}}
        goalLabels={secondaryOverview?.goalLabels ?? {}}
        selectedGoal={secondaryOverview?.selectedGoal ?? null}
        debtTotal={secondaryOverview?.debtTotal ?? 0}
        onReviewDebts={() => router.push('/history/debt?label=Debt&type=debt&returnTo=/app')}
        onConfirmIncome={() => setReceivedSheetOpen(true)}
        onContribGoal={async (goalId, goalLabel, amount, note) => {
          await addGoalContribution({ goalId, goalLabel, amount, note })
          router.refresh()
        }}
        totalSpent={overview.totalSpent}
        fixedTotal={secondaryOverview?.fixedTotal ?? 0}
        spendingBudget={secondaryOverview?.spendingBudget ?? null}
        categorySpend={secondaryOverview?.categorySpend ?? {}}
        recentActivity={secondaryOverview?.recentActivity ?? []}
        lastCycleRecurringTop={secondaryOverview?.lastCycleRecurringTop ?? null}
        monthlyReminders={secondaryOverview?.monthlyReminders ?? []}
        billsLeftToPay={secondaryOverview?.billsLeftToPay ?? null}
        overviewObligations={secondaryOverview?.overviewObligations ?? []}
        debtReminderCandidates={overview.debtReminderCandidates}
        secondaryLoaded={secondaryOverview != null}
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
      <GlobalAddButton returnTo="/app" />
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
