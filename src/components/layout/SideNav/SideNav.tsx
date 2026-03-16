// ─────────────────────────────────────────────────────────────
// SideNav — Sticky left navigation for desktop (768px+)
// Same 4 tabs as BottomNav. Shows Cenza wordmark.
// ─────────────────────────────────────────────────────────────
'use client'
import './SideNav.css'
import { IconOverview, IconSpend, IconGoals, IconFinance } from '@/components/ui/Icons'

const TABS = [
  { id: 'overview', label: 'Overview', Icon: IconOverview },
  { id: 'spend',    label: 'Spend',    Icon: IconSpend    },
  { id: 'goals',    label: 'Goals',    Icon: IconGoals    },
  { id: 'finance',  label: 'Finance',  Icon: IconFinance  },
]

interface Props {
  active: string
  onChange: (tab: string) => void
}

export function SideNav({ active, onChange }: Props) {
  return (
    <nav className="side-nav">
      <div className="side-nav__logo">
        <div className="side-nav__logo-mark" />
        <span className="side-nav__logo-name">Cenza</span>
      </div>
      {TABS.map(t => {
        const on = active === t.id
        return (
          <button key={t.id} className={`side-nav__item${on ? ' side-nav__item--active' : ''}`} onClick={() => onChange(t.id)}>
            <t.Icon color={on ? 'var(--brand-dark)' : 'var(--text-3)'} size={19} />
            <span className={`side-nav__item-label${on ? ' side-nav__item-label--active' : ''}`}>{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
