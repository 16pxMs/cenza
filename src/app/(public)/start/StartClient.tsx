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
      </Link>

      <div className={styles.content}>
        <div className={styles.logo}>Cenza</div>

        <h1 className={styles.headline}>
          See your money clearly,
          <span className={styles.headlineAccent}> Make better moves.</span>
        </h1>

        <p className={styles.description}>
          Create your account, connect it securely, and start tracking your money with a plan that makes sense.
        </p>

        <div className={styles.ctaArea}>
          <Link href="/login" className={styles.primaryButton} style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
          }}>
            Try Cenza
          </Link>

          <p className={styles.signInRow}>
            Already have an account?
            <Link href="/login" className={styles.tertiaryButton}>
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
