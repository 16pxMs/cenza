// ─────────────────────────────────────────────────────────────
// OverviewWithData — Main overview screen once income is saved
//
// Card order:
//   No goals  → goals empty state first, then spending
//   Has goals → spending first, then goals progress
//
// The "why" comes before the "what" when there's no goal yet.
// ─────────────────────────────────────────────────────────────

'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, AlertTriangle, TrendingUp, Target, Sparkles, CheckCircle, Lightbulb, ChevronRight } from 'lucide-react'
import './OverviewWithData.css'
import { fmt } from '@/lib/finance'
import { calculateTotalIncome, calculateRemaining, calculatePct, calculateRemainingPct, calculateCategoryBudget } from '@/lib/math/finance'
import { GoalContribSheet } from './GoalContribSheet'

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
  received?: number | null  // confirmed received this month (null = not yet confirmed)
}

const CATEGORY_EMOJI: Record<string, string> = {
  groceries: '🛒', transport: '🚌', eating_out: '🍽️', airtime: '📱',
  entertainment: '🎬', personal_care: '💄', household: '🏠', clothing: '👕',
  health: '💊', savings: '💰', education: '📚', family: '🤲',
}

interface Props {
  name: string
  currency: string
  goals: string[]
  incomeData: IncomeData | null
  goalTargets: Record<string, any> | null
  goalSaved?: Record<string, number>
  goalLabels?: Record<string, string>
  onAddDebts?: () => void
  onLogExpense?: () => void
  onConfirmIncome?: () => void
  onContribGoal?: (goalId: string, goalLabel: string, amount: number, note: string) => Promise<void>
  totalSpent?: number
  fixedTotal?: number
  spendingBudget?: { categories: any[] } | null
  categorySpend?: Record<string, number>
  isDesktop?: boolean
}

export function OverviewWithData({
  name, currency, goals, incomeData,
  goalTargets, goalSaved = {}, goalLabels = {}, onAddDebts, onLogExpense, onConfirmIncome, onContribGoal,
  totalSpent = 0, fixedTotal = 0, spendingBudget = null, categorySpend = {}, isDesktop,
}: Props) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [debtDismissed, setDebtDismissed] = useState(false)
  const [goalsExpanded, setGoalsExpanded] = useState(false)
  const [activeGoalContrib, setActiveGoalContrib] = useState<string | null>(null)

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
  const totalIncome = incomeData
    ? calculateTotalIncome(incomeData)
    : 0

  // ── Goals ────────────────────────────────────────────────────
  const totalGoals   = goals.length
  const filledGoals  = goalTargets ? Object.keys(goalTargets).length : 0
  const isComplete   = totalGoals > 0 && filledGoals >= totalGoals
  const pendingGoals = totalGoals - filledGoals

  // ── Spending body copy — contextual once goals exist (idea 4) ─
  const firstGoalMeta  = goals.length > 0 ? GOAL_META[goals[0]] : null
  const firstGoalLabel = goals.length > 0 ? (goalLabels[goals[0]] ?? firstGoalMeta?.label ?? '') : ''
  const spendBodyCopy  = firstGoalMeta
    ? goals.length === 1
      ? `Record your expenses to see what's left for your ${firstGoalLabel}.`
      : `Record your expenses to see what's left for your goals.`
    : `Add your first expense to see where your money is going.`

  // ── Fade-in helper ───────────────────────────────────────────
  const fade = (delay: number): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(10px)',
    transition: `all 0.45s ease ${delay}s`,
  })

  // ── Spending card ─────────────────────────────────────────────
  const receivedConfirmed =
  incomeData?.received != null && incomeData.received > 0

