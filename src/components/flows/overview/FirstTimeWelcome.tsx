'use client'

// ─────────────────────────────────────────────────────────────────────────────
// FirstTimeWelcome — shown on first visit before the user logs anything.
// Shown only when cenza_skip_count === 0. After the first skip, OverviewLocked
// takes over — so there is only one nudge variant.
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

export function FirstTimeWelcome({ name, onStart }: Props) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '0 var(--page-padding-mobile, 16px)',
      background: 'var(--page-bg)',
    }}>

      <div style={{ maxWidth: 480, width: '100%' }}>

        <p style={{
          margin: '0 0 var(--space-sm)',
          fontSize: 'var(--text-base)',
          fontWeight: 'var(--weight-semibold)',
          color: 'var(--brand-dark)',
          letterSpacing: '0.01em',
        }}>
          {greeting(name)}
        </p>

        <h1 style={{
          margin: '0 0 var(--space-md)',
          fontSize: 'var(--text-3xl)',
          color: 'var(--text-1)',
        }}>
          Let's see where your<br />money goes.
        </h1>

        <p style={{
          margin: '0 0 var(--space-xxl)',
          fontSize: 'var(--text-base)',
          color: 'var(--text-2)',
          lineHeight: 1.65,
        }}>
          Start by logging something you spent today. We'll build your overview from there.
        </p>

        <button
          onClick={onStart}
          style={{
            width: '100%',
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

      </div>
    </div>
  )
}
