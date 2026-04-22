import { describe, expect, it } from 'vitest'
import { getPostAuthDestination } from '@/lib/auth/auth-flow'
import { getCallbackFailureContext } from './failure-context'

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

  it('sends incomplete users with a PIN to the next missing onboarding step', () => {
    expect(getPostAuthDestination({
      onboardingComplete: false,
      hasPin: true,
      next: '/app',
    })).toBe('/onboarding/name')
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

describe('getCallbackFailureContext', () => {
  it('routes cancelled auth from start back to landing with oauth_cancelled', () => {
    expect(getCallbackFailureContext('start', 'access_denied')).toEqual({
      source: 'start',
      fallbackPath: '/',
      fallbackError: 'oauth_cancelled',
    })
  })

  it('routes cancelled auth from login back to login with oauth_cancelled', () => {
    expect(getCallbackFailureContext('login', 'access_denied')).toEqual({
      source: 'login',
      fallbackPath: '/login',
      fallbackError: 'oauth_cancelled',
    })
  })

  it('uses auth_callback_failed for non-cancel callback failures', () => {
    expect(getCallbackFailureContext('start', 'server_error')).toEqual({
      source: 'start',
      fallbackPath: '/',
      fallbackError: 'auth_callback_failed',
    })
  })

  it('defaults unknown source to login fallback', () => {
    expect(getCallbackFailureContext('unknown', 'access_denied')).toEqual({
      source: 'login',
      fallbackPath: '/login',
      fallbackError: 'oauth_cancelled',
    })
  })
})
