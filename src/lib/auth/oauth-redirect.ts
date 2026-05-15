const PRODUCTION_ORIGIN = 'https://cenza.vercel.app'
const LOCAL_ORIGIN = 'http://localhost:3000'

type HeaderLike = {
  get(name: string): string | null
}

type OAuthRedirectEnv = {
  NODE_ENV?: string
  NEXT_PUBLIC_SITE_URL?: string
}

function firstHeaderValue(value: string | null | undefined) {
  return value?.split(',')[0]?.trim() || null
}

function normalizeOrigin(value: string | null | undefined) {
  if (!value) return null

  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return `${url.protocol}//${url.host}`
  } catch {
    return null
  }
}

function isLocalHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

function classifyOrigin(origin: string | null) {
  if (!origin) return null

  try {
    const url = new URL(origin)
    if (isLocalHost(url.hostname)) return 'local'
    if (url.hostname === 'cenza.vercel.app') return 'production'
    return null
  } catch {
    return null
  }
}

function originFromForwardedHost(headers: HeaderLike | null | undefined) {
  const host = firstHeaderValue(headers?.get('x-forwarded-host')) || firstHeaderValue(headers?.get('host'))
  if (!host) return null

  const hostname = host.split(':')[0]
  const protocol = isLocalHost(hostname)
    ? 'http'
    : firstHeaderValue(headers?.get('x-forwarded-proto')) || 'https'

  return normalizeOrigin(`${protocol}://${host}`)
}

export function resolveOAuthRedirectOrigin({
  headers,
  env = process.env,
}: {
  headers?: HeaderLike | null
  env?: OAuthRedirectEnv
} = {}) {
  const requestOrigin = normalizeOrigin(firstHeaderValue(headers?.get('origin')))
  const requestOriginKind = classifyOrigin(requestOrigin)
  if (requestOriginKind === 'local') return requestOrigin!
  if (requestOriginKind === 'production') return PRODUCTION_ORIGIN

  const hostOrigin = originFromForwardedHost(headers)
  const hostOriginKind = classifyOrigin(hostOrigin)
  if (hostOriginKind === 'local') return hostOrigin!
  if (hostOriginKind === 'production') return PRODUCTION_ORIGIN

  if (env.NODE_ENV !== 'production') {
    return LOCAL_ORIGIN
  }

  const configuredOrigin = normalizeOrigin(env.NEXT_PUBLIC_SITE_URL)
  const configuredOriginKind = classifyOrigin(configuredOrigin)
  if (configuredOriginKind === 'local') return configuredOrigin!
  if (configuredOriginKind === 'production') return PRODUCTION_ORIGIN

  return PRODUCTION_ORIGIN
}

export function buildOAuthCallbackUrl({
  source,
  headers,
  env,
}: {
  source: 'start' | 'login'
  headers?: HeaderLike | null
  env?: OAuthRedirectEnv
}) {
  const origin = resolveOAuthRedirectOrigin({ headers, env })
  return `${origin}/auth/callback?source=${encodeURIComponent(source)}`
}
