'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AddIncomeFlow, type IncomeData } from '@/components/flows/income/AddIncomeFlow'
import { SetupFlowPage } from '@/components/layout/SetupFlowPage/SetupFlowPage'
import { useToast } from '@/lib/context/ToastContext'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { saveIncome } from '../actions'

interface Props {
  currency: string
  incomeType: 'salaried' | 'variable' | null
  paydayDay: number | null
  incomeData: {
    salary: number | string | null
    extra_income: Array<{ id?: string | number; label?: string; amount?: number | string }> | null
    total: number | string | null
    cycle_start_mode?: 'full_month' | 'mid_month' | null
    opening_balance?: number | string | null
  } | null
  returnTo: string
}

function resolveReturnPath(returnTo: string): string {
  const trimmed = (returnTo || '').trim()
  if (!trimmed.startsWith('/')) return '/app'

  // /income is preview-only and redirects, so always land on app after save.
  if (trimmed === '/income' || trimmed.startsWith('/income?')) return '/app'

  // Guard against accidental self-redirect loops.
  if (trimmed.startsWith('/income/new')) return '/app'

  return trimmed
}

export default function IncomeFlowPageClient({ currency, incomeType, paydayDay, incomeData, returnTo }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const { isDesktop } = useBreakpoint()
  const [saving, setSaving] = useState(false)
  const [flowStep, setFlowStep] = useState<'type' | 'amount' | 'cycle' | 'payday'>(incomeType == null ? 'type' : 'amount')
  const nextPath = resolveReturnPath(returnTo)
  const isFirstTime = incomeType == null

  const copyOverride = (() => {
    if (!isFirstTime) return undefined

    if (flowStep === 'amount') {
      return {
        eyebrow: 'Step 1 of 3',
        title: 'Set your income',
        subtitle: 'Enter your regular take-home pay.',
      }
    }

    if (flowStep === 'cycle') {
      return {
        eyebrow: 'Step 2 of 3',
        title: '',
        subtitle: '',
      }
    }

    if (flowStep === 'payday') {
      return {
        eyebrow: 'Step 3 of 3',
        title: '',
        subtitle: '',
      }
    }

    return undefined
  })()

  const handleBack = () => {
    if (flowStep === 'payday') {
      if (incomeType == null) {
        setFlowStep('cycle')
        return
      }
      setFlowStep('amount')
      return
    }

    if (flowStep === 'cycle') {
      setFlowStep('amount')
      return
    }

    if (incomeType == null && flowStep === 'amount') {
      setFlowStep('type')
      return
    }

    router.push(nextPath)
  }

  const handleSave = async (input: IncomeData) => {
    if (saving) return
    setSaving(true)
    try {
      await saveIncome(input)
      toast('Income updated')
      router.replace(nextPath)
      router.refresh()
    } catch {
      toast('Failed to update income. Please try again.')
      setSaving(false)
    }
  }

  return (
    <SetupFlowPage
      pageKey={incomeType == null ? 'income_new' : 'income_edit'}
      onBack={handleBack}
      isDesktop={isDesktop}
      isSaving={saving}
      copyOverride={copyOverride}
    >
      <AddIncomeFlow
        incomeType={incomeType}
        paydayDay={paydayDay}
        initialIncomeData={incomeData}
        currency={currency}
        onSave={handleSave}
        onBack={incomeType == null ? undefined : () => router.push(nextPath)}
        step={flowStep}
        onStepChange={setFlowStep}
        showInnerBack={false}
      />
    </SetupFlowPage>
  )
}
