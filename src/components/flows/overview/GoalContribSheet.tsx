'use client'
import { useState, useEffect, useRef } from 'react'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { PrimaryBtn } from '@/components/ui/Button/Button'

interface Props {
  open:      boolean
  onClose:   () => void
  goalId:    string
  goalLabel: string
  currency:  string
  onSave:    (amount: number, note: string) => Promise<void>
}

export function GoalContribSheet({ open, onClose, goalLabel, currency, onSave }: Props) {
  const [amount,  setAmount]  = useState('')
  const [note,    setNote]    = useState('')
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const amountRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setAmount('')
    setNote('')
    setSaved(false)
    setTimeout(() => amountRef.current?.focus(), 300)
  }, [open])

  const amountNum = parseFloat(amount) || 0

  const displayAmount = (() => {
    if (!amount) return ''
    const parts = amount.split('.')
    const int   = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return parts.length > 1 ? `${int}.${parts[1]}` : int
  })()

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val   = e.target.value.replace(/[^0-9.]/g, '')
    const parts = val.split('.')
    if (parts.length > 2) return
    if (parts[1] && parts[1].length > 2) return
    setAmount(val)
  }

  const handleSave = async () => {
    if (amountNum <= 0) return
    setSaving(true)
    try {
      await onSave(amountNum, note)
      setSaved(true)
      setTimeout(() => { setSaved(false); onClose() }, 700)
    } finally {
      setSaving(false)
    }
  }

  const T = {
    white: 'var(--white)',
    border: 'var(--border)',
    borderSubtle: 'var(--border-subtle)',
    text1: 'var(--text-1)',
    text2: 'var(--text-2)',
    text3: 'var(--text-3)',
    textMuted: 'var(--text-muted)',
    textInverse: 'var(--text-inverse)',
    grey50: 'var(--grey-50)',
    grey200: 'var(--grey-200)',
    brandDark: 'var(--brand-dark)',
    green: 'var(--green)',
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add money">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <p style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 600,
          color: T.text1,
          letterSpacing: '-0.02em',
          lineHeight: 1.25,
        }}>
          {goalLabel}
        </p>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '8px 0 4px',
          borderTop: `1px solid ${T.borderSubtle}`,
          borderBottom: `1px solid ${T.borderSubtle}`,
        }}>
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            color: T.textMuted,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}>
            {currency}
          </span>
          <input
            ref={amountRef}
            type="text"
            inputMode="decimal"
            value={displayAmount}
            onChange={handleAmountChange}
            placeholder="0"
            onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
            style={{
              fontSize: 56, fontWeight: 600, textAlign: 'center',
              background: 'none', border: 'none', outline: 'none', width: '100%',
              color: amount ? T.text1 : T.grey200,
              letterSpacing: -1, lineHeight: 1, padding: 0,
              fontFamily: 'var(--font-sans)',
            }}
          />
        </div>

        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Add a note (optional)"
          style={{
            height: 40,
            borderRadius: 12,
            border: `1px solid ${T.border}`,
            padding: '0 14px',
            fontSize: 14,
            color: T.text1,
            background: T.white,
            outline: 'none',
            width: '100%',
            boxSizing: 'border-box',
          }}
        />

        <PrimaryBtn
          size="lg"
          onClick={handleSave}
          disabled={amountNum <= 0 || saving}
          style={{
            background: saved ? T.green : amountNum > 0 ? T.brandDark : T.grey200,
            color: amountNum > 0 || saved ? T.textInverse : T.textMuted,
            transition: 'background 0.2s ease',
          }}
        >
          {saved ? 'Saved' : saving ? 'Saving…' : amountNum > 0 ? 'Add money' : 'Enter an amount'}
        </PrimaryBtn>
      </div>
    </Sheet>
  )
}
