// ─────────────────────────────────────────────────────────────
// BottomNav — Fixed bottom navigation for mobile
// 4 tabs: Overview, Spend, Goals, Finance
// Active tab has a top indicator bar
// ─────────────────────────────────────────────────────────────
'use client'
import './BottomNav.css'
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

export function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="bottom-nav">
      {TABS.map(t => {
        const on = active === t.id
        return (
          <button key={t.id} className="bottom-nav__item" onClick={() => onChange(t.id)}>
            {on && <div className="bottom-nav__indicator" />}
            <t.Icon color={on ? 'var(--brand-dark)' : 'var(--text-muted)'} size={20} />
            <span className={`bottom-nav__label${on ? ' bottom-nav__label--active' : ''}`}>
              {t.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
