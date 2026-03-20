// ─────────────────────────────────────────────────────────────
// ReceivedIncomeSheet — two-step check-in before first log
//
// Step 1: How much actually came in this month?
// Step 2: What day does your income usually arrive? (skip if already set)
// ─────────────────────────────────────────────────────────────
'use client'
import { useState } from 'react'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { fmt } from '@/lib/finance'

const T = {
  brandDark: '#5C3489',
  text1:     '#101828',
  text2:     '#475467',
  text3:     '#667085',
  textMuted: '#98A2B3',
  border:    '#E4E7EC',
  white:     '#FFFFFF',
}

// Common pay days shown as quick-select chips
const COMMON_DAYS = [1, 5, 10, 15, 20, 25, 28, 30]

interface Props {
  open:          boolean
  onClose:       () => void
  declaredTotal: number
  currency:      string
  payDay:        number | null   // existing pay_day from profile, null = not set yet
  onConfirm:     (received: number, payDay: number | null) => Promise<void>
}

export function ReceivedIncomeSheet({ open, onClose, declaredTotal, currency, payDay, onConfirm }: Props) {
  type Step = 'amount' | 'payday'

  const [step, setStep]           = useState<Step>('amount')
  const [amount, setAmount]       = useState('')
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [customDay, setCustomDay] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [saving, setSaving]       = useState(false)

  const parsedAmount = parseFloat(amount) || 0
  const effectiveDay = showCustom
    ? (parseInt(customDay) || null)
    : selectedDay

  const handleAllIn = () => {
    setAmount(String(declaredTotal))
  }

  const handleAmountNext = () => {
    // If pay_day already known, skip step 2 and save immediately
    if (payDay !== null) {
      handleSave(payDay)
    } else {
      setStep('payday')
    }
  }

  const handleSave = async (day: number | null) => {
    setSaving(true)
    await onConfirm(parsedAmount, day)
    setSaving(false)
    // Reset internal state for next open
    setStep('amount')
    setAmount('')
    setSelectedDay(null)
    setCustomDay('')
    setShowCustom(false)
  }

  const handleSavePayDay = () => handleSave(effectiveDay)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={step === 'amount' ? 'Income check-in' : 'Your pay day'}
    >
      {step === 'amount' && (
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 14, color: T.text2, lineHeight: 1.65 }}>
            You declared{' '}
            <strong style={{ color: T.text1 }}>{fmt(declaredTotal, currency)}</strong>{' '}
            this month. How much actually landed in your account?
          </p>

          {/* All of it shortcut */}
          <button
            onClick={handleAllIn}
            style={{
              marginBottom: 20,
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, color: T.brandDark, fontWeight: 600,
              padding: 0,
            }}
          >
            All of it came in
          </button>

          {/* Amount input */}
          <div style={{
            display: 'flex', alignItems: 'center',
            border: `1px solid ${amount ? T.brandDark : T.border}`,
            borderRadius: 12, background: T.white,
            overflow: 'hidden', marginBottom: 24,
            transition: 'border-color 0.15s',
          }}>
            <span style={{
              padding: '0 14px', fontSize: 14, fontWeight: 600,
              color: T.text3, borderRight: `1px solid ${T.border}`,
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {currency}
            </span>
            <input
              autoFocus
              type="number"
              inputMode="decimal"
              placeholder={String(declaredTotal)}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{
                flex: 1, height: 52, border: 'none', outline: 'none',
                padding: '0 14px', fontSize: 18, fontWeight: 600,
                color: T.text1, background: 'transparent',
              }}
            />
          </div>

          <button
            onClick={handleAmountNext}
            disabled={parsedAmount <= 0}
            style={{
              width: '100%', height: 52, borderRadius: 14,
              background: parsedAmount > 0 ? T.brandDark : T.border,
              border: 'none',
              color: parsedAmount > 0 ? '#fff' : T.textMuted,
              fontSize: 15, fontWeight: 600,
              cursor: parsedAmount > 0 ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s',
            }}
          >
            {saving ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      )}

      {step === 'payday' && (
        <div>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: T.text2, lineHeight: 1.65 }}>
            Pick the day you usually get paid. We'll check in then so your numbers stay honest.
          </p>

          {/* Day chips */}
          {!showCustom && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              {COMMON_DAYS.map(d => {
                const active = selectedDay === d
                return (
                  <button
                    key={d}
                    onClick={() => setSelectedDay(d)}
                    style={{
                      width: 56, height: 48, borderRadius: 12,
                      border: active ? `2px solid ${T.brandDark}` : `1px solid ${T.border}`,
                      background: active ? T.brandDark : T.white,
                      color: active ? '#fff' : T.text2,
                      fontSize: 15, fontWeight: active ? 600 : 400,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {d}
                  </button>
                )
              })}
              <button
                onClick={() => { setShowCustom(true); setSelectedDay(null) }}
                style={{
                  height: 48, padding: '0 16px', borderRadius: 12,
                  border: `1px solid ${T.border}`,
                  background: T.white, color: T.text3,
                  fontSize: 14, cursor: 'pointer',
                }}
              >
                Other
              </button>
            </div>
          )}

          {/* Custom day input */}
          {showCustom && (
            <div style={{ marginBottom: 16 }}>
              <input
                autoFocus
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                placeholder="Enter day (1–31)"
                value={customDay}
                onChange={e => setCustomDay(e.target.value)}
                style={{
                  width: '100%', height: 52, borderRadius: 12,
                  border: `1px solid ${T.border}`, padding: '0 16px',
                  fontSize: 16, color: T.text1,
                  background: T.white, outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <button
                onClick={() => { setShowCustom(false); setCustomDay('') }}
                style={{ marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: T.textMuted }}
              >
                Back to common days
              </button>
            </div>
          )}

          <button
            onClick={handleSavePayDay}
            disabled={effectiveDay === null || saving}
            style={{
              width: '100%', height: 52, borderRadius: 14,
              background: effectiveDay ? T.brandDark : T.border,
              border: 'none',
              color: effectiveDay ? '#fff' : T.textMuted,
              fontSize: 15, fontWeight: 600,
              cursor: effectiveDay ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>

        </div>
      )}
    </Sheet>
  )
}
