'use client'
export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// /onboarding — Step 1: Name confirmation
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import styles from './onboarding.module.css'

export default function OnboardingNamePage() {
  const router   = useRouter()
  const supabase = createClient()
  const [name,    setName]    = useState('')
  const [focused, setFocused] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setAuthReady(false)
          setAuthError('We are still connecting your account. Please try again in a moment.')
          return
        }

        const n =
          (typeof user.user_metadata?.full_name === 'string'
            ? user.user_metadata.full_name.split(' ')[0]
            : null) ||
          user.email?.split('@')[0] ||
          ''
        setName(n)

        const { data: profile } = await (supabase.from('user_profiles') as any)
          .select('currency')
          .eq('id', user.id)
          .maybeSingle()

        if (profile?.currency) {
          router.replace('/onboarding/pin')
          return
        }

        setAuthReady(true)
        setAuthError(null)
      } catch {
        setAuthReady(false)
        setAuthError('We are still connecting your account. Please try again in a moment.')
      }
    })()
  }, [router, supabase])

  const handleContinue = async () => {
    const trimmed = name.trim()
    if (!trimmed || saving || !authReady) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setAuthReady(false)
        setAuthError('We are still connecting your account. Please try again in a moment.')
        setSaving(false)
        return
      }
      await (supabase.from('user_profiles') as any)
        .update({ name: trimmed })
        .eq('id', user.id)
      router.push('/onboarding/currency')
    } catch {
      setAuthError('We could not save your name yet. Please try again in a moment.')
      setSaving(false)
    }
  }

  const canContinue = name.trim().length > 0 && authReady

  return (
    <div className={styles.pageWrapper} style={{ minHeight: '100vh' }}>
      <div className={styles.content} style={{ paddingTop: 72 }}>

        {/* Eyebrow — muted contextual label, NOT brand-coloured */}
        <p style={{
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--weight-medium)',
          color: 'var(--text-muted)',
          margin: '0 0 var(--space-lg)',
          letterSpacing: '0.01em',
        }}>
          Welcome to Cenza
        </p>

        {/* Heading */}
        <h1 style={{
          fontSize: 'var(--text-3xl)',
          color: 'var(--text-1)',
          margin: '0 0 var(--space-sm)',
        }}>
          What should we<br />call you?
        </h1>

        {/* Subtitle — one level up from muted: var(--text-2) is readable body copy */}
        <p style={{
          fontSize: 'var(--text-base)',
          color: 'var(--text-2)',
          margin: '0 0 var(--space-xl)',
          lineHeight: 1.6,
        }}>
          We'll use this throughout the app.
        </p>

        {authError && (
          <p style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-3)',
            margin: '0 0 var(--space-md)',
            lineHeight: 1.5,
          }}>
            {authError}
          </p>
        )}

        {/* Name input */}
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleContinue()}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Your first name"
          autoFocus
          style={{
            width: '100%',
            height: 56,
            border: focused
              ? '2px solid var(--border-focus)'
              : '1.5px solid var(--border-strong)',
            borderRadius: 'var(--radius-md)',
            padding: '0 var(--space-md)',
            fontSize: 'var(--text-md)',
            fontWeight: 'var(--weight-medium)',
            color: 'var(--text-1)',
            background: 'var(--white)',
            outline: 'none',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
            boxShadow: focused ? '0 0 0 4px rgba(92, 52, 137, 0.08)' : 'none',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          } as React.CSSProperties}
        />

      </div>

      <div className={styles.ctaArea}>
        <button
          onClick={handleContinue}
          disabled={!canContinue || saving}
          style={{
            width: '100%',
            height: 56,
            borderRadius: 'var(--radius-lg)',
            background: canContinue ? 'var(--brand-dark)' : 'var(--grey-200)',
            border: 'none',
            color: canContinue ? 'var(--text-inverse)' : 'var(--text-muted)',
            fontSize: 'var(--text-base)',
            fontWeight: 'var(--weight-semibold)',
            cursor: canContinue && !saving ? 'pointer' : 'default',
            transition: 'background 0.15s, color 0.15s',
            letterSpacing: '-0.1px',
          }}
        >
          {saving ? 'Saving…' : !authReady ? 'Getting your account ready…' : 'Continue →'}
        </button>
      </div>
    </div>
  )
}
