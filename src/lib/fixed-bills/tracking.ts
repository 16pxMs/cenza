import { canonicalizeFixedBillKey } from './canonical'

export interface TrackedFixedExpenseEntry {
  key: string
  label: string
  monthly: number
  confidence?: string
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
  input: { key: string; label: string; monthly: number }
): TrackedFixedExpenseEntry[] {
  const canonicalKey = canonicalizeFixedBillKey(input.key)
  const monthly = Number(input.monthly)
  const nextEntries = readTrackedFixedExpenseEntries(entries)

  if (!canonicalKey || !Number.isFinite(monthly) || monthly <= 0) {
    return nextEntries
  }

  const nextEntry: TrackedFixedExpenseEntry = {
    key: canonicalKey,
    label: input.label.trim() || canonicalKey,
    monthly,
    confidence: 'known',
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
