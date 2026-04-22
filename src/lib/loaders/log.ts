import { formatCycleLabel, getCycleByDate, profileToPaySchedule } from '@/lib/cycles'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { deriveCurrentCycleId } from '@/lib/supabase/cycles-db'
import type { UserProfile } from '@/types/database'
import { recurringExpenseKey } from '@/lib/fixed-bills/canonical'
import { readTrackedFixedExpenseEntries } from '@/lib/fixed-bills/tracking'

export interface LogSubItem {
  key: string
  label: string
  sublabel: string | null
  groupType: string
  loggedAmount: number
  plannedAmount?: number
  latestLoggedDate?: string | null
  entryCount?: number
  singleEntryId?: string | null
  singleEntryDate?: string | null
  singleEntryNote?: string | null
  scope?: 'key' | 'label'
  trackedEssential?: boolean
  trackedEssentialKey?: string | null
  trackedMonthlyAmount?: number | null
}

export interface LogEntry {
  id: string
  name: string
  categoryKey: string
  categoryType: string
  amount: number
  date: string
  note: string | null
  createdAt: string
  trackedEssential: boolean
  trackedEssentialKey: string | null
  trackedMonthlyAmount: number | null
  debtId: string | null
  debtTransactionId: string | null
  debtEntryType: string | null
}

export interface LogPageData {
  cycleLabel: string
  currency: string
  entries: LogEntry[]
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, c => c.toUpperCase())
}

function normalizeCategoryType(value: string | null | undefined) {
  return value === 'essentials' ? 'fixed' : value
}

async function loadDebtMirrorMetadata(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  linkedTransactionIds: string[]
) {
  const ids = linkedTransactionIds.filter(Boolean)
  if (ids.length === 0) return new Map<string, {
    debtId: string
    debtTransactionId: string
    debtEntryType: string
  }>()

  const { data } = await (supabase.from('debt_transactions') as any)
    .select('id, debt_id, entry_type, linked_transaction_id')
    .eq('user_id', userId)
    .in('linked_transaction_id', ids)

  const rows = (data ?? []) as Array<{
    id: string
    debt_id: string
    entry_type: string
    linked_transaction_id: string
  }>

  return new Map(rows.map((row) => [
    row.linked_transaction_id,
    {
      debtId: row.debt_id,
      debtTransactionId: row.id,
      debtEntryType: row.entry_type,
    },
  ] as const))
}

export async function loadLogPageData(userId: string, profile: UserProfile): Promise<LogPageData> {
  const supabase = await createServerSupabaseClient()
  const cycleId = deriveCurrentCycleId(profile)
  const schedule = profileToPaySchedule(profile)

  const [{ data: txns }, { data: fixedExpenses }] = await Promise.all([
    (supabase.from('transactions') as any)
      .select('id, category_key, category_label, category_type, amount, date, note, created_at')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId)
      .order('created_at', { ascending: false }),
    (supabase.from('fixed_expenses') as any)
      .select('entries')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId)
      .maybeSingle(),
  ])

  const currency = profile.currency ?? 'KES'
  const txRows = (txns ?? []) as Array<{
    id: string
    category_key: string
    category_label: string
    category_type: string
    amount: number | string
    date: string
    note?: string | null
    created_at: string
  }>

  const trackedFixedEntries = readTrackedFixedExpenseEntries((fixedExpenses?.entries ?? null) as unknown[] | null)
  const trackedFixedEntriesByKey = new Map(
    trackedFixedEntries.map((entry) => [entry.key, entry] as const)
  )
  const debtMetadataByLinkedTransactionId = await loadDebtMirrorMetadata(
    supabase,
    userId,
    txRows.filter((txn) => txn.category_type === 'debt').map((txn) => txn.id)
  )

  const entries: LogEntry[] = txRows
    .filter((txn) => txn.category_type !== 'goal')
    .map((txn) => {
      const categoryType = normalizeCategoryType(txn.category_type)
      const trackedEssentialKey =
        categoryType === 'everyday' || categoryType === 'fixed'
          ? recurringExpenseKey(categoryType, txn.category_key)
          : null
      const trackedEntry = trackedEssentialKey
        ? trackedFixedEntriesByKey.get(trackedEssentialKey) ?? null
        : null
      const debtMetadata = categoryType === 'debt'
        ? debtMetadataByLinkedTransactionId.get(txn.id) ?? null
        : null

      return {
        id: txn.id,
        name: txn.category_label || titleCase(txn.category_key),
        categoryKey: txn.category_key,
        categoryType: categoryType ?? 'other',
        amount: Number(txn.amount),
        date: txn.date,
        note: txn.note ?? null,
        createdAt: txn.created_at,
        trackedEssential: !!trackedEntry,
        trackedEssentialKey: trackedEntry?.key ?? null,
        trackedMonthlyAmount: trackedEntry?.monthly ?? null,
        debtId: debtMetadata?.debtId ?? null,
        debtTransactionId: debtMetadata?.debtTransactionId ?? null,
        debtEntryType: debtMetadata?.debtEntryType ?? null,
      }
    })

  return {
    cycleLabel: formatCycleLabel(getCycleByDate(new Date(), schedule)),
    currency,
    entries,
  }
}

