// ─────────────────────────────────────────────────────────────
// OverviewWithData — Main overview screen once income is saved
// Shows: greeting, hero income card, next-step nudges in order:
//   1. Set goal targets (if not done)
//   2. Add fixed expenses (if goals done)
//   3. Add spending categories (if expenses done)
// Insight card colour changes based on fixed cost % of income:
//   green < 50%, amber 50-70%, red > 70%
// Props: name, currency, goals, incomeData, expensesData,
//        goalTargets, onSetupGoals, onAddExpenses, onAddBudgets
// ─────────────────────────────────────────────────────────────

'use client'
import { useState, useEffect } from 'react'
import { ArrowRight } from 'lucide-react'
import './OverviewWithData.css'

const GOAL_META: Record<string, {
  label: string
  icon: string
  lightColor: string
  borderColor: string
  darkColor: string
}> = {
  emergency: { label: 'Emergency Fund', icon: '🛡️', lightColor: '#F0FDF4', borderColor: '#BBF7D0', darkColor: '#15803D' },
  car:        { label: 'Car',            icon: '🚗', lightColor: '#EADFF4', borderColor: '#C9AEE8', darkColor: '#5C3489' },
  travel:     { label: 'Travel',         icon: '✈️', lightColor: '#FFFBEB', borderColor: '#FDE68A', darkColor: '#92400E' },
  home:       { label: 'Home',           icon: '🏠', lightColor: '#EADFF4', borderColor: '#C9AEE8', darkColor: '#5C3489' },
  education:  { label: 'Education',      icon: '📚', lightColor: '#EADFF4', borderColor: '#C9AEE8', darkColor: '#5C3489' },
  business:   { label: 'Business',       icon: '💼', lightColor: '#EADFF4', borderColor: '#C9AEE8', darkColor: '#5C3489' },
  family:     { label: 'Family',         icon: '👨‍👩‍👧', lightColor: '#EADFF4', borderColor: '#C9AEE8', darkColor: '#5C3489' },
  other:      { label: 'Other Goal',     icon: '⭐', lightColor: '#EADFF4', borderColor: '#C9AEE8', darkColor: '#5C3489' },
}

function fmt(n: number, cur = 'KES') {
  if (!n) return `${cur} 0`
  if (n >= 1000000) return `${cur} ${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${cur} ${(n / 1000).toFixed(0)}K`
  return `${cur} ${n.toLocaleString()}`
}

interface IncomeData {
  income: number
  extraIncome: { id: string; label: string; amount: number }[]
  total: number
}

interface Props {
  name: string
  currency: string
  goals: string[]
  incomeData: IncomeData
  expensesData: { totalMonthly: number } | null
  goalTargets: Record<string, any> | null
  onSetupGoals: () => void
  onAddExpenses: () => void
  onAddBudgets: () => void
  isDesktop?: boolean
}

