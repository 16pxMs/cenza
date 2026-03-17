// ─────────────────────────────────────────────────────────────
// SideNav — Sticky left navigation for desktop (1024px+)
// 3 tabs: Overview (/), Income (/income), Goals (/goals)
// Active tab derived from current pathname
// ─────────────────────────────────────────────────────────────
'use client'
import { useRouter, usePathname } from 'next/navigation'
import styles from './SideNav.module.css'
import { IconOverview, IconGoals, IconFinance } from '@/components/ui/Icons'

const TABS = [
  { href: '/',       label: 'Overview', Icon: IconOverview },
  { href: '/income', label: 'Income',   Icon: IconFinance  },
  { href: '/goals',  label: 'Goals',    Icon: IconGoals    },
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
        const on = pathname === t.href
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
