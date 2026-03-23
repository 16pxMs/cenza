'use client'
import { useState, useRef } from 'react'
import './OverviewEmpty.css'
import { fmt } from '@/lib/finance'

interface Props {
  name: string
  currency: string
  onSave: (data: { income: number; extraIncome: { id: string; label: string; amount: number }[]; total: number }) => void
}

function getGreeting(name: string) {
  const hour = new Date().getHours()
  if (hour < 12) return `Morning, ${name}.`
  if (hour < 18) return `Hey, ${name}.`
  return `Evening, ${name}.`
}

export function OverviewEmpty({ name, currency, onSave }: Props) {
  const [display, setDisplay] = useState('')
  const [raw, setRaw]         = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const canSave = raw > 0

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/[^0-9]/g, '')
    const num = digits ? parseInt(digits, 10) : 0
    setRaw(num)
    setDisplay(num > 0 ? num.toLocaleString() : '')
  }

  const handleSave = () => {
    if (!canSave) return
    onSave({ income: raw, extraIncome: [], total: raw })
  }

  // Scale font down as number grows
  const fontSize = display.length <= 5 ? 64
    : display.length <= 8  ? 52
    : display.length <= 11 ? 38
    : 28

  return (
    <div className="overview-empty">

      {/* Greeting — no avatar, parent page renders it */}
      <p className="overview-empty__greeting">{getGreeting(name)}</p>

      {/* Heading */}
      <h1 className="overview-empty__heading">What do you earn<br />each month?</h1>
      <p className="overview-empty__sub">The amount that actually lands in your account.</p>

      {/* Income input — visual display decoupled from input so cursor doesn't fight the "0" */}
      <div
        className="overview-empty__input-zone"
        onClick={() => inputRef.current?.focus()}
      >
        <span className="overview-empty__currency-label">{currency}</span>

        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', cursor: 'text' }}>
          {/* Visual number — shown always, dimmed when empty */}
          <span
            style={{
              fontSize,
              fontWeight: 300,
              lineHeight: 1.1,
              color: display ? 'var(--text-1)' : 'var(--text-muted)',
              userSelect: 'none',
              pointerEvents: 'none',
              letterSpacing: -1,
            }}
          >
            {display || '0'}
          </span>

          {/* Hidden input — captures keyboard, no visible cursor */}
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={display}
            onChange={handleChange}
            autoFocus
            style={{
              position: 'absolute', inset: 0,
              opacity: 0,
              fontSize: 16, // prevents iOS zoom
              border: 'none', outline: 'none',
              background: 'transparent',
              caretColor: 'transparent',
            }}
          />
        </div>

        {canSave && (
          <span className="overview-empty__amount-formatted">
            {currency} {raw.toLocaleString()}
          </span>
        )}
      </div>

      {/* CTA */}
      <div className="overview-empty__bottom">
        <button className="overview-empty__cta" onClick={handleSave} disabled={!canSave}>
          {canSave ? 'Add my income' : 'Enter your income'}
        </button>
      </div>

    </div>
  )
}
