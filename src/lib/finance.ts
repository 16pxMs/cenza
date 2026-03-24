// ─────────────────────────────────────────────────────────────
// Shared pure functions used across components.
// No side-effects — safe to unit test.
// ─────────────────────────────────────────────────────────────

import { formatAmount } from './formatting/amount'

/**
 * Compact currency formatter — delegates to formatAmount().
 *
 * Kept as a thin wrapper so existing call sites continue to work
 * without changes. Prefer formatAmount() for new code.
 */
export function fmt(n: number, cur = 'KES'): string {
  return formatAmount(n, { currency: cur, variant: 'compact' })
}

/** Format a YYYY-MM-DD date string as "Mon D" (e.g. "Mar 5") */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Dictionary confidence level based on how many times an item has been logged.
 * 1   → 'learning'  (first time seen, low confidence)
 * 2–4 → 'known'     (seen a few times, good confidence)
 * 5+  → 'trusted'   (well established)
 */
export type ConfidenceLevel = 'learning' | 'known' | 'trusted'

export function getConfidenceLevel(count: number): ConfidenceLevel {
  if (count >= 5) return 'trusted'
  if (count >= 2) return 'known'
  return 'learning'
}

export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  learning: 'Still learning this one',
  known:    'We know this one',
  trusted:  'Trusted',
}

export const CONFIDENCE_COLOR: Record<ConfidenceLevel, string> = {
  learning: '#92400E',
  known:    '#6B6B6B',
  trusted:  '#15803D',
}

/**
 * Project end-of-month spend based on daily burn rate.
 * Returns null when there is no budget or too few days of data (< 3).
 */
export interface BudgetPace {
  projectedSpend: number
  /** 'over' | 'on-track' | 'under' based on projected vs budget */
  status:   'over' | 'on-track' | 'under'
  daysLeft: number
  note:     string
}

export function getBudgetPace(
  totalSpent:  number,
  totalBudget: number,
  dayOfMonth:  number,
  daysInMonth: number,
  currency = 'KES',
): BudgetPace | null {
  if (totalBudget <= 0 || dayOfMonth < 3) return null

  const projectedSpend = Math.round((totalSpent / dayOfMonth) * daysInMonth)
  const projectedRatio = projectedSpend / totalBudget
  const daysLeft       = daysInMonth - dayOfMonth

  let status: BudgetPace['status']
  let note: string

  if (projectedRatio > 1.1) {
    status = 'over'
    note   = `Projected: ${fmt(projectedSpend, currency)} by month end`
  } else if (projectedRatio < 0.8) {
    status = 'under'
    note   = `On track. ${daysLeft} day${daysLeft === 1 ? '' : 's'} to go`
  } else {
    status = 'on-track'
    note   = `Pacing well. ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`
  }

  return { projectedSpend, status, daysLeft, note }
}