export async function loadEntryById(
  userId: string,
  profile: UserProfile,
  entryId: string
): Promise<{ entry: LogEntry; currency: string } | null> {
  const supabase = await createServerSupabaseClient()
  const cycleId = deriveCurrentCycleId(profile)

  const [{ data: txn }, { data: fixedExpenses }] = await Promise.all([
    (supabase.from('transactions') as any)
      .select('id, category_key, category_label, category_type, amount, date, note, created_at')
      .eq('id', entryId)
      .eq('user_id', userId)
      .maybeSingle(),
    (supabase.from('fixed_expenses') as any)
      .select('entries')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId)
      .maybeSingle(),
  ])

  if (!txn) return null

  const trackedFixedEntries = readTrackedFixedExpenseEntries((fixedExpenses?.entries ?? null) as unknown[] | null)
  const trackedFixedEntriesByKey = new Map(
    trackedFixedEntries.map((entry) => [entry.key, entry] as const)
  )

  const normalizedCategoryType = normalizeCategoryType(txn.category_type)
  const trackedEssentialKey =
    normalizedCategoryType === 'everyday' || normalizedCategoryType === 'fixed'
      ? recurringExpenseKey(normalizedCategoryType, txn.category_key)
      : null
  const trackedEntry = trackedEssentialKey
    ? trackedFixedEntriesByKey.get(trackedEssentialKey) ?? null
    : null
  const debtMetadataByLinkedTransactionId = await loadDebtMirrorMetadata(
    supabase,
    userId,
    normalizedCategoryType === 'debt' ? [txn.id] : []
  )
  const debtMetadata = normalizedCategoryType === 'debt'
    ? debtMetadataByLinkedTransactionId.get(txn.id) ?? null
    : null

  const entry: LogEntry = {
    id: txn.id,
    name: txn.category_label || titleCase(txn.category_key),
    categoryKey: txn.category_key,
    categoryType: normalizedCategoryType ?? 'other',
    amount: Number(txn.amount),
    date: txn.date,
    note: txn.note ?? null,
    createdAt: txn.created_at,
    trackedEssential: !!trackedEntry,
    trackedEssentialKey: trackedEntry?.key ?? null,
    trackedMonthlyAmount: trackedEntry?.monthly ?? null,
    debtId: debtMetadata?.debtId ?? null,
    debtTransactionId: debtMetadata?.debtTransactionId ?? null,
    debtEntryType: debtMetadata?.debtEntryType ?? null,
  }

  return { entry, currency: profile.currency ?? 'KES' }
}
