'use client'

import { useState } from 'react'
import { signInWithGoogle } from '@/app/auth/actions'
import styles from './login.module.css'

function WelcomeScreen({ onNext }: { onNext: () => void }) {
  return (
    <div className={styles.pageWrapper}>
      {/* Decorative background depth */}
      <div className={styles.decorTop} />
      <div className={styles.decorMid} />

      <div className={styles.content}>
        <div className={styles.logo}>Cenza</div>

        <h1 className={styles.headline}>
          See your money clearly,
          <span className={styles.headlineAccent}> Make better moves.</span>
        </h1>

        <p className={styles.description}>
          Track spending, understand your patterns, and get simple guidance on what to do next.
        </p>

        <div className={styles.ctaArea}>
          <button className={styles.primaryButton} onClick={onNext}>
            Get started
          </button>

          <p className={styles.signInRow}>
            Already have an account?
            <button type="button" onClick={onNext} className={styles.tertiaryButton}>
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  )
}

export default function LoginPage() {
  const [showLogin, setShowLogin] = useState(false)

  if (!showLogin) {
    return <WelcomeScreen onNext={() => setShowLogin(true)} />
  }

  return (
    <div className={styles.authWrapper}>
      {/* Same orbs — visual continuity from welcome screen */}
      <div className={styles.decorTop} />
      <div className={styles.decorMid} />

      {/* Back — anchored top left, out of content flow */}
      <button
        type="button"
        onClick={() => setShowLogin(false)}
        className={styles.backButton}
      >
        ← Back
      </button>

      <div className={styles.authCard}>
        <div className={styles.logo}>Cenza</div>
        <h1 className={styles.authTitle}>Create your account</h1>
        <p className={styles.authSubtitle}>
          Sign in securely with Google. It only takes a second.
        </p>

        <form action={signInWithGoogle}>
          <button type="submit" className={styles.googleButton}>
            <GoogleIcon />
            Continue with Google
          </button>
        </form>

        <p className={styles.privacyNote}>
          By continuing you agree to our Terms &amp; Privacy Policy.
        </p>
      </div>
    </div>
  )
}
