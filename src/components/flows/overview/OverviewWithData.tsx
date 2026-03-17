// ─────────────────────────────────────────────────────────────
// OverviewWithData — Main overview screen once income is saved
//
// Two modes:
//   Setup mode  — income set, but expenses/budgets not yet done
//                 shows goals card + step nudges
//   Active mode — expenses + budgets complete
//                 shows primary "Add expense" card, goals card,
//                 incomplete tasks card, dismissible debt card
// ─────────────────────────────────────────────────────────────

'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, X } from 'lucide-react'
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
  if (n >= 1_000_000) return `${cur} ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${cur} ${(n / 1_000).toFixed(0)}K`
  return `${cur} ${n.toLocaleString()}`
}

const DEBT_DISMISSED_KEY = 'cenza_debt_card_dismissed'

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
  budgetsData: { totalBudget: number } | null
  goalTargets: Record<string, any> | null
  onSetupGoals: () => void
  onAddExpenses: () => void
  onAddBudgets: () => void
  onAddDebts?: () => void
  onLogExpense?: () => void
  isDesktop?: boolean
}

export function OverviewWithData({
  name, currency, goals, incomeData, expensesData, budgetsData,
  goalTargets, onSetupGoals: _onSetupGoals, onAddExpenses, onAddBudgets,
  onAddDebts, onLogExpense, isDesktop,
}: Props) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [debtDismissed, setDebtDismissed] = useState(false)

  useEffect(() => {
    setDebtDismissed(localStorage.getItem(DEBT_DISMISSED_KEY) === '1')
    const t = setTimeout(() => setMounted(true), 60)
    return () => clearTimeout(t)
  }, [])

  const dismissDebt = () => {
    localStorage.setItem(DEBT_DISMISSED_KEY, '1')
    setDebtDismissed(true)
  }

  // ── Income ──────────────────────────────────────────────────
  const baseIncome  = incomeData.income ?? (incomeData as any).salary ?? 0
  const extras      = incomeData.extraIncome ?? (incomeData as any).extra_income ?? []
  const totalIncome = baseIncome + (extras as any[]).reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0)

  // ── Completion flags ─────────────────────────────────────────
  const expensesComplete = expensesData !== null && expensesData.totalMonthly >= 0
  const budgetsComplete  = budgetsData !== null
  const isActive = expensesComplete && budgetsComplete

  // ── Goals ────────────────────────────────────────────────────
  const goalTotal   = goalTargets
    ? Object.values(goalTargets).reduce((s, v) => s + (Number(v) || 0), 0)
    : 0
  const totalGoals  = goals.length
  const filledGoals = goalTargets ? Object.keys(goalTargets).length : 0
  const isComplete  = totalGoals > 0 && filledGoals >= totalGoals
  const goalsReady  = filledGoals > 0
  const pendingGoals = totalGoals - filledGoals

  // ── Fade-in helper ───────────────────────────────────────────
  const fade = (delay: number): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(10px)',
    transition: `all 0.45s ease ${delay}s`,
  })

  return (
    <div className={`overview-data${isDesktop ? ' overview-data--desktop' : ''}`}>

      {/* ── Greeting ── */}
      <div className="overview-data__greeting" style={fade(0.05)}>
        <h1 className={`overview-data__heading${isDesktop ? ' overview-data__heading--desktop' : ''}`}>
          Morning, {name} ✦
        </h1>
      </div>

      {/* ── ACTIVE MODE ─────────────────────────────────────── */}
      {isActive ? (
        <>
          {/* Primary: Add expense card */}
          <div style={{
            background: 'var(--brand-dark)',
            borderRadius: 20,
            padding: '24px',
            marginTop: 16,
            boxShadow: '0 4px 20px rgba(92,52,137,0.25)',
            ...fade(0.08),
          }}>
            <span style={{ fontSize: 30 }}>🧾</span>
            <h2 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: isDesktop ? 22 : 20,
              fontWeight: 700, color: '#fff',
              margin: '12px 0 6px', letterSpacing: '-0.2px',
            }}>
              Track your spending
            </h2>
            <p style={{
              fontSize: 14, color: 'rgba(234,223,244,0.72)',
              margin: '0 0 20px', lineHeight: 1.6,
              fontFamily: 'var(--font-sans)',
            }}>
              Log your expenses and Cenza will start learning your patterns — helping you stay on plan.
            </p>
            <button
              onClick={onLogExpense}
              style={{
                width: '100%', height: 48, borderRadius: 12,
                background: '#fff', color: 'var(--brand-dark)',
                border: 'none', fontWeight: 700, fontSize: 14,
                fontFamily: 'var(--font-sans)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              Add expense <ArrowRight size={15} />
            </button>
          </div>

          {/* Goals card — unchanged */}
          {totalGoals > 0 && (
            <div style={{ marginTop: 12, ...fade(0.15) }}>
              <div
                role={!isComplete ? 'button' : undefined}
                onClick={!isComplete ? () => router.push('/targets') : undefined}
                style={{
                  background: 'var(--white)',
                  border: '1px solid var(--border)',
                  borderRadius: 16, padding: '20px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  cursor: !isComplete ? 'pointer' : 'default',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Your goals
                    </p>
                    {goalTotal > 0 && (
                      <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700, color: 'var(--text-1)', fontFamily: 'var(--font-serif)', letterSpacing: '-0.3px' }}>
                        {fmt(goalTotal, currency)}
                      </p>
                    )}
                  </div>
                  {!isComplete && (
                    <div style={{
                      fontSize: 11, fontWeight: 600, color: 'var(--brand-dark)',
                      background: '#EADFF4', borderRadius: 99,
                      padding: '4px 10px', whiteSpace: 'nowrap', alignSelf: 'flex-start',
                    }}>
                      {filledGoals === 0 ? 'Not started' : `${filledGoals} / ${totalGoals}`}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: !isComplete ? 16 : 0 }}>
                  {goals.map(gid => {
                    const m = GOAL_META[gid]
                    if (!m) return null
                    const isFilled = !!goalTargets?.[gid]
                    return (
                      <div key={gid} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '5px 11px 5px 8px', borderRadius: 99,
                        background: 'transparent', border: '1.5px solid #D5CDED',
                      }}>
                        <span style={{ fontSize: 13 }}>{m.icon}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 400, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                          {m.label}
                        </span>
                        {isFilled && (
                          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ marginLeft: 1, flexShrink: 0 }} role="img" aria-label="Target set">
                            <title>Target set</title>
                            <circle cx="6.5" cy="6.5" r="6" fill="#DCFCE7" />
                            <path d="M4 6.5l1.8 1.8 3.2-3.6" stroke="#16A34A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    )
                  })}
                </div>
                {!isComplete && (
                  <div style={{
                    width: '100%', height: 44, borderRadius: 12,
                    background: 'var(--brand-dark)', color: '#fff',
                    fontWeight: 600, fontSize: 14, fontFamily: 'var(--font-sans)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                    {filledGoals === 0 ? 'Set targets' : 'Continue'} <ArrowRight size={15} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Incomplete tasks card — only when goals have missing targets */}
          {pendingGoals > 0 && (
            <div style={{
              background: 'var(--white)',
              border: '1px solid var(--border)',
              borderRadius: 16, padding: '18px 20px',
              marginTop: 12,
              ...fade(0.2),
            }}>
              <p style={{
                margin: '0 0 12px', fontSize: 11, fontWeight: 700,
                color: 'var(--text-3)', textTransform: 'uppercase',
                letterSpacing: '1px', fontFamily: 'var(--font-sans)',
              }}>
                Still to do
              </p>
              <button
                onClick={() => router.push('/targets')}
                style={{
                  display: 'flex', width: '100%', alignItems: 'center',
                  justifyContent: 'space-between', background: 'none',
                  border: 'none', cursor: 'pointer', padding: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#F59E0B', flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 13.5, color: 'var(--text-2)', fontFamily: 'var(--font-sans)' }}>
                    Set a target for {pendingGoals} {pendingGoals === 1 ? 'goal' : 'goals'}
                  </span>
                </div>
                <ArrowRight size={14} color="var(--text-3)" />
              </button>
            </div>
          )}

          {/* Dismissible debt card */}
          {!debtDismissed && (
            <div style={{
              background: 'var(--white)',
              border: '1px solid var(--border)',
              borderRadius: 16, padding: '20px',
              marginTop: 12, position: 'relative',
              ...fade(0.25),
            }}>
              <button
                onClick={dismissDebt}
                aria-label="Dismiss"
                style={{
                  position: 'absolute', top: 14, right: 14,
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 4, color: 'var(--text-3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={16} />
              </button>
              <span style={{ fontSize: 22 }}>💳</span>
              <p style={{
                fontWeight: 600, fontSize: 14, color: 'var(--text-1)',
                margin: '10px 0 4px', fontFamily: 'var(--font-sans)',
              }}>
                Do you have any loans or debts?
              </p>
              <p style={{
                fontSize: 13, color: 'var(--text-3)',
                margin: '0 0 16px', lineHeight: 1.6,
                fontFamily: 'var(--font-sans)',
              }}>
                Credit cards, mobile loans, repayments. Adding them gives you the full picture.
              </p>
              <button
                onClick={onAddDebts}
                style={{
                  width: '100%', height: 42, borderRadius: 12,
                  background: 'var(--brand-dark)', color: '#fff',
                  border: 'none', fontWeight: 600, fontSize: 13.5,
                  fontFamily: 'var(--font-sans)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                Add debts <ArrowRight size={14} />
              </button>
            </div>
          )}
        </>
      ) : (
        /* ── SETUP MODE ──────────────────────────────────────── */
        <>
          {/* Summary card: income only */}
          <div style={{
            background: 'var(--white)',
            border: '1px solid var(--border)',
            borderRadius: 16, padding: '20px',
            marginTop: 16,
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            fontFamily: 'var(--font-sans)',
            ...fade(0.1),
          }}>
            <p style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 14px' }}>
              Your plan so far
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 14, color: 'var(--text-2)' }}>You make</span>
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1)', fontFamily: 'var(--font-serif)' }}>
                {fmt(totalIncome, currency)}
              </span>
            </div>
          </div>

          {/* Goals card */}
          {totalGoals > 0 && (
            <div style={{ marginTop: 16, ...fade(0.15) }}>
              <div
                role={!isComplete ? 'button' : undefined}
                onClick={!isComplete ? () => router.push('/targets') : undefined}
                style={{
                  background: 'var(--white)',
                  border: '1px solid var(--border)',
                  borderRadius: 16, padding: '20px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  cursor: !isComplete ? 'pointer' : 'default',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Your goals
                    </p>
                    {goalTotal > 0 && (
                      <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700, color: 'var(--text-1)', fontFamily: 'var(--font-serif)', letterSpacing: '-0.3px' }}>
                        {fmt(goalTotal, currency)}
                      </p>
                    )}
                  </div>
                  {!isComplete && (
                    <div style={{
                      fontSize: 11, fontWeight: 600, color: 'var(--brand-dark)',
                      background: '#EADFF4', borderRadius: 99,
                      padding: '4px 10px', whiteSpace: 'nowrap', alignSelf: 'flex-start',
                    }}>
                      {filledGoals === 0 ? 'Not started' : `${filledGoals} / ${totalGoals}`}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: !isComplete ? 16 : 0 }}>
                  {goals.map(gid => {
                    const m = GOAL_META[gid]
                    if (!m) return null
                    const isFilled = !!goalTargets?.[gid]
                    return (
                      <div key={gid} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '5px 11px 5px 8px', borderRadius: 99,
                        background: 'transparent', border: '1.5px solid #D5CDED',
                      }}>
                        <span style={{ fontSize: 13 }}>{m.icon}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 400, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                          {m.label}
                        </span>
                        {isFilled && (
                          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ marginLeft: 1, flexShrink: 0 }} role="img" aria-label="Target set">
                            <title>Target set</title>
                            <circle cx="6.5" cy="6.5" r="6" fill="#DCFCE7" />
                            <path d="M4 6.5l1.8 1.8 3.2-3.6" stroke="#16A34A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    )
                  })}
                </div>
                {!isComplete && (
                  <div style={{
                    width: '100%', height: 44, borderRadius: 12,
                    background: 'var(--brand-dark)', color: '#fff',
                    fontWeight: 600, fontSize: 14, fontFamily: 'var(--font-sans)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                    {filledGoals === 0 ? 'Set targets' : 'Continue'} <ArrowRight size={15} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: fixed expenses nudge */}
          {goalsReady && !expensesComplete && (
            <div className="overview-data__nudge" style={{ ...fade(0.25), marginTop: 24 }}>
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

          {/* Step 3: spending categories nudge */}
          {!budgetsComplete && (
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
        </>
      )}

    </div>
  )
}
