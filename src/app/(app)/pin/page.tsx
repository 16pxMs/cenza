export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { PinEntryClient } from './PinEntryClient'

export default async function PinPage() {
  const jar = await cookies()
  const isFreshSession = jar.get('cenza-fresh-auth')?.value === '1'

  return <PinEntryClient isFreshSession={isFreshSession} />
}
