// ─────────────────────────────────────────────────────────────
// OverviewWithData — Main overview screen once income is saved
//
// Card order:
//   Spending first, then goals progress (if goals exist)
// ─────────────────────────────────────────────────────────────

'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import './OverviewWithData.css'
import { formatAmount } from '@/lib/formatting/amount'
import type { AmountFormatPreference } from '@/lib/formatting/amount'
import { calculateTotalIncome, calculateRemaining } from '@/lib/math/finance'
import { PrimaryBtn, SecondaryBtn, TertiaryBtn } from '@/components/ui/Button/Button'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { Input } from '@/components/ui/Input/Input'
import { MoneyInput } from '@/components/ui/MoneyInput/MoneyInput'
import { GoalContribSheet } from './GoalContribSheet'
import { OverviewEmptyState } from './OverviewEmptyState'
import { removeMonthlyReminder, updateMonthlyReminder } from '@/app/(app)/log/actions'
import type { MonthlyReminderEntry } from '@/lib/monthly-reminders/storage'
import type { OverviewCommitmentSummary, OverviewObligation } from '@/lib/loaders/overview'
import type { CategoryBreakdownRow } from '@/lib/transactions/category-breakdown'

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

const MONEY_FLOW_BAR_COLORS = {
  everyday: { fill: '#6366F1' },
  fixed: { fill: '#2563EB' },
  debt: { fill: '#DC2626' },
  goal: { fill: '#059669' },
  other: { fill: '#64748B' },
} as const

const MONEY_FLOW_CATEGORY_COLORS: Record<string, { fill: string }> = {
  emergency: { fill: '#059669' },
  rent: { fill: '#2563EB' },
  groceries: { fill: '#7C3AED' },
  debt_repayment: { fill: '#DC2626' },
  family_support: { fill: '#DB2777' },
}

const CONTAINER_TITLE_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--text-base)',
  fontWeight: 'var(--weight-medium)',
  color: 'var(--text-1)',
  lineHeight: 1.35,
}

const RECAP_BREAKDOWN_ROUTE = '/history'
const COMMITMENTS_ROUTE = '/commitments'
const DEBTS_ROUTE = '/history/debt'

function getMoneyFlowBarColor(category: Pick<CategoryBreakdownRow, 'categoryKey' | 'categoryType'>) {
  const keyColor = MONEY_FLOW_CATEGORY_COLORS[category.categoryKey]
  if (keyColor) return keyColor

  if (category.categoryType === 'goal') return MONEY_FLOW_BAR_COLORS.goal
  if (category.categoryType === 'fixed' || category.categoryType === 'subscription') return MONEY_FLOW_BAR_COLORS.fixed
  if (category.categoryType === 'debt') return MONEY_FLOW_BAR_COLORS.debt
  if (category.categoryType === 'everyday') return MONEY_FLOW_BAR_COLORS.everyday
  return MONEY_FLOW_BAR_COLORS.other
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
  amountFormatPreference: AmountFormatPreference
  hasStartedCycleData?: boolean
  incomeType?: 'salaried' | 'variable' | null
  paydayDay?: number | null
  goals: string[]
  activeDebts?: Array<{
    id: string
    name?: string | null
    currency?: string | null
    current_balance?: number | string | null
    status?: string | null
  }>
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
  onConfirmIncome?: () => void
  onContribGoal?: (goalId: string, goalLabel: string, amount: number, note: string) => Promise<void>
  totalSpent?: number
  debtTotal?: number
  fixedTotal?: number
  spendingBudget?: { categories: any[] } | null
  categorySpend?: Record<string, number>
  recentActivity?: Array<{ id: string; label: string; amount: number; date: string }>
  topOutflowCategories?: CategoryBreakdownRow[]
  lastCycleRecurringTop?: { label: string; amount: number; total: number } | null
  monthlyReminders?: MonthlyReminderEntry[]
  billsLeftToPay?: {
    items: Array<{ key: string; label: string; expected: number; paid: number; leftToPay: number }>
    totalLeftToPay: number
  } | null
  overviewObligations?: OverviewObligation[]
  commitmentSummary?: OverviewCommitmentSummary | null
  debtReminderCandidates?: Array<{
    debtId: string
    label: string
    dueDate: string
    balance: number
    state: 'upcoming' | 'due' | 'overdue'
    kind: 'financing_target' | 'standard_due'
    expectedMonthly?: number
  }>
  secondaryLoaded?: boolean
  isDesktop?: boolean
}

