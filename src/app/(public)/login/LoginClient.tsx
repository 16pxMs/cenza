'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signInWithGoogle } from '@/app/auth/actions'
import { IconBack } from '@/components/ui/Icons'
import styles from './login.module.css'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2045c0-.6382-.0573-1.2518-.1636-1.8409H9v3.4818h4.8436c-.2087 1.125-.8428 2.0782-1.7959 2.715v2.2582h2.9086c1.7023-1.5673 2.6837-3.8773 2.6837-6.6141z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.4673-.8068 5.9564-2.1818l-2.9086-2.2582c-.8068.5409-1.8409.8618-3.0478.8618-2.3441 0-4.3282-1.5823-5.0373-3.7091H.9573v2.3318C2.4382 15.9845 5.4818 18 9 18z" />
      <path fill="#FBBC05" d="M3.9627 10.7136C3.7827 10.1727 3.6818 9.5959 3.6818 9s.1009-1.1727.2809-1.7136V4.9545H.9573C.3477 6.1677 0 7.5368 0 9s.3477 2.8323.9573 4.0455l3.0054-2.3319z" />
      <path fill="#EA4335" d="M9 3.5795c1.3214 0 2.5077.4541 3.4391 1.3455l2.5791-2.5791C13.4632.8918 11.4259 0 9 0 5.4818 0 2.4382 2.0155.9573 4.9545l3.0054 2.3319C4.6718 5.1618 6.6559 3.5795 9 3.5795z" />
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
