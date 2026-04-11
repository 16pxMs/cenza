import { formatCycleLabel, getCycleByDate, profileToPaySchedule } from '@/lib/cycles'
import { fmt } from '@/lib/finance'
import { createClient } from '@/lib/supabase/server'
import { deriveCurrentCycleId } from '@/lib/supabase/cycles-db'
import type { UserProfile } from '@/types/database'

export type LogGroupKey = 'fixed' | 'daily' | 'debts' | 'other'

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
}

export interface LogSection {
  key: LogGroupKey
  label: string
  groupType: string
  items: LogSubItem[]
}

interface LogTransactionRow {
  id: string
  category_key: string
  category_label: string
  category_type: string
  amount: number | string
  date: string
  note?: string | null
}

const EXPENSE_LABELS: Record<string, string> = {
  rent: 'Rent',
  electricity: 'Electricity',
  water: 'Water',
  gas: 'Cooking fuel',
  internet: 'Internet',
  phone: 'Phone',
  houseKeeping: 'Housekeeping',
  blackTax: 'Black tax',
  schoolFees: 'School fees',
  childcare: 'Childcare',
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, c => c.toUpperCase())
}

function normalizeLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
}

function toSubItems(
  map: Record<string, { label: string; amount: number; latestDate?: string | null; entryCount?: number; singleEntryId?: string | null; singleEntryDate?: string | null; singleEntryNote?: string | null }>,
  groupType: string
): LogSubItem[] {
  return Object.entries(map).map(([key, { label, amount }]) => ({
    key,
    label,
    sublabel: null,
    groupType,
    loggedAmount: amount,
    latestLoggedDate: map[key].latestDate ?? null,
    entryCount: map[key].entryCount ?? 0,
    singleEntryId: map[key].singleEntryId ?? null,
    singleEntryDate: map[key].singleEntryDate ?? null,
    singleEntryNote: map[key].singleEntryNote ?? null,
    scope: 'key',
  }))
}

function mergeItemsByLabel(items: LogSubItem[]): LogSubItem[] {
  const merged = new Map<string, LogSubItem>()

  for (const item of items) {
    const normalized = normalizeLabel(item.label || item.key)
    const existing = merged.get(normalized)

    if (!existing) {
      merged.set(normalized, { ...item })
      continue
    }

    existing.loggedAmount += item.loggedAmount
    existing.plannedAmount = (existing.plannedAmount ?? 0) + (item.plannedAmount ?? 0)
    existing.entryCount = (existing.entryCount ?? 0) + (item.entryCount ?? 0)

    if (!existing.latestLoggedDate || (item.latestLoggedDate && item.latestLoggedDate > existing.latestLoggedDate)) {
      existing.latestLoggedDate = item.latestLoggedDate
    }

    if ((existing.entryCount ?? 0) > 1) {
      existing.singleEntryId = null
      existing.singleEntryDate = null
      existing.singleEntryNote = null
      existing.scope = 'label'
    }

    if (!existing.sublabel && item.sublabel) {
      existing.sublabel = item.sublabel
    }
  }

  return Array.from(merged.values()).map((item) => ({
    ...item,
    plannedAmount: item.plannedAmount && item.plannedAmount > 0 ? item.plannedAmount : undefined,
    scope: (item.entryCount ?? 0) > 1 ? 'label' : 'key',
  }))
}

export interface LogPageData {
  cycleLabel: string
  currency: string
  sections: LogSection[]
  isFirstTime: boolean
}