const reference = receivedConfirmed
  ? Number(incomeData?.received ?? 0)
  : totalIncome

  const spentPct  = calculatePct(totalSpent, reference)
  const hasLogged = totalSpent > 0

  // State B: received confirmed, nothing logged — hero is full available amount
  const stateBCard = (ref: number) => (
    <div style={{
      background: '#fff', borderRadius: 20, padding: '24px',
      marginTop: 16, boxShadow: '0 1px 10px rgba(0,0,0,0.07)',
      ...fade(0.08),
    }}>
      <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
        Available this month
      </p>
      <p style={{ margin: '0 0 20px', fontSize: 36, fontWeight: 700, color: 'var(--text-1)', letterSpacing: -1, lineHeight: 1 }}>
        {fmt(ref, currency)}
      </p>

      {/* Full green bar — tank is full */}
      <div style={{ height: 5, background: '#E5E5EA', borderRadius: 99, marginBottom: 8 }}>
        <div style={{ height: '100%', width: '100%', background: '#22C55E', borderRadius: 99 }} />
      </div>
      <p style={{ margin: '0 0 20px', fontSize: 12, color: 'var(--text-muted)' }}>
        All yours — nothing spent yet
      </p>

      {/* Fixed bills breakdown — clean 2-column stat grid */}
      {fixedTotal > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          borderTop: '1px solid var(--border)', paddingTop: 16, marginBottom: 20,
        }}>
          <div>
            <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fixed bills</p>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-3)' }}>{fmt(fixedTotal, currency)}</p>
          </div>
          <div>
            <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Free to spend</p>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>{fmt(calculateRemaining(ref, totalSpent), currency)}</p>
          </div>
        </div>
      )}

      <button
        onClick={onLogExpense}
        style={{
          width: '100%', height: 50, borderRadius: 12,
          background: 'var(--brand-dark)', color: '#fff',
          border: 'none', fontWeight: 600, fontSize: 15, cursor: 'pointer',
        }}
      >
        Log your first expense
      </button>
    </div>
  )

  // State C: live spend — hero is what remains, bar depletes as spend grows
  const stateCCard = (spent: number, ref: number) => {
    const remaining   = calculateRemaining(ref, spent)
    const isOver      = remaining < 0
    // Bar represents remaining (depletes as you spend), colour signals urgency
    const remainPct   = calculateRemainingPct(remaining, ref)
    const barColor    = remainPct > 50 ? '#22C55E' : remainPct > 25 ? '#F59E0B' : '#EF4444'
    return (
      <div style={{
        background: '#fff', borderRadius: 20, padding: '24px',
        marginTop: 16, boxShadow: '0 1px 10px rgba(0,0,0,0.07)',
        ...fade(0.08),
      }}>
        <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
          {isOver ? 'Over budget' : 'Remaining'}
        </p>
        <p style={{ margin: '0 0 20px', fontSize: 36, fontWeight: 700, color: isOver ? '#EF4444' : 'var(--text-1)', letterSpacing: -1, lineHeight: 1 }}>
          {fmt(Math.abs(remaining), currency)}
        </p>

        {ref > 0 && (
          <>
            {/* Depleting bar — full = untouched, empties as spend grows */}
            <div style={{ height: 5, background: '#E5E5EA', borderRadius: 99, marginBottom: 8 }}>
              <div style={{
                height: '100%', width: `${remainPct}%`,
                background: barColor,
                borderRadius: 99, transition: 'width 0.5s ease',
              }} />
            </div>
            <p style={{ margin: '0 0 20px', fontSize: 12, color: 'var(--text-3)' }}>
              {fmt(spent, currency)} spent of {fmt(ref, currency)}
            </p>
          </>
        )}

        {/* Income confirmation nudge — contained strip, clearly separated from buttons */}
        {!receivedConfirmed && onConfirmIncome && (
          <button
            onClick={onConfirmIncome}
            style={{
              width: '100%', textAlign: 'left', cursor: 'pointer',
              background: '#F5F0FA', border: '1px solid #E4D9F4',
              borderRadius: 10, padding: '10px 12px', marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: 'var(--brand-dark)', flexShrink: 0,
            }} />
            <span style={{ flex: 1, fontSize: 13, color: 'var(--brand-dark)', fontWeight: 500 }}>
              Confirm your income for this month
            </span>
            <ChevronRight size={16} color="var(--brand-dark)" strokeWidth={2.5} />
          </button>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onLogExpense}
            style={{
              flex: 1, height: 48, borderRadius: 12,
              background: 'var(--brand-dark)', color: '#fff',
              border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer',
            }}
          >
            Add an expense
          </button>
          <button
            onClick={() => router.push('/history')}
            style={{
              height: 48, borderRadius: 12, padding: '0 18px',
              background: 'transparent', color: 'var(--brand-dark)',
              border: '1px solid var(--border)',
              fontWeight: 600, fontSize: 14, cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Monthly review
          </button>
        </div>
      </div>
    )
  }

  const spendingCard = hasLogged && totalIncome > 0
    // ── State C: live data ─────────────────────────────────────
    ? stateCCard(totalSpent, reference)
    : receivedConfirmed
    // ── State B: received confirmed, nothing logged yet ─────────
    ? stateBCard(reference)
    : (
    // ── State A: setup mode ────────────────────────────────────
    <div style={{
      marginTop: 16, background: '#fff',
      borderRadius: 20, padding: '22px 24px 24px',
      border: '1px solid var(--border)',
      ...fade(totalGoals === 0 ? 0.18 : 0.08),
    }}>
      <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
        Your spending
      </p>
      <p style={{ margin: '0 0 20px', fontSize: 15, color: 'var(--text-2)', lineHeight: 1.65 }}>
        {spendBodyCopy}
      </p>
      <button
        onClick={onLogExpense}
        style={{
          width: '100%', height: 56, borderRadius: 16,
          background: 'var(--brand-dark)', color: '#fff',
          border: 'none', fontWeight: 600, fontSize: 16, cursor: 'pointer',
          letterSpacing: -0.1,
        }}
      >
        Add an expense
      </button>
    </div>
  )

  // ── Goals contextual card — State B: same context as State A but secondary hierarchy ──
  const goalsContextCard = (
    <div style={{
      background: 'var(--white)', border: '1px solid var(--border)',
      borderRadius: 20, padding: '22px 24px',
      marginTop: 16, ...fade(0.15),
    }}>
      <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        Goals
      </p>
      <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.2px', lineHeight: 1.25 }}>
        Give your money a purpose.
      </h3>
      <p style={{ margin: '0 0 20px', fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
        School fees, an emergency fund, travel — set a goal and watch it build alongside your spend.
      </p>
      <button
        onClick={() => router.push('/goals/new?from=overview')}
        style={{
          width: '100%', height: 46, borderRadius: 12,
          background: 'transparent', color: 'var(--brand-dark)',
          border: '1.5px solid #C9AEE8',
          fontWeight: 600, fontSize: 14, cursor: 'pointer',
        }}
      >
        Add your first goal
      </button>
    </div>
  )

  // ── Goals empty state (ideas 2 + 3 + 5) ─────────────────────
  const goalsEmptyState = (
    <div style={{
      background: 'var(--white)',
      border: '1px solid var(--border)',
      borderRadius: 20,
      padding: '24px',
      marginTop: 16,
      ...fade(0.08),
    }}>
      {/* Badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: '#F0FDF4', border: '1px solid #BBF7D0',
        borderRadius: 99, padding: '4px 12px', marginBottom: 20,
      }}>
        <Sparkles size={12} color="#15803D" />
        <span style={{ fontSize: 11, fontWeight: 600, color: '#15803D', letterSpacing: '0.04em' }}>
          Set up your first goal
        </span>
      </div>

      {/* Title */}
      <h2 style={{
        margin: '0 0 8px',
        fontSize: 20, fontWeight: 700,
        color: 'var(--text-1)', lineHeight: 1.2,
        letterSpacing: '-0.2px',
      }}>
        Give your money a purpose.
      </h2>

      {/* Body */}
      <p style={{
        margin: '0 0 28px',
        fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65,
      }}>
        Whether it is school fees, an emergency fund, or something else. Set a goal and track it here.
      </p>

      {/* CTA */}
      <button
        onClick={() => router.push('/goals/new?from=overview')}
        style={{
          width: '100%', height: 52, borderRadius: 14,
          background: 'var(--brand-dark)', color: '#fff',
          border: 'none', fontWeight: 600, fontSize: 15,
          cursor: 'pointer', letterSpacing: '-0.1px',
        }}
      >
        Add your first goal
      </button>
    </div>
  )

  // ── Goals progress card (has goals) ─────────────────────────
  const goalsCard = (
    <div style={{ marginTop: 16, ...fade(0.15) }}>
      <div
        onClick={() => router.push('/goals')}
        style={{
          background: 'var(--white)', border: '1px solid var(--border)',
          borderRadius: 16, padding: '20px', cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Your goals
          </p>
          {!isComplete && (
            <button
              onClick={(e) => { e.stopPropagation(); router.push('/targets') }}
              style={{
                fontSize: 11, fontWeight: 600, color: 'var(--brand-dark)',
                background: '#EADFF4', borderRadius: 99, padding: '4px 10px',
                border: 'none', cursor: 'pointer',
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
                  const label  = goalLabels[gid] ?? m.label
                  const target = goalTargets?.[gid] ? Number(goalTargets[gid]) : 0
                  const saved  = goalSaved[gid] ?? 0
                  const pct    = target > 0 ? Math.min(100, (saved / target) * 100) : 0
                  return (
                    <div key={gid}>
                      {/* Row 1: name + add button */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ fontSize: 16 }}>{m.icon}</span>
                          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>{label}</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setActiveGoalContrib(gid) }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            fontSize: 12, fontWeight: 600, color: 'var(--brand-dark)',
                            background: '#EADFF4', border: 'none', borderRadius: 99,
                            padding: '4px 10px', cursor: 'pointer',
                          }}
                        >
                          + Add
                        </button>
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

                      {/* Row 2: saved/to-go + target */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                          {target > 0
                            ? saved > 0
                              ? `${fmt(saved, currency)} saved`
                              : `${fmt(target, currency)} to go`
                            : ''}
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
                  onClick={(e) => { e.stopPropagation(); setGoalsExpanded(ex => !ex) }}
                  style={{
                    marginTop: 14, width: '100%', background: 'none', border: 'none',
                    cursor: 'pointer', fontSize: 13, fontWeight: 500,
                    color: 'var(--brand-dark)', textAlign: 'left', padding: 0,
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
  )

  // ── Insight card ─────────────────────────────────────────────
  const remaining   = reference - totalSpent
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const daysLeft    = daysInMonth - new Date().getDate()

  const neglectedGoal = goals.find(g => goalTargets?.[g] && !(goalSaved[g] > 0))
  const neglectedMeta = neglectedGoal ? GOAL_META[neglectedGoal] : null

  type InsightIcon = typeof AlertTriangle
  type Insight = { Icon: InsightIcon; text: string; color: string; href?: string; onTap?: () => void }
  const insights: Insight[] = []

  if (totalSpent > 0 && reference > 0 && remaining < 0) {
    insights.push({
      Icon: AlertTriangle,
      text: `You've spent ${fmt(Math.abs(remaining), currency)} more than your income this month.`,
      color: '#D93025',
      href: '/log?open=true',
    })
  }
  if (spentPct > 75 && daysLeft > 7) {
    insights.push({
      Icon: TrendingUp,
      text: `${Math.round(spentPct)}% of your income spent with ${daysLeft} days still to go.`,
      color: '#D97706',
      href: '/log?open=true',
    })
  }
  if (neglectedMeta) {
    const neglectedLabel = neglectedGoal ? (goalLabels[neglectedGoal] ?? neglectedMeta.label) : neglectedMeta.label
    insights.push({
      Icon: Target,
      text: `You haven't added anything to ${neglectedLabel} yet this month.`,
      color: '#4A3B66',
      onTap: () => setActiveGoalContrib(neglectedGoal!),
    })
  }
  if (totalSpent === 0) {
    insights.push({
      Icon: Sparkles,
      text: `Nothing logged yet. Start tracking and Cenza will surface insights here.`,
      color: '#4A3B66',
    })
  }
  if (reference > 0 && spentPct <= 75 && totalSpent > 0) {
    insights.push({
      Icon: CheckCircle,
      text: `You're on track. ${fmt(remaining, currency)} in hand for the remaining ${daysLeft} days.`,
      color: '#1A7A45',
    })
  }

  const TIPS = [
    'The 50/30/20 rule: 50% on needs, 30% on wants, 20% into savings or goals.',
    'An emergency fund covering 3 to 6 months of expenses is one of the highest-return things you can build.',
    'Small, consistent contributions to a goal beat large irregular ones over time.',
    'Tracking spending is not about restriction — it is about knowing where your money actually goes.',
    'Paying yourself first means moving money to savings before spending, not after.',
  ]
  const displayInsights: Insight[] = insights.length > 0
    ? insights
    : [{ Icon: Lightbulb, text: TIPS[new Date().getDate() % TIPS.length], color: '#4A3B66' }]

  const insightCard = (
    <div style={{
      marginTop: 16,
      background: 'var(--white)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '4px 20px',
      ...fade(0.22),
    }}>
      {displayInsights.map((insight, i) => (
        <div
          key={i}
          onClick={insight.onTap ?? (insight.href ? () => router.push(insight.href!) : undefined)}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            padding: '16px 0',
            borderBottom: i < displayInsights.length - 1 ? '1px solid var(--border-subtle)' : 'none',
            cursor: insight.onTap || insight.href ? 'pointer' : 'default',
          }}
        >
          <insight.Icon size={17} color={insight.color} style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: insight.color, flex: 1 }}>
            {insight.text}
          </p>
          {(insight.href || insight.onTap) && (
            <ChevronRight size={16} color={insight.color} strokeWidth={2} style={{ flexShrink: 0, alignSelf: 'center', opacity: 0.5 }} />
          )}
        </div>
      ))}
    </div>
  )

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className={`overview-data${isDesktop ? ' overview-data--desktop' : ''}`}>

      {/* Greeting */}
      <div className="overview-data__greeting" style={{ ...fade(0.05), display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
            {new Date().toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase()}
          </p>
          <h1 className={`overview-data__heading${isDesktop ? ' overview-data__heading--desktop' : ''}`}>
            {(() => { const h = new Date().getHours(); return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening' })()}, {name}
          </h1>
        </div>
        <button
          onClick={() => router.push('/settings')}
          style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'var(--brand-dark)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0, marginTop: 4,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>
            {name ? name[0].toUpperCase() : '?'}
          </span>
        </button>
      </div>

      {/* Pending targets nudge — only when goals exist but targets missing */}
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
            <span style={{ fontSize: 13, color: '#92400E' }}>
              Set a target for {pendingGoals} {pendingGoals === 1 ? 'goal' : 'goals'} to track progress
            </span>
          </div>
          <span style={{ fontSize: 12, color: '#92400E', fontWeight: 600 }}>Do it now</span>
        </div>
      )}

      {/* Budget vs actual card — shown when budget is set and spending has been logged */}
      {(() => {
        const cats = (spendingBudget?.categories ?? []).filter((c: any) => c.budget > 0)
        if (cats.length === 0 || !hasLogged) return null
        return (
          <div style={{
            background: 'var(--white)', border: '1px solid var(--border)',
            borderRadius: 18, overflow: 'hidden', marginTop: 16,
            ...fade(0.12),
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 16px 12px',
              borderBottom: '1px solid var(--border-subtle)',
            }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Spending budget
              </p>
            </div>
            {cats.map((cat: any, i: number) => {
              const { spent, budgeted, pct, over } = calculateCategoryBudget(
                categorySpend[cat.key] ?? 0,
                Number(cat.budget),
              )
              const barColor = over ? 'var(--red)' : pct > 75 ? '#F59E0B' : 'var(--green)'
              const emoji    = CATEGORY_EMOJI[cat.key]
              const isLast   = i === cats.length - 1
              return (
                <div key={cat.key} style={{
                  padding: '12px 16px',
                  borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {emoji && <span style={{ fontSize: 14 }}>{emoji}</span>}
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{cat.label}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: over ? 'var(--red-dark)' : 'var(--text-1)' }}>
                        {fmt(spent, currency)}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 3 }}>
                        / {fmt(budgeted, currency)}
                      </span>
                    </div>
                  </div>
                  <div style={{ height: 4, background: 'var(--grey-100)', borderRadius: 99 }}>
                    <div style={{
                      height: '100%', width: `${pct}%`,
                      background: barColor, borderRadius: 99,
                      transition: 'width 0.5s ease', minWidth: pct > 0 ? 4 : 0,
                    }} />
                  </div>
                  {over && (
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--red-dark)', fontWeight: 500 }}>
                      {fmt(spent - budgeted, currency)} over budget
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* Card order:
            No goals (any state) → goals empty state first (the why before the what)
            Has goals, State B   → spending first, quiet goal row (one primary CTA)
            Has goals, State C   → spending first, full goals progress card */}
      {totalGoals === 0 ? (
        // No goals set — always lead with the goal prompt so balance has meaning
        <>
          {goalsEmptyState}
          {spendingCard}
        </>
      ) : receivedConfirmed && !hasLogged ? (
        // State B: income confirmed, nothing logged — quiet goal row
        <>
          {spendingCard}
          {goalsContextCard}
        </>
      ) : (
        // State C: has spending data — spending leads, goals progress below
        <>
          {spendingCard}
          {goalsCard}
        </>
      )}

      {/* Quiet nudge — fills empty space when nothing logged yet */}
      {!hasLogged && (
        <p style={{
          textAlign: 'center', fontSize: 12, color: 'var(--text-muted)',
          margin: '28px 0 8px', lineHeight: 1.7,
          ...fade(0.35),
        }}>
          Every expense you add builds a clearer picture.
        </p>
      )}

      {/* Insight card — only shown once there is spend data to surface insights from */}
      {totalSpent > 0 && insightCard}

      {/* Dismissible debt card */}
      {!debtDismissed && (
        <div style={{
          background: 'var(--white)', border: '1px solid var(--border)',
          borderRadius: 16, padding: '20px',
          marginTop: 16, position: 'relative',
          ...fade(0.28),
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
          <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-1)', margin: '0 0 4px' }}>
            Do you have any loans or debts?
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 16px', lineHeight: 1.6 }}>
            Credit cards, mobile loans, repayments. Adding them gives you the full picture.
          </p>
          {onAddDebts && (
            <button
              onClick={onAddDebts}
              style={{
                width: '100%', height: 42, borderRadius: 12,
                background: 'var(--brand-dark)', color: '#fff',
                border: 'none', fontWeight: 600, fontSize: 13.5, cursor: 'pointer',
              }}
            >
              Add debts
            </button>
          )}
        </div>
      )}

      {/* Goal contribution sheet */}
      {activeGoalContrib && (() => {
        const m = GOAL_META[activeGoalContrib]
        return (
          <GoalContribSheet
            open={!!activeGoalContrib}
            onClose={() => setActiveGoalContrib(null)}
            goalId={activeGoalContrib}
            goalLabel={m?.label ?? activeGoalContrib}
            goalIcon={m?.icon ?? '⭐'}
            currency={currency}
            onSave={async (amount, note) => {
              await onContribGoal?.(activeGoalContrib, m?.label ?? activeGoalContrib, amount, note)
              setActiveGoalContrib(null)
            }}
          />
        )
      })()}

    </div>
  )

}
