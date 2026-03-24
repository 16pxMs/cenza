// ─────────────────────────────────────────────────────────────
// ReceivedIncomeSheet — income check-in before first log
//
// Confirms how much income actually came in this cycle.
// (Pay schedule is now set in Settings — no payday capture here.)
// ─────────────────────────────────────────────────────────────
'use client'
import { useState } from 'react'
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
  onConfirm:     (received: number) => Promise<void>
}

export function ReceivedIncomeSheet({ open, onClose, declaredTotal, currency, onConfirm }: Props) {
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

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

  const handleConfirm = async () => {
    if (parsedAmount <= 0) return
    setSaving(true)
    await onConfirm(parsedAmount)
    setSaving(false)
    setAmount('')
  }

  const handleClose = () => {
    setAmount('')
    onClose()
  }

  return (
    <Sheet open={open} onClose={handleClose} title="Income check-in">
      <p style={{ margin: '0 0 12px', fontSize: 14, color: T.text2, lineHeight: 1.65 }}>
        Before we track your spending, confirm how much income actually came in this cycle.
      </p>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: 'color-mix(in srgb, var(--brand) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--brand) 25%, transparent)',
        borderRadius: 99, padding: '4px 12px', marginBottom: 16,
      }}>
        <span style={{ fontSize: 11, color: T.text3, fontWeight: 500 }}>Declared</span>
        <span style={{ fontSize: 13, color: T.text1, fontWeight: 600 }}>{currency} {Number(declaredTotal).toLocaleString()}</span>
      </div>

      <button
        onClick={handleAllIn}
        style={{
          marginBottom: 20,
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 13, color: T.brandDark, fontWeight: 600,
          padding: 0, display: 'block',
        }}
      >
        All of it came in
      </button>

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
        onClick={handleConfirm}
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
        {saving ? 'Saving…' : 'Confirm'}
      </button>
    </Sheet>
  )
}
