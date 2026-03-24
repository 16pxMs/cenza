'use client'

// ─────────────────────────────────────────────────────────────
// PinSetupClient — enter + confirm PIN flow
//
// Used by:
//   /onboarding/pin  (isReset=false, redirectTo='/')
//   /pin/reset       (isReset=true,  redirectTo='/app')
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { setupPin } from '@/lib/actions/pin'
import { PinPad } from '@/components/ui/PinPad'

type Step = 'enter' | 'confirm'

interface Props {
  redirectTo: string
  isReset?:   boolean
}

export function PinSetupClient({ redirectTo, isReset = false }: Props) {
  const router = useRouter()

  const [step,       setStep]       = useState<Step>('enter')
  const [firstPin,   setFirstPin]   = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [shake,      setShake]      = useState(false)
  const [error,      setError]      = useState('')
  const [saving,     setSaving]     = useState(false)

  // Auto-advance to confirm after 4 digits in enter step
  useEffect(() => {
    if (step === 'enter' && firstPin.length === 4) {
      const t = setTimeout(() => setStep('confirm'), 150)
      return () => clearTimeout(t)
    }
  }, [firstPin, step])

  // Auto-submit after 4 digits in confirm step
  useEffect(() => {
    if (step === 'confirm' && confirmPin.length === 4) {
      handleConfirm(confirmPin)
    }
  }, [confirmPin, step]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirm = async (pin: string) => {
    if (pin !== firstPin) {
      setShake(true)
      setError("PINs didn't match. Try again.")
      setTimeout(() => {
        setShake(false)
        setStep('enter')
        setFirstPin('')
        setConfirmPin('')
        setError('')
      }, 700)
      return
    }

    setSaving(true)
    try {
      // When isReset=false (onboarding), setupPin also sets onboarding_complete = true
      // in the same server-side DB write. No client-side Supabase write needed.
      await setupPin(firstPin, { onboarding: !isReset })
      router.push(redirectTo)
    } catch {
      setError('Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  const activePin    = step === 'enter' ? firstPin   : confirmPin
  const setActivePin = step === 'enter' ? setFirstPin : setConfirmPin

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      padding: '0 24px',
      background: 'var(--page-bg, #FAFAF8)',
    }}>
      <div style={{ flex: 1, paddingTop: 72 }}>

        {!isReset && (
          <p style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--weight-medium)',
            color: 'var(--text-muted)',
            margin: '0 0 var(--space-lg)',
            letterSpacing: '0.01em',
          }}>
            Step 3 of 3
          </p>
        )}

        <h1 style={{
          fontSize: 'var(--text-3xl)',
          color: 'var(--text-1)',
          margin: '0 0 var(--space-sm)',
        }}>
          {step === 'enter'
            ? (isReset ? 'Set a new PIN' : 'Secure your account')
            : 'Confirm your PIN'}
        </h1>

        <p style={{
          fontSize: 'var(--text-base)',
          color: 'var(--text-2)',
          margin: '0 0 48px',
          lineHeight: 1.6,
        }}>
          {step === 'enter'
            ? "Set a 4-digit PIN. You'll enter it each time you open Cenza."
            : 'Enter the same PIN again to confirm.'}
        </p>

        {error && (
          <p style={{
            fontSize: 'var(--text-sm)', color: '#D93025',
            textAlign: 'center', margin: '0 0 20px',
          }}>
            {error}
          </p>
        )}

        <PinPad
          value={activePin}
          onChange={setActivePin}
          shake={shake}
          disabled={saving}
        />

      </div>
    </div>
  )
}
