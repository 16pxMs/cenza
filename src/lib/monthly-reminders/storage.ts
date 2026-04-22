import { canonicalizeFixedBillKey } from '@/lib/fixed-bills/canonical'

export type MonthlyStorageEntryType = 'planned' | 'monthly_reminder'

export interface PlannedMonthlyEntry {
  key: string
  label: string
  monthly: number
  entry_type: 'planned'
  confidence?: string
  priority?: 'core' | 'flex'
}

export interface MonthlyReminderEntry {
  key: string
  label: string
  monthly: number
  reminder: true
  entry_type: 'monthly_reminder'
  confidence?: string
  priority?: 'core' | 'flex'
}

type MonthlyStorageEntry = PlannedMonthlyEntry | MonthlyReminderEntry

type SupabaseLike = {
  from: (table: string) => any
}

function normalizePriority(value: unknown): 'core' | 'flex' {
  return value === 'flex' ? 'flex' : 'core'
}

function entryKey(raw: unknown) {
  const entry = (raw ?? {}) as Record<string, unknown>
  const rawKey = String(entry.key ?? '').trim()
  return canonicalizeFixedBillKey(rawKey)
}

export function isMonthlyReminderStorageEntry(raw: unknown) {
  const entry = (raw ?? {}) as Record<string, unknown>
  return entry.entry_type === 'monthly_reminder' ||
    entry.reminder === true ||
    entry.source === 'monthly_reminder'
}

function normalizeBaseEntry(raw: unknown) {
  const entry = (raw ?? {}) as Record<string, unknown>
  const key = entryKey(entry)
  const monthly = Number(entry.monthly ?? 0)

  if (!key) return null
  if (!Number.isFinite(monthly) || monthly <= 0) return null

  return {
    key,
    label: String(entry.label ?? '').trim() || key,
    monthly,
    confidence: typeof entry.confidence === 'string' ? entry.confidence : undefined,
    priority: normalizePriority(entry.priority),
  }
}

function asMonthlyReminderEntry(raw: unknown): MonthlyReminderEntry | null {
  if (!isMonthlyReminderStorageEntry(raw)) return null

  const base = normalizeBaseEntry(raw)
  if (!base) return null

  return {
    ...base,
    reminder: true,
    entry_type: 'monthly_reminder',
  }
}

function asPlannedMonthlyEntry(raw: unknown): PlannedMonthlyEntry | null {
  if (isMonthlyReminderStorageEntry(raw)) return null

  const base = normalizeBaseEntry(raw)
  if (!base) return null

  return {
    ...base,
    entry_type: 'planned',
  }
}

function normalizeStorageEntries(entries: unknown[] | null | undefined): MonthlyStorageEntry[] {
  const byKeyAndType = new Map<string, MonthlyStorageEntry>()

  for (const raw of entries ?? []) {
    const entry = asMonthlyReminderEntry(raw) ?? asPlannedMonthlyEntry(raw)
    if (!entry) continue
    byKeyAndType.set(`${entry.entry_type}:${entry.key}`, entry)
  }

  return Array.from(byKeyAndType.values())
}

export function readMonthlyReminderEntries(entries: unknown[] | null | undefined): MonthlyReminderEntry[] {
  return normalizeStorageEntries(entries).filter((entry): entry is MonthlyReminderEntry => entry.entry_type === 'monthly_reminder')
}

export function readPlannedMonthlyEntries<T = PlannedMonthlyEntry>(
  entries: unknown[] | null | undefined
): T[] {
  return normalizeStorageEntries(entries).filter((entry): entry is PlannedMonthlyEntry => entry.entry_type === 'planned') as T[]
}

export function hasMonthlyReminder(
  entries: unknown[] | null | undefined,
  key: string
): boolean {
  const canonicalKey = canonicalizeFixedBillKey(key)
  if (!canonicalKey) return false
  return readMonthlyReminderEntries(entries).some((entry) => entry.key === canonicalKey)
}

export function setMonthlyReminderEntry(
  entries: unknown[] | null | undefined,
  input: { key: string; label: string; monthly: number; priority?: 'core' | 'flex' }
): MonthlyStorageEntry[] {
  const key = canonicalizeFixedBillKey(input.key)
  const monthly = Number(input.monthly)
  const existingEntries = normalizeStorageEntries(entries)
  const existingEntry = readMonthlyReminderEntries(existingEntries).find((entry) => entry.key === key)
  const hasPriority = Object.prototype.hasOwnProperty.call(input, 'priority')
  const priority = hasPriority
    ? normalizePriority(input.priority)
    : (existingEntry?.priority ?? 'flex')

  if (!key || !Number.isFinite(monthly) || monthly <= 0) {
    return existingEntries
  }

  const nextEntry: MonthlyReminderEntry = {
    key,
    label: input.label.trim() || key,
    monthly,
    reminder: true,
    entry_type: 'monthly_reminder',
    confidence: 'known',
    priority,
  }

  return [
    ...existingEntries.filter((entry) => !(entry.entry_type === 'monthly_reminder' && entry.key === key)),
    nextEntry,
  ]
}

