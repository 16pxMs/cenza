// ─────────────────────────────────────────────────────────────
// SideNav — Sticky left navigation for desktop (1024px+)
// 2 tabs: Overview (/app), Recap (/history)
// Active tab derived from current pathname
// ─────────────────────────────────────────────────────────────
'use client'
import { useRouter, usePathname } from 'next/navigation'
import styles from './SideNav.module.css'
import { IconOverview, IconSpend } from '@/components/ui/Icons'

const TABS = [
  { href: '/app',     label: 'Overview', Icon: IconOverview },
  { href: '/history', label: 'Recap',    Icon: IconSpend    },
]

export function SideNav() {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <nav className={styles.sideNav}>
      <div className={styles.logo}>
        <div className={styles.logoMark} />
        <span className={styles.logoName}>Cenza</span>
      </div>
      {TABS.map(t => {
        const on =
          t.href === '/app'
            ? pathname === '/app'
            : pathname === t.href || pathname.startsWith(`${t.href}/`)
        return (
          <button
            key={t.href}
            type="button"
            className={on ? `${styles.item} ${styles.itemActive}` : styles.item}
            onClick={() => router.push(t.href)}
          >
            <t.Icon color={on ? 'var(--brand-dark)' : 'var(--text-3)'} size={19} />
            <span className={on ? styles.itemLabelActive : styles.itemLabel}>{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
