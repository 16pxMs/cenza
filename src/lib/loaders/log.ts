import { formatCycleLabel, getCycleByDate, profileToPaySchedule } from '@/lib/cycles'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { deriveCurrentCycleId } from '@/lib/supabase/cycles-db'
import type { UserProfile } from '@/types/database'
import { recurringExpenseKey } from '@/lib/fixed-bills/canonical'
import { loadMonthlyReminderEntriesForCycle } from '@/lib/monthly-reminders/storage'
import {
  deriveOutflowCategoryRows,
  deriveOutflowTotalFromCategories,
  isDebtOpeningBalanceTransaction,
} from '@/lib/transactions/outflow'
import { deriveCategoryBreakdown, type CategoryBreakdownRow } from '@/lib/transactions/category-breakdown'
import type { AmountFormatPreference } from '@/lib/formatting/amount'

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
  hasMonthlyReminder?: boolean
  monthlyReminderKey?: string | null
  monthlyAmount?: number | null
}

export interface LogEntry {
  id: string
  name: string
  categoryLabel: string
  categoryKey: string
  categoryType: string
  amount: number
  date: string
  note: string | null
  createdAt: string
  hasMonthlyReminder: boolean
  monthlyReminderKey: string | null
  monthlyAmount: number | null
  debtId: string | null
  debtTransactionId: string | null
  debtEntryType: string | null
}

export interface LogPageData {
  cycleLabel: string
  currency: string
  amountFormatPreference: AmountFormatPreference
  entries: LogEntry[]
  totalOutflow: number
  topOutflowCategories: CategoryBreakdownRow[]
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, c => c.toUpperCase())
}

function resolveTransactionTitle(row: {
  display_name?: string | null
  category_label?: string | null
  category_key?: string | null
}) {
  const displayName = typeof row.display_name === 'string' ? row.display_name.trim() : ''
  if (displayName) return displayName

  const categoryLabel = typeof row.category_label === 'string' ? row.category_label.trim() : ''
  if (categoryLabel) return categoryLabel

  return titleCase(row.category_key || 'Expense')
}

function resolveCategoryLabel(row: {
  category_label?: string | null
  category_key?: string | null
}) {
  const categoryLabel = typeof row.category_label === 'string' ? row.category_label.trim() : ''
  if (categoryLabel) return categoryLabel
  return titleCase(row.category_key || 'Expense')
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

  const [{ data: txns }, monthlyReminderEntries] = await Promise.all([
    (supabase.from('transactions') as any)
      .select('*')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId)
      .order('created_at', { ascending: false }),
    loadMonthlyReminderEntriesForCycle(supabase, userId, cycleId),
  ])

  const currency = profile.currency ?? 'KES'
  const txRows = (txns ?? []) as Array<{
    id: string
    display_name?: string | null
    category_key: string
    category_label: string
    category_type: string
    amount: number | string
    date: string
    note?: string | null
    created_at: string
  }>
  const visibleTxRows = txRows.filter((txn) => !isDebtOpeningBalanceTransaction(txn))
  const outflowRows = deriveOutflowCategoryRows(visibleTxRows)
  const totalOutflow = deriveOutflowTotalFromCategories(outflowRows)
  const topOutflowCategories = deriveCategoryBreakdown(visibleTxRows).slice(0, 5)

  const monthlyReminderEntriesByKey = new Map(
    monthlyReminderEntries.map((entry) => [entry.key, entry] as const)
  )
  const debtMetadataByLinkedTransactionId = await loadDebtMirrorMetadata(
    supabase,
    userId,
    visibleTxRows.filter((txn) => txn.category_type === 'debt').map((txn) => txn.id)
  )

  const entries: LogEntry[] = visibleTxRows
    .filter((txn) => txn.category_type !== 'goal')
    .map((txn) => {
      const categoryType = normalizeCategoryType(txn.category_type)
      const monthlyReminderKey =
        categoryType === 'everyday' || categoryType === 'fixed'
          ? recurringExpenseKey(categoryType, txn.category_key)
          : null
      const monthlyReminderEntry = monthlyReminderKey
        ? monthlyReminderEntriesByKey.get(monthlyReminderKey) ?? null
        : null
      const debtMetadata = categoryType === 'debt'
        ? debtMetadataByLinkedTransactionId.get(txn.id) ?? null
        : null

      return {
        id: txn.id,
        name: resolveTransactionTitle(txn),
        categoryLabel: resolveCategoryLabel(txn),
        categoryKey: txn.category_key,
        categoryType: categoryType ?? 'other',
        amount: Number(txn.amount),
        date: txn.date,
        note: txn.note ?? null,
        createdAt: txn.created_at,
        hasMonthlyReminder: !!monthlyReminderEntry,
        monthlyReminderKey: monthlyReminderEntry?.key ?? null,
        monthlyAmount: monthlyReminderEntry?.monthly ?? null,
        debtId: debtMetadata?.debtId ?? null,
        debtTransactionId: debtMetadata?.debtTransactionId ?? null,
        debtEntryType: debtMetadata?.debtEntryType ?? null,
      }
    })

  return {
    cycleLabel: formatCycleLabel(getCycleByDate(new Date(), schedule)),
    currency,
    amountFormatPreference: profile.amount_format_preference ?? 'smart',
    entries,
    totalOutflow,
    topOutflowCategories,
  }
}

export async function loadEntryById(
  userId: string,
  profile: UserProfile,
  entryId: string
): Promise<{ entry: LogEntry; currency: string } | null> {
  const supabase = await createServerSupabaseClient()
  const cycleId = deriveCurrentCycleId(profile)

  const [{ data: txn }, monthlyReminderEntries] = await Promise.all([
    (supabase.from('transactions') as any)
      .select('*')
      .eq('id', entryId)
      .eq('user_id', userId)
      .maybeSingle(),
    loadMonthlyReminderEntriesForCycle(supabase, userId, cycleId),
  ])

  if (!txn) return null
  if (isDebtOpeningBalanceTransaction(txn)) return null

  const monthlyReminderEntriesByKey = new Map(
    monthlyReminderEntries.map((entry) => [entry.key, entry] as const)
  )

  const normalizedCategoryType = normalizeCategoryType(txn.category_type)
  const monthlyReminderKey =
    normalizedCategoryType === 'everyday' || normalizedCategoryType === 'fixed'
      ? recurringExpenseKey(normalizedCategoryType, txn.category_key)
      : null
  const monthlyReminderEntry = monthlyReminderKey
    ? monthlyReminderEntriesByKey.get(monthlyReminderKey) ?? null
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
    name: resolveTransactionTitle(txn),
    categoryLabel: resolveCategoryLabel(txn),
    categoryKey: txn.category_key,
    categoryType: normalizedCategoryType ?? 'other',
    amount: Number(txn.amount),
    date: txn.date,
    note: txn.note ?? null,
    createdAt: txn.created_at,
    hasMonthlyReminder: !!monthlyReminderEntry,
    monthlyReminderKey: monthlyReminderEntry?.key ?? null,
    monthlyAmount: monthlyReminderEntry?.monthly ?? null,
    debtId: debtMetadata?.debtId ?? null,
    debtTransactionId: debtMetadata?.debtTransactionId ?? null,
    debtEntryType: debtMetadata?.debtEntryType ?? null,
  }

  return { entry, currency: profile.currency ?? 'KES' }
}
