'use server'

import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { createClient } from '@/lib/supabase/server'

const HAS_PIN      = 'cenza-has-pin'
const PIN_VERIFIED = 'cenza-pin-verified'
const RETURNING_USER = 'cenza-returning-user'

const COOKIE_BASE = {
  path:     '/',
  sameSite: 'lax' as const,
  secure:   process.env.NODE_ENV === 'production',
}

async function setKnownDeviceCookies(userId: string): Promise<void> {
  const jar = await cookies()
  // Non-httpOnly: middleware and public-entry UI use these to detect a returning device.
  jar.set(HAS_PIN, '1', { ...COOKIE_BASE, httpOnly: false })
  jar.set(RETURNING_USER, userId, { ...COOKIE_BASE, httpOnly: false })
  // httpOnly session cookie: clears when browser closes
  jar.set(PIN_VERIFIED, '1', { ...COOKIE_BASE, httpOnly: true })
}

// opts.onboarding: when true, also sets onboarding_complete = true in the same DB write.
// This avoids a separate client-side Supabase call from PinSetupClient.
export async function setupPin(pin: string, opts?: { onboarding?: boolean }): Promise<void> {
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN must be exactly 4 digits')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const pinHash = await bcrypt.hash(pin, 10)

  const update: Record<string, unknown> = { pin_hash: pinHash }
  if (opts?.onboarding) update.onboarding_complete = true

  const { error } = await (supabase as any)
    .from('user_profiles')
    .update(update)
    .eq('id', user.id)

  if (error) throw new Error('Failed to save PIN')

  await setKnownDeviceCookies(user.id)
}

export async function verifyPin(pin: string): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data: profile } = await (supabase as any)
    .from('user_profiles')
    .select('pin_hash')
    .eq('id', user.id)
    .single()

  if (!profile?.pin_hash) return false

  const match = await bcrypt.compare(pin, profile.pin_hash)

  if (match) {
    await setKnownDeviceCookies(user.id)
  }

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
