export const dynamic = 'force-dynamic'

import { PinSetupClient } from '@/components/flows/pin/PinSetupClient'

export default function OnboardingPinPage() {
  return <PinSetupClient redirectTo="/" />
}
