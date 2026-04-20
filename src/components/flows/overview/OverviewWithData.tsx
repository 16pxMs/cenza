// ─────────────────────────────────────────────────────────────
// OverviewWithData — Main overview screen once income is saved
//
// Card order:
//   Spending first, then goals progress (if goals exist)
// ─────────────────────────────────────────────────────────────

'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import './OverviewWithData.css'
import { fmt } from '@/lib/finance'
import { formatAmount } from '@/lib/formatting/amount'
import { calculateTotalIncome, calculateRemaining, calculatePct } from '@/lib/math/finance'
import { PrimaryBtn, SecondaryBtn, TertiaryBtn } from '@/components/ui/Button/Button'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { Input } from '@/components/ui/Input/Input'
import { GoalContribSheet } from './GoalContribSheet'
import { OverviewEmptyState } from './OverviewEmptyState'
import { stopTrackingEssential, updateTrackedEssential } from '@/app/(app)/log/actions'
import type { TrackedFixedExpenseEntry } from '@/lib/fixed-bills/tracking'
import type { OverviewObligation } from '@/lib/loaders/overview'

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
  activeDebts?: Array<{ id: string }>
  incomeData: IncomeData | null
  goalTargets: Record<string, any> | null
  goalSaved?: Record<string, number>
  goalLabels?: Record<string, string>
  selectedGoal?: {
    id: string
    label: string
    target: number | null
    totalSaved: number
    createdAt: string
    lastContributionAt: string | null
    contributionCount: number
  } | null
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
  trackedEssentials?: TrackedFixedExpenseEntry[]
  billsLeftToPay?: {
    items: Array<{ key: string; label: string; expected: number; paid: number; leftToPay: number }>
    totalLeftToPay: number
  } | null
  overviewObligations?: OverviewObligation[]
  debtReminderCandidates?: Array<{
    debtId: string
    label: string
    dueDate: string
    balance: number
    state: 'upcoming' | 'due' | 'overdue'
    kind: 'financing_target' | 'standard_due'
    expectedMonthly?: number
  }>
  isDesktop?: boolean
}