export function OverviewWithData({
  name, currency, goals, incomeData, expensesData,
  goalTargets, onSetupGoals, onAddExpenses, onAddBudgets, isDesktop,
}: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60)
    return () => clearTimeout(t)
  }, [])

  // Derived numbers
  const totalIncome  = incomeData.income + (incomeData.extraIncome || []).reduce((s, e) => s + e.amount, 0)
  const hasExpenses  = expensesData !== null
  const totalMonthly = hasExpenses ? expensesData!.totalMonthly : 0
  const remaining    = totalIncome - totalMonthly
  const fixedPct     = totalIncome > 0 && totalMonthly > 0
    ? Math.round((totalMonthly / totalIncome) * 100)
    : 0
  const goalsReady   = goalTargets && Object.keys(goalTargets).length > 0

  // Staggered fade-in helper
  const fade = (delay: number): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(10px)',
    transition: `all 0.45s ease ${delay}s`,
  })

  // Insight card colours by fixed cost band
  const insightColor = fixedPct > 70
    ? { bg: 'var(--red-light)',   border: 'var(--red-border)',   text: 'var(--red-dark)'   }
    : fixedPct > 50
    ? { bg: 'var(--amber-light)', border: '#FDE68A',             text: 'var(--amber-dark)' }
    : { bg: 'var(--green-light)', border: 'var(--green-border)', text: 'var(--green-dark)' }

  const insightTitle = fixedPct > 70
    ? `${fixedPct}% of income on fixed costs`
    : fixedPct > 50
    ? `${fixedPct}% committed to fixed costs`
    : `${fixedPct}% on fixed costs — solid foundation`

  const insightBody = fixedPct > 70
    ? 'A useful guideline keeps fixed costs under 50% of take-home. Above 70% leaves very little buffer. Something to work towards as income grows.'
    : fixedPct > 50
    ? "You're slightly above the 50% guideline. Still workable — worth keeping in mind as you plan variable spending."
    : "Fixed costs under 50% means real flexibility for saving and living. That's the foundation goals are built on."

  return (
    <div className={`overview-data${isDesktop ? ' overview-data--desktop' : ''}`}>

      {/* Greeting */}
      <div className="overview-data__greeting" style={fade(0.05)}>
        <h1 className={`overview-data__heading${isDesktop ? ' overview-data__heading--desktop' : ''}`}>
          Morning, {name} ✦
        </h1>
      </div>

      {/* Hero card — shows spendable or total income depending on whether expenses exist */}
      <div className="overview-data__hero" style={fade(0.1)}>
        <div className="overview-data__hero-glow" />
        <p className="overview-data__hero-label">
          {hasExpenses ? 'After fixed costs' : 'This month'}
        </p>
        <p className="overview-data__hero-amount">{fmt(remaining, currency)}</p>

        {/* Breakdown only shown once fixed costs are entered */}
        {hasExpenses && (
          <div className="overview-data__hero-breakdown">
            <div className="overview-data__hero-cell">
              <div className="overview-data__hero-cell-label">Income</div>
              <div className="overview-data__hero-cell-value">{fmt(totalIncome, currency)}</div>
            </div>
            <div className="overview-data__hero-cell">
              <div className="overview-data__hero-cell-label">Fixed costs</div>
              <div className="overview-data__hero-cell-value">{fmt(totalMonthly, currency)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Step 1 nudge: set goal targets — shown before fixed expenses */}
      {!goalsReady && (
        <button className="overview-data__next-step" onClick={onSetupGoals} style={fade(0.2)}>
          <p className="overview-data__next-step-eyebrow">Next step</p>
          <p className="overview-data__next-step-title">Set targets for your goals</p>
          <p className="overview-data__next-step-sub">
            You picked {goals.length} {goals.length === 1 ? 'goal' : 'goals'} during setup.
            Add a target amount so we can track progress.
          </p>
          <div className="overview-data__goal-chips">
            {goals.map(gid => {
              const m = GOAL_META[gid]
              if (!m) return null
              return (
                <div
                  key={gid}
                  className="overview-data__goal-chip"
                  style={{ background: m.lightColor, border: `1px solid ${m.borderColor}` }}
                >
                  <span style={{ fontSize: 14 }}>{m.icon}</span>
                  <span className="overview-data__goal-chip-label" style={{ color: m.darkColor }}>
                    {m.label}
                  </span>
                </div>
              )
            })}
          </div>
          <div style={{
            width: '100%', height: 44, borderRadius: 12,
            background: 'var(--brand-dark)', color: '#fff',
            border: 'none', fontWeight: 600, fontSize: 14,
            fontFamily: 'var(--font-sans)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, marginTop: 12,
          }}>
            Set targets <ArrowRight size={15} />
          </div>
        </button>
      )}

      {/* Step 2 nudge: add fixed expenses — shown after goals are set */}
      {goalsReady && !hasExpenses && (
        <div className="overview-data__nudge" style={fade(0.2)}>
          <p className="overview-data__nudge-title">Add your fixed costs</p>
          <p className="overview-data__nudge-sub">
            Rent, utilities, phone. The costs you pay no matter what.
          </p>
          <button onClick={onAddExpenses} style={{
            width: '100%', height: 44, borderRadius: 12,
            background: 'var(--brand-dark)', color: '#fff',
            border: 'none', fontWeight: 600, fontSize: 14,
            fontFamily: 'var(--font-sans)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, marginTop: 12,
          }}>
            Add fixed costs <ArrowRight size={15} />
          </button>
        </div>
      )}

      {/* Insight card — only shown once fixed expenses exist */}
      {hasExpenses && (
        <div
          className="overview-data__insight"
          style={{
            background: insightColor.bg,
            border: `1.5px solid ${insightColor.border}`,
            ...fade(0.2),
          }}
        >
          <p className="overview-data__insight-title" style={{ color: insightColor.text }}>
            {insightTitle}
          </p>
          <p className="overview-data__insight-body" style={{ color: insightColor.text }}>
            {insightBody}
          </p>
        </div>
      )}

      {/* Step 3 nudge: add spending categories — shown after expenses */}
      {hasExpenses && (
        <div className="overview-data__nudge" style={fade(0.3)}>
          <div className="overview-data__nudge-text">
            <p className="overview-data__nudge-title">How do you spend?</p>
            <p className="overview-data__nudge-sub">
              Tell us what you regularly spend on. We will track the patterns.
            </p>
          </div>
          <button className="overview-data__nudge-btn" onClick={onAddBudgets}>Add</button>
        </div>
      )}

    </div>
  )
}
