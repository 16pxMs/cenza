'use client'

// ─────────────────────────────────────────────────────────────────────────────
// OverviewLocked — shown when the user has declined to log at least once.
//
// No locks, no gating. Real UI, even when empty:
//   • Spending card: visible empty bar chart + one quiet inline CTA
//   • Categories: real default categories, KES 0, tappable
//   • Goals: exact same empty state card as OverviewWithData
// ─────────────────────────────────────────────────────────────────────────────

import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'

interface Props {
  name:      string
  currency?: string
  onStart:   (category?: string) => void
}

function greeting(name: string) {
  const h = new Date().getHours()
  if (h < 12) return `Morning, ${name}.`
  if (h < 18) return `Hey, ${name}.`
  return `Evening, ${name}.`
}

const BAR_HEIGHTS = [28, 52, 35, 68, 42, 58, 38]

// Labels must match log/first CATEGORIES exactly so ?category= pre-fill works
const DEFAULT_CATEGORIES = [
  { emoji: '🛒', label: 'Groceries'    },
  { emoji: '🚌', label: 'Transport'    },
  { emoji: '🍽️', label: 'Eating out'  },
  { emoji: '📱', label: 'Airtime / Data' },
  { emoji: '💡', label: 'Utilities'    },
]

export function OverviewLocked({ name, currency = 'KES', onStart }: Props) {
  const router = useRouter()

  return (
    <div style={{
      padding: '28px 16px 96px',
      maxWidth: 480,
      margin: '0 auto',
      boxSizing: 'border-box',
    } as React.CSSProperties}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <p style={{
            margin: '0 0 4px',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--brand-deep)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            {greeting(name)}
          </p>
          <h1 style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 700,
            color: 'var(--text-1)',
            lineHeight: 1.2,
            letterSpacing: '-0.4px',
          }}>
            Your overview is empty.
          </h1>
        </div>
        <button
          onClick={() => router.push('/settings')}
          style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'var(--brand-dark)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0, marginTop: 4,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>
            {name ? name[0].toUpperCase() : '?'}
          </span>
        </button>
      </div>

      {/* ── Spending card ─────────────────────────────────────────── */}
      <div style={{
        background: '#fff',
        borderRadius: 20,
        padding: '22px 24px 24px',
        border: '1px solid var(--border)',
        marginBottom: 16,
      }}>
        <p style={{
          margin: '0 0 16px',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-muted)',
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
        }}>
          Your spending
        </p>

        {/* Empty bar chart — visible, no blur */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 6,
          height: 72,
          marginBottom: 16,
        }}>
          {BAR_HEIGHTS.map((h, i) => (
            <div key={i} style={{
              flex: 1,
              height: `${h}%`,
              background: 'var(--grey-100)',
              borderRadius: 4,
            }} />
          ))}
        </div>

        <p style={{
          margin: '0 0 14px',
          fontSize: 15,
          color: 'var(--text-2)',
          lineHeight: 1.6,
        }}>
          Your spending will appear here.
        </p>

        {/* Inline CTA — the only nudge on this page */}
        <button
          onClick={() => onStart()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            height: 36,
            padding: '0 16px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--brand)',
            border: 'none',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--brand-dark)',
            cursor: 'pointer',
            letterSpacing: '-0.1px',
          }}
        >
          Log an expense
        </button>
      </div>

      {/* ── Categories ────────────────────────────────────────────── */}
      <p style={{
        margin: '0 0 8px',
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--text-muted)',
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
      }}>
        Spending by category
      </p>

      <div style={{
        background: '#fff',
        borderRadius: 16,
        border: '1px solid var(--border)',
        overflow: 'hidden',
        marginBottom: 16,
      }}>
        {DEFAULT_CATEGORIES.map((cat, i) => (
          <button
            key={cat.label}
            onClick={() => onStart(cat.label)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '13px 16px',
              background: 'none',
              border: 'none',
              borderBottom: i < DEFAULT_CATEGORIES.length - 1
                ? '1px solid var(--border-subtle)'
                : 'none',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'var(--grey-100)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 17,
              flexShrink: 0,
            }}>
              {cat.emoji}
            </span>
            <span style={{
              flex: 1,
              fontSize: 15,
              fontWeight: 500,
              color: 'var(--text-1)',
            }}>
              {cat.label}
            </span>
            <span style={{
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--text-muted)',
            }}>
              {currency} 0
            </span>
          </button>
        ))}
      </div>

      {/* ── Goals empty state — identical to OverviewWithData ─────── */}
      <div style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        padding: '24px',
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: '#F0FDF4',
          border: '1px solid #BBF7D0',
          borderRadius: 99,
          padding: '4px 12px',
          marginBottom: 20,
        }}>
          <Sparkles size={12} color="#15803D" />
          <span style={{ fontSize: 11, fontWeight: 600, color: '#15803D', letterSpacing: '0.04em' }}>
            Set up your first goal
          </span>
        </div>

        <h2 style={{
          margin: '0 0 8px',
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--text-1)',
          lineHeight: 1.2,
          letterSpacing: '-0.2px',
        }}>
          Give your money a purpose.
        </h2>

        <p style={{
          margin: '0 0 28px',
          fontSize: 14,
          color: 'var(--text-2)',
          lineHeight: 1.65,
        }}>
          Whether it is school fees, an emergency fund, or something else. Set a goal and track it here.
        </p>

        <button
          onClick={() => router.push('/goals/new?from=overview')}
          style={{
            width: '100%',
            height: 52,
            borderRadius: 14,
            background: 'var(--brand-dark)',
            color: '#fff',
            border: 'none',
            fontWeight: 600,
            fontSize: 15,
            cursor: 'pointer',
            letterSpacing: '-0.1px',
          }}
        >
          Add your first goal
        </button>
      </div>

    </div>
  )
}
