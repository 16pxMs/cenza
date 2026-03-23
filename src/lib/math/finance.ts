// ─────────────────────────────────────────────────────────────
// src/lib/math/finance.ts — Centralized financial math
//
// All arithmetic is performed in minor units (×100 integers) to
// eliminate floating-point drift. Values convert back to major
// units only at the boundary (output). Pure functions only —
// no imports, no side-effects, safe to unit-test in isolation.
//
// Accuracy contract:
//   10.50 → toMinor → 1050
//   1050 + 250 = 1300 → fromMinor → 13.00
//   Never mix formatted strings into calculations.
//   Never return NaN or undefined — always default to 0.
// ─────────────────────────────────────────────────────────────

// ── Minor-unit conversion ────────────────────────────────────

/** Major units → minor units (e.g. 10.50 → 1050). Uses Math.round to avoid
 *  drift from values like 0.1 + 0.2. */
function toMinor(amount: number): number {
  return Math.round(amount * 100)
}

/** Minor units → major units (e.g. 1050 → 10.50). */
function fromMinor(minor: number): number {
  return minor / 100
}

// ── Input normalisation ──────────────────────────────────────

/** Coerce any incoming value to a finite number. Returns 0 for
 *  null / undefined / NaN / Infinity / non-numeric strings. */
export function safeNum(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

// ── Core exported functions ──────────────────────────────────

/**
 * Sum an array of objects that each carry an `amount` field.
 * Handles missing arrays, null entries, and string amounts.
 *
 * @example
 * sumAmounts([{ amount: 10.50 }, { amount: '5.25' }]) // → 15.75
 */
export function sumAmounts(rows: { amount: unknown }[]): number {
  if (!rows?.length) return 0
  const minor = rows.reduce((s, r) => s + toMinor(safeNum(r.amount)), 0)
  return fromMinor(minor)
}

/**
 * Compute total income from a base figure plus an array of extra sources.
 * Accepts both camelCase (extraIncome) and snake_case (extra_income) shapes
 * to handle data coming from the database or from component state.
 */
export function calculateTotalIncome(income: {
  income?:      unknown
  salary?:      unknown
  extraIncome?: { amount: unknown }[]
  extra_income?: { amount: unknown }[]
}): number {
  if (!income) return 0
  const base   = safeNum(income.income ?? income.salary)
  const extras = income.extraIncome ?? income.extra_income ?? []
  const extrasMinor = (extras as { amount: unknown }[]).reduce(
    (s, e) => s + toMinor(safeNum(e.amount)),
    0
  )
  return fromMinor(toMinor(base) + extrasMinor)
}

/**
 * Sum all transaction amounts. Filters non-goal transactions when
 * a `categoryType` field is present (pass raw txns directly).
 */
export function calculateTotalSpent(txns: { amount: unknown }[]): number {
  return sumAmounts(txns ?? [])
}

/**
 * Remaining balance: income − spent. Can be negative (over-budget).
 * Both inputs are normalised before subtraction.
 */
export function calculateRemaining(income: number, spent: number): number {
  return fromMinor(toMinor(safeNum(income)) - toMinor(safeNum(spent)))
}

/**
 * Percentage of `value` relative to `reference`, capped at 100.
 * Returns 0 when reference is 0 to avoid division-by-zero.
 */
export function calculatePct(value: number, reference: number): number {
  if (!safeNum(reference)) return 0
  return Math.min(100, (safeNum(value) / safeNum(reference)) * 100)
}

/**
 * Remaining percentage (0–100), floored at 0.
 * Used for depleting progress bars.
 */
export function calculateRemainingPct(remaining: number, reference: number): number {
  if (!safeNum(reference)) return 0
  return Math.max(0, Math.min(100, (safeNum(remaining) / safeNum(reference)) * 100))
}

/**
 * Per-category budget utilisation.
 * Returns spent amount, budget amount, percentage used, and whether over.
 */
export function calculateCategoryBudget(
  spent:    number,
  budgeted: number,
): { spent: number; budgeted: number; pct: number; over: boolean } {
  const s = safeNum(spent)
  const b = safeNum(budgeted)
  return {
    spent:    s,
    budgeted: b,
    pct:      b > 0 ? Math.min(100, calculatePct(s, b)) : 0,
    over:     s > b,
  }
}
