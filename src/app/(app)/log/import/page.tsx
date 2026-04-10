export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { SmsImportClient } from './SmsImportClient'

export default function SmsImportPage() {
  return (
    <Suspense>
      <SmsImportClient />
    </Suspense>
  )
}
