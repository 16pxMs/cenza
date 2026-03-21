'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { signInWithGoogle } from '@/app/auth/actions'
import styles from './login.module.css'

function WelcomeScreen({ onNext }: { onNext: () => void }) {
  return (
    <div className={styles.pageWrapper}>
      <div className={styles.decorTop} />
      <div className={styles.decorMid} />

      <Link href="/" className={styles.backButton}>
        <ArrowLeft size={16} />
        Back
      </Link>

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
      {/* keep your SVG exactly as is */}
    </svg>
  )
}

export default function LoginClient() {
  const searchParams = useSearchParams()
  const isReturning = searchParams.get('tab') === 'login'
  const [showLogin, setShowLogin] = useState(isReturning)

  if (!showLogin) {
    return <WelcomeScreen onNext={() => setShowLogin(true)} />
  }

  return (
    <div className={styles.authWrapper}>
      <div className={styles.decorTop} />
      <div className={styles.decorMid} />

      <button
        type="button"
        onClick={() => setShowLogin(false)}
        className={styles.backButton}
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div className={styles.authCard}>
        <div className={styles.logo}>Cenza</div>
        <h1 className={styles.authTitle}>
          {isReturning ? 'Welcome back.' : 'Create your account'}
        </h1>
        <p className={styles.authSubtitle}>
          {isReturning
            ? 'Good to see you again. Continue with Google to pick up where you left off.'
            : 'Log in securely with Google. It only takes a second.'}
        </p>

        <form action={signInWithGoogle}>
          <button type="submit" className={styles.googleButton}>
            <GoogleIcon />
            Continue with Google
          </button>
        </form>

        <p className={styles.privacyNote}>
          By continuing you agree to our Terms & Privacy Policy.
        </p>
      </div>
    </div>
  )
}