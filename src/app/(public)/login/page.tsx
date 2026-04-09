import { cookies } from 'next/headers'
import LoginClient from './LoginClient'

function getAuthError(error: string | undefined) {
  if (error === 'oauth_cancelled') {
    return 'Google sign-in was canceled. You are not signed in yet.'
  }
  if (error === 'oauth_start_failed') {
    return 'We could not start Google sign-in just now. Please try again.'
  }
  if (error === 'auth_callback_failed') {
    return 'We could not reconnect your session. Please try again.'
  }
  return null
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; source?: string }>
}) {
  const params = await searchParams
  const cookieStore = await cookies()
  const knownDevice =
    !!cookieStore.get('cenza-returning-user') ||
    cookieStore.get('cenza-has-pin')?.value === '1'

  const entryIntent = params.source === 'start' ? 'start' : 'login'

  return (
    <LoginClient
      knownDevice={knownDevice}
      authError={getAuthError(params.error)}
      entryIntent={entryIntent}
    />
  )
}
