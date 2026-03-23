// NOTE: No 'use client' here — this is a server component wrapping a Suspense boundary.
// NewExpenseClient carries 'use client' and calls useSearchParams() safely inside Suspense.
export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { NewExpenseClient } from './NewExpenseClient'

export default function NewExpensePage() {
  return (
    <Suspense>
      <NewExpenseClient />
    </Suspense>
  )
}
