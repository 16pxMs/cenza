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

function resolveReturnPath(returnTo: string): string {
  const trimmed = (returnTo || '').trim()
  if (!trimmed.startsWith('/')) return '/app'

  // /income is preview-only and redirects, so always land on app after save.
  if (trimmed === '/income' || trimmed.startsWith('/income?')) return '/app'

  // Guard against accidental self-redirect loops.
  if (trimmed.startsWith('/income/new')) return '/app'

  return trimmed
}

export default function IncomeFlowPageClient({ currency, incomeType, returnTo }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const { refreshProfile } = useUser()
  const { isDesktop } = useBreakpoint()
  const [isPending, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [flowStep, setFlowStep] = useState<'type' | 'amount'>(incomeType == null ? 'type' : 'amount')
  const nextPath = resolveReturnPath(returnTo)

  const handleBack = () => {
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
      try {
        await refreshProfile()
      } catch {
        // Do not block navigation if profile refresh is temporarily unavailable.
      }
      toast('Income updated')
      startTransition(() => {
        router.replace(nextPath)
        router.refresh()
      })

      // Hard-navigation fallback: if router transition stalls, force exit from income setup.
      window.setTimeout(() => {
        if (window.location.pathname.startsWith('/income/new')) {
          window.location.assign(nextPath)
        }
      }, 300)
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
      isSaving={isPending}
    >
      <AddIncomeFlow
        incomeType={incomeType}
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
