'use client'

import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import styles from '../login/login.module.css'

export default function StartClient() {
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
          <Link href="/login" className={styles.primaryButton} style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
          }}>
            Get started
          </Link>

          <p className={styles.signInRow}>
            Already have an account?
            <Link href="/login" className={styles.tertiaryButton}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
