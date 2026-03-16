'use client'

import { useState } from 'react'
import { signInWithGoogle } from '@/app/auth/actions'
import styles from './login.module.css'

const T = {
  brand: '#EADFF4', brandMid: '#C9AEE8', brandDeep: '#9B6FCC', brandDark: '#5C3489',
  pageBg: '#FAFAF8', white: '#FFFFFF', border: '#EDE8F5', borderStrong: '#D5CDED',
  text1: '#1A1025', text2: '#4A3B66', text3: '#8B7BA8', textMuted: '#B8AECE',
  greenBorder: '#BBF7D0', greenDark: '#15803D',
}

function WelcomeScreen({ onNext }: { onNext: () => void }) {
  return (
    <div className={styles.pageWrapper} style={{
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', top: -80, right: -80, width: 300, height: 300,
        background: 'radial-gradient(circle, rgba(155,111,204,0.18) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div className={styles.content} style={{ flex: 1 }}>
        {/* Logo mark */}
        <div style={{
          fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600,
          color: '#C9AEE8', letterSpacing: 2, textTransform: 'uppercase' as const,
          marginBottom: 80, marginTop: 48,
        }}>CENZA</div>
        {/* Headline */}
        <h1 style={{
          fontFamily: 'var(--font-serif)', fontSize: 42, fontWeight: 700,
          color: '#fff', margin: '0 0 20px', lineHeight: 1.15,
        }}>
          See your money clearly, {' '}
          <span style={{ color: '#C9AEE8', fontStyle: 'italic' }}>
           Make<br />better moves.
          </span>
        </h1>
        <p style={{
          fontFamily: 'var(--font-sans)', fontSize: 15,
          color: 'rgb(250, 250, 250)', lineHeight: 1.65,
          margin: 0, maxWidth: 320,
        }}>
         Track spending, understand your patterns, and get simple guidance on what to do next. Cenza helps you stay aware and build habits that move your finances forward.
        </p>
      </div>
      {/* CTAs */}
      <div className={styles.ctaArea}>
        <button onClick={onNext} style={{
          width: '100%', height: 56, borderRadius: 16,
          background: '#9B6FCC', border: 'none', color: '#fff',
          fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-sans)',
          cursor: 'pointer', marginBottom: 16,
        }}>
          Get started
        </button>
        <p style={{
          textAlign: 'center', margin: 0,
          fontFamily: 'var(--font-sans)', fontSize: 14,
          color: 'rgba(234,223,244,0.4)',
        }}>
          Already have an account?{' '}
          <span onClick={onNext} style={{ color: '#C9AEE8', fontWeight: 600, cursor: 'pointer' }}>
            Sign in
          </span>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const [showLogin, setShowLogin] = useState(false)

  if (!showLogin) {
    return <WelcomeScreen onNext={() => setShowLogin(true)} />
  }

  return (
    <div className={styles.pageWrapper} style={{ background: T.pageBg }}>
      <div className={styles.content}>
        <button onClick={() => setShowLogin(false)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: T.text3, fontSize: 14, fontFamily: 'var(--font-sans)',
          textAlign: 'left', padding: '4px 0', marginBottom: 32, marginTop: 48,
        }}>← Back</button>
        <h1 style={{
          fontFamily: 'var(--font-serif)', fontSize: 30, fontWeight: 700,
          color: T.text1, margin: '0 0 6px',
        }}>Create your account</h1>
        <p style={{
          fontFamily: 'var(--font-sans)', fontSize: 14, color: T.text3,
          margin: '0 0 32px',
        }}>Takes under a minute. No card needed.</p>
      </div>
      <div className={styles.ctaArea}>
        <form action={signInWithGoogle}>
          <button type="submit" style={{
            width: '100%', height: 52, borderRadius: 14,
            border: `1.5px solid ${T.border}`, background: T.white,
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 12, fontSize: 15, fontWeight: 600,
            fontFamily: 'var(--font-sans)', color: T.text1,
          }}>
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.5 20-21 0-1.4-.2-2.7-.5-4z"/>
              <path fill="#34A853" d="M6.3 14.7l7 5.1C15 16.1 19.1 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3c-7.6 0-14.2 4.6-17.7 11.7z"/>
              <path fill="#FBBC05" d="M24 45c5.8 0 10.7-1.9 14.3-5.2l-6.6-5.4C29.8 36.1 27.1 37 24 37c-6 0-11.1-4-12.9-9.5l-7 5.4C7.8 40.5 15.4 45 24 45z"/>
              <path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-.8 2.5-2.4 4.6-4.5 6l6.6 5.4C41.6 36.5 45 31 45 24c0-1.4-.2-2.7-.5-4z"/>
            </svg>
            Continue with Google
          </button>
        </form>
      </div>
    </div>
  )
}
