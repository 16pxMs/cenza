'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { signInWithGoogle } from '@/app/auth/actions'
import { IconBack } from '@/components/ui/Icons'
import styles from './login.module.css'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      {/* keep your SVG exactly as is */}
    </svg>
  )
}

export default function LoginClient({
  knownDevice,
  authError,
  entryIntent,
}: {
  knownDevice: boolean
  authError: string | null
  entryIntent: 'start' | 'login'
}) {
  const [reconnecting, setReconnecting] = useState(false)
  const formRef = useRef<HTMLFormElement | null>(null)
  const didAutoSubmit = useRef(false)

  useEffect(() => {
    if (!knownDevice || authError || didAutoSubmit.current) return
    didAutoSubmit.current = true
    setReconnecting(true)
    const timeout = window.setTimeout(() => {
      formRef.current?.requestSubmit()
    }, 120)
    return () => window.clearTimeout(timeout)
  }, [authError, knownDevice])

  return (
    <div className={styles.authWrapper}>
      <div className={styles.decorTop} />
      <div className={styles.decorMid} />

      <button
        type="button"
        onClick={() => window.location.href = '/'}
        className={styles.backButton}
        aria-label="Go back"
      >
        <IconBack size={18} />
      </button>

      <div className={styles.authCard}>
        <div className={styles.logo}>Cenza</div>
        <h1 className={styles.authTitle}>
          {knownDevice
            ? entryIntent === 'start'
              ? 'This Google account already has a Cenza account.'
              : 'Unlock your account.'
            : entryIntent === 'start'
              ? 'Create your account.'
              : 'Log in to Cenza.'}
        </h1>
        <p className={styles.authSubtitle}>
          {knownDevice
            ? entryIntent === 'start'
              ? 'It looks like you are using a Google account that already exists in Cenza. Reconnect securely and we will take you to your PIN.'
              : 'This is a known device. Reconnect securely with Google and we will take you straight to your PIN.'
            : entryIntent === 'start'
              ? 'Continue with Google to create your Cenza account and start onboarding.'
              : 'Use Google to reconnect your secure session and pick up where you left off.'}
        </p>

        {knownDevice && !authError && (
          <div className={styles.returningNote}>
            On this device, PIN is your normal re-entry step. Google is only used here to restore your secure session.
          </div>
        )}

        <form
          ref={formRef}
          action={signInWithGoogle}
          onSubmit={() => setReconnecting(true)}
        >
          <input type="hidden" name="source" value="login" />
          <button type="submit" className={styles.googleButton} disabled={reconnecting}>
            <GoogleIcon />
            {reconnecting
              ? 'Reconnecting…'
              : knownDevice
                ? 'Reconnect with Google'
                : entryIntent === 'start'
                  ? 'Create account with Google'
                  : 'Continue with Google'}
          </button>
        </form>

        {authError && (
          <p className={styles.privacyNote} style={{ marginTop: 12, color: 'var(--text-3)' }}>
            {authError}
          </p>
        )}

        <p className={styles.privacyNote}>
          {knownDevice
            ? 'After reconnecting, you will unlock the app with your PIN.'
            : entryIntent === 'start'
              ? 'By creating an account you agree to our Terms & Privacy Policy.'
              : 'By continuing you agree to our Terms & Privacy Policy.'}
        </p>
      </div>
    </div>
  )
}
