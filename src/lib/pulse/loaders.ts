import {
  buildDuplicateSuspectSignal,
  buildHighBurnSignal,
  buildNeglectedGoalSignal,
  buildOverBudgetSignal,
} from './rules'
import { selectTopPulseSignal } from './select'
import type { DuplicateCandidate, PulseSignal } from './types'

export function loadLogPulseSignal(input: {
  duplicateCandidate: DuplicateCandidate | null
  currency: string
}): PulseSignal | null {
  return selectTopPulseSignal([
    buildDuplicateSuspectSignal(input.duplicateCandidate, input.currency),
  ])
}

export function loadOverviewPulseSignal(input: {
  remaining: number
  currency: string
  spentPct: number
  daysLeft: number
  neglectedGoalId: string | null
  neglectedGoalLabel: string | null
}): PulseSignal | null {
  return selectTopPulseSignal([
    buildOverBudgetSignal({
      remaining: input.remaining,
      currency: input.currency,
    }),
    buildHighBurnSignal({
      spentPct: input.spentPct,
      daysLeft: input.daysLeft,
    }),
    buildNeglectedGoalSignal({
      goalId: input.neglectedGoalId,
      goalLabel: input.neglectedGoalLabel,
    }),
  ])
}
