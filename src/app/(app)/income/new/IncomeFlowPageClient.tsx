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
  hasHistoricalIncome: boolean
  hasCurrentCycleIncome: boolean
  modeHint: string | null
  returnTo: string
}

type IncomeFlowMode = 'new' | 'returning' | 'edit'

function resolveReturnPath(returnTo: string): string {
  const trimmed = (returnTo || '').trim()
  if (!trimmed.startsWith('/')) return '/app'

  // /income is preview-only and redirects, so always land on app after save.
  if (trimmed === '/income' || trimmed.startsWith('/income?')) return '/app'

  // Guard against accidental self-redirect loops.
  if (trimmed.startsWith('/income/new')) return '/app'

  return trimmed
}

export default function IncomeFlowPageClient({
  currency,
  incomeType,
  paydayDay,
  incomeData,
  hasHistoricalIncome,
  hasCurrentCycleIncome,
  modeHint,
  returnTo,
}: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const { isDesktop } = useBreakpoint()
  const [saving, setSaving] = useState(false)
  const nextPath = resolveReturnPath(returnTo)
  const resolvedMode: IncomeFlowMode = (() => {
    if (modeHint === 'edit') return 'edit'
    if (!hasHistoricalIncome) return 'new'
    if (!hasCurrentCycleIncome) return 'returning'
    return 'edit'
  })()
  const needsTypeSelection = incomeType == null
  const [flowStep, setFlowStep] = useState<'type' | 'amount' | 'cycle' | 'payday'>(needsTypeSelection ? 'type' : 'amount')

  const copyOverride = (() => {
    if (resolvedMode === 'new') {
      return {
        eyebrow: 'Income',
        title: 'Set up your income',
        subtitle: 'Add your salary and any extra income',
      }
    }

    if (resolvedMode === 'returning') {
      return {
        eyebrow: 'Income',
        title: 'Add your income',
        subtitle: 'Set what you expect this month',
      }
    }

    return {
      eyebrow: 'Income',
      title: 'Update your income',
      subtitle: 'Change your salary or income details',
    }
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

    if (needsTypeSelection && flowStep === 'amount') {
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
      pageKey={resolvedMode === 'edit' ? 'income_edit' : 'income_new'}
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
        flowMode={resolvedMode}
        onSave={handleSave}
        onBack={needsTypeSelection ? undefined : () => router.push(nextPath)}
        step={flowStep}
        onStepChange={setFlowStep}
        showInnerBack={false}
      />
    </SetupFlowPage>
  )
}
