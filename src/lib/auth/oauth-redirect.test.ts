import { describe, expect, it } from 'vitest'
import { buildOAuthCallbackUrl, resolveOAuthRedirectOrigin } from './oauth-redirect'

describe('OAuth redirect origin', () => {
  it('uses localhost for local requests even when NEXT_PUBLIC_SITE_URL is production', () => {
    const redirectTo = buildOAuthCallbackUrl({
      source: 'login',
      headers: new Headers({
        host: 'localhost:3000',
        'x-forwarded-proto': 'http',
      }),
      env: {
        NODE_ENV: 'development',
        NEXT_PUBLIC_SITE_URL: 'https://cenza.vercel.app',
      },
    })

    expect(redirectTo).toBe('http://localhost:3000/auth/callback?source=login')
  })

  it('uses production for deployed production requests', () => {
    const redirectTo = buildOAuthCallbackUrl({
      source: 'start',
      headers: new Headers({
        host: 'cenza.vercel.app',
        'x-forwarded-proto': 'https',
      }),
      env: {
        NODE_ENV: 'production',
        NEXT_PUBLIC_SITE_URL: 'https://cenza.vercel.app',
      },
    })

    expect(redirectTo).toBe('https://cenza.vercel.app/auth/callback?source=start')
  })

  it('does not hardcode the production callback during local dev', () => {
    const redirectTo = buildOAuthCallbackUrl({
      source: 'login',
      headers: new Headers({
        origin: 'http://localhost:3000',
      }),
      env: {
        NODE_ENV: 'development',
        NEXT_PUBLIC_SITE_URL: 'https://cenza.vercel.app',
      },
    })

    expect(redirectTo).toContain('http://localhost:3000/auth/callback')
    expect(redirectTo).not.toContain('https://cenza.vercel.app/auth/callback')
  })

  it('falls back to production for production requests from unsupported preview hosts', () => {
    expect(resolveOAuthRedirectOrigin({
      headers: new Headers({
        host: 'cenza-git-feature.vercel.app',
        'x-forwarded-proto': 'https',
      }),
      env: {
        NODE_ENV: 'production',
        NEXT_PUBLIC_SITE_URL: 'https://cenza.vercel.app',
      },
    })).toBe('https://cenza.vercel.app')
  })
})
