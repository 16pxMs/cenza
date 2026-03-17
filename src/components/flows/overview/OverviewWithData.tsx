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
import { X } from 'lucide-react'
import './OverviewWithData.css'
import { fmt, getBudgetPace } from '@/lib/finance'

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
  expensesData: { totalMonthly: number; entries?: any[] } | null
  budgetsData: { totalBudget: number; categories?: any[] } | null
  goalTargets: Record<string, any> | null
  onSetupGoals: () => void
  onAddExpenses: () => void
  onAddBudgets: () => void
  onAddDebts?: () => void
  onLogExpense?: () => void
  totalSpent?: number
  isDesktop?: boolean
}

export function OverviewWithData({
  name, currency, goals, incomeData, expensesData, budgetsData,
  goalTargets, onSetupGoals: _onSetupGoals, onAddExpenses, onAddBudgets,
  onAddDebts, onLogExpense, totalSpent = 0, isDesktop,
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
  const expensesComplete = expensesData !== null && expensesData.totalMonthly > 0
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
          {/* Info box: still to do — comes first */}
          {pendingGoals > 0 && (
            <div
              onClick={() => router.push('/targets')}
              style={{
                background: '#FFFBEB', border: '1px solid #FDE68A',
                borderRadius: 14, padding: '14px 16px',
                marginTop: 16, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                ...fade(0.05),
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#92400E', fontFamily: 'var(--font-sans)' }}>
                  You still need to set a target for {pendingGoals} {pendingGoals === 1 ? 'goal' : 'goals'}
                </span>
              </div>
              <span style={{ fontSize: 12, color: '#92400E', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>Do it now</span>
            </div>
          )}

          {/* Primary: Track spending card */}
          {(() => {
            const totalBudget = (budgetsData?.totalBudget ?? 0) + (expensesData?.totalMonthly ?? 0)
            const pct         = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0
            const hasLogged   = totalSpent > 0

            return (
              <div style={{
                background: 'var(--brand-dark)',
                borderRadius: 20,
                padding: '24px',
                marginTop: 16,
                boxShadow: '0 4px 20px rgba(92,52,137,0.25)',
                ...fade(0.08),
              }}>
                <h2 style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: isDesktop ? 16 : 14,
                  fontWeight: 600, color: 'rgba(234,223,244,0.7)',
                  margin: '0 0 6px', letterSpacing: '0.2px',
                  textTransform: 'uppercase',
                }}>
                  This month
                </h2>

                {hasLogged ? (
                  <>
                    {/* Spent vs budget numbers */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                      <span style={{ fontSize: 26, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-sans)', letterSpacing: -0.5 }}>
                        {fmt(totalSpent, currency)}
                      </span>
                      {totalBudget > 0 && (
                        <span style={{ fontSize: 13, color: 'rgba(234,223,244,0.6)', fontFamily: 'var(--font-sans)' }}>
                          of {fmt(totalBudget, currency)}
                        </span>
                      )}
                    </div>
                    {/* Progress bar + remaining */}
                    {totalBudget > 0 && (() => {
                      const remaining = totalBudget - totalSpent
                      const isOver    = remaining < 0
                      return (
                        <>
                          <div style={{ height: 5, background: 'rgba(255,255,255,0.15)', borderRadius: 99, marginBottom: 8 }}>
                            <div style={{
                              height: '100%',
                              width: `${pct}%`,
                              background: pct > 90 ? '#FCA5A5' : pct > 75 ? '#FCD34D' : '#86EFAC',
                              borderRadius: 99,
                              transition: 'width 0.5s ease',
                            }} />
                          </div>
                          <p style={{
                            margin: '0 0 18px', fontSize: 12,
                            color: isOver ? '#FCA5A5' : 'rgba(234,223,244,0.6)',
                            fontFamily: 'var(--font-sans)',
                          }}>
                            {isOver
                              ? `${fmt(Math.abs(remaining), currency)} over budget`
                              : `${fmt(remaining, currency)} remaining`}
                          </p>
                        </>
                      )
                    })()}
                  </>
                ) : (
                  <p style={{
                    fontSize: 14, color: 'rgba(234,223,244,0.72)',
                    margin: '0 0 20px', lineHeight: 1.6,
                    fontFamily: 'var(--font-sans)',
                  }}>
                    Log your expenses and Cenza will start learning your patterns.
                  </p>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={onLogExpense}
                    style={{
                      flex: 1, height: 48, borderRadius: 12,
                      background: '#fff', color: 'var(--brand-dark)',
                      border: 'none', fontWeight: 700, fontSize: 14,
                      fontFamily: 'var(--font-sans)', cursor: 'pointer',
                    }}
                  >
                    Log expense
                  </button>
                  {hasLogged && (
                    <button
                      onClick={() => router.push('/history')}
                      style={{
                        height: 48, borderRadius: 12, padding: '0 18px',
                        background: 'rgba(255,255,255,0.12)', color: '#fff',
                        border: '1.5px solid rgba(255,255,255,0.25)',
                        fontWeight: 600, fontSize: 14,
                        fontFamily: 'var(--font-sans)', cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      View
                    </button>
                  )}
                </div>
              </div>
            )
          })()}

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
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {filledGoals === 0 ? 'Set targets' : 'Continue'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Dismissible debt card */}
          {!debtDismissed && (
            <div style={{
              background: 'var(--white)',
              border: '1px solid var(--border)',
              borderRadius: 16, padding: '20px',
              marginTop: 16, position: 'relative',
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
              <p style={{
                fontWeight: 600, fontSize: 14, color: 'var(--text-1)',
                margin: '0 0 4px', fontFamily: 'var(--font-sans)',
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
                }}
              >
                Add debts
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
                    {filledGoals === 0 ? 'Set targets' : 'Continue'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: fixed expenses card — 3 states */}
          {goalsReady && (() => {
            const entries: any[] = expensesData?.entries ?? []
            const knownEntries = entries.filter((e: any) => e.confidence !== 'unsure' && e.monthly > 0)

            // State 3 — complete with amounts
            if (expensesComplete && expensesData && expensesData.totalMonthly > 0) {
              return (
                <div style={{
                  background: 'var(--white)', border: '1px solid var(--border)',
                  borderRadius: 16, padding: '18px 20px', marginTop: 16,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  fontFamily: 'var(--font-sans)',
                  ...fade(0.25),
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Fixed costs
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700, color: 'var(--text-1)', fontFamily: 'var(--font-serif)', letterSpacing: '-0.3px' }}>
                        {fmt(expensesData.totalMonthly, currency)}<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-3)', fontFamily: 'var(--font-sans)', marginLeft: 4 }}>/mo</span>
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#15803D', background: '#DCFCE7', borderRadius: 99, padding: '4px 10px' }}>
                      <svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4.5L4 7.5L10 1.5" stroke="#15803D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Set
                    </div>
                  </div>
                  {knownEntries.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      {knownEntries.slice(0, 5).map((e: any) => (
                        <div key={e.key} style={{ fontSize: 12, color: 'var(--text-2)', background: '#F4F0FB', borderRadius: 99, padding: '3px 10px' }}>
                          {e.label || e.key} · {fmt(e.monthly, currency)}
                        </div>
                      ))}
                      {knownEntries.length > 5 && (
                        <div style={{ fontSize: 12, color: 'var(--text-3)', background: '#F4F0FB', borderRadius: 99, padding: '3px 10px' }}>
                          +{knownEntries.length - 5} more
                        </div>
                      )}
                    </div>
                  )}
                  <button onClick={onAddExpenses} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12.5, color: 'var(--text-3)', fontFamily: 'var(--font-sans)' }}>
                    Edit fixed costs
                  </button>
                </div>
              )
            }

            // State 2 — saved but no amounts
            if (expensesData !== null && expensesData.totalMonthly === 0) {
              return (
                <div style={{
                  background: '#FFFBEB', border: '1px solid #FDE68A',
                  borderRadius: 16, padding: '18px 20px', marginTop: 16,
                  fontFamily: 'var(--font-sans)',
                  ...fade(0.25),
                }}>
                  <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: '#92400E' }}>
                    Fixed costs logged — no amounts yet
                  </p>
                  <p style={{ margin: '0 0 12px', fontSize: 13, color: '#92400E', lineHeight: 1.55, opacity: 0.8 }}>
                    You've added{entries.length > 0 ? ` ${entries.length} expense${entries.length === 1 ? '' : 's'}` : ' expenses'} but haven't set amounts. Add them to see what your plan looks like.
                  </p>
                  {entries.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      {entries.map((e: any) => (
                        <div key={e.key} style={{ fontSize: 12, color: '#92400E', background: '#FEF3C7', borderRadius: 99, padding: '3px 10px' }}>
                          {e.label || e.key}
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={onAddExpenses} style={{
                    width: '100%', height: 40, borderRadius: 10,
                    background: '#92400E', color: '#fff',
                    border: 'none', fontWeight: 600, fontSize: 13.5,
                    fontFamily: 'var(--font-sans)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                    Set amounts                  </button>
                </div>
              )
            }

            // State 1 — not started
            return (
              <div className="overview-data__nudge" style={{ ...fade(0.25), marginTop: 16 }}>
                <p className="overview-data__nudge-title">Add your fixed costs</p>
                <p className="overview-data__nudge-sub">
                  Rent, utilities, phone. The costs you pay no matter what.
                </p>
                <button onClick={onAddExpenses} style={{
                  width: '100%', height: 44, borderRadius: 12,
                  background: 'var(--brand-dark)', color: '#fff',
                  border: 'none', fontWeight: 600, fontSize: 14,
                  fontFamily: 'var(--font-sans)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12,
                }}>
                  Add fixed costs                </button>
              </div>
            )
          })()}

          {/* Step 3: spending card — 3 states */}
          {(() => {
            const categories: any[] = budgetsData?.categories ?? []
            const filledCats = categories.filter((c: any) => c.budget > 0)

            // State 3 — complete with amounts
            if (budgetsComplete && budgetsData && budgetsData.totalBudget > 0) {
              return (
                <div style={{
                  background: 'var(--white)', border: '1px solid var(--border)',
                  borderRadius: 16, padding: '18px 20px', marginTop: 16,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  fontFamily: 'var(--font-sans)',
                  ...fade(0.3),
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Spending budget
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700, color: 'var(--text-1)', fontFamily: 'var(--font-serif)', letterSpacing: '-0.3px' }}>
                        {fmt(budgetsData.totalBudget, currency)}<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-3)', fontFamily: 'var(--font-sans)', marginLeft: 4 }}>/mo</span>
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#15803D', background: '#DCFCE7', borderRadius: 99, padding: '4px 10px' }}>
                      <svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4.5L4 7.5L10 1.5" stroke="#15803D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Set
                    </div>
                  </div>
                  {filledCats.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      {filledCats.slice(0, 5).map((c: any) => (
                        <div key={c.key} style={{ fontSize: 12, color: 'var(--text-2)', background: '#F4F0FB', borderRadius: 99, padding: '3px 10px' }}>
                          {c.label || c.key} · {fmt(c.budget, currency)}
                        </div>
                      ))}
                      {filledCats.length > 5 && (
                        <div style={{ fontSize: 12, color: 'var(--text-3)', background: '#F4F0FB', borderRadius: 99, padding: '3px 10px' }}>
                          +{filledCats.length - 5} more
                        </div>
                      )}
                    </div>
                  )}
                  <button onClick={onAddBudgets} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12.5, color: 'var(--text-3)', fontFamily: 'var(--font-sans)' }}>
                    Edit spending
                  </button>
                </div>
              )
            }

            // State 2 — saved but no amounts
            if (budgetsData !== null && budgetsData.totalBudget === 0) {
              return (
                <div style={{
                  background: '#FFFBEB', border: '1px solid #FDE68A',
                  borderRadius: 16, padding: '18px 20px', marginTop: 16,
                  fontFamily: 'var(--font-sans)',
                  ...fade(0.3),
                }}>
                  <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: '#92400E' }}>
                    Spending categories added — no amounts yet
                  </p>
                  <p style={{ margin: '0 0 12px', fontSize: 13, color: '#92400E', lineHeight: 1.55, opacity: 0.8 }}>
                    You've picked{categories.length > 0 ? ` ${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}` : ' categories'} but haven't set budgets. Add amounts to complete your plan.
                  </p>
                  {categories.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      {categories.map((c: any) => (
                        <div key={c.key} style={{ fontSize: 12, color: '#92400E', background: '#FEF3C7', borderRadius: 99, padding: '3px 10px' }}>
                          {c.label || c.key}
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={onAddBudgets} style={{
                    width: '100%', height: 40, borderRadius: 10,
                    background: '#92400E', color: '#fff',
                    border: 'none', fontWeight: 600, fontSize: 13.5,
                    fontFamily: 'var(--font-sans)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                    Set amounts                  </button>
                </div>
              )
            }

            // State 1 — not started
            return (
              <div className="overview-data__nudge" style={{ ...fade(0.3), marginTop: 16 }}>
                <div className="overview-data__nudge-text">
                  <p className="overview-data__nudge-title">How do you spend?</p>
                  <p className="overview-data__nudge-sub">
                    Tell us what you regularly spend on. We will track the patterns.
                  </p>
                </div>
                <button className="overview-data__nudge-btn" onClick={onAddBudgets}>Add</button>
              </div>
            )
          })()}
        </>
      )}

    </div>
  )
}
