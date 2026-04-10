import type { DuplicateCandidate, PulseSignal } from './types'

function parseLocalDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

export function buildDuplicateSuspectSignal(
  candidate: DuplicateCandidate | null,
  currency: string
): PulseSignal | null {
  if (!candidate) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const entryDate = parseLocalDate(candidate.date)
  entryDate.setHours(0, 0, 0, 0)

  const diffDays = Math.round((today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0 || diffDays > 3) return null

  const when =
    diffDays === 0 ? 'today' :
    diffDays === 1 ? 'yesterday' :
    `${diffDays} days ago`

  return {
    type: 'duplicate_suspect',
    surface: 'log_review',
    key: `duplicate:${candidate.id}`,
    priority: 100,
    title: 'Possible duplicate',
    message: `You logged this ${when} for ${currency} ${candidate.amount.toLocaleString()}.`,
    actions: [
      { key: 'new', label: 'New entry' },
      { key: 'update', label: 'Update last' },
    ],
  }
}

export function buildOverBudgetSignal(input: {
  remaining: number
  currency: string
}): PulseSignal | null {
  if (input.remaining >= 0) return null
  return {
    type: 'trend_shift',
    surface: 'overview',
    key: 'overview:over_budget',
    priority: 100,
    title: 'You are over this month',
    message: `You are ${input.currency} ${Math.abs(input.remaining).toLocaleString()} over. Review entries and adjust early.`,
    actions: [
      { key: 'open_log', label: 'Open expense log' },
    ],
  }
}

export function buildHighBurnSignal(input: {
  spentPct: number
  daysLeft: number
}): PulseSignal | null {
  if (input.spentPct <= 75 || input.daysLeft <= 7) return null
  return {
    type: 'trend_shift',
    surface: 'overview',
    key: 'overview:high_burn',
    priority: 80,
    title: 'Spending is moving fast',
    message: `${Math.round(input.spentPct)}% is already spent with ${input.daysLeft} days left in this cycle.`,
    actions: [
      { key: 'open_log', label: 'Check expense log' },
    ],
  }
}

export function buildNeglectedGoalSignal(input: {
  goalId: string | null
  goalLabel: string | null
}): PulseSignal | null {
  if (!input.goalId || !input.goalLabel) return null
  return {
    type: 'missing_essential',
    surface: 'overview',
    key: `overview:goal:${input.goalId}`,
    priority: 60,
    title: `${input.goalLabel} is waiting`,
    message: `No money has been added to this goal this month yet.`,
    actions: [
      { key: `goal:${input.goalId}`, label: 'Add to goal' },
    ],
  }
}
