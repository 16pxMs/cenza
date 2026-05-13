'use server'

import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logPerfSpan, timePerf } from '@/lib/perf/debug'

const HAS_PIN      = 'cenza-has-pin'
const PIN_VERIFIED = 'cenza-pin-verified'
const RETURNING_USER = 'cenza-returning-user'
const KNOWN_DEVICE_MAX_AGE = 60 * 60 * 24 * 30

const COOKIE_BASE = {
  path:     '/',
  sameSite: 'lax' as const,
  secure:   process.env.NODE_ENV === 'production',
}

async function setKnownDeviceCookies(userId: string): Promise<void> {
  const startedAt = Date.now()
  const jar = await cookies()
  // Non-httpOnly: middleware and public-entry UI use these to detect a returning device.
  jar.set(HAS_PIN, '1', { ...COOKIE_BASE, httpOnly: false, maxAge: KNOWN_DEVICE_MAX_AGE })
  jar.set(RETURNING_USER, userId, { ...COOKIE_BASE, httpOnly: false, maxAge: KNOWN_DEVICE_MAX_AGE })
  // httpOnly session cookie: clears when browser closes
  jar.set(PIN_VERIFIED, '1', { ...COOKIE_BASE, httpOnly: true })
  logPerfSpan('pin.cookies', 'set-known-device-cookies', startedAt, {
    hasKnownDeviceCookie: true,
    hasVerifiedCookie: true,
  })
}

// opts.onboarding: when true, also sets onboarding_complete = true in the same DB write.
// This avoids a separate client-side Supabase call from PinSetupClient.
export async function setupPin(pin: string, opts?: { onboarding?: boolean }): Promise<void> {
  const startedAt = Date.now()
  const flow = 'pin.setup'
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN must be exactly 4 digits')

  const supabase = await timePerf(flow, 'supabase-init', async () => createServerSupabaseClient())
  const { data: { user } } = await timePerf(flow, 'auth-user-load', async () => supabase.auth.getUser())
  if (!user) throw new Error('Not authenticated')

  const pinHash = await timePerf(flow, 'pin-hash', async () => bcrypt.hash(pin, 10), {
    onboarding: !!opts?.onboarding,
  })

  const update: Record<string, unknown> = { pin_hash: pinHash }
  if (opts?.onboarding) {
    const { data: existing } = await timePerf(flow, 'onboarding-completion-check', async () =>
      (supabase as any)
        .from('user_profiles')
        .select('name, currency')
        .eq('id', user.id)
        .single()
    )

    if (!existing?.name?.trim() || !existing?.currency?.trim()) {
      throw new Error('Complete your name and currency before finishing onboarding')
    }

    update.onboarding_complete = true
  }

  const { error } = await timePerf(flow, 'profile-pin-update', async () =>
    (supabase as any)
      .from('user_profiles')
      .update(update)
      .eq('id', user.id)
  )

  if (error) throw new Error('Failed to save PIN')

  await timePerf(flow, 'cookie-write', async () => setKnownDeviceCookies(user.id))
  logPerfSpan(flow, 'total', startedAt, { onboarding: !!opts?.onboarding })
}

export async function verifyPin(pin: string): Promise<boolean> {
  const startedAt = Date.now()
  const flow = 'pin.verify'
  if (!/^\d{4}$/.test(pin)) {
    logPerfSpan(flow, 'invalid-format', startedAt)
    return false
  }

  const supabase = await timePerf(flow, 'supabase-init', async () => createServerSupabaseClient())
  const { data: { user } } = await timePerf(flow, 'auth-user-load', async () => supabase.auth.getUser())
  if (!user) {
    logPerfSpan(flow, 'total', startedAt, { authenticated: false, matched: false })
    return false
  }

  const { data: profile } = await timePerf(flow, 'profile-pin-read', async () =>
    (supabase as any)
      .from('user_profiles')
      .select('pin_hash')
      .eq('id', user.id)
      .single()
  )

  if (!profile?.pin_hash) {
    logPerfSpan(flow, 'total', startedAt, { authenticated: true, hasPin: false, matched: false })
    return false
  }

  const match = await timePerf(flow, 'pin-hash-compare', async () => bcrypt.compare(pin, profile.pin_hash))

  if (match) {
    await timePerf(flow, 'cookie-write', async () => setKnownDeviceCookies(user.id))
  }

  logPerfSpan(flow, 'total', startedAt, {
    authenticated: true,
    hasPin: true,
    matched: match,
  })
  return match
}

export async function clearPinVerified(): Promise<void> {
  const jar = await cookies()
  jar.set(PIN_VERIFIED, '', { ...COOKIE_BASE, httpOnly: true, maxAge: 0 })
}

export async function clearPinDeviceState(opts?: { forgetDevice?: boolean }): Promise<void> {
  const jar = await cookies()

  jar.set(PIN_VERIFIED, '', { ...COOKIE_BASE, httpOnly: true, maxAge: 0 })

  if (opts?.forgetDevice) {
    jar.set(HAS_PIN, '', { ...COOKIE_BASE, httpOnly: false, maxAge: 0 })
    jar.set(RETURNING_USER, '', { ...COOKIE_BASE, httpOnly: false, maxAge: 0 })
  }
}
