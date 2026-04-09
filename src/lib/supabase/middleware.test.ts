import { describe, expect, it } from 'vitest'
import { getMiddlewareRedirectPath } from './middleware'

describe('getMiddlewareRedirectPath', () => {
  it('redirects unauthenticated protected routes to landing', () => {
    expect(getMiddlewareRedirectPath({
      pathname: '/app',
      hasUser: false,
      isPublic: false,
      isPinPage: false,
      hasReturningDevice: false,
      hasPin: false,
      pinVerified: false,
    })).toBe('/')
  })

  it('hard-redirects legacy /start traffic back to landing', () => {
    expect(getMiddlewareRedirectPath({
      pathname: '/start',
      hasUser: false,
      isPublic: true,
      isPinPage: false,
      hasReturningDevice: true,
      hasPin: false,
      pinVerified: false,
    })).toBe('/')
  })

  it('redirects authenticated returning users on public entry to /pin when PIN is not verified', () => {
    expect(getMiddlewareRedirectPath({
      pathname: '/login',
      hasUser: true,
      isPublic: true,
      isPinPage: false,
      hasReturningDevice: false,
      hasPin: true,
      pinVerified: false,
    })).toBe('/pin')
  })

  it('redirects authenticated verified users on public entry to /app', () => {
    expect(getMiddlewareRedirectPath({
      pathname: '/login',
      hasUser: true,
      isPublic: true,
      isPinPage: false,
      hasReturningDevice: false,
      hasPin: true,
      pinVerified: true,
    })).toBe('/app')
  })

  it('forces protected app routes through /pin when the user has a PIN but has not verified it', () => {
    expect(getMiddlewareRedirectPath({
      pathname: '/history',
      hasUser: true,
      isPublic: false,
      isPinPage: false,
      hasReturningDevice: false,
      hasPin: true,
      pinVerified: false,
    })).toBe('/pin')
  })

  it('redirects /pin to /app when the user is already verified', () => {
    expect(getMiddlewareRedirectPath({
      pathname: '/pin',
      hasUser: true,
      isPublic: false,
      isPinPage: true,
      hasReturningDevice: false,
      hasPin: true,
      pinVerified: true,
    })).toBe('/app')
  })

  it('allows /pin when the user still needs to verify', () => {
    expect(getMiddlewareRedirectPath({
      pathname: '/pin',
      hasUser: true,
      isPublic: false,
      isPinPage: true,
      hasReturningDevice: false,
      hasPin: true,
      pinVerified: false,
    })).toBeNull()
  })
})
