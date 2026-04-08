'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { signInWithGoogle } from '@/app/auth/actions'
import styles from './login.module.css'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      {/* keep your SVG exactly as is */}
    </svg>
  )
}

function hasReturningDevice() {
  if (typeof document === 'undefined') return false
  return document.cookie.split(';').some(cookie => cookie.trim().startsWith('cenza-returning-user='))
}

export default function LoginClient() {
  const [knownDevice, setKnownDevice] = useState(false)

  useEffect(() => {
    setKnownDevice(hasReturningDevice())
  }, [])

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
        <ArrowLeft size={16} />
      </button>

      <div className={styles.authCard}>
        <div className={styles.logo}>Cenza</div>
        <h1 className={styles.authTitle}>
          {knownDevice ? 'Unlock your account.' : 'Log in to Cenza.'}
        </h1>
        <p className={styles.authSubtitle}>
          {knownDevice
            ? 'This is a known device. Reconnect securely with Google and we will take you straight to your PIN.'
            : 'Use Google to reconnect your secure session and pick up where you left off.'}
        </p>

        {knownDevice && (
          <div className={styles.returningNote}>
            On this device, PIN is your normal re-entry step. Google is only used here to restore your secure session.
          </div>
        )}

        <form action={signInWithGoogle}>
          <button type="submit" className={styles.googleButton}>
            <GoogleIcon />
            {knownDevice ? 'Reconnect with Google' : 'Continue with Google'}
          </button>
        </form>

        <p className={styles.privacyNote}>
          {knownDevice
            ? 'After reconnecting, you will unlock the app with your PIN.'
            : 'By continuing you agree to our Terms & Privacy Policy.'}
        </p>
      </div>
    </div>
  )
}
