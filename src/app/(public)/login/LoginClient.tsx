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
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div className={styles.authCard}>
        <div className={styles.logo}>Cenza</div>
        <h1 className={styles.authTitle}>
          {knownDevice
            ? 'Welcome back.'
            : 'Welcome back.'}
        </h1>
        <p className={styles.authSubtitle}>
          {knownDevice
            ? 'This device already knows your account. Continue with Google to reconnect securely, then we will take you straight to your PIN.'
            : 'Continue with Google to reconnect securely and pick up where you left off.'}
        </p>

        {knownDevice && (
          <div className={styles.returningNote}>
            PIN is your normal re-entry step on this device. Google is only used here to restore your secure session.
          </div>
        )}

        <form action={signInWithGoogle}>
          <button type="submit" className={styles.googleButton}>
            <GoogleIcon />
            {knownDevice ? 'Reconnect with Google' : 'Continue with Google'}
          </button>
        </form>

        <p className={styles.privacyNote}>
          By continuing you agree to our Terms & Privacy Policy.
        </p>
      </div>
    </div>
  )
}