export function OverviewWithData({
  name, currency, amountFormatPreference, hasStartedCycleData = false, incomeType = null, paydayDay = null, goals, activeDebts = [], incomeData,
  goalTargets, goalSaved = {}, goalLabels = {}, selectedGoal = null, onConfirmIncome, onContribGoal,
  totalSpent = 0, debtTotal = 0, fixedTotal = 0, spendingBudget = null, categorySpend = {}, recentActivity = [], lastCycleRecurringTop = null, monthlyReminders = [], billsLeftToPay = null, overviewObligations = [], debtReminderCandidates = [], isDesktop,
  commitmentSummary = null,
  topOutflowCategories = [],
  secondaryLoaded = false,
}: Props) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [activeGoalContrib, setActiveGoalContrib] = useState<string | null>(null)
  const [manageRemindersOpen, setManageRemindersOpen] = useState(false)
  const [activeMonthlyReminder, setActiveMonthlyReminder] = useState<MonthlyReminderEntry | null>(null)
  const [monthlyReminderLabel, setMonthlyReminderLabel] = useState('')
  const [monthlyReminderAmount, setMonthlyReminderAmount] = useState('')
  const [monthlyReminderErrors, setMonthlyReminderErrors] = useState<{ label?: string; monthlyAmount?: string }>({})
  const [savingMonthlyReminder, setSavingMonthlyReminder] = useState(false)

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

  const prioritizedDebtReminders = useMemo(() => [...debtReminderCandidates].sort((a, b) => {
    const rank = { overdue: 0, due: 1, upcoming: 2 } as const
    const byState = rank[a.state] - rank[b.state]
    if (byState !== 0) return byState
    return a.dueDate.localeCompare(b.dueDate)
  }), [debtReminderCandidates])

  const formatCommitmentDueText = (item: OverviewObligation) => {
    if (item.status === 'overdue') return `${item.name} is overdue`
    if (item.status === 'today') return `${item.name} is due today`
    if (item.daysUntilDue === 1) return `${item.name} due tomorrow`
    return `${item.name} due in ${item.daysUntilDue} days`
  }

  const commitmentsCardCopy = (() => {
    // Empty/missing commitment summary is handled by hiding the card entirely
    // (see hasCommitmentsToShow below), so we can assume a non-empty summary here.
    if (!commitmentSummary) return { state: '', meta: '' }

    if (commitmentSummary.state === 'overdue' && commitmentSummary.nearestItem) {
      return {
        state: commitmentSummary.overdueCount === 1
          ? formatCommitmentDueText(commitmentSummary.nearestItem)
          : `${commitmentSummary.overdueCount} commitments overdue`,
        meta: `${commitmentSummary.activeCount} active monthly ${commitmentSummary.activeCount === 1 ? 'commitment' : 'commitments'}`,
      }
    }

    if (commitmentSummary.state === 'due_soon' && commitmentSummary.nearestItem) {
      return {
        state: formatCommitmentDueText(commitmentSummary.nearestItem),
        meta: `${commitmentSummary.activeCount} active monthly ${commitmentSummary.activeCount === 1 ? 'commitment' : 'commitments'}`,
      }
    }

    return {
      state: 'Nothing due soon',
      meta: `${commitmentSummary.activeCount} active monthly ${commitmentSummary.activeCount === 1 ? 'commitment' : 'commitments'}`,
    }
  })()

  const activeDebtRows = useMemo(() => (
    activeDebts
      .filter((debt) => debt.status === 'active' && Number(debt.current_balance) > 0)
      .sort((a, b) => Number(b.current_balance) - Number(a.current_balance))
  ), [activeDebts])
  const hasDebtSummary = activeDebtRows.length > 0
  const debtPreviewRows = activeDebtRows.slice(0, 3)
  const hiddenDebtCount = Math.max(0, activeDebtRows.length - debtPreviewRows.length)
  const totalDebtBalance = activeDebtRows.reduce(
    (sum, debt) => sum + Number(debt.current_balance ?? 0),
    0
  )

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    // Warm the most likely next routes after first paint so the initial
    // overview load is not competing with route prefetch work.
    const prefetch = () => {
      router.prefetch('/log/import?returnTo=/app')
      router.prefetch('/log')
    }

    const idleCallback = globalThis.requestIdleCallback
    if (typeof idleCallback === 'function') {
      const idleId = idleCallback(() => prefetch())
      return () => globalThis.cancelIdleCallback?.(idleId)
    }

    const timeoutId = window.setTimeout(prefetch, 250)
    return () => window.clearTimeout(timeoutId)
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
const reference = receivedConfirmed
  ? Number(incomeData?.received ?? 0)
  : totalIncome
  const hasLogged = totalSpent > 0
  const isMidMonthStart = incomeData?.cycleStartMode === 'mid_month' && Number(incomeData?.openingBalance ?? 0) > 0
  const referenceBase = isMidMonthStart
    ? Number(incomeData?.openingBalance ?? 0)
    : reference

  const shouldShowIncomeConfirmationCard =
    !isMidMonthStart &&
    !receivedConfirmed &&
    !!onConfirmIncome &&
    totalIncome > 0

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
        subtitle: `${overdue.label} · ${formatAmount(overdue.balance, { currency, preference: amountFormatPreference, context: 'summary' })} left`,
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
        subtitle: `${dueToday.label} · ${formatAmount(dueToday.balance, { currency, preference: amountFormatPreference, context: 'summary' })} left`,
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

    return null
  })()

  const goalsPreviewCard = totalGoals === 0 ? (
    <div style={{ marginTop: 16, ...fade(0.15) }}>
      <div
        style={{
          background: 'var(--white)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 16,
        }}
      >
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          borderRadius: 999,
          border: 'var(--border-width) solid var(--green-border)',
          background: 'var(--green-light)',
          color: 'var(--green-dark)',
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--weight-semibold)',
          letterSpacing: '0.02em',
          padding: '4px 10px',
          marginBottom: 10,
        }}>
          Set up your first goal
        </div>
        <p style={{ ...CONTAINER_TITLE_STYLE, marginBottom: 4 }}>
          Give your money a purpose.
        </p>
        <p style={{ margin: '0 0 14px', fontSize: 'var(--text-sm)', color: 'var(--text-2)', lineHeight: 1.5 }}>
          Whether it is school fees, an emergency fund, or something else. Set a goal and track it here.
        </p>
        <SecondaryBtn
          type="button"
          size="md"
          onClick={() => router.push('/goals/new?from=overview')}
          style={{ width: '100%' }}
        >
          Add your first goal
        </SecondaryBtn>
      </div>
    </div>
  ) : (
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
          <p style={CONTAINER_TITLE_STYLE}>
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
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-regular)', color: 'var(--text-1)' }}>{selectedGoal.label}</span>
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
                    {target > 0
                      ? `${formatAmount(saved, { currency, preference: amountFormatPreference, context: 'summary' })} of ${formatAmount(target, { currency, preference: amountFormatPreference, context: 'summary' })}`
                      : 'Set a target to track this goal'}
                  </p>
                </div>
              )
            })() : (
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-2)', lineHeight: 1.55 }}>
                You have no active goals.
              </p>
            )}
          </div>
        ) : null}
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
            <p style={{ ...CONTAINER_TITLE_STYLE, marginBottom: 4 }}>
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

  const hasIncomeConfigured = totalIncome > 0 || isMidMonthStart
  const snapshotState = !hasIncomeConfigured
    ? 'add_income'
    : shouldShowIncomeConfirmationCard
      ? 'confirm_income'
      : 'balance'
  const snapshotReference =
    hasIncomeConfigured
      ? referenceBase
      : 0
  const snapshotRemaining =
    totalIncome > 0 || isMidMonthStart
      ? calculateRemaining(snapshotReference, totalSpent)
      : hasLogged
        ? -totalSpent
        : referenceBase
  const hasIncome = snapshotState === 'balance' && snapshotReference > 0
  const snapshotRemainingRatio = hasIncome
    ? Math.max(0, Math.min(1, snapshotRemaining / snapshotReference))
    : 0
  const snapshotProgressPercent = snapshotRemainingRatio * 100
  const snapshotIsOverspent = hasIncome && snapshotRemaining < 0
  const snapshotIsAlmostOut = hasIncome && snapshotRemaining > 0 && snapshotRemaining <= snapshotReference * 0.2
  const snapshotProgressFill =
    snapshotRemaining <= 0
      ? 'var(--red)'
      : snapshotRemainingRatio > 0.5
      ? 'var(--green)'
      : snapshotRemainingRatio >= 0.2
        ? 'var(--amber)'
        : 'var(--red)'
  const snapshotProgressTrack = snapshotIsOverspent
    ? 'var(--red-light)'
    : 'var(--progress-track)'
  const snapshotMainCopy = snapshotRemaining < 0
    ? formatAmount(Math.abs(snapshotRemaining), { currency, preference: amountFormatPreference, context: 'summary' })
    : formatAmount(snapshotRemaining, { currency, preference: amountFormatPreference, context: 'summary' })
  const snapshotIncomeOnly = snapshotState === 'balance' && hasIncome && totalSpent <= 0
  const snapshotTitle =
    snapshotIncomeOnly
      ? formatAmount(snapshotReference, { currency, preference: amountFormatPreference, context: 'summary' })
      : snapshotMainCopy
  const snapshotSupportingLabel =
    snapshotIncomeOnly
      ? 'available this month'
      : snapshotRemaining < 0
        ? 'over this month'
        : 'left this month'
  const snapshotDetailCopy =
    snapshotIncomeOnly
      ? 'You haven’t logged any spending yet.'
      : snapshotRemaining < 0
        ? `You’ve used ${formatAmount(totalSpent, { currency, preference: amountFormatPreference, context: 'detail' })} against ${formatAmount(snapshotReference, { currency, preference: amountFormatPreference, context: 'detail' })} income.`
        : snapshotIsAlmostOut
          ? 'You’re running low for this month'
          : `You’ve used ${formatAmount(totalSpent, { currency, preference: amountFormatPreference, context: 'detail' })} of ${formatAmount(snapshotReference, { currency, preference: amountFormatPreference, context: 'detail' })} income.`

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
        {snapshotState === 'add_income' ? (
          <>
            <p style={CONTAINER_TITLE_STYLE}>
              Add your usual income
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-3)', lineHeight: 1.5 }}>
              to plan future months and estimate what is left
            </p>
            <div style={{ marginTop: 12 }}>
              <PrimaryBtn size="md" onClick={() => router.push('/income/new?returnTo=/app')} style={{ width: '100%' }}>
                Add usual income
              </PrimaryBtn>
            </div>
          </>
        ) : snapshotState === 'confirm_income' ? (
          <>
            <p style={CONTAINER_TITLE_STYLE}>
              Confirm this month’s income
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-3)', lineHeight: 1.5 }}>
              This updates this month only
            </p>
            <div style={{ marginTop: 12 }}>
              <PrimaryBtn size="md" onClick={onConfirmIncome} style={{ width: '100%' }}>
                Confirm income
              </PrimaryBtn>
            </div>
          </>
        ) : (
          <>
            {/* Main amount */}
            <p style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-medium)', color: snapshotIsOverspent ? 'var(--red-dark)' : 'var(--text-1)', letterSpacing: '-0.03em' }}>
              {snapshotTitle}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', color: 'var(--text-muted)', textTransform: 'lowercase' }}>
              {snapshotSupportingLabel}
            </p>
            <p style={{ margin: '8px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-3)', lineHeight: 1.5 }}>
              {snapshotDetailCopy}
            </p>

            {/* Progress bar */}
            {hasIncome && (
              <div style={{ marginTop: 12 }}>
                <div
                  style={{
                    height: 8,
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
                      fontWeight: 'var(--weight-medium)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Outflow
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--text-sm)',
                      fontWeight: 'var(--weight-medium)',
                      color: 'var(--text-1)',
                    }}
                  >
                    {formatAmount(totalSpent, { currency, preference: amountFormatPreference, context: 'compact' })}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      fontWeight: 'var(--weight-medium)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Income
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--text-sm)',
                      fontWeight: 'var(--weight-medium)',
                      color: 'var(--text-1)',
                    }}
                  >
                    {formatAmount(snapshotReference, { currency, preference: amountFormatPreference, context: 'compact' })}
                  </span>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )

  const topOutflowMaxAmount = topOutflowCategories.reduce(
    (max, category) => Math.max(max, category.totalAmount),
    0
  )

  const moneyFlowCard = topOutflowCategories.length > 0 ? (
    <div style={{ marginTop: 16, ...fade(0.13) }}>
      <div
        style={{
          background: 'var(--white)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '16px',
        }}
      >
        <p style={{ ...CONTAINER_TITLE_STYLE, marginBottom: 16 }}>
          {topOutflowCategories.length <= 2 ? 'Spending so far' : 'Your largest expenses this month'}
        </p>

        <div style={{ display: 'grid', gap: 16 }}>
          {topOutflowCategories.map((category) => {
            const colors = getMoneyFlowBarColor(category)
            const width = topOutflowMaxAmount > 0
              ? Math.max(6, Math.round((category.totalAmount / topOutflowMaxAmount) * 100))
              : 0

            return (
              <div key={category.categoryKey} style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{
                    minWidth: 0,
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--weight-medium)',
                    color: 'var(--text-2)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {category.categoryLabel}
                  </span>
                  <span style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--weight-semibold)',
                    color: 'var(--text-1)',
                    fontVariantNumeric: 'tabular-nums',
                    flexShrink: 0,
                  }}>
                    {formatAmount(category.totalAmount, { currency, preference: amountFormatPreference, context: 'summary' })}
                  </span>
                </div>
                <div aria-hidden="true" style={{ width: '100%', height: 8, display: 'flex', alignItems: 'center' }}>
                  <div style={{
                    width: `${width}%`,
                    minWidth: 24,
                    height: '100%',
                    borderRadius: 'var(--radius-full)',
                    background: colors.fill,
                  }} />
                </div>
              </div>
            )
          })}
        </div>

        <button
          type="button"
          aria-label="View monthly recap breakdown"
          onClick={() => router.push(RECAP_BREAKDOWN_ROUTE)}
          style={{
            border: 'none',
            borderTop: '1px solid var(--border-subtle)',
            background: 'transparent',
            padding: '14px 0 0',
            marginTop: 16,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            color: 'var(--brand-dark)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--weight-medium)',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span>View breakdown</span>
          <ChevronRight size={16} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  ) : null

  const hasCommitmentsToShow =
    !!commitmentSummary && commitmentSummary.state !== 'empty'
  const hasCommitmentsAreaToShow = hasCommitmentsToShow || hasDebtSummary

  const debtSummarySection = hasDebtSummary ? (
    <div style={{
      borderTop: hasCommitmentsToShow ? '1px solid var(--border-subtle)' : 'none',
      paddingTop: hasCommitmentsToShow ? 14 : 0,
      marginTop: hasCommitmentsToShow ? 14 : 0,
    }}>
      <p style={{ ...CONTAINER_TITLE_STYLE, fontSize: 'var(--text-sm)', marginBottom: 4 }}>
        Money you owe
      </p>
      <p style={{ margin: '0 0 12px', fontSize: 'var(--text-xs)', color: 'var(--text-3)', lineHeight: 1.45 }}>
        {formatAmount(totalDebtBalance, { currency, preference: amountFormatPreference, context: 'summary' })} across {activeDebtRows.length} {activeDebtRows.length === 1 ? 'debt' : 'debts'}
      </p>
      <div style={{ display: 'grid', gap: 8 }}>
        {debtPreviewRows.map((debt) => (
          <div
            key={debt.id}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <span style={{
              minWidth: 0,
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--weight-medium)',
              color: 'var(--text-2)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {debt.name?.trim() || 'Untitled debt'}
            </span>
            <span style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--weight-medium)',
              color: 'var(--text-1)',
              fontVariantNumeric: 'tabular-nums',
              flexShrink: 0,
            }}>
              {formatAmount(Number(debt.current_balance ?? 0), {
                currency: debt.currency || currency,
                preference: amountFormatPreference,
                context: 'row',
              })}
            </span>
          </div>
        ))}
        {hiddenDebtCount > 0 ? (
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-3)', lineHeight: 1.45 }}>
            +{hiddenDebtCount} more {hiddenDebtCount === 1 ? 'debt' : 'debts'}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => router.push(DEBTS_ROUTE)}
        style={{
          border: 'none',
          borderTop: '1px solid var(--border-subtle)',
          background: 'transparent',
          padding: '12px 0 0',
          marginTop: 14,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          color: 'var(--brand-dark)',
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--weight-medium)',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
        }}
      >
        <span>View debts</span>
        <ChevronRight size={14} strokeWidth={2.2} />
      </button>
    </div>
  ) : null

  const obligationsPreviewCard = !hasCommitmentsAreaToShow ? null : (
    <div style={{ marginTop: 16, ...fade(0.14) }}>
      {hasCommitmentsToShow && !hasDebtSummary ? (
        <button
          type="button"
          aria-label="View commitments"
          onClick={() => router.push(COMMITMENTS_ROUTE)}
          style={{
            width: '100%',
            background: 'var(--white)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: '14px 16px',
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: 'inherit',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
            <p style={{ ...CONTAINER_TITLE_STYLE, fontSize: 'var(--text-sm)' }}>
              Upcoming commitments
            </p>
            <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--brand-dark)', flexShrink: 0 }}>
              <ChevronRight size={12} color="var(--text-3)" strokeWidth={2.2} />
            </span>
          </div>

          <p style={{ margin: '0 0 3px', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: commitmentSummary?.state === 'overdue' ? 'var(--red-dark)' : 'var(--text-1)', lineHeight: 1.35 }}>
            {commitmentsCardCopy.state}
          </p>
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-3)', lineHeight: 1.45 }}>
            {commitmentsCardCopy.meta}
          </p>
        </button>
      ) : (
        <div
          style={{
            width: '100%',
            background: 'var(--white)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: '14px 16px',
            textAlign: 'left',
            fontFamily: 'inherit',
          }}
        >
          {hasCommitmentsToShow ? (
            <button
              type="button"
              aria-label="View commitments"
              onClick={() => router.push(COMMITMENTS_ROUTE)}
              style={{
                border: 'none',
                background: 'transparent',
                padding: 0,
                margin: 0,
                width: '100%',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                <p style={{ ...CONTAINER_TITLE_STYLE, fontSize: 'var(--text-sm)' }}>
                  Upcoming commitments
                </p>
                <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--brand-dark)', flexShrink: 0 }}>
                  <ChevronRight size={12} color="var(--text-3)" strokeWidth={2.2} />
                </span>
              </div>

              <p style={{ margin: '0 0 3px', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: commitmentSummary?.state === 'overdue' ? 'var(--red-dark)' : 'var(--text-1)', lineHeight: 1.35 }}>
                {commitmentsCardCopy.state}
              </p>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-3)', lineHeight: 1.45 }}>
                {commitmentsCardCopy.meta}
              </p>
            </button>
          ) : null}

          {debtSummarySection}
        </div>
      )}
    </div>
  )

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
          <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', color: 'var(--text-inverse)' }}>
            {name ? name[0].toUpperCase() : '?'}
          </span>
        </button>
      </div>

      {!hasStartedCycleData ? (
        <OverviewEmptyState
          onCreateGoal={() => router.push('/goals/new?from=overview')}
        />
      ) : (
        <>
          {priorityCard}
          {snapshotCard}
          {secondaryLoaded ? moneyFlowCard : null}
          {secondaryLoaded ? obligationsPreviewCard : null}
          {secondaryLoaded ? goalsPreviewCard : null}

          {secondaryLoaded && pendingGoals > 0 && (
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
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--amber-dark)', fontWeight: 'var(--weight-medium)' }}>Do it now</span>
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

      {manageRemindersOpen && (
        <Sheet
          open={true}
          onClose={() => {
            setManageRemindersOpen(false)
          }}
          title="Manage reminders"
        >
          <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-2)', lineHeight: 1.5 }}>
              Monthly reminders for this month.
            </p>
            {monthlyReminders.length > 0 ? (
              <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
                {monthlyReminders.map((item) => (
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
                      <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', color: 'var(--text-1)' }}>
                        {item.label}
                      </span>
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)', flexShrink: 0 }}>
                        {formatAmount(item.monthly, { currency, preference: amountFormatPreference, context: 'row' })}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                      <SecondaryBtn
                        size="sm"
                        onClick={() => {
                          setManageRemindersOpen(false)
                          setActiveMonthlyReminder(item)
                          setMonthlyReminderLabel(item.label)
                          setMonthlyReminderAmount(String(item.monthly))
                          setMonthlyReminderErrors({})
                        }}
                        style={{ width: 'auto' }}
                      >
                        Edit
                      </SecondaryBtn>
                      <TertiaryBtn
                        size="sm"
                        onClick={async () => {
                          try {
                            await removeMonthlyReminder({ categoryKey: item.key })
                            setManageRemindersOpen(false)
                            router.refresh()
                          } catch (error) {
                            console.error('[overview] removeMonthlyReminder failed', error)
                          }
                        }}
                        style={{ width: 'auto', color: 'var(--red-dark)' }}
                      >
                        Remove monthly reminder
                      </TertiaryBtn>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-2)', lineHeight: 1.5 }}>
                No monthly reminders yet.
              </p>
            )}
          </div>
        </Sheet>
      )}

      {activeMonthlyReminder && (
        <Sheet
          open={true}
          onClose={() => {
            setActiveMonthlyReminder(null)
            setMonthlyReminderLabel('')
            setMonthlyReminderAmount('')
            setMonthlyReminderErrors({})
          }}
          title={activeMonthlyReminder.label}
        >
          <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
            <Input
              label="Name"
              value={monthlyReminderLabel}
              onChange={(value) => {
                setMonthlyReminderLabel(value)
                setMonthlyReminderErrors((current) => ({ ...current, label: undefined }))
              }}
              error={monthlyReminderErrors.label}
            />
            <MoneyInput
              label="Monthly amount"
              value={monthlyReminderAmount}
              onChange={(value) => {
                setMonthlyReminderAmount(value)
                setMonthlyReminderErrors((current) => ({ ...current, monthlyAmount: undefined }))
              }}
              currency={currency}
              error={monthlyReminderErrors.monthlyAmount}
            />
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', lineHeight: 1.55, color: 'var(--text-2)' }}>
              This amount is used for your monthly reminder.
            </p>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', lineHeight: 1.55, color: 'var(--text-2)' }}>
              Reminders will use your pay schedule by default.
            </p>
            <PrimaryBtn
              size="lg"
              onClick={async () => {
                const label = monthlyReminderLabel.trim()
                const monthlyAmount = parseFloat(monthlyReminderAmount)
                const nextErrors: { label?: string; monthlyAmount?: string } = {}
                if (!label) {
                  nextErrors.label = 'Add a name'
                }
                if (!(monthlyAmount > 0)) {
                  nextErrors.monthlyAmount = 'Add a monthly amount'
                }
                if (Object.keys(nextErrors).length > 0) {
                  setMonthlyReminderErrors(nextErrors)
                  return
                }

                setSavingMonthlyReminder(true)
                try {
                  await updateMonthlyReminder({
                    categoryKey: activeMonthlyReminder.key,
                    label,
                    monthlyAmount,
                  })
                  setActiveMonthlyReminder(null)
                  setManageRemindersOpen(false)
                  router.refresh()
                } finally {
                  setSavingMonthlyReminder(false)
                }
              }}
              disabled={savingMonthlyReminder}
            >
              {savingMonthlyReminder ? 'Saving…' : 'Save changes'}
            </PrimaryBtn>
            <SecondaryBtn
              size="lg"
              onClick={async () => {
                setSavingMonthlyReminder(true)
                try {
                  await removeMonthlyReminder({ categoryKey: activeMonthlyReminder.key })
                  setActiveMonthlyReminder(null)
                  setManageRemindersOpen(false)
                  router.refresh()
                } finally {
                  setSavingMonthlyReminder(false)
                }
              }}
              disabled={savingMonthlyReminder}
            >
              Remove monthly reminder
            </SecondaryBtn>
          </div>
        </Sheet>
      )}

    </div>
  )

}
