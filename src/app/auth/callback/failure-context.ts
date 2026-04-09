export function getCallbackFailureContext(
  sourceParam: string | null,
  authError: string | null,
): {
  source: 'start' | 'login'
  fallbackPath: '/' | '/login'
  fallbackError: 'oauth_cancelled' | 'auth_callback_failed'
} {
  const source = sourceParam === 'start' ? 'start' : 'login'
  return {
    source,
    fallbackPath: source === 'start' ? '/' : '/login',
    fallbackError: authError === 'access_denied' ? 'oauth_cancelled' : 'auth_callback_failed',
  }
}
