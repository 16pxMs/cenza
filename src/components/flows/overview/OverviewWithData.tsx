// ─────────────────────────────────────────────────────────────
// OverviewWithData — Main overview screen once income is saved
//
// Card order:
//   Spending first, then goals progress (if goals exist)
// ─────────────────────────────────────────────────────────────

'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import './OverviewWithData.css'
import { fmt } from '@/lib/finance'
import { formatAmount } from '@/lib/formatting/amount'
import { calculateTotalIncome, calculateRemaining, calculatePct, calculateRemainingPct } from '@/lib/math/finance'
import { PrimaryBtn, SecondaryBtn, TertiaryBtn } from '@/components/ui/Button/Button'
import { GoalContribSheet } from './GoalContribSheet'
import { OverviewEmptyState } from './OverviewEmptyState'

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

interface IncomeData {
  income: number
  extraIncome: { id: string; label: string; amount: number }[]
  total: number
  cycleStartMode?: 'full_month' | 'mid_month'
  openingBalance?: number | null
  received?: number | null  // confirmed received this month (null = not yet confirmed)
  receivedConfirmedAt?: string | null
}

interface Props {
  name: string
  currency: string
  incomeType?: 'salaried' | 'variable' | null
  paydayDay?: number | null
  goals: string[]
  incomeData: IncomeData | null
  goalTargets: Record<string, any> | null
  goalSaved?: Record<string, number>
  goalLabels?: Record<string, string>
  onAddDebts?: () => void
  onReviewDebts?: () => void
  onLogExpense?: () => void
  onConfirmIncome?: () => void
  onContribGoal?: (goalId: string, goalLabel: string, amount: number, note: string) => Promise<void>
  totalSpent?: number
  debtTotal?: number
  fixedTotal?: number
  spendingBudget?: { categories: any[] } | null
  categorySpend?: Record<string, number>
  recentActivity?: Array<{ id: string; label: string; amount: number; date: string }>
  lastCycleRecurringTop?: { label: string; amount: number; total: number } | null
  billsLeftToPay?: {
    items: Array<{ key: string; label: string; expected: number; paid: number; leftToPay: number }>
    totalLeftToPay: number
  } | null
  isDesktop?: boolean
}

export function OverviewWithData({
  name, currency, incomeType = null, paydayDay = null, goals, incomeData,
  goalTargets, goalSaved = {}, goalLabels = {}, onAddDebts, onReviewDebts, onLogExpense, onConfirmIncome, onContribGoal,
  totalSpent = 0, debtTotal = 0, fixedTotal = 0, spendingBudget = null, categorySpend = {}, recentActivity = [], lastCycleRecurringTop = null, billsLeftToPay = null, isDesktop,
}: Props) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [goalsExpanded, setGoalsExpanded] = useState(false)
  const [activeGoalContrib, setActiveGoalContrib] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    // Warm likely next routes so taps feel immediate.
    router.prefetch('/log/new')
    router.prefetch('/log')
    router.prefetch('/income/new')
    router.prefetch('/goals/new')
  }, [router])

  // ── Income ──────────────────────────────────────────────────
  const totalIncome = incomeData
    ? calculateTotalIncome(incomeData)
    : 0

  // ── Goals ────────────────────────────────────────────────────
  const totalGoals   = goals.length
  const filledGoals  = goalTargets ? Object.keys(goalTargets).length : 0
  const isComplete   = totalGoals > 0 && filledGoals >= totalGoals
  const pendingGoals = totalGoals - filledGoals

  // ── Fade-in helper ───────────────────────────────────────────
  const fade = (delay: number): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(10px)',
    transition: `all 0.45s ease ${delay}s`,
  })

  // ── Spending card ─────────────────────────────────────────────
  const receivedConfirmed =
  incomeData?.received != null && incomeData.received > 0
  const isVariableIncome = incomeType === 'variable'
  const isSalariedIncome = incomeType === 'salaried'

