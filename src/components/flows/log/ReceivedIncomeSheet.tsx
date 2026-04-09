// ─────────────────────────────────────────────────────────────
// ReceivedIncomeSheet — income check-in before first log
//
// Confirms how much income actually came in this cycle.
// (Pay schedule is now set in Settings — no payday capture here.)
// ─────────────────────────────────────────────────────────────
'use client'
import { useEffect, useState } from 'react'
import { Sheet } from '@/components/layout/Sheet/Sheet'

const T = {
  brandDark: '#5C3489',
  text1:     '#101828',
  text2:     '#475467',
  text3:     '#667085',
  textMuted: '#98A2B3',
  border:    '#E4E7EC',
  white:     '#FFFFFF',
}

interface Props {
  open:          boolean
  onClose:       () => void
  declaredTotal: number
  currency:      string
  incomeType?:   'salaried' | 'variable' | null
  onConfirm:     (received: number) => Promise<void>
}

export function ReceivedIncomeSheet({ open, onClose, declaredTotal, currency, incomeType, onConfirm }: Props) {
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [showCustomAmount, setShowCustomAmount] = useState(false)
  const isVariable = incomeType === 'variable'
  const isSalaried = incomeType === 'salaried'

  const parsedAmount = parseFloat(amount.replace(/,/g, '')) || 0

  const displayAmount = (() => {
    if (!amount) return ''
    const raw = amount.replace(/,/g, '')
    const parts = raw.split('.')
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return parts.join('.')
  })()

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '')
    if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return
    setAmount(raw)
  }

  const handleAllIn = () => {
    setAmount(String(declaredTotal))
  }

  useEffect(() => {
    if (!open) {
      setShowCustomAmount(false)
      setAmount('')
    }
  }, [open])

  const handleConfirm = async (value: number) => {
    if (value <= 0) return
    setSaving(true)
    await onConfirm(value)
    setSaving(false)
    setAmount('')
    setShowCustomAmount(false)
  }

  const handleClose = () => {
    setShowCustomAmount(false)
    setAmount('')
    onClose()
  }

  return (
    <Sheet open={open} onClose={handleClose} title={isVariable ? 'Money received this month' : "Confirm this month's income"}>
      <p style={{ margin: '0 0 12px', fontSize: 14, color: T.text2, lineHeight: 1.65 }}>
        {isVariable
          ? 'Keep this month accurate by logging what actually came in. You can update this anytime.'
          : 'Quick check-in so your remaining balance reflects reality.'}
      </p>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: 'color-mix(in srgb, var(--brand) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--brand) 25%, transparent)',
        borderRadius: 99, padding: '4px 12px', marginBottom: 16,
      }}>
        <span style={{ fontSize: 11, color: T.text3, fontWeight: 500 }}>{isVariable ? 'Expected' : 'Planned'}</span>
        <span style={{ fontSize: 13, color: T.text1, fontWeight: 600 }}>{currency} {Number(declaredTotal).toLocaleString()}</span>
      </div>

      {isVariable && (
        <button
          onClick={handleAllIn}
          style={{
            marginBottom: 20,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: T.brandDark, fontWeight: 600,
            padding: 0, display: 'block',
          }}
        >
          Use expected amount
        </button>
      )}

      {isSalaried && !showCustomAmount && (
        <>
          <button
            onClick={() => handleConfirm(Number(declaredTotal))}
            disabled={saving || declaredTotal <= 0}
            style={{
              width: '100%', height: 52, borderRadius: 14,
              background: declaredTotal > 0 ? T.brandDark : T.border,
              border: 'none',
              color: declaredTotal > 0 ? '#fff' : T.textMuted,
              fontSize: 15, fontWeight: 600,
              cursor: declaredTotal > 0 ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s',
              marginBottom: 10,
            }}
          >
            {saving ? 'Saving…' : 'I received full income'}
          </button>
          <button
            onClick={() => setShowCustomAmount(true)}
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              color: T.text3,
              fontWeight: 600,
              padding: '8px 0 0',
            }}
          >
            Enter a different amount
          </button>
        </>
      )}

      {(isVariable || showCustomAmount) && (
        <>
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
              type="text"
              inputMode="decimal"
              placeholder={Number(declaredTotal).toLocaleString()}
              value={displayAmount}
              onChange={handleAmountChange}
              style={{
                flex: 1, height: 52, border: 'none', outline: 'none',
                padding: '0 14px', fontSize: 18, fontWeight: 600,
                color: T.text1, background: 'transparent',
              }}
            />
          </div>

          <button
            onClick={() => handleConfirm(parsedAmount)}
            disabled={parsedAmount <= 0 || saving}
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
            {saving ? 'Saving…' : isVariable ? 'Save received amount' : 'Confirm income'}
          </button>
        </>
      )}
    </Sheet>
  )
}
