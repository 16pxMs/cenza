import type { PulseSignal } from './types'

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
    title: 'You\'ve gone over',
    message: `You're ${input.currency} ${Math.abs(input.remaining).toLocaleString()} over. Take a quick look at what added up.`,
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
    message: `Add your first amount.`,
    actions: [
      { key: `goal:${input.goalId}`, label: 'Add to goal' },
    ],
  }
}
