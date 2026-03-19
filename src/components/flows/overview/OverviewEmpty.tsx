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
  if (hour < 12) return `Morning, ${name}`
  if (hour < 18) return `Hey, ${name}`
  return `Evening, ${name}`
}

export function OverviewEmpty({ name, currency, onSave }: Props) {
  const [display, setDisplay] = useState('')   // formatted string shown in input
  const [raw, setRaw]         = useState(0)    // actual number used for saving
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

  const initial = (name ?? '?')[0].toUpperCase()

  // Scale font down as number grows so it always fits one line
  const fontSize = display.length <= 5 ? 64
    : display.length <= 8  ? 52
    : display.length <= 11 ? 38
    : 28

  return (
    <div className="overview-empty">

      {/* Top bar */}
      <div className="overview-empty__topbar">
        <p className="overview-empty__greeting">{getGreeting(name)}</p>
        <div className="overview-empty__avatar">{initial}</div>
      </div>

      {/* Heading */}
      <h1 className="overview-empty__heading">What do you earn<br />each month?</h1>
      <p className="overview-empty__sub">The amount that actually lands in your account each month.</p>

      {/* Income input */}
      <div className="overview-empty__input-zone" onClick={() => inputRef.current?.focus()}>
        <span className="overview-empty__currency-label">{currency}</span>
        <input
          ref={inputRef}
          className="overview-empty__amount-input"
          type="text"
          inputMode="numeric"
          placeholder="0"
          value={display}
          onChange={handleChange}
          autoFocus
          style={{ fontSize }}
        />
        {canSave && (
          <span className="overview-empty__amount-formatted">
            {fmt(raw, currency)}
          </span>
        )}
      </div>

      {/* Bottom — always visible */}
      <div className="overview-empty__bottom">
        <button className="overview-empty__cta" onClick={handleSave} disabled={!canSave}>
          Add my income
        </button>
      </div>

    </div>
  )
}
