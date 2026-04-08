'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FixedExpensesEditor, type FixedEntry } from '@/components/flows/plan/EditFixedExpensesSheet'
import { SetupFlowPage } from '@/components/layout/SetupFlowPage/SetupFlowPage'
import { useToast } from '@/lib/context/ToastContext'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { saveFixedExpenses } from '../actions'

interface Props {
  currency: string
  initialEntries: FixedEntry[]
  returnTo: string
}

export default function FixedExpensesPageClient({ currency, initialEntries, returnTo }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const { isDesktop } = useBreakpoint()
  const [isPending, startTransition] = useTransition()

  const handleSave = async (entries: FixedEntry[]) => {
    try {
      await saveFixedExpenses(entries)
      toast('Fixed expenses updated')
      startTransition(() => router.push(returnTo))
    } catch {
      toast('Failed to update fixed expenses. Please try again.')
    }
  }

  return (
    <SetupFlowPage
      pageKey="fixed_costs"
      onBack={() => router.push(returnTo)}
      isDesktop={isDesktop}
      isSaving={isPending}
    >
      <FixedExpensesEditor
        initialEntries={initialEntries}
        currency={currency}
        onSave={handleSave}
        saving={isPending}
      />
    </SetupFlowPage>
  )
}