const reference = receivedConfirmed
  ? Number(incomeData?.received ?? 0)
  : totalIncome
  const hasLogged = totalSpent > 0
  const isMidMonthStart = incomeData?.cycleStartMode === 'mid_month' && Number(incomeData?.openingBalance ?? 0) > 0
  const referenceBase = isMidMonthStart
    ? Number(incomeData?.openingBalance ?? 0)
    : reference

  const getDaysSinceRecentPayday = (dayOfMonth: number) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const clamp = (year: number, month: number, day: number) => {
      const maxDay = new Date(year, month + 1, 0).getDate()
      return Math.min(Math.max(day, 1), maxDay)
    }

    const thisMonthPayday = new Date(
      today.getFullYear(),
      today.getMonth(),
      clamp(today.getFullYear(), today.getMonth(), dayOfMonth)
    )

    const recentPayday = today >= thisMonthPayday
      ? thisMonthPayday
      : new Date(
          today.getFullYear(),
          today.getMonth() - 1,
          clamp(today.getFullYear(), today.getMonth() - 1, dayOfMonth)
        )

    return Math.floor((today.getTime() - recentPayday.getTime()) / (1000 * 60 * 60 * 24))
  }

  const getDaysUntilNextPayday = (dayOfMonth: number) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const clamp = (year: number, month: number, day: number) => {
      const maxDay = new Date(year, month + 1, 0).getDate()
      return Math.min(Math.max(day, 1), maxDay)
    }

    const thisMonthPayday = new Date(
      today.getFullYear(),
      today.getMonth(),
      clamp(today.getFullYear(), today.getMonth(), dayOfMonth)
    )

    const nextPayday = today <= thisMonthPayday
      ? thisMonthPayday
      : new Date(
          today.getFullYear(),
          today.getMonth() + 1,
          clamp(today.getFullYear(), today.getMonth() + 1, dayOfMonth)
        )

    return Math.floor((nextPayday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }

  const shouldShowIncomeConfirmPrompt = (() => {
    if (isMidMonthStart) return false
    if (receivedConfirmed || !onConfirmIncome) return false
    if (totalIncome <= 0) return false

    if (isVariableIncome) {
      return true
    }

    if (!isSalariedIncome) {
      return totalSpent > 0
    }

    if (!paydayDay || paydayDay <= 0) return false
    const daysSincePayday = getDaysSinceRecentPayday(paydayDay)
    const cadenceTrigger = daysSincePayday === 0 || daysSincePayday === 2
    const contextualTrigger = totalSpent > 0

    return cadenceTrigger || contextualTrigger
  })()

  const shouldPrioritizeIncomeCta =
    hasLogged && totalIncome <= 0 && !isMidMonthStart

  const daysUntilPayday = isSalariedIncome && paydayDay && paydayDay > 0
    ? getDaysUntilNextPayday(paydayDay)
    : null
  const shouldShowPlanAheadReminder =
    !!lastCycleRecurringTop &&
    !!daysUntilPayday &&
    daysUntilPayday >= 1 &&
    daysUntilPayday <= 3

  const incomeConfirmPromptText = (() => {
    if (isVariableIncome) {
      return totalSpent > 0
        ? 'You have spending logged. Confirm money received so your balance stays accurate.'
        : 'Log money received as it comes in so your balance stays real.'
    }

    if (isSalariedIncome) {
      if (!paydayDay || paydayDay <= 0) return "Set your pay day in Settings to enable cycle check-ins."
      const daysSincePayday = getDaysSinceRecentPayday(paydayDay)
      if (daysSincePayday === 0) return "It's payday. Confirm income to start this cycle clean."
      if (daysSincePayday === 2) return "Quick reminder: confirm this cycle's income."
      return 'You have spending logged. Confirm income so your remaining amount stays accurate.'
    }

    return "Confirm this cycle's income."
  })()

  const spentPct  = calculatePct(totalSpent, referenceBase)
  const isCanonicalEmpty = totalIncome <= 0 && !hasLogged && !receivedConfirmed && !isMidMonthStart

  // State B: received confirmed, nothing logged — hero is full available amount
  const stateBCard = (ref: number) => (
    <div style={{
      background: '#fff', borderRadius: 20, padding: '24px',
      marginTop: 16, boxShadow: '0 1px 10px rgba(0,0,0,0.07)',
      ...fade(0.08),
    }}>
      <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
        {isVariableIncome && !receivedConfirmed ? 'Expected this cycle' : 'Available this cycle'}
      </p>
      <p style={{ margin: '0 0 20px', fontSize: 36, fontWeight: 700, color: 'var(--text-1)', letterSpacing: -1, lineHeight: 1 }}>
        {formatAmount(ref, { currency, variant: 'full' })}
      </p>

      {/* Full green bar — tank is full */}
      <div style={{ height: 5, background: '#E5E5EA', borderRadius: 99, marginBottom: 8 }}>
        <div style={{ height: '100%', width: '100%', background: isVariableIncome && !receivedConfirmed ? 'var(--brand-dark)' : '#22C55E', borderRadius: 99 }} />
      </div>
      <p style={{ margin: '0 0 20px', fontSize: 12, color: 'var(--text-muted)' }}>
        {isVariableIncome && !receivedConfirmed
          ? 'Set as expected income. Log what actually came in to unlock a safer balance view.'
          : 'All yours — nothing spent yet'}
      </p>

      {shouldShowIncomeConfirmPrompt && (
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
              {incomeConfirmPromptText}
            </span>
            <ChevronRight size={16} color="var(--brand-dark)" strokeWidth={2.5} />
          </button>
      )}

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
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>{formatAmount(calculateRemaining(ref, totalSpent), { currency, variant: 'full' })}</p>
          </div>
        </div>
      )}

      <PrimaryBtn size="lg" onClick={onLogExpense}>
        Log your first expense
      </PrimaryBtn>
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
          {formatAmount(remaining, { currency, variant: 'full' })}
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

        {totalIncome <= 0 && !isMidMonthStart && (
          <div
            style={{
              margin: '0 0 12px',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--grey-50)',
            }}
          >
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55 }}>
              Income setup needed next. Add your income so your remaining balance is accurate.
            </p>
          </div>
        )}

        {/* Income confirmation nudge — contained strip, clearly separated from buttons */}
        {shouldShowIncomeConfirmPrompt && !shouldPrioritizeIncomeCta && (
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
              {incomeConfirmPromptText}
            </span>
            <ChevronRight size={16} color="var(--brand-dark)" strokeWidth={2.5} />
          </button>
        )}

        {shouldPrioritizeIncomeCta ? (
          <>
            <PrimaryBtn
              size="lg"
              onClick={() => router.push('/income/new?returnTo=/app')}
            >
              Add income
            </PrimaryBtn>
            <SecondaryBtn
              size="lg"
              onClick={() => router.push('/log')}
              style={{ marginTop: 10, color: 'var(--text-2)' }}
            >
              View expense log
            </SecondaryBtn>
          </>
        ) : (
          <>
            <PrimaryBtn size="lg" onClick={onLogExpense}>
              Add an expense
            </PrimaryBtn>
            <SecondaryBtn
              size="lg"
              onClick={() => router.push('/log')}
              style={{ marginTop: 10, color: 'var(--text-2)' }}
            >
              View expense log
            </SecondaryBtn>
          </>
        )}
      </div>
    )
  }

  const spendingCard = hasLogged && (totalIncome > 0 || isMidMonthStart)
    ? stateCCard(totalSpent, referenceBase)
    : hasLogged
    ? stateCCard(totalSpent, Math.max(totalSpent, 1))
    : stateBCard(referenceBase)

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
            <SecondaryBtn
              onClick={(e) => { e.stopPropagation(); router.push('/targets') }}
              size="sm"
              style={{
                width: 'auto',
                minWidth: 88,
                padding: '0 10px',
                whiteSpace: 'nowrap',
              }}
            >
              {filledGoals === 0 ? 'Set targets' : 'Continue'}
            </SecondaryBtn>
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
                          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>{label}</span>
                        </div>
                        <SecondaryBtn
                          onClick={(e) => { e.stopPropagation(); setActiveGoalContrib(gid) }}
                          size="sm"
                          style={{
                            width: 'auto',
                            minWidth: 96,
                            padding: '0 12px',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                        >
                          Add money
                        </SecondaryBtn>
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
                <TertiaryBtn
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setGoalsExpanded(ex => !ex) }}
                  style={{
                    marginTop: 14,
                    width: '100%',
                    textAlign: 'left',
                    justifyContent: 'flex-start',
                    fontSize: 13,
                  }}
                >
                  {goalsExpanded ? 'Show less' : `View ${hiddenCount} more goal${hiddenCount > 1 ? 's' : ''}`}
                </TertiaryBtn>
              )}
            </>
          )
        })()}
      </div>
    </div>
  )

  const noGoalsCard = (
    <div style={{ marginTop: 16, ...fade(0.15) }}>
      <div style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '16px',
      }}>
        <p style={{
          margin: '0 0 8px',
          fontSize: 11,
          color: 'var(--text-muted)',
          fontWeight: 600,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
        }}>
          Goals
        </p>
        <p style={{ margin: '0 0 8px', fontSize: 'var(--text-md)', fontWeight: 'var(--weight-semibold)', lineHeight: 1.3, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
          Give your money a purpose.
        </p>
        <p style={{ margin: '0 0 14px', fontSize: 13.5, lineHeight: 1.55, color: 'var(--text-2)' }}>
          Whether it is school fees, an emergency fund, or something else. Set a goal and track it here.
        </p>
        <SecondaryBtn
          size="lg"
          onClick={() => router.push('/goals/new?from=overview')}
          style={{ color: 'var(--text-1)' }}
        >
          Add your first goal
        </SecondaryBtn>
      </div>
    </div>
  )

  const debtReminderCard = (
    <div style={{ marginTop: 16, ...fade(0.18) }}>
      <div style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '16px',
      }}>
        <p style={{
          margin: '0 0 8px',
          fontSize: 11,
          color: 'var(--text-muted)',
          fontWeight: 600,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
        }}>
          Debts
        </p>
        <p style={{ margin: '0 0 8px', fontSize: 'var(--text-md)', fontWeight: 'var(--weight-semibold)', lineHeight: 1.3, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
          {debtTotal > 0 ? 'Keep debt visible.' : 'Do you have debt this cycle?'}
        </p>
        <p style={{ margin: '0 0 14px', fontSize: 13.5, lineHeight: 1.55, color: 'var(--text-2)' }}>
          {debtTotal > 0
            ? `You've logged ${fmt(debtTotal, currency)} in debt. Keep repayments here so nothing slips.`
            : 'Log loans, credit cards, and repayments so you always know what you owe.'}
        </p>
        <div style={{ display: 'grid', gap: 16 }}>
          <SecondaryBtn
            size="md"
            onClick={() => (debtTotal > 0 ? onReviewDebts?.() : onAddDebts?.())}
            style={{ width: '100%' }}
          >
            {debtTotal > 0 ? 'Review debt' : 'Add debt payment'}
          </SecondaryBtn>
          {debtTotal > 0 && (
            <TertiaryBtn
              size="sm"
              onClick={() => onAddDebts?.()}
              style={{ justifyContent: 'center' }}
            >
              Log another debt payment
            </TertiaryBtn>
          )}
        </div>
      </div>
    </div>
  )

  const planAheadCard = shouldShowPlanAheadReminder ? (
    <div style={{ marginTop: 16, ...fade(0.2) }}>
      <div style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '16px',
      }}>
        <p style={{
          margin: '0 0 8px',
          fontSize: 11,
          color: 'var(--text-muted)',
          fontWeight: 600,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
        }}>
          Plan ahead
        </p>
        <p style={{ margin: '0 0 8px', fontSize: 'var(--text-md)', fontWeight: 'var(--weight-semibold)', lineHeight: 1.3, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
          Payday is in {daysUntilPayday} {daysUntilPayday === 1 ? 'day' : 'days'}.
        </p>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: 'var(--text-2)' }}>
          Last cycle, your biggest recurring expense was {lastCycleRecurringTop?.label} ({fmt(lastCycleRecurringTop?.amount ?? 0, currency)}).
        </p>
      </div>
    </div>
  ) : null

  // ── Spending insight card (one prioritized actionable signal) ─
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const daysLeft    = daysInMonth - new Date().getDate()

  const spendingInsight = selectSpendingInsight({
    spentPct,
    daysLeft,
    totalSpent,
    currency,
    categorySpend,
    router,
  })

  const insightCard = spendingInsight ? (
    <div style={{
      marginTop: 16,
      background: 'var(--white)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '4px 20px',
      ...fade(0.22),
    }}>
      <button
        onClick={spendingInsight.onAction}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: '16px 0',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ marginTop: 1 }}>
          <AlertTriangle size={17} color="#C2410C" style={{ flexShrink: 0 }} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: '0 0 4px', fontSize: 13.5, lineHeight: 1.45, color: 'var(--text-1)', fontWeight: 600 }}>
            {spendingInsight.title}
          </p>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: 'var(--text-2)' }}>
            {spendingInsight.text}
          </p>
        </div>
        <ChevronRight size={16} color="#C2410C" strokeWidth={2} style={{ flexShrink: 0, alignSelf: 'center', opacity: 0.6 }} />
      </button>
    </div>
  ) : null

  // ── Bills left to pay card ───────────────────────────────────
  const billsCard = billsLeftToPay && billsLeftToPay.totalLeftToPay > 0 ? (
    <div style={{
      marginTop: 16,
      background: 'var(--white)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      padding: '16px 20px',
      ...fade(0.18),
    }}>
      <p style={{
        margin: '0 0 12px',
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--text-muted)',
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
      }}>
        Bills left to pay
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {billsLeftToPay.items.slice(0, 5).map((item) => (
          <div key={item.key} style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12,
          }}>
            <span style={{ fontSize: 14, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.label}
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', flexShrink: 0 }}>
              {fmt(item.leftToPay, currency)}
            </span>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 14,
        paddingTop: 12,
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Total left to pay</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>
          {fmt(billsLeftToPay.totalLeftToPay, currency)}
        </span>
      </div>
    </div>
  ) : null

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

      {isCanonicalEmpty ? (
        <OverviewEmptyState
          onLogExpense={onLogExpense}
          onCreateGoal={() => router.push('/goals/new?from=overview')}
        />
      ) : (
        <>
      {/* Card order: spending first, then insight, then goals progress */}
      {spendingCard}
      {/* Spending insight card — one prioritized actionable signal */}
      {insightCard}
      {billsCard}
      {planAheadCard}
      {totalGoals > 0 ? goalsCard : noGoalsCard}
      {debtReminderCard}
        </>
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

type SpendingInsight = {
  title: string
  text: string
  onAction: () => void
}

function formatCategoryLabel(key: string): string {
  return key.replace(/[_-]+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase())
}

function selectSpendingInsight(args: {
  spentPct: number
  daysLeft: number
  totalSpent: number
  currency: string
  categorySpend: Record<string, number>
  router: ReturnType<typeof useRouter>
}): SpendingInsight | null {
  const { spentPct, daysLeft, totalSpent, currency, categorySpend, router } = args

  // 1. Overspend (highest priority)
  if (spentPct >= 80) {
    return {
      title: `Spending is high`,
      text: `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left this month`,
      onAction: () => router.push('/log?source=pulse'),
    }
  }

  // 2. Category dominance — pool is intentionally discretionary spend only
  // (categorySpend is built from everyday + subscription transactions; fixed
  // and debt are excluded upstream), so type=everyday is the correct route.
  const entries = Object.entries(categorySpend).filter(([, amount]) => amount > 0)
  if (totalSpent > 0 && entries.length > 0) {
    const [topKey, topAmount] = entries.reduce((best, curr) => (curr[1] > best[1] ? curr : best))
    if (topAmount / totalSpent >= 0.35) {
      const label = formatCategoryLabel(topKey)
      return {
        title: `${label} is your biggest spend`,
        text: `${fmt(topAmount, currency)} this month`,
        onAction: () =>
          router.push(`/history/${encodeURIComponent(topKey)}?label=${encodeURIComponent(label)}&type=everyday&returnTo=%2Fapp`),
      }
    }
  }

  return null
}
