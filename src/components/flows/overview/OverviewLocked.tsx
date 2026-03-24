'use client'

import type { CSSProperties } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// OverviewLocked — shown when the user has declined to log at least once.
//
// Displays the same card layout as OverviewWithData but with skeleton placeholders
// and a frosted-glass overlay on each card. No data, no state — purely presentational.
// The single CTA routes to /log/first.
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

function LockedCard({ children, hint }: { children: React.ReactNode; hint: string }) {
  return (
    <div style={{
      position: 'relative',
      background: 'var(--white, #fff)',
      border: '1px solid var(--border, #E4E7EC)',
      borderRadius: 'var(--radius-lg, 16px)',
      overflow: 'hidden',
      marginBottom: 'var(--space-md, 12px)',
    }}>
      {children}
      {/* Frosted glass overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        background: 'rgba(255, 255, 255, 0.6)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '0 24px',
      } as CSSProperties}>
        <span style={{ fontSize: 20 }}>🔒</span>
        <span style={{
          fontSize: 'var(--text-sm, 13px)',
          color: 'var(--text-muted, #98A2B3)',
          fontWeight: 'var(--weight-medium, 500)',
          textAlign: 'center',
          lineHeight: 1.4,
        }}>
          {hint}
        </span>
      </div>
    </div>
  )
}

export function OverviewLocked({ name, onStart }: Props) {
  return (
    <div style={{
      padding: '0 var(--page-padding-mobile, 16px)',
      paddingBottom: 96,
      paddingTop: 'var(--space-xl, 24px)',
      maxWidth: 600,
      margin: '0 auto',
    }}>

      {/* Greeting */}
      <p style={{
        margin: '0 0 var(--space-xl, 24px)',
        fontSize: 'var(--text-base, 15px)',
        fontWeight: 'var(--weight-semibold, 600)',
        color: 'var(--brand-dark, #5C3489)',
        letterSpacing: '0.01em',
      }}>
        {greeting(name)}
      </p>

      {/* Spending summary card */}
      <LockedCard hint="Log an expense to see your spending">
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ height: 48, background: '#F2F4F7', borderRadius: 8 }} />
          ))}
        </div>
      </LockedCard>

      {/* Budget categories card */}
      <LockedCard hint="Your categories will appear here">
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#F2F4F7', flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ height: 8, background: '#F2F4F7', borderRadius: 4, width: '60%' }} />
                <div style={{ height: 8, background: '#F2F4F7', borderRadius: 4, width: '40%' }} />
              </div>
            </div>
          ))}
        </div>
      </LockedCard>

      {/* Goals card */}
      <LockedCard hint="Track savings goals once you start logging">
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1].map(i => (
            <div key={i} style={{ height: 8, background: '#F2F4F7', borderRadius: 4, width: '100%' }} />
          ))}
        </div>
      </LockedCard>

      {/* Sticky CTA */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '12px var(--page-padding-mobile, 16px)',
        background: 'var(--page-bg, #F8F9FA)',
        borderTop: '1px solid var(--border, #E4E7EC)',
      }}>
        <button
          onClick={onStart}
          style={{
            width: '100%',
            height: 56,
            borderRadius: 'var(--radius-lg, 16px)',
            background: 'var(--brand-dark, #5C3489)',
            border: 'none',
            color: 'var(--text-inverse, #fff)',
            fontSize: 'var(--text-base, 15px)',
            fontWeight: 'var(--weight-semibold, 600)',
            cursor: 'pointer',
            letterSpacing: '-0.1px',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          + Log expense
        </button>
      </div>

    </div>
  )
}
