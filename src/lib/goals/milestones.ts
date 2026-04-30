import type { GoalId } from '@/types/database'

export interface GoalMilestoneInput {
  name: string
  amount: number | null
  targetDate?: string | null
}

export interface NormalizedGoalMilestone {
  name: string
  amount: number
  targetDate: string | null
}

export interface GoalMilestoneValidationResult {
  milestones: NormalizedGoalMilestone[]
  error: string | null
}

function formatOrdinal(index: number) {
  return `Milestone ${index + 1}`
}

export function goalMilestoneTip(goalId: GoalId, destination?: string | null) {
  if (goalId === 'emergency') {
    return 'Keep this money separate from your daily spending account. It should be accessible when needed, but not too easy to spend.'
  }

  if (goalId === 'travel' && destination?.trim()) {
    return `Small, regular contributions can make ${destination.trim()} feel much closer.`
  }

  return 'Small, regular contributions make this goal easier to maintain over time.'
}

function isValidDateString(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return (
    !Number.isNaN(parsed.getTime())
    && parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
  )
}

export function validateGoalMilestones(
  rows: GoalMilestoneInput[],
  targetAmount: number | null,
  goalTargetDate: string | null = null
): GoalMilestoneValidationResult {
  const normalized: NormalizedGoalMilestone[] = []
  const seenAmounts = new Set<number>()

  for (const [index, row] of rows.entries()) {
    const name = row.name.trim()
    const amount = row.amount
    const targetDate = row.targetDate?.trim() || null
    const label = formatOrdinal(index)

    if (!name && !targetDate && (amount == null || !Number.isFinite(amount) || amount <= 0)) {
      continue
    }

    if (!name) {
      return { milestones: [], error: `${label} needs a name.` }
    }

    if (amount == null || !Number.isFinite(amount)) {
      return { milestones: [], error: `${label} needs a target amount.` }
    }

    if (amount <= 0) {
      return { milestones: [], error: `${label} amount must be greater than 0.` }
    }

    if (targetAmount != null && amount > targetAmount) {
      return { milestones: [], error: `${label} cannot be higher than the goal target.` }
    }

    if (targetDate && !isValidDateString(targetDate)) {
      return { milestones: [], error: `${label} needs a valid target date.` }
    }

    if (targetDate && goalTargetDate && targetDate > goalTargetDate) {
      return { milestones: [], error: `${label} cannot be after the goal target date.` }
    }

    if (seenAmounts.has(amount)) {
      return { milestones: [], error: 'Milestones need different target amounts.' }
    }

    seenAmounts.add(amount)
    normalized.push({ name, amount, targetDate })
  }

  normalized.sort((a, b) => a.amount - b.amount)

  return { milestones: normalized, error: null }
}
