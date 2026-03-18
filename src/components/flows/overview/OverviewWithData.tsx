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
import { X, AlertTriangle, TrendingUp, Target, Sparkles, CheckCircle, Lightbulb } from 'lucide-react'
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
  budgetsSource?: 'onboarding' | 'user_set'
  goalTargets: Record<string, any> | null
  goalSaved?: Record<string, number>
  onSetupGoals: () => void
  onAddExpenses: () => void
  onAddBudgets: () => void
  onAddDebts?: () => void
  onLogExpense?: () => void
  totalSpent?: number
  isDesktop?: boolean
}

export function OverviewWithData({
  name, currency, goals, incomeData, expensesData, budgetsData, budgetsSource = 'onboarding',
  goalTargets, goalSaved = {}, onSetupGoals: _onSetupGoals, onAddExpenses, onAddBudgets,
  onAddDebts, onLogExpense, totalSpent = 0, isDesktop,
}: Props) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [debtDismissed, setDebtDismissed] = useState(false)
  const [goalsExpanded, setGoalsExpanded] = useState(false)

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
            // Compare against income — the only complete and honest ceiling.
            // Comparing against a partial budget (fixed-only) is misleading because
            // totalSpent includes goals, debt, and other categories not in that budget.
            const reference   = totalIncome > 0 ? totalIncome : 0
            const pct         = reference > 0 ? Math.min(100, (totalSpent / reference) * 100) : 0
            const hasLogged   = totalSpent > 0

            return (
              <div style={{
                background: '#F5F5F7',
                borderRadius: 20,
                padding: '24px',
                marginTop: 16,
                ...fade(0.08),
              }}>
                <h2 style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 11, fontWeight: 700,
                  color: 'var(--text-3)',
                  margin: '0 0 6px', letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                }}>
                  {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h2>

                {hasLogged ? (
                  <>
                    {/* Spent vs income */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                      <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-1)', fontFamily: 'var(--font-sans)', letterSpacing: -0.5 }}>
                        {fmt(totalSpent, currency)}
                      </span>
                      {reference > 0 && (
                        <span style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-sans)' }}>
                          of {fmt(reference, currency)}
                        </span>
                      )}
                    </div>
                    {/* Progress bar + remaining */}
                    {reference > 0 && (() => {
                      const remaining = reference - totalSpent
                      const isOver    = remaining < 0
                      return (
                        <>
                          <div style={{ height: 5, background: '#E5E5EA', borderRadius: 99, marginBottom: 8 }}>
                            <div style={{
                              height: '100%',
                              width: `${pct}%`,
                              background: pct > 90 ? '#D93025' : pct > 75 ? '#F4A01C' : '#5C3489',
                              borderRadius: 99,
                              transition: 'width 0.5s ease',
                            }} />
                          </div>
                          <p style={{
                            margin: '0 0 18px', fontSize: 12,
                            color: isOver ? '#D93025' : 'var(--text-3)',
                            fontFamily: 'var(--font-sans)',
                          }}>
                            {isOver
                              ? `${fmt(Math.abs(remaining), currency)} over income`
                              : `${fmt(remaining, currency)} in hand`}
                          </p>
                        </>
                      )
                    })()}
                  </>
                ) : (
                  <p style={{
                    fontSize: 14, color: 'var(--text-3)',
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
                      background: 'var(--brand-dark)', color: '#fff',
                      border: 'none', fontWeight: 700, fontSize: 14,
                      fontFamily: 'var(--font-sans)', cursor: 'pointer',
                    }}
                  >
                    Track my spend
                  </button>
                  {hasLogged && (
                    <button
                      onClick={() => router.push('/history')}
                      style={{
                        height: 48, borderRadius: 12, padding: '0 18px',
                        background: 'transparent', color: 'var(--brand-dark)',
                        border: '1.5px solid #D1D1D6',
                        fontWeight: 600, fontSize: 14,
                        fontFamily: 'var(--font-sans)', cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Monthly review
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
                onClick={() => router.push('/goals')}
                style={{
                  background: 'var(--white)', border: '1px solid var(--border)',
                  borderRadius: 16, padding: '20px', fontFamily: 'var(--font-sans)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Your goals
                  </p>
                  {!isComplete && (
                    <button
                      onClick={() => router.push('/targets')}
                      style={{
                        fontSize: 11, fontWeight: 600, color: 'var(--brand-dark)',
                        background: '#EADFF4', borderRadius: 99, padding: '4px 10px',
                        border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {filledGoals === 0 ? 'Set targets' : 'Continue'}
                    </button>
                  )}
                </div>
                {(() => {
                  const validGoals   = goals.filter(g => !!GOAL_META[g])
                  const hiddenCount  = Math.max(0, validGoals.length - 2)
                  const visibleGoals = goalsExpanded ? validGoals : validGoals.slice(0, 2)
                  return (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        {visibleGoals.map(gid => {
                          const m      = GOAL_META[gid]
                          const target = goalTargets?.[gid] ? Number(goalTargets[gid]) : 0
                          const saved  = goalSaved[gid] ?? 0
                          const pct    = target > 0 ? Math.min(100, (saved / target) * 100) : 0
                          return (
                            <div key={gid}>
                              {/* Row: icon + name | saved amount */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                  <span style={{ fontSize: 16 }}>{m.icon}</span>
                                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>{m.label}</span>
                                </div>
                                <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
                                  {fmt(saved, currency)} saved
                                </span>
                              </div>
                              {/* Progress bar */}
                              <div style={{ height: 4, background: '#EDE8F5', borderRadius: 99, marginBottom: 5 }}>
                                {target > 0 && (
                                  <div style={{
                                    height: '100%', width: `${pct}%`,
                                    background: pct >= 100 ? '#22C55E' : 'var(--brand-dark)',
                                    borderRadius: 99, transition: 'width 0.5s ease',
                                    minWidth: pct > 0 ? 6 : 0,
                                  }} />
                                )}
                              </div>
                              {/* Sublabel: pct left | target right */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                                  {target > 0 ? `${Math.round(pct)}%` : ''}
                                </span>
                                <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                                  {target > 0 ? `Target: ${fmt(target, currency)}` : 'No target set'}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      {hiddenCount > 0 && (
                        <button
                          onClick={() => setGoalsExpanded(e => !e)}
                          style={{
                            marginTop: 14, width: '100%', background: 'none', border: 'none',
                            cursor: 'pointer', fontSize: 13, fontWeight: 500,
                            color: 'var(--brand-dark)', fontFamily: 'var(--font-sans)',
                            textAlign: 'left', padding: 0,
                          }}
                        >
                          {goalsExpanded ? 'Show less' : `View ${hiddenCount} more goal${hiddenCount > 1 ? 's' : ''}`}
                        </button>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
          )}

          {/* Insight / feedback card */}
          {(() => {
            const reference = totalIncome > 0 ? totalIncome : 0
            const remaining = reference - totalSpent
            const pct       = reference > 0 ? Math.min(100, (totalSpent / reference) * 100) : 0
            const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
            const dayOfMonth  = new Date().getDate()
            const daysLeft    = daysInMonth - dayOfMonth

            // Goal with no contribution this month
            const neglectedGoal = goals.find(g => goalTargets?.[g] && !(goalSaved[g] > 0))
            const neglectedMeta = neglectedGoal ? GOAL_META[neglectedGoal] : null

            type InsightIcon = typeof AlertTriangle
            type Insight = { Icon: InsightIcon; text: string; color: string }
            const insights: Insight[] = []

            if (totalSpent > 0 && reference > 0 && remaining < 0) {
              insights.push({
                Icon: AlertTriangle,
                text: `You've spent ${fmt(Math.abs(remaining), currency)} more than your income this month.`,
                color: '#D93025',
              })
            }
            if (pct > 75 && daysLeft > 7) {
              insights.push({
                Icon: TrendingUp,
                text: `${Math.round(pct)}% of your income spent with ${daysLeft} days still to go.`,
                color: '#D97706',
              })
            }
            if (neglectedMeta) {
              insights.push({
                Icon: Target,
                text: `You haven't added anything to ${neglectedMeta.label} yet this month.`,
                color: '#4A3B66',
              })
            }
            if (totalSpent === 0) {
              insights.push({
                Icon: Sparkles,
                text: `Nothing logged yet. Start tracking and Cenza will surface insights here.`,
                color: '#4A3B66',
              })
            }
            if (reference > 0 && pct <= 75 && totalSpent > 0) {
              insights.push({
                Icon: CheckCircle,
                text: `You're on track. ${fmt(remaining, currency)} in hand for the remaining ${daysLeft} days.`,
                color: '#1A7A45',
              })
            }

            // Empty state — financial tip when everything is fine and nothing to flag
            const TIPS = [
              'The 50/30/20 rule: 50% on needs, 30% on wants, 20% into savings or goals.',
              'An emergency fund covering 3 to 6 months of expenses is one of the highest-return things you can build.',
              'Small, consistent contributions to a goal beat large irregular ones over time.',
              'Tracking spending is not about restriction — it is about knowing where your money actually goes.',
              'Paying yourself first means moving money to savings before spending, not after.',
            ]
            const tip = TIPS[new Date().getDate() % TIPS.length]

            const displayInsights = insights.length > 0
              ? insights
              : [{ Icon: Lightbulb, text: tip, color: '#4A3B66' }]

            return (
              <div style={{
                marginTop: 16,
                background: 'var(--white)', border: '1px solid var(--border)',
                borderRadius: 16, padding: '4px 20px',
                fontFamily: 'var(--font-sans)',
                ...fade(0.2),
              }}>
                {displayInsights.map((insight, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '16px 0',
                    borderBottom: i < displayInsights.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <insight.Icon size={17} color={insight.color} style={{ flexShrink: 0, marginTop: 2 }} />
                    <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: insight.color }}>
                      {insight.text}
                    </p>
                  </div>
                ))}
              </div>
            )
          })()}

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
                onClick={() => router.push('/goals')}
                style={{
                  background: 'var(--white)', border: '1px solid var(--border)',
                  borderRadius: 16, padding: '20px', fontFamily: 'var(--font-sans)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Your goals
                  </p>
                  {!isComplete && (
                    <button
                      onClick={() => router.push('/targets')}
                      style={{
                        fontSize: 11, fontWeight: 600, color: 'var(--brand-dark)',
                        background: '#EADFF4', borderRadius: 99, padding: '4px 10px',
                        border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {filledGoals === 0 ? 'Set targets' : 'Continue'}
                    </button>
                  )}
                </div>
                {(() => {
                  const validGoals   = goals.filter(g => !!GOAL_META[g])
                  const hiddenCount  = Math.max(0, validGoals.length - 2)
                  const visibleGoals = goalsExpanded ? validGoals : validGoals.slice(0, 2)
                  return (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        {visibleGoals.map(gid => {
                          const m      = GOAL_META[gid]
                          const target = goalTargets?.[gid] ? Number(goalTargets[gid]) : 0
                          const saved  = goalSaved[gid] ?? 0
                          const pct    = target > 0 ? Math.min(100, (saved / target) * 100) : 0
                          return (
                            <div key={gid}>
                              {/* Row: icon + name | saved amount */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                  <span style={{ fontSize: 16 }}>{m.icon}</span>
                                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>{m.label}</span>
                                </div>
                                <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
                                  {fmt(saved, currency)} saved
                                </span>
                              </div>
                              {/* Progress bar */}
                              <div style={{ height: 4, background: '#EDE8F5', borderRadius: 99, marginBottom: 5 }}>
                                {target > 0 && (
                                  <div style={{
                                    height: '100%', width: `${pct}%`,
                                    background: pct >= 100 ? '#22C55E' : 'var(--brand-dark)',
                                    borderRadius: 99, transition: 'width 0.5s ease',
                                    minWidth: pct > 0 ? 6 : 0,
                                  }} />
                                )}
                              </div>
                              {/* Sublabel: pct left | target right */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                                  {target > 0 ? `${Math.round(pct)}%` : ''}
                                </span>
                                <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                                  {target > 0 ? `Target: ${fmt(target, currency)}` : 'No target set'}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      {hiddenCount > 0 && (
                        <button
                          onClick={() => setGoalsExpanded(e => !e)}
                          style={{
                            marginTop: 14, width: '100%', background: 'none', border: 'none',
                            cursor: 'pointer', fontSize: 13, fontWeight: 500,
                            color: 'var(--brand-dark)', fontFamily: 'var(--font-sans)',
                            textAlign: 'left', padding: 0,
                          }}
                        >
                          {goalsExpanded ? 'Show less' : `View ${hiddenCount} more goal${hiddenCount > 1 ? 's' : ''}`}
                        </button>
                      )}
                    </>
                  )
                })()}
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
