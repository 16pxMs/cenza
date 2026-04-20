// ─────────────────────────────────────────────────────────────
// BottomNav — Fixed bottom navigation for mobile
// Uses Next.js Link for automatic route prefetching.
// ─────────────────────────────────────────────────────────────
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './BottomNav.module.css'
import { IconMore, IconOverview, IconSpend } from '@/components/ui/Icons'

const TABS = [
  { href: '/app', label: 'Overview', Icon: IconOverview },
  { href: '/log', label: 'Activity', Icon: IconSpend },
  { href: '/menu', label: 'More', Icon: IconMore },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className={styles.bottomNav}>
      {TABS.map(t => {
        const on =
          t.href === '/app'
            ? pathname === '/app'
            : t.href === '/log'
              ? pathname === '/log' || pathname.startsWith('/log/')
              : pathname !== '/app' && !pathname.startsWith('/log')
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
