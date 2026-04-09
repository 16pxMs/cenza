import { describe, expect, it } from 'vitest'
import { getOnboardingPageRedirect, getPostAuthDestination, getPublicEntryRedirect } from './auth-flow'

describe('getPostAuthDestination', () => {
  it('sends incomplete users to onboarding name', () => {
    expect(getPostAuthDestination({
      onboardingComplete: false,
      hasPin: false,
      next: '/app',
    })).toBe('/onboarding/name')
  })

  it('sends users with a saved name but no currency to onboarding currency', () => {
    expect(getPostAuthDestination({
      onboardingComplete: false,
      name: 'Michael',
      hasPin: false,
      next: '/app',
    })).toBe('/onboarding/currency')
  })

  it('sends users with name and currency but no pin to onboarding pin', () => {
    expect(getPostAuthDestination({
      onboardingComplete: false,
      name: 'Michael',
      currency: 'KES',
      hasPin: false,
      next: '/app',
    })).toBe('/onboarding/pin')
  })

  it('sends returning users with a PIN to /pin', () => {
    expect(getPostAuthDestination({
      onboardingComplete: true,
      hasPin: true,
      next: '/app',
    })).toBe('/pin')
  })

  it('respects safe internal destinations for onboarded users without a PIN', () => {
    expect(getPostAuthDestination({
      onboardingComplete: true,
      hasPin: false,
      next: '/history',
    })).toBe('/history')
  })

  it('falls back to /app when next is a public entry path', () => {
    expect(getPostAuthDestination({
      onboardingComplete: true,
      hasPin: false,
      next: '/login',
    })).toBe('/app')
  })

  it('falls back to /app when next is unsafe', () => {
    expect(getPostAuthDestination({
      onboardingComplete: true,
      hasPin: false,
      next: '//evil.test',
    })).toBe('/app')
  })

  it('falls back to /app when next is blank', () => {
    expect(getPostAuthDestination({
      onboardingComplete: true,
      hasPin: false,
      next: '   ',
    })).toBe('/app')
  })
})

describe('getPublicEntryRedirect', () => {
  it('sends users with an unverified PIN to /pin', () => {
    expect(getPublicEntryRedirect({
      hasPin: true,
      pinVerified: false,
    })).toBe('/pin')
  })

  it('sends verified users to /app', () => {
    expect(getPublicEntryRedirect({
      hasPin: true,
      pinVerified: true,
    })).toBe('/app')
  })

  it('sends users without a PIN to /app', () => {
    expect(getPublicEntryRedirect({
      hasPin: false,
      pinVerified: false,
    })).toBe('/app')
  })
})

describe('getOnboardingPageRedirect', () => {
  it('keeps a new user on the name step', () => {
    expect(getOnboardingPageRedirect({
      requestedStep: 'name',
      hasPin: false,
      onboardingComplete: false,
      pinVerified: false,
    })).toBeNull()
  })

  it('moves past name when the user already has a name', () => {
    expect(getOnboardingPageRedirect({
      requestedStep: 'name',
      name: 'Michael',
      hasPin: false,
      onboardingComplete: false,
      pinVerified: false,
    })).toBe('/onboarding/currency')
  })

  it('keeps a named user on currency until it is saved', () => {
    expect(getOnboardingPageRedirect({
      requestedStep: 'currency',
      name: 'Michael',
      hasPin: false,
      onboardingComplete: false,
      pinVerified: false,
    })).toBeNull()
  })

  it('moves a named and currency-set user to onboarding pin', () => {
    expect(getOnboardingPageRedirect({
      requestedStep: 'currency',
      name: 'Michael',
      currency: 'KES',
      hasPin: false,
      onboardingComplete: false,
      pinVerified: false,
    })).toBe('/onboarding/pin')
  })

  it('keeps a user on onboarding pin when that is the first unfinished step', () => {
    expect(getOnboardingPageRedirect({
      requestedStep: 'pin',
      name: 'Michael',
      currency: 'KES',
      hasPin: false,
      onboardingComplete: false,
      pinVerified: false,
    })).toBeNull()
  })

  it('sends completed users with a pin to pin verification', () => {
    expect(getOnboardingPageRedirect({
      requestedStep: 'pin',
      name: 'Michael',
      currency: 'KES',
      hasPin: true,
      onboardingComplete: true,
      pinVerified: false,
    })).toBe('/pin')
  })

  it('sends completed verified users into the app', () => {
    expect(getOnboardingPageRedirect({
      requestedStep: 'currency',
      name: 'Michael',
      currency: 'KES',
      hasPin: true,
      onboardingComplete: true,
      pinVerified: true,
    })).toBe('/app')
  })
})