export async function loadLogPageData(userId: string, profile: UserProfile): Promise<LogPageData> {
  const supabase = await createClient()
  const cycleId = deriveCurrentCycleId(profile)
  const schedule = profileToPaySchedule(profile)

  const [
    { data: txns },
    { data: expenses },
    { data: budgets },
  ] = await Promise.all([
    (supabase.from('transactions') as any)
      .select('id, category_key, category_label, category_type, amount, date, note')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId),
    (supabase.from('fixed_expenses') as any)
      .select('entries')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId)
      .maybeSingle(),
    (supabase.from('spending_budgets') as any)
      .select('categories')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId)
      .maybeSingle(),
  ])

  const currency = profile.currency ?? 'KES'
  const txRows = (txns ?? []) as LogTransactionRow[]

  const logged: Record<string, number> = {}
  const latestLoggedDateByKey: Record<string, string> = {}
  const entryCountByKey: Record<string, number> = {}
  const singleEntryMetaByKey: Record<string, { id: string; date: string; note: string | null } | null> = {}
  for (const txn of txRows) {
    logged[txn.category_key] = (logged[txn.category_key] ?? 0) + Number(txn.amount)
    entryCountByKey[txn.category_key] = (entryCountByKey[txn.category_key] ?? 0) + 1
    if (!(txn.category_key in singleEntryMetaByKey)) {
      singleEntryMetaByKey[txn.category_key] = { id: txn.id, date: txn.date, note: txn.note ?? null }
    } else {
      singleEntryMetaByKey[txn.category_key] = null
    }
    if (!latestLoggedDateByKey[txn.category_key] || txn.date > latestLoggedDateByKey[txn.category_key]) {
      latestLoggedDateByKey[txn.category_key] = txn.date
    }
  }

  const fixedItems: LogSubItem[] = (expenses?.entries ?? [])
    .filter((entry: any) => entry.confidence === 'known' && entry.monthly > 0)
    .map((entry: any) => ({
      key: entry.key,
      label: EXPENSE_LABELS[entry.key] ?? titleCase(entry.label ?? entry.key),
      sublabel: fmt(entry.monthly, currency),
      groupType: 'fixed',
      loggedAmount: logged[entry.key] ?? 0,
      plannedAmount: entry.monthly,
      latestLoggedDate: latestLoggedDateByKey[entry.key] ?? null,
      entryCount: entryCountByKey[entry.key] ?? 0,
      singleEntryId: singleEntryMetaByKey[entry.key]?.id ?? null,
      singleEntryDate: singleEntryMetaByKey[entry.key]?.date ?? null,
      singleEntryNote: singleEntryMetaByKey[entry.key]?.note ?? null,
    }))

  const dailyItems: LogSubItem[] = ((budgets?.categories ?? []) as any[]).map(category => ({
    key: category.key,
    label: titleCase(category.label ?? category.key),
    sublabel: category.budget ? fmt(category.budget, currency) : null,
    groupType: 'everyday',
    loggedAmount: logged[category.key] ?? 0,
    latestLoggedDate: latestLoggedDateByKey[category.key] ?? null,
    entryCount: entryCountByKey[category.key] ?? 0,
    singleEntryId: singleEntryMetaByKey[category.key]?.id ?? null,
    singleEntryDate: singleEntryMetaByKey[category.key]?.date ?? null,
    singleEntryNote: singleEntryMetaByKey[category.key]?.note ?? null,
  }))

  const debtMap: Record<string, { label: string; amount: number; latestDate?: string | null; entryCount?: number; singleEntryId?: string | null; singleEntryDate?: string | null; singleEntryNote?: string | null }> = {}
  for (const txn of txRows) {
    if (txn.category_type !== 'debt') continue
    if (!debtMap[txn.category_key]) {
      debtMap[txn.category_key] = {
        label: titleCase(txn.category_label ?? txn.category_key),
        amount: 0,
        latestDate: null,
        entryCount: 0,
        singleEntryId: txn.id,
        singleEntryDate: txn.date,
        singleEntryNote: txn.note ?? null,
      }
    } else {
      debtMap[txn.category_key].singleEntryId = null
      debtMap[txn.category_key].singleEntryDate = null
      debtMap[txn.category_key].singleEntryNote = null
    }
    debtMap[txn.category_key].amount += Number(txn.amount)
    debtMap[txn.category_key].entryCount = (debtMap[txn.category_key].entryCount ?? 0) + 1
    if (!debtMap[txn.category_key].latestDate || txn.date > debtMap[txn.category_key].latestDate!) {
      debtMap[txn.category_key].latestDate = txn.date
    }
  }
  const debtItems = toSubItems(debtMap, 'debt')

  const knownKeys = new Set([
    ...fixedItems.map(item => item.key),
    ...dailyItems.map(item => item.key),
    ...debtItems.map(item => item.key),
  ])

  const orphanFixedMap: Record<string, { label: string; amount: number; latestDate?: string | null; entryCount?: number; singleEntryId?: string | null; singleEntryDate?: string | null; singleEntryNote?: string | null }> = {}
  const orphanDailyMap: Record<string, { label: string; amount: number; latestDate?: string | null; entryCount?: number; singleEntryId?: string | null; singleEntryDate?: string | null; singleEntryNote?: string | null }> = {}
  const otherMap: Record<string, { label: string; amount: number; latestDate?: string | null; entryCount?: number; singleEntryId?: string | null; singleEntryDate?: string | null; singleEntryNote?: string | null }> = {}

  for (const txn of txRows) {
    if (knownKeys.has(txn.category_key)) continue
    if (txn.category_type === 'debt' || txn.category_type === 'goal') continue

    const key = txn.category_key
    const label = titleCase(txn.category_label ?? key)
    const amount = Number(txn.amount)

    if (txn.category_type === 'fixed') {
      if (!orphanFixedMap[key]) orphanFixedMap[key] = { label, amount: 0, latestDate: null, entryCount: 0, singleEntryId: txn.id, singleEntryDate: txn.date, singleEntryNote: txn.note ?? null }
      else {
        orphanFixedMap[key].singleEntryId = null
        orphanFixedMap[key].singleEntryDate = null
        orphanFixedMap[key].singleEntryNote = null
      }
      orphanFixedMap[key].amount += amount
      orphanFixedMap[key].entryCount = (orphanFixedMap[key].entryCount ?? 0) + 1
      if (!orphanFixedMap[key].latestDate || txn.date > orphanFixedMap[key].latestDate!) orphanFixedMap[key].latestDate = txn.date
    } else if (txn.category_type === 'everyday') {
      if (!orphanDailyMap[key]) orphanDailyMap[key] = { label, amount: 0, latestDate: null, entryCount: 0, singleEntryId: txn.id, singleEntryDate: txn.date, singleEntryNote: txn.note ?? null }
      else {
        orphanDailyMap[key].singleEntryId = null
        orphanDailyMap[key].singleEntryDate = null
        orphanDailyMap[key].singleEntryNote = null
      }
      orphanDailyMap[key].amount += amount
      orphanDailyMap[key].entryCount = (orphanDailyMap[key].entryCount ?? 0) + 1
      if (!orphanDailyMap[key].latestDate || txn.date > orphanDailyMap[key].latestDate!) orphanDailyMap[key].latestDate = txn.date
    } else {
      if (!otherMap[key]) otherMap[key] = { label, amount: 0, latestDate: null, entryCount: 0, singleEntryId: txn.id, singleEntryDate: txn.date, singleEntryNote: txn.note ?? null }
      else {
        otherMap[key].singleEntryId = null
        otherMap[key].singleEntryDate = null
        otherMap[key].singleEntryNote = null
      }
      otherMap[key].amount += amount
      otherMap[key].entryCount = (otherMap[key].entryCount ?? 0) + 1
      if (!otherMap[key].latestDate || txn.date > otherMap[key].latestDate!) otherMap[key].latestDate = txn.date
    }
  }

  const otherItems = toSubItems(otherMap, 'everyday')

  return {
    cycleLabel: formatCycleLabel(getCycleByDate(new Date(), schedule)),
    currency,
    sections: [
      { key: 'fixed', label: 'Essentials', groupType: 'fixed', items: mergeItemsByLabel([...fixedItems, ...toSubItems(orphanFixedMap, 'fixed')]) },
      { key: 'daily', label: 'Life', groupType: 'everyday', items: mergeItemsByLabel([...dailyItems, ...toSubItems(orphanDailyMap, 'everyday')]) },
      { key: 'debts', label: 'Debt', groupType: 'debt', items: mergeItemsByLabel(debtItems) },
      ...(otherItems.length > 0
        ? [{ key: 'other' as LogGroupKey, label: 'Other', groupType: 'everyday', items: mergeItemsByLabel(otherItems) }]
        : []),
    ],
    isFirstTime: txRows.filter(txn => txn.category_type !== 'goal').length === 0,
  }
}
