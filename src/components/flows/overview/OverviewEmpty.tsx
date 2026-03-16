'use client'
import { useState, useEffect } from 'react'
import './OverviewEmpty.css'
import { Plus } from 'lucide-react'

const GOAL_META: Record<string, { label: string; icon: string; lightColor: string; borderColor: string }> = {
  emergency: { label: 'Emergency Fund', icon: '🛡️', lightColor: '#F0FDF4', borderColor: '#BBF7D0' },
  car:       { label: 'Car Fund',       icon: '🚗', lightColor: '#EADFF4', borderColor: '#C9AEE8' },
  travel:    { label: 'Travel',         icon: '✈️', lightColor: '#FFFBEB', borderColor: '#FDE68A' },
  home:      { label: 'Home',           icon: '🏠', lightColor: '#EADFF4', borderColor: '#C9AEE8' },
  education: { label: 'Education',      icon: '📚', lightColor: '#EADFF4', borderColor: '#C9AEE8' },
  business:  { label: 'Business',       icon: '💼', lightColor: '#EADFF4', borderColor: '#C9AEE8' },
  family:    { label: 'Family',         icon: '👨‍👩‍👧', lightColor: '#EADFF4', borderColor: '#C9AEE8' },
  other:     { label: 'Other Goal',     icon: '⭐', lightColor: '#EADFF4', borderColor: '#C9AEE8' },
}

interface Props {
  name: string
  goals: string[]
  onAddIncome: () => void
  isDesktop?: boolean
}

export function OverviewEmpty({ name, goals, onAddIncome, isDesktop }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t) }, [])

  return (
    <div className={`overview-empty${isDesktop ? ' overview-empty--desktop' : ''}`}>
      <div className={`overview-empty__greeting${mounted ? ' overview-empty__greeting--mounted' : ''}`}>
        <h1 className={`overview-empty__heading${isDesktop ? ' overview-empty__heading--desktop' : ''}`}>
          Morning, {name} ✦
        </h1>
      </div>
      <div className={`overview-empty__income-card${mounted ? ' overview-empty__income-card--mounted' : ''}`}>
        <div className="overview-empty__income-inner">
          <div className="overview-empty__income-glow" />
          <p className="overview-empty__income-step">Step 1 of 1</p>
          <h2 className="overview-empty__income-title">Add your income</h2>
          <p className="overview-empty__income-sub">Everything else flows from here: expenses, goals, budgets. Takes 30 seconds.</p>
          <button className="overview-empty__income-btn" onClick={onAddIncome}>
            <Plus size={16} />
            Add income
          </button>
        </div>
      </div>
      <div className={`overview-empty__goals-fade${mounted ? ' overview-empty__goals-fade--mounted' : ''}`}>
        <div className="overview-empty__goals-header">
          <span className="overview-empty__goals-label">Your Goals</span>
          <span className="overview-empty__goals-hint">Available after income added</span>
        </div>
        {goals.map(gid => {
          const meta = GOAL_META[gid]
          if (!meta) return null
          return (
            <div key={gid} className="overview-empty__goal-row">
              <div className="overview-empty__goal-icon" style={{ background: meta.lightColor, border: `1.5px solid ${meta.borderColor}` }}>
                {meta.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div className="overview-empty__goal-name">{meta.label}</div>
                <div className="overview-empty__goal-sub">Target not set yet</div>
              </div>
              <div className="overview-empty__goal-bar" />
            </div>
          )
        })}
      </div>
    </div>
  )
}
