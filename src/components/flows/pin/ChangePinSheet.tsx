'use client'

// ─────────────────────────────────────────────────────────────
// ChangePinSheet — 3-step Change PIN flow in a bottom sheet
//
// Step 1: verify current PIN
// Step 2: enter new PIN (4 digits auto-advance)
// Step 3: confirm new PIN (4 digits auto-submit)
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { PinPad } from '@/components/ui/PinPad'
import { verifyPin, setupPin } from '@/lib/actions/pin'

interface Props {
  open:    boolean
  onClose: () => void
  onSaved: () => void   // parent shows a toast
}

type Step = 'verify' | 'enter' | 'confirm'

export function ChangePinSheet({ open, onClose, onSaved }: Props) {
  const [step,       setStep]       = useState<Step>('verify')
  const [currentPin, setCurrentPin] = useState('')
  const [firstPin,   setFirstPin]   = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [shake,      setShake]      = useState(false)
  const [error,      setError]      = useState('')
  const [saving,     setSaving]     = useState(false)

  // Reset state when sheet closes
  useEffect(() => {
    if (!open) {
      setStep('verify')
      setCurrentPin('')
      setFirstPin('')
      setConfirmPin('')
      setShake(false)
      setError('')
      setSaving(false)
    }
  }, [open])

  // Auto-submit verify on 4 digits
  useEffect(() => {
    if (step === 'verify' && currentPin.length === 4) {
      handleVerifyCurrent(currentPin)
    }
  }, [currentPin, step]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance to confirm on 4 new-PIN digits
  useEffect(() => {
    if (step === 'enter' && firstPin.length === 4) {
      const t = setTimeout(() => setStep('confirm'), 150)
      return () => clearTimeout(t)
    }
  }, [firstPin, step])

  // Auto-submit confirm on 4 digits
  useEffect(() => {
    if (step === 'confirm' && confirmPin.length === 4) {
      handleSaveNew(confirmPin)
    }
  }, [confirmPin, step]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleVerifyCurrent = async (pin: string) => {
    setSaving(true)
    const ok = await verifyPin(pin)
    setSaving(false)

    if (!ok) {
      setShake(true)
      setError('Incorrect PIN')
      setTimeout(() => {
        setShake(false)
        setCurrentPin('')
        setError('')
      }, 700)
      return
    }

    setError('')
    setStep('enter')
  }

  const handleSaveNew = async (pin: string) => {
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
      await setupPin(firstPin)
      onSaved()
      onClose()
    } catch {
      setError('Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  const headings: Record<Step, string> = {
    verify:  'Enter your current PIN',
    enter:   'Set a new PIN',
    confirm: 'Confirm new PIN',
  }

  const activePin    = step === 'verify' ? currentPin    : step === 'enter' ? firstPin    : confirmPin
  const setActivePin = step === 'verify' ? setCurrentPin : step === 'enter' ? setFirstPin : setConfirmPin

  return (
    <Sheet open={open} onClose={onClose} title="Change PIN">
      <p style={{
        margin: '0 0 8px',
        fontSize: 'var(--text-base)',
        fontWeight: 'var(--weight-semibold)',
        color: 'var(--text-1)',
        textAlign: 'center',
      }}>
        {headings[step]}
      </p>

      {error && (
        <p style={{
          fontSize: 'var(--text-sm)', color: '#D93025',
          textAlign: 'center', margin: '8px 0 16px',
        }}>
          {error}
        </p>
      )}

      <div style={{ marginTop: 24 }}>
        <PinPad
          value={activePin}
          onChange={setActivePin}
          shake={shake}
          disabled={saving}
        />
      </div>
    </Sheet>
  )
}
