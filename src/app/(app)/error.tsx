'use client'

import { useEffect } from 'react'
import { PrimaryBtn, SecondaryBtn } from '@/components/ui/Button/Button'

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[app] rendered error boundary', error)
  }, [error])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '48px 16px' }}>
        <div
          style={{
            background: 'var(--white)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: 24,
          }}
        >
          <h1
            style={{
              margin: '0 0 8px',
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-2xl)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-1)',
              letterSpacing: '-0.01em',
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              margin: '0 0 20px',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-2)',
              lineHeight: 1.5,
            }}
          >
            We couldn't load this page. Please try again in a moment.
          </p>

          <PrimaryBtn size="lg" onClick={() => reset()}>
            Try again
          </PrimaryBtn>
          <SecondaryBtn
            size="lg"
            onClick={() => { window.location.href = '/app' }}
            style={{ marginTop: 10 }}
          >
            Back to overview
          </SecondaryBtn>
        </div>
      </div>
    </div>
  )
}