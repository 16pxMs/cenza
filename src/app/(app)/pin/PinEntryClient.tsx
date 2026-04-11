'use client'

// ─────────────────────────────────────────────────────────────
// PinEntryClient
//
// Shown when middleware redirects to /pin (has-pin but not verified).
// Auto-submits on 4th digit. Locks for 30s after 5 wrong attempts.
// The only recovery path here is reconnecting with Google.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { verifyPin, clearPinDeviceState } from '@/lib/actions/pin'
import { signOutAndForgetDevice } from '@/app/auth/actions'
import { PinPad } from '@/components/ui/PinPad'

const LOCK_AFTER = 5   // wrong attempts before lockout
const LOCK_SECS  = 30  // lockout duration in seconds

interface Props {
  name: string
}

export function PinEntryClient({ name }: Props) {
  const router   = useRouter()

  const [pin,           setPin]           = useState('')
  const [shake,         setShake]         = useState(false)
  const [error,         setError]         = useState('')
  const [attempts,      setAttempts]      = useState(0)
  const [locked,        setLocked]        = useState(false)
  const [lockCountdown, setLockCountdown] = useState(0)
  const [submitting,    setSubmitting]    = useState(false)

  // Auto-submit on 4th digit
  useEffect(() => {
    if (pin.length === 4 && !locked && !submitting) {
      handleVerify(pin)
    }
  }, [pin]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleVerify = async (enteredPin: string) => {
    setSubmitting(true)
    const ok = await verifyPin(enteredPin)

    if (ok) {
      router.replace('/app')
      return
    }

    const newAttempts = attempts + 1
    setAttempts(newAttempts)
    setShake(true)

    setTimeout(() => {
      setShake(false)
      setPin('')
      setSubmitting(false)
      if (newAttempts >= LOCK_AFTER) {
        setLocked(true)
        setLockCountdown(LOCK_SECS)
        setError(`Too many attempts. Try again in ${LOCK_SECS}s.`)
      } else {
        setError('Incorrect PIN')
      }
    }, 600)
  }

  // Lockout countdown timer
  useEffect(() => {
    if (!locked) return
    const interval = setInterval(() => {
      setLockCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          setLocked(false)
          setAttempts(0)
          setError('')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [locked])

  const handleForgotPin = async () => {
    await signOutAndForgetDevice()
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '0 24px',
      background: 'var(--page-bg, #FAFAF8)',
    }}>
      <div style={{ width: '100%', maxWidth: 320 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          {name && (
            <p style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-3)',
              margin: '0 0 8px',
            }}>
              Welcome back, {name}
            </p>
          )}
          <h1 style={{
            fontSize: 'var(--text-2xl)',
            color: 'var(--text-1)',
            margin: 0, fontWeight: 700,
            letterSpacing: '-0.3px',
          }}>
            Enter your PIN
          </h1>
        </div>

        {/* Error / lockout message */}
        {error && (
          <p style={{
            fontSize: 'var(--text-sm)', color: '#D93025',
            textAlign: 'center', margin: '0 0 16px',
          }}>
            {locked ? `Too many attempts. Try again in ${lockCountdown}s.` : error}
          </p>
        )}

        <PinPad
          value={pin}
          onChange={setPin}
          shake={shake}
          disabled={locked || submitting}
        />

        {/* Footer links */}
        <div style={{ marginTop: 36, textAlign: 'center' }}>
          <button
            onClick={handleForgotPin}
            style={{
              display: 'block', width: '100%',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-3, #667085)',
              padding: '10px 0',
              fontFamily: 'inherit',
            }}
          >
            Forgot PIN? Reconnect with Google
          </button>
        </div>

      </div>
    </div>
  )
}
