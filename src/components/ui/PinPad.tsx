'use client'

// ─────────────────────────────────────────────────────────────
// PinPad — 4-dot indicator + 10-key number pad
//
// Used by: PinSetupClient (onboarding + reset), PinEntryClient
// ─────────────────────────────────────────────────────────────

interface Props {
  value:    string                        // current entered digits, max 4
  onChange: (v: string) => void
  shake?:   boolean                       // triggers shake animation
  disabled?: boolean
}

const T = {
  brand:     'var(--brand-dark)',
  text1:     'var(--text-1)',
  text2:     'var(--text-2)',
  border:    'var(--border)',
  bgSubtle:  'var(--grey-50)',
  bgMuted:   'var(--grey-100)',
}

// Standard phone keypad layout
const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  [null, '0', 'del'],
] as const

export function PinPad({ value, onChange, shake = false, disabled = false }: Props) {
  const handleDigit = (d: string) => {
    if (disabled || value.length >= 4) return
    onChange(value + d)
  }

  const handleDelete = () => {
    if (disabled || value.length === 0) return
    onChange(value.slice(0, -1))
  }

  return (
    <>
      <style>{`
        @keyframes pinShake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-8px); }
          40%       { transform: translateX(8px); }
          60%       { transform: translateX(-5px); }
          80%       { transform: translateX(5px); }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 34 }}>

        {/* 4-dot indicator */}
        <div style={{
          display: 'flex', gap: 18,
          animation: shake ? 'pinShake 0.45s ease' : 'none',
        }}>
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                width: 13, height: 13, borderRadius: '50%',
                background:  i < value.length ? T.brand : 'transparent',
                border:      `2px solid ${i < value.length ? T.brand : T.border}`,
                transition:  'background 0.12s, border-color 0.12s',
              }}
            />
          ))}
        </div>

        {/* Number pad */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12, width: '100%', maxWidth: 276,
        }}>
          {ROWS.flat().map((key, i) => {
            if (key === null) return <div key={`cell-${i}`} />

            if (key === 'del') {
              return (
                <button
                  key={`cell-${i}`}
                  onClick={handleDelete}
                  disabled={disabled || value.length === 0}
                  style={{
                    height: 84, width: 84, borderRadius: '50%',
                    background: value.length === 0 ? T.bgMuted : T.bgSubtle,
                    border: `1px solid ${T.border}`,
                    color: T.text2, fontSize: 20,
                    cursor: disabled || value.length === 0 ? 'default' : 'pointer',
                    opacity: value.length === 0 ? 0.55 : 1,
                    transition: 'opacity 0.12s, background 0.12s',
                    fontFamily: 'inherit',
                  }}
                >
                  ⌫
                </button>
              )
            }

            return (
              <button
                key={`cell-${i}`}
                onClick={() => handleDigit(key)}
                disabled={disabled}
                style={{
                  height: 84, width: 84, borderRadius: '50%',
                  background: T.bgSubtle, border: `1px solid ${T.border}`,
                  color: T.text1, fontSize: 20, fontWeight: 500,
                  cursor: disabled ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                  transition: 'background 0.1s, transform 0.08s',
                }}
              >
                {key}
              </button>
            )
          })}
        </div>

      </div>
    </>
  )
}
