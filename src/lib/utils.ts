// ─────────────────────────────────────────────────────────────────────────────
// Utility functions
// ─────────────────────────────────────────────────────────────────────────────

// ─── Currency formatting ──────────────────────────────────────────────────────

/**
 * Format a number as a currency string.
 * e.g. fmt(1234567, 'KES') → 'KES 1.2M'
 */
export function fmt(amount: number, currency = 'KES'): string {
  if (amount >= 1_000_000) return `${currency} ${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 10_000)    return `${currency} ${(amount / 1_000).toFixed(0)}K`
  if (amount >= 1_000)     return `${currency} ${amount.toLocaleString()}`
  return `${currency} ${amount.toLocaleString()}`
}

/**
 * Full precision format — used in input displays and detail views.
 */
export function fmtFull(amount: number, currency = 'KES'): string {
  return `${currency} ${amount.toLocaleString()}`
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Returns 'YYYY-MM' for the current or given date */
export function toMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Returns 'YYYY-MM-DD' for the current or given date */
export function toDateKey(date = new Date()): string {
  return date.toISOString().split('T')[0]
}

/** Returns a human-readable month name from 'YYYY-MM' */
export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
}

/** Greeting based on current hour */
export function greeting(): 'Morning' | 'Afternoon' | 'Evening' {
  const h = new Date().getHours()
  if (h < 12) return 'Morning'
  if (h < 17) return 'Afternoon'
  return 'Evening'
}

// ─── Number helpers ───────────────────────────────────────────────────────────

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function pct(part: number, total: number): number {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

/** Months of income represented by an amount */
export function monthsOfIncome(amount: number, monthlyIncome: number): number {
  if (!monthlyIncome) return 0
  return amount / monthlyIncome
}

/** Months to save for a target at a given monthly saving rate */
export function monthsToSave(target: number, monthlySaving: number): number {
  if (!monthlySaving) return Infinity
  return Math.ceil(target / monthlySaving)
}

// ─── String helpers ───────────────────────────────────────────────────────────

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/** Generates a short unique id for client-side lists */
export function uid(): string {
  return Math.random().toString(36).slice(2, 9)
}
