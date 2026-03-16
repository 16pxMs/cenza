'use client'
import { useState } from 'react'
import './Input.css'

interface Props {
  label: string
  value: string
  onChange: (val: string) => void
  prefix?: string
  placeholder?: string
  type?: string
  hint?: string
}

export function Input({ label, value, onChange, prefix, placeholder, type = 'text', hint }: Props) {
  const [focused, setFocused] = useState(false)
  return (
    <div className="input-wrap">
      <label className="input-label">{label}</label>
      <div className={`input-field${focused ? ' input-field--focused' : ''}`}>
        {prefix && <span className="input-prefix">{prefix}</span>}
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </div>
      {hint && <p className="input-hint">{hint}</p>}
    </div>
  )
}
