import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'

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

  // Refresh session — do not write logic between createServerClient and getUser
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Public routes that don't need auth
  const publicRoutes = ['/', '/login', '/demo', '/auth/callback', '/onboarding']
  const isPublic = publicRoutes.some(r => pathname === r || pathname.startsWith(r + '/'))

  // Redirect unauthenticated users to landing page
  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from landing and login to app
  if (user && (pathname === '/' || pathname === '/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/app'
    return NextResponse.redirect(url)
  }

  // ── PIN gate ──────────────────────────────────────────────
  // /pin and /pin/reset are auth-gated (unauthenticated users
  // are caught above) but excluded from the PIN cookie check
  // to prevent an infinite redirect loop.
  const isPinPage = pathname === '/pin' || pathname.startsWith('/pin/')

  if (user && !isPublic && !isPinPage) {
    const hasPin      = request.cookies.get('cenza-has-pin')?.value === '1'
    const pinVerified = request.cookies.get('cenza-pin-verified')?.value === '1'

    if (hasPin && !pinVerified) {
      const url = request.nextUrl.clone()
      url.pathname = '/pin'
      return NextResponse.redirect(url)
    }
  }
  // ─────────────────────────────────────────────────────────

  return supabaseResponse
}
