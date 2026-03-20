'use client'
import { useState, useEffect, useRef } from 'react'
import { Sheet } from '@/components/layout/Sheet/Sheet'

interface Props {
  open:      boolean
  onClose:   () => void
  goalId:    string
  goalLabel: string
  goalIcon:  string
  currency:  string
  onSave:    (amount: number, note: string) => Promise<void>
}

export function GoalContribSheet({ open, onClose, goalLabel, goalIcon, currency, onSave }: Props) {
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

  return (
    <Sheet open={open} onClose={onClose} title="Add to goal">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Goal identity */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px', borderRadius: 14,
          background: '#F5F0FA', border: '1px solid #C9AEE8',
        }}>
          <span style={{ fontSize: 24 }}>{goalIcon}</span>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A0A2E' }}>{goalLabel}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#7C5AA8' }}>Adding a contribution</p>
          </div>
        </div>

        {/* Amount */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '16px 0 8px', borderTop: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 12.5, color: '#98A2B3', marginBottom: 4 }}>{currency}</span>
          <input
            ref={amountRef}
            type="text"
            inputMode="decimal"
            value={displayAmount}
            onChange={handleAmountChange}
            placeholder="0"
            onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
            style={{
              fontSize: 52, fontWeight: 600, textAlign: 'center',
              background: 'none', border: 'none', outline: 'none', width: '100%',
              color: amount ? '#101828' : '#D0D5DD',
              letterSpacing: -1, lineHeight: 1, padding: 0,
            }}
          />
        </div>

        {/* Note */}
        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Add a note (optional)"
          style={{
            height: 46, borderRadius: 12, border: '1px solid var(--border)',
            padding: '0 14px', fontSize: 14, color: '#101828',
            background: '#fff', outline: 'none', width: '100%', boxSizing: 'border-box',
          }}
        />

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={amountNum <= 0 || saving}
          style={{
            height: 52, borderRadius: 14, border: 'none', width: '100%',
            background: saved ? '#15803D' : amountNum > 0 ? '#5C3489' : '#E4E7EC',
            color: amountNum > 0 || saved ? '#fff' : '#98A2B3',
            fontSize: 15, fontWeight: 600,
            cursor: amountNum > 0 ? 'pointer' : 'not-allowed',
            transition: 'background 0.2s',
          }}
        >
          {saved ? 'Saved ✓' : saving ? 'Saving…' : amountNum > 0 ? `Add ${currency} ${displayAmount} to ${goalLabel}` : 'Enter an amount'}
        </button>

      </div>
    </Sheet>
  )
}
