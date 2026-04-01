'use client'

import { useRouter } from 'next/navigation'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import type { TargetsPageData } from '@/lib/loaders/targets'
import { saveTargets } from './actions'
import TargetsPageView from './TargetsPageView'

export default function TargetsPageClient({ data }: { data: TargetsPageData }) {
  const router = useRouter()
  const { isDesktop } = useBreakpoint()

  return (
    <TargetsPageView
      goals={data.goals}
      currency={data.currency}
      totalIncome={data.totalIncome}
      onDone={async (targets, complete) => {
        await saveTargets(targets, complete)
        router.push('/app')
      }}
      isDesktop={isDesktop}
      onBack={() => router.back()}
      initialStep={data.initialStep}
      existingTargets={data.existingTargets}
    />
  )
}
