'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AddIncomeFlow, type IncomeData } from '@/components/flows/income/AddIncomeFlow'
import { SetupFlowPage } from '@/components/layout/SetupFlowPage/SetupFlowPage'
import { useToast } from '@/lib/context/ToastContext'
import { useUser } from '@/lib/context/UserContext'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { saveIncome } from '../actions'

interface Props {
  currency: string
  incomeType: 'salaried' | 'variable' | null
  returnTo: string
}

export default function IncomeFlowPageClient({ currency, incomeType, returnTo }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const { refreshProfile } = useUser()
  const { isDesktop } = useBreakpoint()
  const [isPending, startTransition] = useTransition()
  const [flowStep, setFlowStep] = useState<'type' | 'amount'>(incomeType == null ? 'type' : 'amount')

  const handleBack = () => {
    if (incomeType == null && flowStep === 'amount') {
      setFlowStep('type')
      return
    }

    router.push(returnTo)
  }

  const handleSave = async (input: IncomeData) => {
    try {
      await saveIncome(input)
      await refreshProfile()
      toast('Income updated')
      startTransition(() => router.push(returnTo))
    } catch {
      toast('Failed to update income. Please try again.')
    }
  }

  return (
    <SetupFlowPage
      pageKey={incomeType == null ? 'income_new' : 'income_edit'}
      onBack={handleBack}
      isDesktop={isDesktop}
      isSaving={isPending}
    >
      <AddIncomeFlow
        incomeType={incomeType}
        currency={currency}
        onSave={handleSave}
        onBack={incomeType == null ? undefined : () => router.push(returnTo)}
        step={flowStep}
        onStepChange={setFlowStep}
        showInnerBack={false}
      />
    </SetupFlowPage>
  )
}
