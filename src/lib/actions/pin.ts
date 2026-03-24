'use server'

import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { createClient } from '@/lib/supabase/server'

const HAS_PIN      = 'cenza-has-pin'
const PIN_VERIFIED = 'cenza-pin-verified'

const COOKIE_BASE = {
  path:     '/',
  sameSite: 'lax' as const,
  secure:   process.env.NODE_ENV === 'production',
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

  const jar = await cookies()
  // Non-httpOnly: middleware reads this to know a PIN exists
  jar.set(HAS_PIN, '1', { ...COOKIE_BASE, httpOnly: false })
  // httpOnly session cookie: clears when browser closes
  jar.set(PIN_VERIFIED, '1', { ...COOKIE_BASE, httpOnly: true })
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
    const jar = await cookies()
    jar.set(PIN_VERIFIED, '1', { ...COOKIE_BASE, httpOnly: true })
  }

  return match
}

export async function clearPinVerified(): Promise<void> {
  const jar = await cookies()
  jar.set(PIN_VERIFIED, '', { ...COOKIE_BASE, httpOnly: true, maxAge: 0 })
}