export function OverviewWithData({
  name, currency, incomeType = null, paydayDay = null, goals, activeDebts = [], incomeData,
  goalTargets, goalSaved = {}, goalLabels = {}, selectedGoal = null, onAddDebts, onReviewDebts, onLogExpense, onConfirmIncome, onContribGoal,
  totalSpent = 0, debtTotal = 0, fixedTotal = 0, spendingBudget = null, categorySpend = {}, recentActivity = [], lastCycleRecurringTop = null, trackedEssentials = [], billsLeftToPay = null, overviewObligations = [], debtReminderCandidates = [], isDesktop,
}: Props) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [activeGoalContrib, setActiveGoalContrib] = useState<string | null>(null)
  const [manageEssentialsOpen, setManageEssentialsOpen] = useState(false)
  const [activeTrackedBill, setActiveTrackedBill] = useState<TrackedFixedExpenseEntry | null>(null)
  const [trackedBillLabel, setTrackedBillLabel] = useState('')
  const [trackedBillMonthlyAmount, setTrackedBillMonthlyAmount] = useState('')
  const [trackedBillErrors, setTrackedBillErrors] = useState<{ label?: string; monthlyAmount?: string }>({})
  const [savingTrackedBill, setSavingTrackedBill] = useState(false)

  const formatReminderRelativeTime = (dueDate: string, state: 'upcoming' | 'due' | 'overdue') => {
    const today = new Date()
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const target = new Date(`${dueDate}T00:00:00`)

    if (Number.isNaN(target.getTime())) return null

    const diffMs = target.getTime() - startOfToday.getTime()
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

    if (state === 'due') return null

    if (state === 'overdue') {
      const lateDays = Math.abs(diffDays)
      if (lateDays <= 0) return null
      if (lateDays === 1) return '1 day late'
      if (lateDays < 7) return `${lateDays} days late`

      const lateWeeks = Math.floor(lateDays / 7)
      if (lateWeeks === 1) return '1 week late'
      return `${lateWeeks} weeks late`
    }

    if (diffDays <= 0) return null
    if (diffDays >= 30) {
      const months = Math.floor(diffDays / 30)
      return months >= 2 ? `in ${months} months` : null
    }
    if (diffDays === 1) return 'in 1 day'
    if (diffDays < 7) return `in ${diffDays} days`

    const weeks = Math.floor(diffDays / 7)
    if (weeks === 1) return 'in 1 week'
    return `in ${weeks} weeks`
  }

  const prioritizedDebtReminders = [...debtReminderCandidates].sort((a, b) => {
    const rank = { overdue: 0, due: 1, upcoming: 2 } as const
    const byState = rank[a.state] - rank[b.state]
    if (byState !== 0) return byState
    return a.dueDate.localeCompare(b.dueDate)
  })

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
  const hasActiveDebts = activeDebts.length > 0

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

  const incomeConfirmPromptText = (() => {
    if (isVariableIncome) {
      return totalSpent > 0
        ? 'You have spending logged. Confirm money received so your balance stays accurate.'
        : 'Log money received as it comes in so your balance stays real.'
    }

    if (isSalariedIncome) {
      if (!paydayDay || paydayDay <= 0) return 'Set your pay day in Settings to enable monthly check-ins.'
      const daysSincePayday = getDaysSinceRecentPayday(paydayDay)
      if (daysSincePayday === 0) return "It's payday. Confirm income to start this month clean."
      if (daysSincePayday === 2) return "Quick reminder: confirm this month's income."
      return 'You have spending logged. Confirm income so your remaining amount stays accurate.'
    }

    return "Confirm this month's income."
  })()

  const spentPct  = calculatePct(totalSpent, referenceBase)
  const isCanonicalEmpty = totalIncome <= 0 && !hasLogged && !receivedConfirmed && !isMidMonthStart

  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const daysLeft    = daysInMonth - new Date().getDate()

  // ── Priority card resolver ────────────────────────────────────
  // Returns the single highest-priority status card, or null.
  // Order: overdue → due today → due soon (3-5 days) → setup blocker
  const resolvedPriority = (() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    function daysUntil(dateStr: string) {
      const d = new Date(`${dateStr}T00:00:00`)
      if (Number.isNaN(d.getTime())) return Infinity
      return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    }

    // 1. Overdue debt
    const overdue = prioritizedDebtReminders.find((item) => item.state === 'overdue')
    if (overdue) {
      return {
        kind: 'overdue' as const,
        title: 'Overdue payment',
        subtitle: `${overdue.label} · ${fmt(overdue.balance, currency)} left`,
        href: `/history/debt/${overdue.debtId}`,
        tone: 'danger' as const,
      }
    }

    // 2. Due today
    const dueToday = prioritizedDebtReminders.find((item) => item.state === 'due')
    if (dueToday) {
      return {
        kind: 'due_today' as const,
        title: 'Payment due today',
        subtitle: `${dueToday.label} · ${fmt(dueToday.balance, currency)} left`,
        href: `/history/debt/${dueToday.debtId}`,
        tone: 'warning' as const,
      }
    }

    // 3. Due soon (upcoming, within 3-5 days)
    const dueSoon = prioritizedDebtReminders.find(
      (item) => {
        const days = daysUntil(item.dueDate)
        return item.state === 'upcoming' && days >= 3 && days <= 5
      }
    )
    if (dueSoon) {
      const days = daysUntil(dueSoon.dueDate)
      return {
        kind: 'due_soon' as const,
        title: 'Payment coming up',
        subtitle: `${dueSoon.label} · due in ${days} ${days === 1 ? 'day' : 'days'}`,
        href: `/history/debt/${dueSoon.debtId}`,
        tone: 'warning' as const,
      }
    }

    // 4. Setup blocker (income not confirmed)
    if (shouldShowIncomeConfirmPrompt) {
      return {
        kind: 'setup' as const,
        title: 'Set your income',
        subtitle: "Your monthly summary isn't ready yet",
        href: '/income/new?returnTo=/app',
        tone: 'neutral' as const,
      }
    }

    return null
  })()

  const goalsPreviewCard = (
    <div style={{ marginTop: 16, ...fade(0.15) }}>
      <div
        onClick={() => router.push('/goals')}
        style={{
          background: 'var(--white)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '16px',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 'var(--weight-semibold)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            Goals
          </p>
          <ChevronRight size={16} color="var(--text-muted)" strokeWidth={2.2} style={{ flexShrink: 0 }} />
        </div>

        {totalGoals > 0 ? (
          <div style={{ display: 'grid', gap: 12 }}>
            {selectedGoal ? (() => {
              const target = selectedGoal.target ?? 0
              const saved = selectedGoal.totalSaved ?? 0
              const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0

              return (
                <div key={selectedGoal.id}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--text-1)' }}>{selectedGoal.label}</span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', flexShrink: 0 }}>
                      {target > 0 ? `${Math.round(pct)}%` : 'No target'}
                    </span>
                  </div>
                  <div style={{ height: 4, background: '#EDE8F5', borderRadius: 99, marginBottom: 6 }}>
                    {target > 0 && (
                      <div
                        style={{
                          height: '100%',
                          width: `${pct}%`,
                          background: pct >= 100 ? '#22C55E' : 'var(--brand-dark)',
                          borderRadius: 99,
                          minWidth: pct > 0 ? 6 : 0,
                        }}
                      />
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>
                    {target > 0 ? `${fmt(saved, currency)} of ${fmt(target, currency)}` : 'Set a target to track this goal'}
                  </p>
                </div>
              )
            })() : (
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-2)', lineHeight: 1.55 }}>
                You have no active goals.
              </p>
            )}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-2)', lineHeight: 1.55 }}>
            You have no goals yet.
          </p>
        )}
      </div>
    </div>
  )

  const priorityCard = (() => {
    if (!resolvedPriority) return null

    const toneStyles = {
      danger:  { bg: 'var(--red-light)', border: 'var(--red-border)', chevron: 'var(--red-dark)' },
      warning: { bg: 'var(--amber-light)', border: 'var(--amber-border)', chevron: 'var(--amber-dark)' },
      neutral: { bg: 'var(--white)', border: 'var(--border)', chevron: 'var(--text-3)' },
    }
    const style = toneStyles[resolvedPriority.tone]

    const handleClick = () => {
      if (resolvedPriority.href) {
        router.push(resolvedPriority.href)
      }
    }

    const isActionable = !!resolvedPriority.href

    return (
      <div style={{ marginTop: 16, ...fade(0.08) }}>
        <button
          onClick={handleClick}
          style={{
            width: '100%',
            background: style.bg,
            border: `1px solid ${style.border}`,
            borderRadius: 16,
            padding: '16px',
            cursor: isActionable ? 'pointer' : 'default',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
          disabled={!isActionable}
        >
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 4px', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-1)', lineHeight: 1.35 }}>
              {resolvedPriority.title}
            </p>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', lineHeight: 1.55, color: 'var(--text-2)' }}>
              {resolvedPriority.subtitle}
            </p>
          </div>
          {isActionable && (
            <ChevronRight size={16} color={style.chevron} strokeWidth={2} style={{ flexShrink: 0, opacity: 0.6 }} />
          )}
        </button>
      </div>
    )
  })()

  const snapshotReference =
    totalIncome > 0 || isMidMonthStart
      ? referenceBase
      : 0
  const snapshotRemaining =
    totalIncome > 0 || isMidMonthStart
      ? calculateRemaining(snapshotReference, totalSpent)
      : hasLogged
        ? -totalSpent
        : referenceBase
  const hasIncome = snapshotReference > 0
  const snapshotProgressPercent = hasIncome
    ? Math.max(0, Math.min(100, spentPct))
    : 0
  const snapshotProgressFill = spentPct > 100
    ? 'var(--red-dark)'
    : spentPct >= 80
      ? 'var(--amber-dark)'
      : 'var(--progress-fill)'
  const snapshotProgressTrack = spentPct > 100
    ? 'var(--red-light)'
    : spentPct >= 80
      ? 'var(--amber-light)'
      : 'var(--progress-track)'

  const obligationPreviewItems = overviewObligations.slice(0, 3)

  const snapshotCard = (
    <div style={{ marginTop: 16, ...fade(0.12) }}>
      <div
        style={{
          background: 'var(--white)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '16px',
        }}
      >
        {/* Eyebrow */}
        <p style={{ margin: '0 0 8px', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
          This month
        </p>

        {/* Main amount */}
        <p style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: snapshotRemaining < 0 ? 'var(--red-dark)' : 'var(--text-1)', letterSpacing: '-0.03em' }}>
          {formatAmount(snapshotRemaining, { currency, variant: 'full' })}
        </p>

        {/* Progress bar */}
        {hasIncome && (
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                height: 6,
                background: snapshotProgressTrack,
                borderRadius: 'var(--radius-full)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: mounted ? `${snapshotProgressPercent}%` : '0%',
                  background: snapshotProgressFill,
                  borderRadius: 'var(--radius-full)',
                  transition: 'width 300ms ease-out',
                }}
              />
            </div>
          </div>
        )}

        {/* Stat row */}
        {hasIncome ? (
          <div
            style={{
              marginTop: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--weight-semibold)',
                  color: 'var(--text-muted)',
                }}
              >
                Spent
              </span>
              <span
                style={{
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--weight-semibold)',
                  color: 'var(--text-1)',
                }}
              >
                {formatAmount(totalSpent, { currency, variant: 'compact' })}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--weight-semibold)',
                  color: 'var(--text-muted)',
                }}
              >
                Income
              </span>
              <span
                style={{
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--weight-semibold)',
                  color: 'var(--text-1)',
                }}
              >
                {formatAmount(snapshotReference, { currency, variant: 'compact' })}
              </span>
            </div>
          </div>
        ) : (
          <p style={{ margin: 0, marginTop: 12, fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>
            Add your income to see how much you have left.
          </p>
        )}

        {/* CTA */}
        <div style={{ marginTop: 12 }}>
          <TertiaryBtn size="sm" onClick={hasIncome ? onLogExpense : () => router.push('/income')} style={{ width: 'auto', padding: 0 }}>
            {hasIncome ? 'Log expense' : 'Set up income'}
          </TertiaryBtn>
        </div>
      </div>
    </div>
  )

  const obligationsPreviewCard = obligationPreviewItems.length > 0 ? (
    <div style={{ marginTop: 16, ...fade(0.14) }}>
      <div
        style={{
          background: 'var(--white)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '16px',
        }}
      >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-1)' }}>
          Upcoming payments
        </p>
      </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {obligationPreviewItems.map((item) => (
            <button
              key={`${item.source}-${item.id}`}
              onClick={() => router.push(item.actionHref)}
              style={{
                width: '100%',
                display: 'grid',
                gap: 6,
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--white)',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--text-1)', minWidth: 0 }}>
                  {item.name}
                </p>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-1)', flexShrink: 0 }}>
                  {fmt(item.amount, item.currency)}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>
                {item.status === 'overdue'
                  ? 'Overdue'
                  : item.status === 'today'
                    ? 'Due today'
                    : `Due in ${item.daysUntilDue} ${item.daysUntilDue === 1 ? 'day' : 'days'}`}
              </p>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 12 }}>
          {hasActiveDebts || prioritizedDebtReminders.length > 0 ? (
            <SecondaryBtn size="sm" onClick={onReviewDebts} style={{ width: '100%' }}>
              Open things to pay
            </SecondaryBtn>
          ) : (
            <SecondaryBtn size="sm" onClick={onAddDebts} style={{ width: '100%' }}>
              Add debt payment
            </SecondaryBtn>
          )}
        </div>
      </div>
    </div>
  ) : null

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className={`overview-data${isDesktop ? ' overview-data--desktop' : ''}`}>

      {/* Greeting */}
      <div className="overview-data__greeting" style={{ ...fade(0.05), display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
          </p>
          <h1 className="overview-data__heading">
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
          <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-inverse)' }}>
            {name ? name[0].toUpperCase() : '?'}
          </span>
        </button>
      </div>

      {isCanonicalEmpty ? (
        <OverviewEmptyState
          onLogExpense={onLogExpense}
          onCreateGoal={() => router.push('/goals/new?from=overview')}
        />
      ) : (
        <>
          {priorityCard}
          {snapshotCard}
          {obligationsPreviewCard}
          {goalsPreviewCard}

          {pendingGoals > 0 && (
            <div
              onClick={() => router.push('/targets')}
              style={{
                background: '#FFFBEB',
                border: '1px solid #FDE68A',
                borderRadius: 14,
                padding: '14px 16px',
                marginTop: 16,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                ...fade(0.18),
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--amber-dark)' }}>
                  Set a target for {pendingGoals} {pendingGoals === 1 ? 'goal' : 'goals'} to track progress
                </span>
              </div>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--amber-dark)', fontWeight: 'var(--weight-semibold)' }}>Do it now</span>
            </div>
          )}
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

      {manageEssentialsOpen && (
        <Sheet
          open={true}
          onClose={() => {
            setManageEssentialsOpen(false)
          }}
          title="Manage essentials"
        >
          <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-2)', lineHeight: 1.5 }}>
              Recurring essentials for this month.
            </p>
            {trackedEssentials.length > 0 ? (
              <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
                {trackedEssentials.map((item) => (
                  <div
                    key={item.key}
                    style={{
                      display: 'grid',
                      gap: 'var(--space-sm)',
                      padding: 'var(--space-md)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--white)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                      <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-1)' }}>
                        {item.label}
                      </span>
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)', flexShrink: 0 }}>
                        {fmt(item.monthly, currency)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                      <SecondaryBtn
                        size="sm"
                        onClick={() => {
                          setManageEssentialsOpen(false)
                          setActiveTrackedBill(item)
                          setTrackedBillLabel(item.label)
                          setTrackedBillMonthlyAmount(String(item.monthly))
                          setTrackedBillErrors({})
                        }}
                        style={{ width: 'auto' }}
                      >
                        Edit
                      </SecondaryBtn>
                      <TertiaryBtn
                        size="sm"
                        onClick={async () => {
                          try {
                            await stopTrackingEssential({ categoryKey: item.key })
                            setManageEssentialsOpen(false)
                            router.refresh()
                          } catch (error) {
                            console.error('[overview] stopTrackingEssential failed', error)
                          }
                        }}
                        style={{ width: 'auto', color: 'var(--red-dark)' }}
                      >
                        Remove from recurring
                      </TertiaryBtn>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-2)', lineHeight: 1.5 }}>
                No recurring essentials yet.
              </p>
            )}
          </div>
        </Sheet>
      )}

      {activeTrackedBill && (
        <Sheet
          open={true}
          onClose={() => {
            setActiveTrackedBill(null)
            setTrackedBillLabel('')
            setTrackedBillMonthlyAmount('')
            setTrackedBillErrors({})
          }}
          title={activeTrackedBill.label}
        >
          <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
            <Input
              label="Name"
              value={trackedBillLabel}
              onChange={(value) => {
                setTrackedBillLabel(value)
                setTrackedBillErrors((current) => ({ ...current, label: undefined }))
              }}
              error={trackedBillErrors.label}
            />
            <Input
              label="Monthly amount"
              type="number"
              value={trackedBillMonthlyAmount}
              onChange={(value) => {
                setTrackedBillMonthlyAmount(value)
                setTrackedBillErrors((current) => ({ ...current, monthlyAmount: undefined }))
              }}
              error={trackedBillErrors.monthlyAmount}
            />
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', lineHeight: 1.55, color: 'var(--text-2)' }}>
              This will be included in your monthly expenses.
            </p>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', lineHeight: 1.55, color: 'var(--text-2)' }}>
              Reminders will use your pay schedule by default.
            </p>
            <PrimaryBtn
              size="lg"
              onClick={async () => {
                const label = trackedBillLabel.trim()
                const monthlyAmount = parseFloat(trackedBillMonthlyAmount)
                const nextErrors: { label?: string; monthlyAmount?: string } = {}
                if (!label) {
                  nextErrors.label = 'Add a name'
                }
                if (!(monthlyAmount > 0)) {
                  nextErrors.monthlyAmount = 'Add a monthly amount'
                }
                if (Object.keys(nextErrors).length > 0) {
                  setTrackedBillErrors(nextErrors)
                  return
                }

                setSavingTrackedBill(true)
                try {
                  await updateTrackedEssential({
                    categoryKey: activeTrackedBill.key,
                    label,
                    monthlyAmount,
                  })
                  setActiveTrackedBill(null)
                  setManageEssentialsOpen(false)
                  router.refresh()
                } finally {
                  setSavingTrackedBill(false)
                }
              }}
              disabled={savingTrackedBill}
            >
              {savingTrackedBill ? 'Saving…' : 'Save changes'}
            </PrimaryBtn>
            <SecondaryBtn
              size="lg"
              onClick={async () => {
                setSavingTrackedBill(true)
                try {
                  await stopTrackingEssential({ categoryKey: activeTrackedBill.key })
                  setActiveTrackedBill(null)
                  setManageEssentialsOpen(false)
                  router.refresh()
                } finally {
                  setSavingTrackedBill(false)
                }
              }}
              disabled={savingTrackedBill}
            >
              Remove from recurring
            </SecondaryBtn>
          </div>
        </Sheet>
      )}

    </div>
  )

}
