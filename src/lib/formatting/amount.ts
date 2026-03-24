// ─────────────────────────────────────────────────────────────
// Currency amount formatting
//
// Three variants:
//   full    — KES 24,530     finance-safe, no abbreviation
//   compact — KES 24.5K      UI scanning, 1 decimal, strip .0
//   raw     — 24530          no currency, no formatting
//
// Rules:
//   • Negatives always format as -KES 1.5K (sign before currency)
//   • compact never aggressively rounds (2,530 → 2.5K, not 3K)
//   • full uses locale thousands separators (no abbreviation)
// ─────────────────────────────────────────────────────────────

export type AmountVariant = 'full' | 'compact' | 'raw'

export interface FormatAmountOptions {
  currency?: string
  variant?:  AmountVariant
}

const DEFAULT_CURRENCY = 'KES'

// Compact thresholds — ordered largest first.
// Extend here to support billions or beyond.
const COMPACT_THRESHOLDS = [
  { min: 1_000_000_000, suffix: 'B', divisor: 1_000_000_000 },
  { min: 1_000_000,     suffix: 'M', divisor: 1_000_000 },
  { min: 1_000,         suffix: 'K', divisor: 1_000 },
] as const

/**
 * Format a number as a currency amount.
 *
 * @param value   The numeric value to format.
 * @param options currency (default 'KES'), variant (default 'full')
 *
 * @example
 * formatAmount(24530)                                   // 'KES 24,530'
 * formatAmount(24530, { variant: 'compact' })           // 'KES 24.5K'
 * formatAmount(24530, { variant: 'raw' })               // '24530'
 * formatAmount(-1500, { currency: 'USD', variant: 'compact' }) // '-USD 1.5K'
 */
export function formatAmount(value: number, options: FormatAmountOptions = {}): string {
  const { currency = DEFAULT_CURRENCY, variant = 'full' } = options

  if (variant === 'raw') return String(value)

  if (value === 0) return `${currency} 0`

  const abs  = Math.abs(value)
  const sign = value < 0 ? '-' : ''

  if (variant === 'compact') return compactFormat(abs, sign, currency)
  return fullFormat(abs, sign, currency)
}

// ─── Variants ─────────────────────────────────────────────────

function fullFormat(abs: number, sign: string, currency: string): string {
  return `${sign}${currency} ${abs.toLocaleString()}`
}

function compactFormat(abs: number, sign: string, currency: string): string {
  for (const { min, suffix, divisor } of COMPACT_THRESHOLDS) {
    if (abs >= min) {
      const formatted = (abs / divisor).toFixed(1).replace(/\.0$/, '')
      return `${sign}${currency} ${formatted}${suffix}`
    }
  }
  // Below 1K — show as-is
  return `${sign}${currency} ${abs.toLocaleString()}`
}
