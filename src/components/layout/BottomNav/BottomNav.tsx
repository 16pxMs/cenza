// ─────────────────────────────────────────────────────────────
// BottomNav — Fixed bottom navigation for mobile
// 3 tabs: Overview (/), Income (/income), Goals (/goals)
// Active tab derived from current pathname
// ─────────────────────────────────────────────────────────────
'use client'
import { useRouter, usePathname } from 'next/navigation'
import styles from './BottomNav.module.css'
import { IconOverview, IconGoals, IconFinance } from '@/components/ui/Icons'

const TABS = [
  { href: '/',       label: 'Overview', Icon: IconOverview },
  { href: '/income', label: 'Income',   Icon: IconFinance  },
  { href: '/goals',  label: 'Goals',    Icon: IconGoals    },
]

export function BottomNav() {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <nav className={styles.bottomNav}>
      {TABS.map(t => {
        const on = pathname === t.href
        return (
          <button key={t.href} type="button" className={styles.item} onClick={() => router.push(t.href)}>
            {on && <div className={styles.indicator} />}
            <t.Icon color={on ? 'var(--brand-dark)' : 'var(--text-muted)'} size={20} />
            <span className={on ? styles.labelActive : styles.label}>
              {t.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