export function removeMonthlyReminderEntry(
  entries: unknown[] | null | undefined,
  key: string
): MonthlyStorageEntry[] {
  const canonicalKey = canonicalizeFixedBillKey(key)
  const existingEntries = normalizeStorageEntries(entries)
  if (!canonicalKey) return existingEntries

  return existingEntries.filter((entry) => !(entry.entry_type === 'monthly_reminder' && entry.key === canonicalKey))
}

function setPlannedMonthlyEntries(
  entries: unknown[] | null | undefined,
  plannedEntries: Array<{ key: string; label: string; monthly: number; confidence?: string; priority?: 'core' | 'flex' }>
): MonthlyStorageEntry[] {
  const existingReminders = readMonthlyReminderEntries(entries)
  const nextPlannedEntries = readPlannedMonthlyEntries(plannedEntries)
  return [...nextPlannedEntries, ...existingReminders]
}

export function sumPlannedMonthlyAmounts(entries: unknown[] | null | undefined): number {
  // Financial totals are protected: only explicitly planned rows count.
  return readPlannedMonthlyEntries(entries).reduce((sum, entry) => sum + entry.monthly, 0)
}

async function loadMonthlyStorageEntriesForCycle(
  supabase: SupabaseLike,
  userId: string,
  cycleId: string
): Promise<MonthlyStorageEntry[]> {
  const { data, error } = await (supabase.from('fixed_expenses') as any)
    .select('entries')
    .eq('user_id', userId)
    .eq('cycle_id', cycleId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load monthly storage entries: ${error.message}`)
  }

  return normalizeStorageEntries(data?.entries ?? null)
}

async function saveMonthlyStorageEntriesForCycle(
  supabase: SupabaseLike,
  userId: string,
  cycleId: string,
  entries: MonthlyStorageEntry[]
): Promise<void> {
  const normalizedEntries = normalizeStorageEntries(entries)
  const { error } = await (supabase.from('fixed_expenses') as any).upsert({
    user_id: userId,
    cycle_id: cycleId,
    total_monthly: sumPlannedMonthlyAmounts(normalizedEntries),
    entries: normalizedEntries,
  }, { onConflict: 'user_id,cycle_id' })

  if (error) {
    throw new Error(`Failed to save monthly storage entries: ${error.message}`)
  }
}

export async function loadMonthlyReminderEntriesForCycle(
  supabase: SupabaseLike,
  userId: string,
  cycleId: string
): Promise<MonthlyReminderEntry[]> {
  return readMonthlyReminderEntries(await loadMonthlyStorageEntriesForCycle(supabase, userId, cycleId))
}

export async function loadPlannedMonthlyEntriesForCycle(
  supabase: SupabaseLike,
  userId: string,
  cycleId: string
): Promise<PlannedMonthlyEntry[]> {
  return readPlannedMonthlyEntries(await loadMonthlyStorageEntriesForCycle(supabase, userId, cycleId))
}

export async function saveMonthlyReminderEntryForCycle(
  supabase: SupabaseLike,
  userId: string,
  cycleId: string,
  entry: { key: string; label: string; monthly: number; priority?: 'core' | 'flex' }
): Promise<void> {
  const existingEntries = await loadMonthlyStorageEntriesForCycle(supabase, userId, cycleId)
  await saveMonthlyStorageEntriesForCycle(
    supabase,
    userId,
    cycleId,
    setMonthlyReminderEntry(existingEntries, entry)
  )
}

export async function saveMonthlyReminderEntriesForCycle(
  supabase: SupabaseLike,
  userId: string,
  cycleId: string,
  entries: Array<{ key: string; label: string; monthly: number; priority?: 'core' | 'flex' }>
): Promise<void> {
  let nextEntries: MonthlyStorageEntry[] = await loadMonthlyStorageEntriesForCycle(supabase, userId, cycleId)
  for (const entry of entries) {
    nextEntries = setMonthlyReminderEntry(nextEntries, entry)
  }
  await saveMonthlyStorageEntriesForCycle(supabase, userId, cycleId, nextEntries)
}

export async function removeMonthlyReminderEntryForCycle(
  supabase: SupabaseLike,
  userId: string,
  cycleId: string,
  key: string
): Promise<void> {
  const existingEntries = await loadMonthlyStorageEntriesForCycle(supabase, userId, cycleId)
  await saveMonthlyStorageEntriesForCycle(
    supabase,
    userId,
    cycleId,
    removeMonthlyReminderEntry(existingEntries, key)
  )
}

export async function savePlannedMonthlyEntriesForCycle(
  supabase: SupabaseLike,
  userId: string,
  cycleId: string,
  entries: Array<{ key: string; label: string; monthly: number; confidence?: string; priority?: 'core' | 'flex' }>
): Promise<void> {
  const existingEntries = await loadMonthlyStorageEntriesForCycle(supabase, userId, cycleId)
  await saveMonthlyStorageEntriesForCycle(
    supabase,
    userId,
    cycleId,
    setPlannedMonthlyEntries(existingEntries, entries)
  )
}
