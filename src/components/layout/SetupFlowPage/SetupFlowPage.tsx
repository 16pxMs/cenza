'use client'

import type { ReactNode } from 'react'
import { IconBack } from '@/components/ui/Icons'
import { SETUP_PAGE_COPY, type SetupPageCopyKey } from './setup-flow-copy'

const T = {
  pageBg: 'var(--page-bg)',
  white: 'var(--white)',
  border: 'var(--border)',
  text1: 'var(--text-1)',
  text3: 'var(--text-3)',
  textMuted: 'var(--text-muted)',
}

interface Props {
  pageKey: SetupPageCopyKey
  onBack: () => void
  children: ReactNode
  isDesktop?: boolean
  isSaving?: boolean
  copyOverride?: Partial<(typeof SETUP_PAGE_COPY)[SetupPageCopyKey]>
}

export function SetupFlowPage({
  pageKey,
  onBack,
  children,
  isDesktop,
  isSaving,
  copyOverride,
}: Props) {
  const copy = {
    ...SETUP_PAGE_COPY[pageKey],
    ...copyOverride,
  }
  const hasHeader = Boolean(copy.eyebrow || copy.title || copy.subtitle)

  return (
    <div style={{ minHeight: '100vh', background: T.pageBg }}>
      <main style={{ maxWidth: 640, margin: '0 auto', padding: isDesktop ? '40px var(--space-page-desktop) 96px' : '24px var(--space-page-mobile) 88px' }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            width: 44,
            height: 44,
            padding: 0,
            marginBottom: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--grey-900)',
          }}
          aria-label="Go back"
        >
          <IconBack size={18} />
        </button>

        <section
          style={{
            background: T.white,
            border: `1px solid ${T.border}`,
            borderRadius: 24,
            padding: isDesktop ? '28px 28px 24px' : '24px 18px 20px',
          }}
        >
          {hasHeader && (
          <div style={{ marginBottom: 24 }}>
            {copy.eyebrow ? (
              <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {copy.eyebrow}
              </p>
            ) : null}
            {copy.title ? (
              <h1 style={{ margin: '0 0 8px', fontSize: isDesktop ? 34 : 28, fontWeight: 700, color: T.text1, letterSpacing: '-0.7px', lineHeight: 1.05 }}>
                {copy.title}
              </h1>
            ) : null}
            {copy.subtitle ? (
              <p style={{ margin: 0, fontSize: 14, color: T.text3, lineHeight: 1.6, maxWidth: 520 }}>
                {copy.subtitle}
              </p>
            ) : null}
          </div>
          )}

          {children}
        </section>

        {isSaving && (
          <p style={{ margin: '16px 0 0', fontSize: 13, color: T.text3 }}>
            {copy.savingText}
          </p>
        )}
      </main>
    </div>
  )
}
