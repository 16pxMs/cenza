'use client'

import type { ReactNode } from 'react'
import { IconBack } from '@/components/ui/Icons'

interface SingleTaskFlowStepProps {
  stepLabel: string
  title: string
  supportingLine?: string
  onBack: () => void
  backDisabled?: boolean
  children: ReactNode
  action: ReactNode
}

export function SingleTaskFlowStep({
  stepLabel,
  title,
  supportingLine,
  onBack,
  backDisabled,
  children,
  action,
}: SingleTaskFlowStepProps) {
  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--page-bg)',
      padding: 'var(--space-lg) var(--space-page-mobile) calc(var(--space-xxl) + var(--bottom-nav-height, 0px))',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          disabled={backDisabled}
          style={{
            width: 44,
            height: 44,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 'var(--space-lg)',
            color: 'var(--grey-900)',
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: backDisabled ? 'default' : 'pointer',
          }}
        >
          <IconBack size={20} />
        </button>

        <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
          <div>
            <p style={{
              margin: '0 0 var(--space-sm)',
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
            }}>
              {stepLabel}
            </p>
            <h1 style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-xl)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-1)',
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
            }}>
              {title}
            </h1>
            {supportingLine ? (
              <p style={{
                margin: 'var(--space-xs) 0 0',
                fontSize: 'var(--text-base)',
                fontWeight: 'var(--weight-regular)',
                color: 'var(--text-3)',
                lineHeight: 1.45,
              }}>
                {supportingLine}
              </p>
            ) : null}
          </div>

          <div style={{ display: 'grid', gap: 'var(--space-lg)' }}>
            {children}
            {action}
          </div>
        </div>
      </div>
    </main>
  )
}
