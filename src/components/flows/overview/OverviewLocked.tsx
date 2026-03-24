'use client'

import type { CSSProperties } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// OverviewLocked — shown when the user has declined to log at least once.
//
// Redesigned as a calm, inviting empty state:
//   • One hero preview card (dark gradient + ghost chart) instead of 3 locked boxes
//   • Feature rows show what unlocks — no repeated lock icons
//   • CTA is warm and low-pressure
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  name:    string
  onStart: () => void
}

function greeting(name: string) {
  const h = new Date().getHours()
  if (h < 12) return `Morning, ${name}.`
  if (h < 18) return `Hey, ${name}.`
  return `Evening, ${name}.`
}

// Ghost bar heights for the preview chart (purely decorative)
const BAR_HEIGHTS = [38, 55, 30, 72, 48, 62, 44]

const FEATURES: { icon: string; label: string; description: string }[] = [
  { icon: '◎', label: 'Spending overview',   description: 'See where every shilling goes each cycle' },
  { icon: '◈', label: 'Budget categories',   description: 'Track spending by category automatically'  },
  { icon: '◇', label: 'Savings goals',       description: 'Set targets and watch your progress build' },
]

export function OverviewLocked({ name, onStart }: Props) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100dvh',
      background: 'var(--page-bg)',
      padding: '0 var(--page-padding-mobile)',
      paddingTop: 28,
      paddingBottom: 100,
      maxWidth: 480,
      margin: '0 auto',
      boxSizing: 'border-box',
    } as CSSProperties}>

      {/* ── Greeting ─────────────────────────────────────────────────── */}
      <p style={{
        margin: '0 0 4px',
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--weight-semibold)',
        color: 'var(--brand-deep)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}>
        {greeting(name)}
      </p>

      <h1 style={{
        margin: '0 0 28px',
        fontSize: 'var(--text-2xl)',
        fontWeight: 'var(--weight-bold)',
        color: 'var(--text-1)',
        lineHeight: 1.2,
        letterSpacing: '-0.5px',
      }}>
        Your overview<br />is ready to fill.
      </h1>

      {/* ── Hero preview card ─────────────────────────────────────────── */}
      <div style={{
        position: 'relative',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        background: 'linear-gradient(145deg, var(--brand-darker) 0%, var(--brand-dark) 60%, var(--brand-deep) 100%)',
        padding: '24px 20px 20px',
        marginBottom: 32,
        boxShadow: 'var(--shadow-lg)',
      }}>

        {/* Card header */}
        <p style={{
          margin: '0 0 16px',
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--weight-semibold)',
          color: 'rgba(255,255,255,0.5)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          This cycle
        </p>

        {/* Ghost bar chart */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 6,
          height: 80,
          marginBottom: 20,
        }}>
          {BAR_HEIGHTS.map((h, i) => (
            <div key={i} style={{
              flex: 1,
              height: `${h}%`,
              background: 'rgba(255,255,255,0.12)',
              borderRadius: 4,
            }} />
          ))}
        </div>

        {/* Ghost stat row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 8,
          marginBottom: 20,
        }}>
          {['Spent', 'Budget', 'Left'].map((label) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 10,
              padding: '10px 0',
              textAlign: 'center',
            }}>
              <div style={{
                height: 6,
                background: 'rgba(255,255,255,0.18)',
                borderRadius: 3,
                width: '55%',
                margin: '0 auto 6px',
              }} />
              <p style={{
                margin: 0,
                fontSize: 'var(--text-xs)',
                color: 'rgba(255,255,255,0.4)',
                fontWeight: 'var(--weight-medium)',
              }}>
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* Frosted lock overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          background: 'rgba(36, 16, 64, 0.52)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          borderRadius: 'var(--radius-xl)',
        } as CSSProperties}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            marginBottom: 4,
          }}>
            🔒
          </div>
          <p style={{
            margin: 0,
            fontSize: 'var(--text-base)',
            fontWeight: 'var(--weight-semibold)',
            color: '#fff',
            textAlign: 'center',
          }}>
            Log one expense to unlock
          </p>
          <p style={{
            margin: 0,
            fontSize: 'var(--text-sm)',
            color: 'rgba(255,255,255,0.55)',
            textAlign: 'center',
            lineHeight: 1.5,
          }}>
            Your full spending picture will appear here
          </p>
        </div>

      </div>

      {/* ── Feature list ─────────────────────────────────────────────── */}
      <p style={{
        margin: '0 0 12px',
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--weight-semibold)',
        color: 'var(--text-muted)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}>
        What you'll see
      </p>

      <div style={{
        background: 'var(--white)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
      }}>
        {FEATURES.map((f, i) => (
          <div key={f.label} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '14px 16px',
            borderBottom: i < FEATURES.length - 1
              ? '1px solid var(--border-subtle)'
              : 'none',
          }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'var(--brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              color: 'var(--brand-dark)',
              flexShrink: 0,
            }}>
              {f.icon}
            </div>
            <div>
              <p style={{
                margin: '0 0 2px',
                fontSize: 'var(--text-base)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--text-1)',
              }}>
                {f.label}
              </p>
              <p style={{
                margin: 0,
                fontSize: 'var(--text-sm)',
                color: 'var(--text-3)',
                lineHeight: 1.45,
              }}>
                {f.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Sticky CTA ───────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '12px var(--page-padding-mobile) 28px',
        background: 'linear-gradient(to top, var(--page-bg) 70%, transparent)',
      }}>
        <button
          onClick={onStart}
          style={{
            width: '100%',
            maxWidth: 480,
            display: 'block',
            margin: '0 auto',
            height: 56,
            borderRadius: 'var(--radius-lg)',
            background: 'var(--brand-dark)',
            border: 'none',
            color: 'var(--text-inverse)',
            fontSize: 'var(--text-base)',
            fontWeight: 'var(--weight-semibold)',
            cursor: 'pointer',
            letterSpacing: '-0.1px',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          Log my first expense
        </button>
        <p style={{
          margin: '8px 0 0',
          textAlign: 'center',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-muted)',
        }}>
          Takes under a minute
        </p>
      </div>

    </div>
  )
}
