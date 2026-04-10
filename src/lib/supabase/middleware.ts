import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'
import { getPublicEntryRedirect } from '@/lib/auth/auth-flow'

interface RedirectDecisionInput {
  pathname: string
  hasUser: boolean
  isPublic: boolean
  isPinPage: boolean
  hasReturningDevice: boolean
  hasPin: boolean
  pinVerified: boolean
  hasAuthErrorQuery: boolean
}

export function getMiddlewareRedirectPath(input: RedirectDecisionInput): string | null {
  if (input.pathname === '/start') {
    return '/'
  }

  // If OAuth just failed/cancelled, always allow the user to stay on public entry
  // pages so we don't bounce them straight back into authenticated routes.
  if (input.hasAuthErrorQuery && (input.pathname === '/' || input.pathname === '/login')) {
    return null
  }

  if (!input.hasUser && !input.isPublic) {
    return '/'
  }

  if (input.hasUser && (input.pathname === '/' || input.pathname === '/login')) {
    return getPublicEntryRedirect({
      hasPin: input.hasPin,
      pinVerified: input.pinVerified,
    })
  }

  if (input.hasUser && !input.isPublic && !input.isPinPage && input.hasPin && !input.pinVerified) {
    return '/pin'
  }

  if (input.hasUser && input.pathname === '/pin' && (!input.hasPin || input.pinVerified)) {
    return '/app'
  }

  return null
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: object }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          )
        },
      },
    }
  )

  const authError = request.nextUrl.searchParams.get('error')

  // Hard stop for cancelled OAuth flows that accidentally return to /app
  // with an existing session cookie. Explicitly clear session and bounce
  // to a public entry path.
  if (authError === 'access_denied') {
    await supabase.auth.signOut()

    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    url.searchParams.set('error', 'oauth_cancelled')

    const response = NextResponse.redirect(url)
    for (const cookie of supabaseResponse.cookies.getAll()) {
      response.cookies.set(cookie)
    }
    return response
  }

  // Refresh session — do not write logic between createServerClient and getUser
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const hasPin = request.cookies.get('cenza-has-pin')?.value === '1'
  const hasReturningDevice = !!request.cookies.get('cenza-returning-user')?.value || hasPin
  const pinVerified = request.cookies.get('cenza-pin-verified')?.value === '1'
  const isPinPage = pathname === '/pin' || pathname.startsWith('/pin/')

  // Public routes that don't need auth
  const publicRoutes = ['/', '/login', '/demo', '/auth/callback', '/onboarding']
  const isPublic = publicRoutes.some(r => pathname === r || pathname.startsWith(r + '/'))

  const redirectPath = getMiddlewareRedirectPath({
    pathname,
    hasUser: !!user,
    isPublic,
    isPinPage,
    hasReturningDevice,
    hasPin,
    pinVerified,
    hasAuthErrorQuery: !!authError,
  })

  if (redirectPath) {
    const url = request.nextUrl.clone()
    url.pathname = redirectPath
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
