// ─────────────────────────────────────────────────────────────
// BottomNav — Fixed bottom navigation for mobile
// Uses Next.js Link for automatic route prefetching.
// ─────────────────────────────────────────────────────────────
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './BottomNav.module.css'
import { IconOverview, IconSpend, IconFinance } from '@/components/ui/Icons'

const TABS = [
  { href: '/app',     label: 'Overview', Icon: IconOverview },
  { href: '/history', label: 'Recap',    Icon: IconSpend    },
  { href: '/income',  label: 'Budget',   Icon: IconFinance  },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className={styles.bottomNav}>
      {TABS.map(t => {
        const on =
          t.href === '/app'
            ? pathname === '/app'
            : pathname === t.href || pathname.startsWith(`${t.href}/`)
        return (
          <Link key={t.href} href={t.href} className={styles.item} prefetch>
            {on && <div className={styles.indicator} />}
            <t.Icon color={on ? 'var(--brand-dark)' : 'var(--text-muted)'} size={20} />
            <span className={on ? styles.labelActive : styles.label}>
              {t.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
