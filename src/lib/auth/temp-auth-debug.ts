type AuthDebugMeta = Record<string, unknown>

const PREFIX = '[auth-redirect-debug]'

function safeValue(value: unknown): unknown {
  if (typeof value !== 'string') return value

  try {
    const url = new URL(value)
    url.searchParams.delete('code')
    url.searchParams.delete('access_token')
    url.searchParams.delete('refresh_token')
    return url.toString()
  } catch {
    return value
  }
}

export function tempAuthDebugLog(step: string, meta: AuthDebugMeta = {}) {
  const safeMeta = Object.fromEntries(
    Object.entries(meta).map(([key, value]) => [key, safeValue(value)])
  )

  console.log(PREFIX, step, safeMeta)
}
