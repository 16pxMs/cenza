import { canonicalizeFixedBillKey } from './canonical'

export interface TrackedFixedExpenseEntry {
  key: string
  label: string
  monthly: number
  confidence?: string
  due_day?: number | null
  priority?: 'core' | 'flex'
}

export type TrackedFixedExpenseObligationStatus = 'overdue' | 'today' | 'soon' | 'upcoming'

export interface TrackedFixedExpenseDueState {
  isSettledForCurrentPeriod: boolean
  dueDate: string
  daysUntilDue: number
  status: TrackedFixedExpenseObligationStatus
  amountDue: number
}

function normalizeDueDay(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 28) return null
  return parsed
}

function normalizePriority(value: unknown): 'core' | 'flex' {
  return value === 'flex' ? 'flex' : 'core'
}

function asTrackedEntry(raw: unknown): TrackedFixedExpenseEntry | null {
  const entry = (raw ?? {}) as Record<string, unknown>
  const rawKey = String(entry.key ?? '').trim()
  const canonicalKey = canonicalizeFixedBillKey(rawKey)
  const monthly = Number(entry.monthly ?? 0)

  if (!canonicalKey) return null
  if (!Number.isFinite(monthly) || monthly <= 0) return null

  return {
    key: canonicalKey,
    label: String(entry.label ?? '').trim() || canonicalKey,
    monthly,
    confidence: typeof entry.confidence === 'string' ? entry.confidence : undefined,
    due_day: normalizeDueDay(entry.due_day),
    priority: normalizePriority(entry.priority),
  }
}

export function readTrackedFixedExpenseEntries(entries: unknown[] | null | undefined): TrackedFixedExpenseEntry[] {
  const byKey = new Map<string, TrackedFixedExpenseEntry>()

  for (const raw of entries ?? []) {
    const entry = asTrackedEntry(raw)
    if (!entry) continue
    byKey.set(entry.key, entry)
  }

  return Array.from(byKey.values())
}

export function isTrackedFixedExpense(
  entries: unknown[] | null | undefined,
  key: string
): boolean {
  const canonicalKey = canonicalizeFixedBillKey(key)
  if (!canonicalKey) return false
  return readTrackedFixedExpenseEntries(entries).some((entry) => entry.key === canonicalKey)
}

export function upsertTrackedFixedExpense(
  entries: unknown[] | null | undefined,
  input: { key: string; label: string; monthly: number; due_day?: number | null; priority?: 'core' | 'flex' }
): TrackedFixedExpenseEntry[] {
  const canonicalKey = canonicalizeFixedBillKey(input.key)
  const monthly = Number(input.monthly)
  const nextEntries = readTrackedFixedExpenseEntries(entries)
  const existingEntry = nextEntries.find((entry) => entry.key === canonicalKey)
  const hasDueDay = Object.prototype.hasOwnProperty.call(input, 'due_day')
  const hasPriority = Object.prototype.hasOwnProperty.call(input, 'priority')
  const dueDay = hasDueDay ? normalizeDueDay(input.due_day) : undefined
  const priority = hasPriority
    ? normalizePriority(input.priority)
    : (existingEntry?.priority ?? 'flex')

  if (!canonicalKey || !Number.isFinite(monthly) || monthly <= 0) {
    return nextEntries
  }

  const nextEntry: TrackedFixedExpenseEntry = {
    key: canonicalKey,
    label: input.label.trim() || canonicalKey,
    monthly,
    confidence: 'known',
    ...(hasDueDay ? { due_day: dueDay } : {}),
    priority,
  }

  const existingIndex = nextEntries.findIndex((entry) => entry.key === canonicalKey)
  if (existingIndex >= 0) {
    nextEntries[existingIndex] = {
      ...nextEntries[existingIndex],
      ...nextEntry,
    }
    return nextEntries
  }

  return [...nextEntries, nextEntry]
}

export function removeTrackedFixedExpense(
  entries: unknown[] | null | undefined,
  key: string
): TrackedFixedExpenseEntry[] {
  const canonicalKey = canonicalizeFixedBillKey(key)
  if (!canonicalKey) return readTrackedFixedExpenseEntries(entries)

  return readTrackedFixedExpenseEntries(entries).filter((entry) => entry.key !== canonicalKey)
}

export function sumTrackedFixedExpenses(entries: Array<{ monthly: number }>): number {
  return entries.reduce((sum, entry) => sum + Number(entry.monthly ?? 0), 0)
}

function startOfToday(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function daysBetween(fromDate: Date, toDate: Date) {
  return Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))
}

function deriveStatus(daysUntilDue: number): TrackedFixedExpenseObligationStatus {
  if (daysUntilDue < 0) return 'overdue'
  if (daysUntilDue === 0) return 'today'
  if (daysUntilDue <= 5) return 'soon'
  return 'upcoming'
}

export function deriveTrackedFixedExpenseDueState(
  entry: TrackedFixedExpenseEntry,
  cycleTransactions: Array<{ amount: number | string; category_key: string; category_type: string }>,
  todayInput = new Date()
): TrackedFixedExpenseDueState | null {
  const dueDay = normalizeDueDay(entry.due_day)
  const monthlyAmount = Number(entry.monthly ?? 0)
  if (dueDay == null) return null
  if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0) return null

  const today = startOfToday(todayInput)
  const currentDueDate = new Date(today.getFullYear(), today.getMonth(), dueDay)
  const nextDueDate = new Date(today.getFullYear(), today.getMonth() + 1, dueDay)

  const paidThisCycle = cycleTransactions.reduce((sum, txn) => {
    if (txn.category_type !== 'fixed') return sum
    const canonicalKey = canonicalizeFixedBillKey(String(txn.category_key ?? ''))
    if (canonicalKey !== entry.key) return sum
    return sum + Number(txn.amount ?? 0)
  }, 0)

  const isSettledForCurrentPeriod = paidThisCycle >= monthlyAmount
  const effectiveDueDate = isSettledForCurrentPeriod ? nextDueDate : currentDueDate
  const daysUntilDue = daysBetween(today, effectiveDueDate)

  return {
    isSettledForCurrentPeriod,
    dueDate: toDateKey(effectiveDueDate),
    daysUntilDue,
    status: deriveStatus(daysUntilDue),
    amountDue: isSettledForCurrentPeriod ? 0 : monthlyAmount,
  }
}
