'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { SpendingBudgetEditor, type BudgetCategory } from '@/components/flows/plan/EditSpendingBudgetSheet'
import { SetupFlowPage } from '@/components/layout/SetupFlowPage/SetupFlowPage'
import { useToast } from '@/lib/context/ToastContext'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { saveSpendingBudget } from '../actions'

interface Props {
  currency: string
  initialCategories: BudgetCategory[]
  spendingHistory: Record<string, number>
  returnTo: string
}

export default function SpendingBudgetPageClient({
  currency,
  initialCategories,
  spendingHistory,
  returnTo,
}: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const { isDesktop } = useBreakpoint()
  const [isPending, startTransition] = useTransition()

  const handleSave = async (categories: BudgetCategory[]) => {
    try {
      await saveSpendingBudget(categories)
      toast('Spending budget updated')
      startTransition(() => router.push(returnTo))
    } catch {
      toast('Failed to update spending budget. Please try again.')
    }
  }

  return (
    <SetupFlowPage
      pageKey="spending_budget"
      onBack={() => router.push(returnTo)}
      isDesktop={isDesktop}
      isSaving={isPending}
    >
      <SpendingBudgetEditor
        initialCategories={initialCategories}
        currency={currency}
        onSave={handleSave}
        saving={isPending}
        spendingHistory={spendingHistory}
      />
    </SetupFlowPage>
  )
}
