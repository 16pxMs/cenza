'use client'

// ─────────────────────────────────────────────────────────────────────────────
// FirstTimeWelcome — shown until the user logs their first expense.
//
// Progressive nudge: headline + body copy escalates based on how many times
// the user has skipped. Skip count is tracked in localStorage under
// 'cenza_skip_count' and is written by the /log/first skip interstitial.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'

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

const NUDGES = [
  {
    headline: <>Let's see where your<br />money goes.</>,
    body: "Start by logging something you spent today. We'll build your overview from there.",
    cta: 'Log my first expense',
  },
  {
    headline: <>Your money has a story.<br />Start telling it.</>,
    body: "Every expense you log builds a clearer picture of where you stand financially.",
    cta: 'Log an expense',
  },
  {
    headline: <>Still flying blind?<br />One tap changes that.</>,
    body: "Log a single expense — coffee, transport, anything — and your overview comes to life.",
    cta: 'Log something now',
  },
]

export function FirstTimeWelcome({ name, onStart }: Props) {
  const [skipCount, setSkipCount] = useState(0)

  useEffect(() => {
    const stored = parseInt(localStorage.getItem('cenza_skip_count') ?? '0', 10)
    setSkipCount(stored)
  }, [])

  const nudge = NUDGES[Math.min(skipCount, NUDGES.length - 1)]

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
          {nudge.headline}
        </h1>

        <p style={{
          margin: '0 0 var(--space-xxl)',
          fontSize: 'var(--text-base)',
          color: 'var(--text-2)',
          lineHeight: 1.65,
        }}>
          {nudge.body}
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
          {nudge.cta}
        </button>

      </div>
    </div>
  )
}
