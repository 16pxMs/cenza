export const PUBLIC_ENTRY_PATHS = ['/', '/login'] as const

export type OnboardingStep = 'name' | 'currency' | 'pin'

export interface OnboardingProfileState {
  name?: string | null
  currency?: string | null
  hasPin: boolean
  onboardingComplete: boolean
}

export function getOnboardingPageRedirect(input: {
  requestedStep: OnboardingStep
  name?: string | null
  currency?: string | null
  hasPin: boolean
  onboardingComplete: boolean
  pinVerified: boolean
}): string | null {
  if (input.onboardingComplete) {
    return input.hasPin && !input.pinVerified ? '/pin' : '/app'
  }

  const currentStep = getNextOnboardingStep({
    name: input.name,
    currency: input.currency,
    hasPin: input.hasPin,
  })

  if (input.requestedStep !== currentStep) {
    return getOnboardingRoute(currentStep)
  }

  return null
}

export function isPublicEntryPath(pathname: string) {
  return PUBLIC_ENTRY_PATHS.includes(pathname as (typeof PUBLIC_ENTRY_PATHS)[number])
}

export function isSafeInternalPath(path: string) {
  return path.startsWith('/') && !path.startsWith('//')
}

export function normalizeOnboardingStep(step: string | null | undefined): OnboardingStep | null {
  if (step === 'name' || step === 'currency' || step === 'pin') return step
  return null
}

export function getOnboardingRoute(step: OnboardingStep): string {
  switch (step) {
    case 'currency':
      return '/onboarding/currency'
    case 'pin':
      return '/onboarding/pin'
    case 'name':
    default:
      return '/onboarding/name'
  }
}

export function getNextOnboardingStep(input: {
  name?: string | null
  currency?: string | null
  hasPin: boolean
}): OnboardingStep {
  if (!input.name?.trim()) return 'name'
  if (!input.currency?.trim()) return 'currency'
  if (!input.hasPin) return 'pin'
  return 'pin'
}

export function getOnboardingDestination(input: {
  name?: string | null
  currency?: string | null
  hasPin: boolean
}): string {
  const step = getNextOnboardingStep({
    name: input.name,
    currency: input.currency,
    hasPin: input.hasPin,
  })

  if (step === 'pin' && input.hasPin) return '/pin'

  return getOnboardingRoute(step)
}

export function getPostAuthDestination(input: {
  onboardingComplete: boolean
  name?: string | null
  currency?: string | null
  hasPin: boolean
  next: string
}): string {
  if (!input.onboardingComplete) {
    return getOnboardingDestination({
      name: input.name,
      currency: input.currency,
      hasPin: input.hasPin,
    })
  }

  if (input.hasPin) return '/pin'

  const next = input.next.trim()
  if (next && isSafeInternalPath(next) && !isPublicEntryPath(next)) {
    return next
  }

  return '/app'
}

export function getPublicEntryRedirect(input: {
  hasPin: boolean
  pinVerified: boolean
}): string {
  return input.hasPin && !input.pinVerified ? '/pin' : '/app'
}
