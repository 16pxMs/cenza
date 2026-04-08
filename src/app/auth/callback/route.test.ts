import { describe, expect, it } from 'vitest'
import { getPostAuthDestination } from './route-helpers'

describe('getPostAuthDestination', () => {
  it('sends incomplete users to onboarding', () => {
    expect(getPostAuthDestination({
      onboardingComplete: false,
      hasPin: false,
      next: '/app',
    })).toBe('/onboarding')
  })

  it('sends returning users with a PIN to /pin', () => {
    expect(getPostAuthDestination({
      onboardingComplete: true,
      hasPin: true,
      next: '/app',
    })).toBe('/pin')
  })

  it('respects the requested destination for onboarded users without a PIN', () => {
    expect(getPostAuthDestination({
      onboardingComplete: true,
      hasPin: false,
      next: '/history',
    })).toBe('/history')
  })
})
