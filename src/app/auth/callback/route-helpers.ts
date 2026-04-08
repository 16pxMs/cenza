export function getPostAuthDestination(input: {
  onboardingComplete: boolean
  hasPin: boolean
  next: string
}): string {
  if (!input.onboardingComplete) return '/onboarding'
  return input.hasPin ? '/pin' : input.next
}
