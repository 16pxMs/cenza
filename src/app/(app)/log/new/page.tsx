// NOTE: No 'use client' here — this is a server component wrapping a Suspense boundary.
// NewExpenseClient carries 'use client' and calls useSearchParams() safely inside Suspense.
export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { NewExpenseClient } from './NewExpenseClient'

type RawSearchParams = Record<string, string | string[] | undefined>

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  const sp = (await searchParams) ?? {}

  // Deep-link entry points that must stay in the manual flow (review/queue).
  const hasManualDeepLink =
    Boolean(firstValue(sp.label)) ||
    Boolean(firstValue(sp.key)) ||
    Boolean(firstValue(sp.type)) ||
    Boolean(firstValue(sp.amount)) ||
    firstValue(sp.isOther) === 'true'

  if (!hasManualDeepLink) {
    const returnTo = firstValue(sp.returnTo) || '/log'
    redirect(`/log/import?returnTo=${encodeURIComponent(returnTo)}`)
  }

  return (
    <Suspense>
      <NewExpenseClient />
    </Suspense>
  )
}
