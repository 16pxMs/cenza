'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { getAppSession } from '@/lib/auth/app-session'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { buildTransactionRecord } from '@/lib/supabase/transactions-db'
import type { CategoryType } from '@/types/database'
import { deriveCycleIdForDate } from '@/lib/supabase/cycles-db'
import { getCycleByDate, profileToPaySchedule, toLocalDateStr } from '@/lib/cycles'
import {
  parseSmsBlob,
  parsePastExpenseCsv,
  parsePastExpenseLines,
  parseSimpleExpenseLines,
  getCsvMappingRequest,
  analyzeCsvImportProfile,
  type CsvImportMapping,
  type CsvImportProfileAnalysis,
  type ImportCategoryType,
  type ImportParseStatus,
  type ParsedSmsExpense,
} from '@/lib/sms-import/parser'
import { ok, runAction, unauthorized, type ActionResult } from '@/lib/actions/result'
import { canonicalizeFixedBillKey, recurringExpenseKey } from '@/lib/fixed-bills/canonical'
import { buildDictionaryCategoryWriteRecord } from '@/lib/categories/dictionary-write'
import {
  loadActiveCustomCategories,
  loadCustomCategoryMap,
  normalizeCustomCategoryType,
  resolveCustomCategoryForWrite,
  slugifyCustomCategoryLabel,
  type CategoryOption,
  type ResolvedWriteCategory,
} from '@/lib/categories/catalog'
import { getCategoryConfig } from '@/lib/categories/config'
import { DUPLICATE_MESSAGE } from './state'
import {
  loadMonthlyReminderEntriesForCycle,
  saveMonthlyReminderEntriesForCycle,
} from '@/lib/monthly-reminders/storage'
import { deriveCurrentCycleId, getCycleIdForDate } from '@/lib/supabase/cycles-db'
import { addDebtTransaction, getDebt, getDebtTransactions } from '@/lib/supabase/debt-db'
import { logPerfSpan, timePerf } from '@/lib/perf/debug'

interface ParsedRowInput {
  id: string
  label: string
  // Past-mode imports may submit rows without a category. Current-mode imports
  // are still validated to require both.
  categoryType: ImportCategoryType | null
  categoryKey: string
  customCategoryId?: string | null
  amount: number
  date: string
  sourceHash: string
  blockedReason?: string | null
  repeatsMonthly?: boolean
  debtId?: string | null
}

export type ImportMode = 'current' | 'past'
export type ImportInputSource = 'text' | 'csv'

export interface CustomCategoryOption extends CategoryOption {
  type: Extract<ImportCategoryType, 'everyday' | 'fixed'>
  created_at?: string
}

export interface ActiveDebtOption {
  id: string
  name: string
  currency: string
  currentBalance: number
  direction: 'owed_by_me' | 'owed_to_me'
}

export async function loadActiveDebts(): Promise<ActionResult<ActiveDebtOption[]>> {
  return runAction<ActiveDebtOption[]>(async () => {
    const { user } = await getAppSession()
    if (!user) return unauthorized()

    const supabase = await createServerSupabaseClient()
    const { data, error } = await (supabase.from('debts') as any)
      .select('id, name, currency, current_balance, direction')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to load debts: ${error.message}`)
    }

    return ok(
      (data ?? []).map((row: any) => ({
        id: row.id,
        name: row.name,
        currency: row.currency,
        currentBalance: Number(row.current_balance),
        direction: row.direction,
      }))
    )
  })
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function normalizeCategoryType(value: string | null | undefined): ImportCategoryType | null {
  if (value === 'essentials' || value === 'fixed') return 'fixed'
  if (value === 'everyday' || value === 'debt') return value
  return null
}

async function rememberDictionaryItems(
  supabase: any,
  userId: string,
  items: Array<{
    label: string
    categoryKey: string
    categoryType: ImportCategoryType
    customCategory?: ResolvedWriteCategory | null
  }>
) {
  const usageInBatch = new Map<string, number>()
  const latestItemByNormalized = new Map<string, ReturnType<typeof buildDictionaryCategoryWriteRecord>>()

  for (const item of items) {
    const dictionaryRecord = buildDictionaryCategoryWriteRecord({
      nameNormalizedSource: item.label,
      categoryType: item.categoryType,
      categoryKey: item.categoryKey,
      categoryLabel: item.label,
      customCategory: item.customCategory,
    })
    usageInBatch.set(
      dictionaryRecord.nameNormalized,
      (usageInBatch.get(dictionaryRecord.nameNormalized) ?? 0) + 1
    )
    latestItemByNormalized.set(dictionaryRecord.nameNormalized, dictionaryRecord)
  }

  const normalizedNames = Array.from(latestItemByNormalized.keys())
  if (normalizedNames.length === 0) return

  const table = supabase.from('item_dictionary') as any
  const { data: existingRows, error: existingError } = await table
    .select('name_normalized,usage_count')
    .eq('user_id', userId)
    .in('name_normalized', normalizedNames)

  if (existingError) {
    throw new Error(`Failed to load remembered items: ${existingError.message}`)
  }

  const existingUsage = new Map<string, number>()
  for (const row of existingRows ?? []) {
    if (!row?.name_normalized) continue
    existingUsage.set(String(row.name_normalized), Number(row.usage_count ?? 0))
  }

  const upserts = normalizedNames.map((normalized) => {
    const item = latestItemByNormalized.get(normalized)!
    return {
      user_id: userId,
      name_normalized: normalized,
      label: item.label,
      category_key: item.categoryKey,
      category_type: item.categoryType,
      custom_category_id: item.customCategoryId,
      usage_count: (existingUsage.get(normalized) ?? 0) + (usageInBatch.get(normalized) ?? 0),
    }
  })

  const { error } = await table.upsert(upserts, { onConflict: 'user_id,name_normalized' })
  if (error) {
    throw new Error(`Failed to remember items: ${error.message}`)
  }
}

export async function loadSmsCustomCategories(): Promise<ActionResult<CustomCategoryOption[]>> {
  return runAction<CustomCategoryOption[]>(async () => {
    const { user } = await getAppSession()
    if (!user) return unauthorized()

    const supabase = await createServerSupabaseClient()
    const categories = await loadActiveCustomCategories(supabase, user.id)
    return ok(categories.map((category) => ({
      ...category,
      customCategoryId: category.id,
      source: 'custom' as const,
    })))
  })
}

export async function createSmsCustomCategory(input: {
  label: string
  type: 'everyday' | 'fixed'
}): Promise<ActionResult<CustomCategoryOption>> {
  return runAction<CustomCategoryOption>(async () => {
    const startedAt = Date.now()
    const flow = 'sms-import.custom-category'
    const { user } = await getAppSession()
    if (!user) return unauthorized()

    const label = input.label.trim().replace(/\s+/g, ' ')
    const type = normalizeCustomCategoryType(input.type)
    if (!label) {
      throw new Error('Category name is required.')
    }
    if (!type) {
      throw new Error('Category type is invalid.')
    }

    const supabase = await timePerf(flow, 'supabase-init', async () => createServerSupabaseClient())
    const existing = await timePerf(flow, 'custom-category-load', async () =>
      loadActiveCustomCategories(supabase, user.id)
    )
    const duplicate = existing.find((category) =>
      category.type === type &&
      normalize(category.label) === normalize(label)
    )
    if (duplicate) {
      const response = ok({
        ...duplicate,
        customCategoryId: duplicate.id,
        source: 'custom' as const,
      })
      logPerfSpan(flow, 'total', startedAt, {
        duplicate: true,
        existingCount: existing.length,
      })
      return response
    }

    const usedKeys = new Set(existing.map((category) => category.key))
    let baseKey = slugifyCustomCategoryLabel(label) || 'custom_category'
    if (getCategoryConfig(baseKey)) baseKey = `custom_${baseKey}`
    let key = baseKey
    let suffix = 2
    while (usedKeys.has(key) || getCategoryConfig(key)) {
      key = `${baseKey}_${suffix}`
      suffix += 1
    }

    const { data, error } = await timePerf(flow, 'custom-category-insert', async () =>
      (supabase.from('custom_categories') as any)
        .insert({
          user_id: user.id,
          key,
          label,
          type,
        })
        .select('id,user_id,key,label,type,archived_at,created_at,updated_at')
        .single()
    )

    if (error) {
      if (error.code === '23505') {
        throw new Error('That category already exists.')
      }
      throw new Error(`Failed to create custom category: ${error.message}`)
    }

    const response = ok({
      id: String(data.id),
      user_id: String(data.user_id),
      key: String(data.key),
      label: String(data.label),
      type,
      archived_at: data.archived_at ?? null,
      created_at: String(data.created_at ?? ''),
      updated_at: String(data.updated_at ?? ''),
      customCategoryId: String(data.id),
      source: 'custom' as const,
    })
    logPerfSpan(flow, 'total', startedAt, {
      duplicate: false,
      existingCount: existing.length,
    })
    return response
  })
}

function validateDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
}

function normalizeLabel(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function normalizeDebtNote(value: string | null | undefined) {
  return (value ?? '').trim()
}

function amountToMinorUnits(amount: number) {
  return Math.round(amount * 100)
}

function buildRowFingerprint(input: {
  cycleId: string
  date: string
  amount: number
  label: string
  categoryType: ImportCategoryType | null
}) {
  const normalizedLabel = normalizeLabel(input.label)
  return [
    input.cycleId,
    input.date,
    String(amountToMinorUnits(input.amount)),
    normalizedLabel,
    input.categoryType ?? 'uncategorized',
  ].join('|')
}

function logSaveTiming(
  label: string,
  startedAt: number,
  marks: Array<{ step: string; ms: number }>
) {
  const outcome = label.split(':')[1] ?? label
  logPerfSpan('sms-import.save', 'total', startedAt, {
    outcome,
    markCount: marks.length,
  })
}

function createTimingMarks(
  startedAt: number,
  flow?: string,
  baseMeta?: Record<string, string | number | boolean | null | undefined>
) {
  const marks: Array<{ step: string; ms: number }> = []
  let lastMark = startedAt

  return {
    marks,
    mark(step: string, meta?: Record<string, string | number | boolean | null | undefined>) {
      const now = Date.now()
      const durationMs = now - lastMark
      marks.push({ step, ms: durationMs })
      if (flow) {
        logPerfSpan(flow, step, lastMark, {
          ...baseMeta,
          ...meta,
        })
      }
      lastMark = now
    },
  }
}

async function ensureCycleRows(
  supabase: any,
  userId: string,
  profile: { pay_schedule_type: 'monthly' | 'twice_monthly' | null; pay_schedule_days: number[] | null },
  rowMeta: Array<{ cycleId: string; entryDate: Date }>
) {
  const schedule = profileToPaySchedule(profile)
  const cycleRows = new Map<string, { user_id: string; start_date: string; end_date: string; is_current: boolean }>()

  for (const meta of rowMeta) {
    if (cycleRows.has(meta.cycleId)) continue
    const localDay = new Date(
      meta.entryDate.getFullYear(),
      meta.entryDate.getMonth(),
      meta.entryDate.getDate()
    )
    const cycle = getCycleByDate(localDay, schedule)
    cycleRows.set(meta.cycleId, {
      user_id: userId,
      start_date: toLocalDateStr(cycle.startDate),
      end_date: toLocalDateStr(cycle.endDate),
      is_current: false,
    })
  }

  if (cycleRows.size === 0) return

  const { error } = await (supabase.from('cycles') as any).upsert(
    Array.from(cycleRows.values()),
    { onConflict: 'user_id,start_date' }
  )

  if (error) {
    throw new Error(`Failed to ensure cycles: ${error.message}`)
  }
}

function isUncategorizedRow(row: ParsedRowInput) {
  return !row.customCategoryId && (!row.categoryType || !row.categoryKey?.trim())
}

function validateParsedRow(row: ParsedRowInput, options: { allowUncategorized?: boolean } = {}) {
  const errors: string[] = []
  const trimmedLabel = row.label.trim()
  const trimmedCategoryKey = row.categoryKey.trim()

  if (row.blockedReason) {
    errors.push(row.blockedReason)
    return errors
  }

  if (!trimmedLabel) {
    errors.push('Name is required.')
  }
  if (!trimmedCategoryKey && !options.allowUncategorized) {
    errors.push('Category key is missing.')
  }
  if (!Number.isFinite(row.amount) || row.amount <= 0) {
    errors.push('Amount must be greater than zero.')
  }
  if (!validateDate(row.date)) {
    errors.push('Date is invalid.')
  }

  return errors
}

export interface SaveParsedSmsExpensesResult {
  saved: number
  duplicates: number
  blocked: boolean
  overridden: boolean
  rowErrors: Record<string, string[]>
  rowWarnings: Record<string, string[]>
  affectedCycles?: HistoricalIncomeCycle[]
}

export interface HistoricalIncomeCycle {
  cycleId: string
  label: string
  startDate: string
  endDate: string
  existingIncome: number | null
  hasExistingIncome: boolean
}

export interface HistoricalIncomeSaveInput {
  cycleId: string
  amount: number
}

function formatHistoricalIncomeCycleLabel(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T12:00:00`)
  const end = new Date(`${endDate}T12:00:00`)
  if (Number.isNaN(start.getTime())) return startDate
  if (Number.isNaN(end.getTime())) {
    return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${startLabel} – ${endLabel}`
}

function deriveAffectedCycles(
  profile: { pay_schedule_type: 'monthly' | 'twice_monthly' | null; pay_schedule_days: number[] | null },
  rows: Array<{ cycleId: string; entryDate: Date }>
): HistoricalIncomeCycle[] {
  const cycles = new Map<string, HistoricalIncomeCycle>()
  const schedule = profileToPaySchedule(profile)

  for (const row of rows) {
    if (cycles.has(row.cycleId)) continue
    const localDay = new Date(row.entryDate.getFullYear(), row.entryDate.getMonth(), row.entryDate.getDate())
    const cycle = getCycleByDate(localDay, schedule)
    const startDate = toLocalDateStr(cycle.startDate)
    const endDate = toLocalDateStr(cycle.endDate)
    cycles.set(row.cycleId, {
      cycleId: row.cycleId,
      label: formatHistoricalIncomeCycleLabel(startDate, endDate),
      startDate,
      endDate,
      existingIncome: null,
      hasExistingIncome: false,
    })
  }

  return Array.from(cycles.values()).sort((a, b) => a.cycleId.localeCompare(b.cycleId))
}

export interface ParseSmsImportData {
  rows: ParsedSmsExpense[]
  scanned: number
  skippedCredits: number
  hasLowConfidence: boolean
  parseStatus: ImportParseStatus
  monthlyReminderKeys: string[]
  csvMappingRequired?: {
    headers: string[]
    missing: Array<'name' | 'amount'>
  } | null
  csvProfile?: CsvImportProfileAnalysis | null
  // True when rows came from the plain-language fallback parser. Used only
  // to surface a short clarifier in the review UI; no business-logic impact.
  usedFallback: boolean
}

function deriveHistoricalIncomeAmount(row: {
  salary?: number | string | null
  extra_income?: Array<{ amount?: number | string | null }> | null
  total?: number | string | null
  cycle_start_mode?: 'full_month' | 'mid_month' | null
  opening_balance?: number | string | null
  received?: number | string | null
}): number | null {
  const cycleStartMode = row.cycle_start_mode === 'mid_month' ? 'mid_month' : 'full_month'
  const salary = Number(row.salary ?? 0)
  const openingBalance = Number(row.opening_balance ?? 0)
  const extras = Array.isArray(row.extra_income) ? row.extra_income : []
  const extrasTotal = extras.reduce((sum, item) => sum + Number(item?.amount ?? 0), 0)
  const derived = cycleStartMode === 'mid_month' ? openingBalance : salary + extrasTotal
  if (Number.isFinite(derived) && derived > 0) return derived

  const total = Number(row.total ?? 0)
  if (Number.isFinite(total) && total > 0) return total

  const received = Number(row.received ?? 0)
  return Number.isFinite(received) && received > 0 ? received : null
}

export async function loadHistoricalIncomeForCycles(
  cycleIds: string[]
): Promise<ActionResult<HistoricalIncomeCycle[]>> {
  return runAction<HistoricalIncomeCycle[]>(async () => {
    const { user } = await getAppSession()
    if (!user) return unauthorized()

    const normalizedCycleIds = Array.from(new Set(
      cycleIds
        .map((cycleId) => cycleId.trim())
        .filter((cycleId) => /^\d{4}-\d{2}-\d{2}$/.test(cycleId))
    ))
    if (normalizedCycleIds.length === 0) return ok([])

    const supabase = await createServerSupabaseClient()
    const [{ data: cycleRows, error: cycleError }, { data: incomeRows, error: incomeError }] = await Promise.all([
      (supabase.from('cycles') as any)
        .select('start_date,end_date')
        .eq('user_id', user.id)
        .in('start_date', normalizedCycleIds),
      (supabase.from('income_entries') as any)
        .select('cycle_id,salary,extra_income,total,cycle_start_mode,opening_balance,received,received_confirmed_at')
        .eq('user_id', user.id)
        .in('cycle_id', normalizedCycleIds),
    ])

    if (cycleError) throw new Error(`Failed to load historical cycles: ${cycleError.message}`)
    if (incomeError) throw new Error(`Failed to load historical income: ${incomeError.message}`)

    const cycleById = new Map<string, { start_date: string; end_date: string }>()
    for (const row of cycleRows ?? []) {
      if (typeof row?.start_date !== 'string' || typeof row?.end_date !== 'string') continue
      cycleById.set(row.start_date, { start_date: row.start_date, end_date: row.end_date })
    }

    const incomeByCycle = new Map<string, any>()
    for (const row of incomeRows ?? []) {
      if (typeof row?.cycle_id === 'string') incomeByCycle.set(row.cycle_id, row)
    }

    return ok(normalizedCycleIds
      .filter((cycleId) => cycleById.has(cycleId))
      .map((cycleId) => {
        const cycle = cycleById.get(cycleId)!
        const income = incomeByCycle.get(cycleId) ?? null
        const existingIncome = income ? deriveHistoricalIncomeAmount(income) : null
        return {
          cycleId,
          label: formatHistoricalIncomeCycleLabel(cycle.start_date, cycle.end_date),
          startDate: cycle.start_date,
          endDate: cycle.end_date,
          existingIncome,
          hasExistingIncome: existingIncome != null && existingIncome > 0,
        }
      })
      .sort((a, b) => a.cycleId.localeCompare(b.cycleId)))
  })
}

export async function saveHistoricalIncomeForCycles(
  entries: HistoricalIncomeSaveInput[]
): Promise<ActionResult<{ saved: number }>> {
  return runAction<{ saved: number }>(async () => {
    const { user, profile } = await getAppSession()
    if (!user || !profile) return unauthorized()

    const normalized = entries
      .map((entry) => ({
        cycleId: entry.cycleId.trim(),
        amount: Number(entry.amount),
      }))
      .filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry.cycleId))

    for (const entry of normalized) {
      if (!Number.isFinite(entry.amount) || entry.amount <= 0) {
        throw new Error('Historical income must be greater than zero.')
      }
    }

    if (normalized.length === 0) return ok({ saved: 0 })

    const supabase = await createServerSupabaseClient()
    const cycleIds = Array.from(new Set(normalized.map((entry) => entry.cycleId)))
    const schedule = profileToPaySchedule(profile as any)
    const requestedToActualCycleId = new Map<string, string>()
    const cycleRowsToEnsure = cycleIds.map((cycleId) => {
      const date = new Date(`${cycleId}T12:00:00`)
      const cycle = getCycleByDate(date, schedule)
      const startDate = toLocalDateStr(cycle.startDate)
      requestedToActualCycleId.set(cycleId, startDate)
      return {
        user_id: user.id,
        start_date: startDate,
        end_date: toLocalDateStr(cycle.endDate),
        is_current: false,
      }
    })
    if (cycleRowsToEnsure.length > 0) {
      const { error: ensureCycleError } = await (supabase.from('cycles') as any)
        .upsert(cycleRowsToEnsure, { onConflict: 'user_id,start_date' })
      if (ensureCycleError) throw new Error(`Failed to ensure historical cycles: ${ensureCycleError.message}`)
    }
    const [{ data: cycleRows, error: cycleError }, { data: existingRows, error: existingError }] = await Promise.all([
      (supabase.from('cycles') as any)
        .select('start_date')
        .eq('user_id', user.id)
        .in('start_date', Array.from(new Set(requestedToActualCycleId.values()))),
      (supabase.from('income_entries') as any)
        .select('cycle_id,received,received_confirmed_at')
        .eq('user_id', user.id)
        .in('cycle_id', Array.from(new Set(requestedToActualCycleId.values()))),
    ])

    if (cycleError) throw new Error(`Failed to validate historical cycles: ${cycleError.message}`)
    if (existingError) throw new Error(`Failed to read existing historical income: ${existingError.message}`)

    const allowedCycleIds = new Set((cycleRows ?? []).map((row: any) => String(row.start_date ?? '')).filter(Boolean))
    const existingByCycle = new Map<string, any>()
    for (const row of existingRows ?? []) {
      if (typeof row?.cycle_id === 'string') existingByCycle.set(row.cycle_id, row)
    }

    const upserts = normalized
      .filter((entry) => allowedCycleIds.has(requestedToActualCycleId.get(entry.cycleId) ?? entry.cycleId))
      .map((entry) => {
        const actualCycleId = requestedToActualCycleId.get(entry.cycleId) ?? entry.cycleId
        const existing = existingByCycle.get(actualCycleId)
        const preservedReceivedFields =
          existing?.received != null || existing?.received_confirmed_at != null
            ? {
                received: existing.received ?? null,
                received_confirmed_at: existing.received_confirmed_at ?? null,
              }
            : {}

        return {
          user_id: user.id,
          cycle_id: actualCycleId,
          salary: entry.amount,
          extra_income: [],
          total: entry.amount,
          cycle_start_mode: 'full_month',
          opening_balance: null,
          ...preservedReceivedFields,
        }
      })

    if (upserts.length === 0) return ok({ saved: 0 })

    const { error } = await (supabase.from('income_entries') as any)
      .upsert(upserts, { onConflict: 'user_id,cycle_id' })

    if (error) throw new Error(`Failed to save historical income: ${error.message}`)

    revalidatePath('/history')
    revalidatePath('/app')
    revalidatePath('/income')

    return ok({ saved: upserts.length })
  })
}

function deriveParseStatus(input: {
  rows: ParsedSmsExpense[]
  scanned: number
  skippedCredits?: number
}): ImportParseStatus {
  if (input.rows.length === 0) return 'failed'
  if (input.rows.some((row) => row.parseStatus === 'invalid')) return 'invalid'
  if (input.rows.some((row) => row.parseStatus === 'ambiguous')) return 'ambiguous'
  if (
    input.rows.some((row) => row.parseStatus === 'partial' || row.confidence === 'low') ||
    input.skippedCredits ||
    input.rows.length < input.scanned
  ) {
    return 'partial'
  }
  return 'clear'
}

function computeHasLowConfidence(rows: ParsedSmsExpense[]): boolean {
  if (rows.length === 0) return false

  // Signal 1: any row the parser itself flagged as low confidence.
  if (rows.some((row) => row.confidence === 'low')) return true

  // Signal 2: large amount variation across rows. Heuristic only —
  // we are not reconstructing balances or totals.
  const amounts = rows.map((row) => row.amount).filter((n) => Number.isFinite(n) && n > 0)
  if (amounts.length >= 3) {
    const min = Math.min(...amounts)
    const max = Math.max(...amounts)
    if (min > 0 && max / min >= 20) return true
  }

  // Signal 3: many rows but very few distinct dates — likely a partial paste.
  if (rows.length >= 5) {
    const uniqueDates = new Set(rows.map((row) => row.date)).size
    if (uniqueDates <= 2) return true
  }

  return false
}

const STRUCTURED_SMS_MARKERS = [
  /\bconfirmed\b/i,
  /\btransaction\b/i,
  /\b(?:receipt|ref|reference|txn)\b/i,
  /\b(?:balance|bal|available|avail|account|acct|a\/c)\b/i,
  /\bnew\s+balance\b/i,
  /\b(?:paid|sent|withdrawn|withdrawal|debited|credited|received|deposited)\s+(?:to|from|at|via|by)\b/i,
  /\b(?:debited|credited|withdrawn|deposited)\b/i,
]

function countNonEmptyLines(input: string) {
  return input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).length
}

function shouldUseSimpleEntryFastPath(input: string, rows: ParsedSmsExpense[]) {
  if (rows.length === 0) return false
  const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length === 0) return false

  return lines.every((line) => {
    if (!/[A-Za-z]/.test(line) || !/[0-9]/.test(line)) return false
    return !STRUCTURED_SMS_MARKERS.some((marker) => marker.test(line))
  })
}

export async function parseSmsImport(
  rawText: string,
  options: {
    mode?: ImportMode
    defaultImportMonth?: string | null
    source?: ImportInputSource
    csvMapping?: CsvImportMapping | null
  } = {}
): Promise<ActionResult<ParseSmsImportData>> {
  return runAction<ParseSmsImportData>(async () => {
    const startedAt = Date.now()
    const flow = 'sms-import.parse'
    const { user, profile } = await getAppSession()
    if (!user || !profile) return unauthorized()

    const input = rawText?.trim() ?? ''
    const lineCount = countNonEmptyLines(input)
    const mode = options.mode === 'past' ? 'past' : 'current'
    const source = mode === 'past' && options.source === 'csv' ? 'csv' : 'text'
    if (!input) {
      const response = ok({
        rows: [],
        scanned: 0,
        skippedCredits: 0,
        hasLowConfidence: false,
        parseStatus: 'failed' as const,
        monthlyReminderKeys: [],
        csvProfile: null,
        usedFallback: false,
      })
      logPerfSpan(flow, 'total', startedAt, {
        lineCount,
        rowCount: 0,
        fastPath: false,
        structured: false,
      })
      return response
    }

    if (mode === 'past') {
      const pastParserStartedAt = Date.now()
      const csvMappingRequired = source === 'csv' && !options.csvMapping
        ? getCsvMappingRequest(input)
        : null
      const csvProfile = source === 'csv'
        ? analyzeCsvImportProfile(input, options.csvMapping)
        : null
      if (csvMappingRequired) {
        const response = ok({
          rows: [],
          scanned: lineCount,
          skippedCredits: 0,
          hasLowConfidence: false,
          parseStatus: 'invalid' as const,
          monthlyReminderKeys: [],
          csvMappingRequired,
          csvProfile,
          usedFallback: false,
        })
        logPerfSpan(flow, 'csv-mapping-detection', pastParserStartedAt, {
          lineCount,
          columnCount: csvMappingRequired.headers.length,
          missingCount: csvMappingRequired.missing.length,
        })
        logPerfSpan(flow, 'total', startedAt, {
          lineCount,
          rowCount: 0,
          fastPath: false,
          structured: false,
          mode,
          source,
          mappingRequired: true,
        })
        return response
      }

      const pastRows = source === 'csv'
        ? parsePastExpenseCsv(input, {
          defaultCurrency: profile.currency || 'USD',
          defaultImportMonth: options.defaultImportMonth,
          mapping: options.csvMapping,
        })
        : parsePastExpenseLines(input, {
          defaultCurrency: profile.currency || 'USD',
          defaultImportMonth: options.defaultImportMonth,
        })
      logPerfSpan(flow, 'past-parser', pastParserStartedAt, {
        lineCount,
        rowCount: pastRows.length,
        source,
      })
      const responseStartedAt = Date.now()
      const response = ok({
        rows: pastRows,
        scanned: lineCount,
        skippedCredits: 0,
        hasLowConfidence: computeHasLowConfidence(pastRows),
        parseStatus: deriveParseStatus({ rows: pastRows, scanned: lineCount }),
        monthlyReminderKeys: [],
        csvMappingRequired: null,
        csvProfile,
        usedFallback: false,
      })
      logPerfSpan(flow, 'response-shaping', responseStartedAt, {
        rowCount: pastRows.length,
        mode,
        source,
      })
      logPerfSpan(flow, 'total', startedAt, {
        lineCount,
        rowCount: pastRows.length,
        fastPath: false,
        structured: false,
        mode,
        source,
      })
      return response
    }

    const simpleParserStartedAt = Date.now()
    const simpleRows = parseSimpleExpenseLines(input, {
      defaultCurrency: profile.currency || 'USD',
    })
    logPerfSpan(flow, 'simple-parser', simpleParserStartedAt, {
      lineCount,
      rowCount: simpleRows.length,
    })
    const classifierStartedAt = Date.now()
    const useSimpleFastPath = shouldUseSimpleEntryFastPath(input, simpleRows)
    logPerfSpan(flow, 'fast-path-classifier', classifierStartedAt, {
      lineCount,
      rowCount: simpleRows.length,
      fastPath: useSimpleFastPath,
    })
    if (useSimpleFastPath) {
      const responseStartedAt = Date.now()
      const response = ok({
        rows: simpleRows,
        scanned: lineCount,
        skippedCredits: 0,
        hasLowConfidence: computeHasLowConfidence(simpleRows),
        parseStatus: deriveParseStatus({ rows: simpleRows, scanned: lineCount }),
        monthlyReminderKeys: [],
        csvProfile: null,
        usedFallback: true,
      })
      logPerfSpan(flow, 'response-shaping', responseStartedAt, {
        rowCount: simpleRows.length,
        fastPath: true,
      })
      logPerfSpan(flow, 'total', startedAt, {
        lineCount,
        rowCount: simpleRows.length,
        fastPath: true,
        structured: false,
      })
      return response
    }

    const supabase = await timePerf(flow, 'supabase-init', async () => createServerSupabaseClient())
    const cycleId = deriveCurrentCycleId(profile)
    const [
      { data: dictionaryRows, error: dictionaryError },
      customCategories,
      { data: recentRows, error: recentRowsError },
      monthlyReminderEntries,
    ] = await Promise.all([
      timePerf(flow, 'dictionary-load', async () =>
        (supabase.from('item_dictionary') as any)
          .select('name_normalized,label,category_type,category_key,custom_category_id,usage_count')
          .eq('user_id', user.id)
          .limit(300)
      ),
      timePerf(flow, 'custom-category-load', async () =>
        loadActiveCustomCategories(supabase, user.id)
      ),
      timePerf(flow, 'recent-transaction-load', async () =>
        (supabase.from('transactions') as any)
          .select('category_label,category_type')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .limit(300)
      ),
      timePerf(flow, 'monthly-reminder-load', async () =>
        loadMonthlyReminderEntriesForCycle(supabase, user.id, cycleId)
      ),
    ])

    if (dictionaryError) {
      throw new Error(`Failed to load dictionary: ${dictionaryError.message}`)
    }
    if (recentRowsError) {
      throw new Error(`Failed to load recent transactions: ${recentRowsError.message}`)
    }

    const monthlyReminderKeys = monthlyReminderEntries.map((entry) => entry.key)
    const categoryCountsByLabel = new Map<string, Map<ImportCategoryType, number>>()
    for (const row of recentRows ?? []) {
      const normalized = normalize(row.category_label ?? '')
      const categoryType = normalizeCategoryType(row.category_type)
      if (!normalized || !categoryType) continue

      const counts = categoryCountsByLabel.get(normalized) ?? new Map<ImportCategoryType, number>()
      counts.set(categoryType, (counts.get(categoryType) ?? 0) + 1)
      categoryCountsByLabel.set(normalized, counts)
    }

    const activeCustomIds = new Set(customCategories.map((category) => category.id))
    const trustedDictionaryRows = (dictionaryRows ?? []).flatMap((row: any) => {
      const normalized = normalize(row.name_normalized ?? '')
      const customCategoryId = typeof row.custom_category_id === 'string' ? row.custom_category_id : null
      const customCategory = customCategoryId
        ? customCategories.find((category) => category.id === customCategoryId) ?? null
        : null
      if (customCategoryId && activeCustomIds.has(customCategoryId) && customCategory) {
        return [{
          nameNormalized: normalized,
          label: row.label,
          categoryType: customCategory.type,
          categoryKey: customCategory.key,
          customCategoryId,
          usageCount: Number(row.usage_count ?? 0),
        }]
      }

      const counts = categoryCountsByLabel.get(normalized)
      if (!counts) return []

      const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0)
      if (total < 2 || counts.size !== 1) return []

      const categoryType = Array.from(counts.keys())[0]
      return [{
        nameNormalized: normalized,
        label: row.label,
        categoryType,
        categoryKey: row.category_key,
        customCategoryId: null,
        usageCount: total,
      }]
    })

    const structuredParserStartedAt = Date.now()
    const parsed = parseSmsBlob(input, {
      defaultCurrency: profile.currency || 'USD',
      dictionary: trustedDictionaryRows,
    })
    logPerfSpan(flow, 'structured-parser', structuredParserStartedAt, {
      lineCount,
      rowCount: parsed.rows.length,
      dictionaryCount: trustedDictionaryRows.length,
    })

    // Fallback: when the SMS parser finds nothing in non-empty input, try a
    // plain-language parser ("500 for food"). Never mixed with SMS results —
    // only used when SMS parsing returns zero rows.
    if (parsed.rows.length === 0) {
      const fallbackParserStartedAt = Date.now()
      const fallbackRows = parseSimpleExpenseLines(input, {
        defaultCurrency: profile.currency || 'USD',
      })
      logPerfSpan(flow, 'simple-parser-fallback', fallbackParserStartedAt, {
        lineCount,
        rowCount: fallbackRows.length,
      })
      if (fallbackRows.length > 0) {
        const responseStartedAt = Date.now()
        const response = ok({
          rows: fallbackRows,
          scanned: parsed.scanned,
          skippedCredits: parsed.skippedCredits,
          hasLowConfidence: computeHasLowConfidence(fallbackRows),
          parseStatus: deriveParseStatus({
            rows: fallbackRows,
            scanned: parsed.scanned,
            skippedCredits: parsed.skippedCredits,
          }),
          monthlyReminderKeys,
          csvProfile: null,
          usedFallback: true,
        })
        logPerfSpan(flow, 'response-shaping', responseStartedAt, {
          rowCount: fallbackRows.length,
          fastPath: false,
        })
        logPerfSpan(flow, 'total', startedAt, {
          lineCount,
          rowCount: fallbackRows.length,
          fastPath: false,
          structured: false,
        })
        return response
      }
    }

    const responseStartedAt = Date.now()
    const response = ok({
      ...parsed,
      hasLowConfidence: computeHasLowConfidence(parsed.rows),
      parseStatus: deriveParseStatus({
        rows: parsed.rows,
        scanned: parsed.scanned,
        skippedCredits: parsed.skippedCredits,
      }),
      monthlyReminderKeys,
      csvProfile: null,
      usedFallback: false,
    })
    logPerfSpan(flow, 'response-shaping', responseStartedAt, {
      rowCount: parsed.rows.length,
      fastPath: false,
    })
    logPerfSpan(flow, 'total', startedAt, {
      lineCount,
      rowCount: parsed.rows.length,
      fastPath: false,
      structured: true,
    })
    return response
  })
}

export async function saveParsedSmsExpenses(
  rows: ParsedRowInput[],
  opts?: { confirmOverride?: boolean; mode?: ImportMode }
): Promise<ActionResult<SaveParsedSmsExpensesResult>> {
  return runAction<SaveParsedSmsExpensesResult>(async () => {
  const startedAt = Date.now()
  const saveMode: ImportMode = opts?.mode === 'past' ? 'past' : 'current'
  // Past imports are forgiving: rows may arrive without a category. Current
  // imports keep the strict requirement that every row has a real category.
  const allowUncategorized = saveMode === 'past'
  const blockingTiming = createTimingMarks(startedAt, 'sms-import.save', {
    rowCount: rows.length,
    confirmOverride: opts?.confirmOverride === true,
    mode: saveMode,
  })
  const mark = blockingTiming.mark

  const { user, profile } = await getAppSession()
  mark('session')
  if (!user || !profile) {
    logSaveTiming('saveParsedSmsExpenses:blocked', startedAt, blockingTiming.marks)
    return unauthorized()
  }

  const confirmOverride = opts?.confirmOverride === true

  const selectedRows = rows.map((row) => ({
    ...row,
    label: row.label.trim(),
    categoryKey: row.categoryKey.trim(),
    customCategoryId: row.customCategoryId?.trim() || null,
    amount: Number(row.amount),
    sourceHash: (row.sourceHash ?? '').trim(),
  }))
  mark('client-payload-normalize', { rowCount: selectedRows.length })

  if (selectedRows.length === 0) {
    logSaveTiming('saveParsedSmsExpenses:write', startedAt, blockingTiming.marks)
    return ok({
      saved: 0,
      duplicates: 0,
      blocked: false,
      overridden: false,
      rowErrors: {},
      rowWarnings: {},
    })
  }

  const rowErrors: Record<string, string[]> = {}
  const rowWarnings: Record<string, string[]> = {}

  for (const row of selectedRows) {
    const errors = validateParsedRow(row, { allowUncategorized })
    if (errors.length > 0) {
      rowErrors[row.id] = errors
    }
  }
  mark('server-validate', {
    rowCount: selectedRows.length,
    errorCount: Object.keys(rowErrors).length,
  })

  if (Object.keys(rowErrors).length > 0) {
    logSaveTiming('saveParsedSmsExpenses:blocked', startedAt, blockingTiming.marks)
    return ok({
      saved: 0,
      duplicates: 0,
      blocked: true,
      overridden: false,
      rowErrors,
      rowWarnings: {},
    })
  }

  const rowMeta = selectedRows.map((row) => {
    const entryDate = new Date(`${row.date}T12:00:00`)
    const cycleId = deriveCycleIdForDate(profile as any, entryDate)
    return {
      row,
      entryDate,
      cycleId,
      fingerprint: buildRowFingerprint({
        cycleId,
        date: row.date,
        amount: row.amount,
        label: row.label,
        categoryType: row.categoryType,
      }),
    }
  })

  const supabase = await createServerSupabaseClient()
  mark('supabase-init')

  // ── HARD BLOCK: exact-same SMS already imported (in-batch or cross-batch)
  const hashesToCheck = Array.from(
    new Set(rowMeta.map((m) => m.row.sourceHash).filter((h) => h.length > 0))
  )

  const importedHashes = new Set<string>()
  if (hashesToCheck.length > 0) {
    const { data: importedRows, error: importedError } = await (supabase.from('sms_import_lines') as any)
      .select('source_hash')
      .eq('user_id', user.id)
      .in('source_hash', hashesToCheck)

    if (importedError) {
      throw new Error(`Failed to check imported messages: ${importedError.message}`)
    }
    for (const r of importedRows ?? []) {
      if (r?.source_hash) importedHashes.add(String(r.source_hash))
    }
  }
  mark('duplicate-hash-check', {
    hashCount: hashesToCheck.length,
    duplicateCount: importedHashes.size,
  })

  const seenHashInBatch = new Set<string>()
  for (const { row } of rowMeta) {
    if (!row.sourceHash) continue
    if (importedHashes.has(row.sourceHash) || seenHashInBatch.has(row.sourceHash)) {
      rowErrors[row.id] = [...(rowErrors[row.id] ?? []), DUPLICATE_MESSAGE]
      continue
    }
    seenHashInBatch.add(row.sourceHash)
  }

  // ── SOFT WARNING: content fingerprint matches another row in this batch
  //    or an existing transaction in the same cycle.
  const seenFingerprintInBatch = new Set<string>()
  let duplicates = 0
  if (selectedRows.length > 0) {
    const minDate = selectedRows.reduce((acc, row) => (row.date < acc ? row.date : acc), selectedRows[0].date)
    const maxDate = selectedRows.reduce((acc, row) => (row.date > acc ? row.date : acc), selectedRows[0].date)
    const { data: existingRows, error: existingError } = await (supabase.from('transactions') as any)
      .select('cycle_id,date,amount,category_label,category_type')
      .eq('user_id', user.id)
      .gte('date', minDate)
      .lte('date', maxDate)

    if (existingError) {
      throw new Error(`Failed to check duplicates: ${existingError.message}`)
    }

    const existingFingerprints = new Set<string>()
    for (const txn of existingRows ?? []) {
      if (!txn?.cycle_id || !txn?.date || txn?.amount == null || !txn?.category_label || !txn?.category_type) continue
      existingFingerprints.add(
        buildRowFingerprint({
          cycleId: String(txn.cycle_id),
          date: String(txn.date),
          amount: Math.abs(Number(txn.amount)),
          label: String(txn.category_label),
          categoryType: String(txn.category_type) as ImportCategoryType,
        })
      )
    }

    for (const meta of rowMeta) {
      const matchesExisting = existingFingerprints.has(meta.fingerprint)
      const matchesInBatch = seenFingerprintInBatch.has(meta.fingerprint)
      if (matchesExisting || matchesInBatch) {
        rowWarnings[meta.row.id] = [
          ...(rowWarnings[meta.row.id] ?? []),
          'This looks similar to something you already logged',
        ]
        duplicates += 1
      }
      seenFingerprintInBatch.add(meta.fingerprint)
    }
  }
  mark('duplicate-fingerprint-check', {
    rowCount: selectedRows.length,
    duplicateCount: duplicates,
  })

  if (Object.keys(rowWarnings).length > 0 && !confirmOverride) {
    logSaveTiming('saveParsedSmsExpenses:blocked', startedAt, blockingTiming.marks)
    return ok({
      saved: 0,
      duplicates,
      blocked: true,
      overridden: false,
      rowErrors: {},
      rowWarnings,
    })
  }

  const customCategoryIds = selectedRows
    .map((row) => row.customCategoryId)
    .filter((id): id is string => !!id)
  const customCategoriesById = await timePerf('sms-import.save', 'custom-category-validate-load', async () =>
    loadCustomCategoryMap(supabase, user.id, customCategoryIds),
    {
      rowCount: selectedRows.length,
      customCategoryCount: customCategoryIds.length,
    }
  )

  for (const { row } of rowMeta) {
    if (!row.customCategoryId) continue
    const customCategory = customCategoriesById.get(row.customCategoryId)
    if (!customCategory || customCategory.archived_at) {
      rowErrors[row.id] = [...(rowErrors[row.id] ?? []), 'Choose an active custom category.']
    }
  }
  if (Object.keys(rowErrors).length > 0) {
    logSaveTiming('saveParsedSmsExpenses:blocked', startedAt, blockingTiming.marks)
    return ok({
      saved: 0,
      duplicates: 0,
      blocked: true,
      overridden: false,
      rowErrors,
      rowWarnings: {},
    })
  }
  mark('custom-category-validate', {
    customCategoryCount: customCategoryIds.length,
    errorCount: Object.keys(rowErrors).length,
  })

  const persistedRows = rowMeta.map(({ row, entryDate, cycleId }) => {
    const customCategory = row.customCategoryId
      ? customCategoriesById.get(row.customCategoryId) ?? null
      : null
    const resolvedCustomCategory = customCategory
      ? resolveCustomCategoryForWrite(customCategory)
      : null
    // Past-mode rows that arrive without a category bypass canonical resolution
    // entirely — they're stored as 'other' / 'uncategorized' sentinel records
    // the user can edit later. Without this branch the row would crash through
    // resolveCanonicalCategoryForWrite, which throws on unknown keys.
    const isUncategorized = allowUncategorized && !resolvedCustomCategory && isUncategorizedRow(row)
    const persistedKey = isUncategorized
      ? 'uncategorized'
      : resolvedCustomCategory
        ? resolvedCustomCategory.categoryKey
        : row.categoryType === 'fixed'
        ? canonicalizeFixedBillKey(row.categoryKey)
        : row.categoryKey

    return {
      row,
      entryDate,
      cycleId,
      persistedKey,
      resolvedCustomCategory,
      isUncategorized,
    }
  })

  // ── DEBT VALIDATION: load linked debts and reject invalid repayments
  //    before any writes happen.
  const debtLinkedMeta = persistedRows.filter(
    ({ row }) => row.categoryType === 'debt' && row.debtId
  )
  const resolvedDebts = new Map<string, Awaited<ReturnType<typeof getDebt>>>()
  const existingDebtTransactions = new Map<string, Awaited<ReturnType<typeof addDebtTransaction>>[] | any[]>()
  const uniqueDebtIds = Array.from(new Set(
    debtLinkedMeta.map(({ row }) => row.debtId!).filter(Boolean)
  ))

  const debtDetails = await Promise.all(
    uniqueDebtIds.map(async (debtId) => [debtId, await getDebt(debtId)] as const)
  )
  const debtTransactions = await Promise.all(
    uniqueDebtIds.map(async (debtId) => [debtId, await getDebtTransactions(debtId)] as const)
  )
  for (const [debtId, debt] of debtDetails) resolvedDebts.set(debtId, debt)
  for (const [debtId, transactions] of debtTransactions) existingDebtTransactions.set(debtId, transactions)
  mark('debt-resolve', {
    debtRowCount: debtLinkedMeta.length,
    debtCount: uniqueDebtIds.length,
  })

  // Running balance per debt tracks cumulative repayments within this batch
  // so two rows targeting the same debt cannot exceed its balance together.
  const debtRunningPaid = new Map<string, number>()

  for (const { row } of debtLinkedMeta) {
    const debt = resolvedDebts.get(row.debtId!)
    const errors: string[] = []

    if (!debt) {
      errors.push('The selected debt no longer exists.')
    } else if (debt.status !== 'active') {
      errors.push('This debt is no longer active.')
    } else if (debt.currency !== profile.currency) {
      errors.push(
        `This debt uses ${debt.currency}. Imported SMS payments currently use your ${profile.currency} profile currency, so link a debt with the same currency.`
      )
    } else {
      const alreadyPaid = debtRunningPaid.get(debt.id) ?? 0
      const remainingBalance = debt.current_balance - alreadyPaid
      const entryType = debt.direction === 'owed_by_me' ? 'payment_out' : 'payment_in'
      const existingTransactionsForDebt = existingDebtTransactions.get(debt.id) ?? []
      const exactExistingRepayment = existingTransactionsForDebt.find((transaction: any) =>
        transaction.entry_type === entryType &&
        transaction.transaction_date === row.date &&
        Number(transaction.amount) === row.amount &&
        normalizeDebtNote(transaction.note) === 'Imported from SMS'
      )

      if (exactExistingRepayment) {
        errors.push('This SMS payment was already recorded on this debt.')
      } else if (row.amount > remainingBalance) {
        errors.push(
          remainingBalance <= 0
            ? 'This debt has already been fully repaid.'
            : `Amount exceeds remaining balance (${remainingBalance.toLocaleString()}).`
        )
      } else {
        debtRunningPaid.set(debt.id, alreadyPaid + row.amount)
      }
    }

    if (errors.length > 0) {
      rowErrors[row.id] = [...(rowErrors[row.id] ?? []), ...errors]
    }
  }

  if (Object.keys(rowErrors).length > 0) {
    logSaveTiming('saveParsedSmsExpenses:blocked', startedAt, blockingTiming.marks)
    return ok({
      saved: 0,
      duplicates: 0,
      blocked: true,
      overridden: false,
      rowErrors,
      rowWarnings: {},
    })
  }
  mark('debt-validate', {
    debtRowCount: debtLinkedMeta.length,
    errorCount: Object.keys(rowErrors).length,
  })

  await ensureCycleRows(supabase, user.id, profile as any, persistedRows)
  mark('cycle-write', { rowCount: persistedRows.length })

  // Split: debt rows with a linked debtId go through the debt engine;
  // everything else uses the generic batch insert.
  const genericRows = persistedRows.filter(
    ({ row }) => !(row.categoryType === 'debt' && row.debtId)
  )

  if (genericRows.length > 0) {
    const transactionRecords = genericRows.map(({ row, cycleId, entryDate, persistedKey, resolvedCustomCategory, isUncategorized }) => {
      // Past-mode uncategorized rows: skip the canonical resolver. Persist a
      // sentinel record the user can edit later. category_type uses the
      // 'other' bucket already defined in CategoryType so historical totals
      // don't pollute everyday/fixed/debt analytics.
      if (isUncategorized) {
        const displayName = row.label.trim() || 'Uncategorized'
        return {
          user_id: user.id,
          cycle_id: cycleId,
          date: toLocalDateStr(entryDate),
          category_type: 'other' as const,
          category_key: 'uncategorized',
          category_label: 'Uncategorized',
          custom_category_id: null,
          display_name: displayName,
          amount: row.amount,
          note: 'Imported from SMS',
        }
      }
      return buildTransactionRecord({
        userId: user.id,
        cycleId,
        date: toLocalDateStr(entryDate),
        categoryType: (resolvedCustomCategory?.categoryType ?? row.categoryType) as CategoryType,
        categoryKey: persistedKey,
        categoryLabel: resolvedCustomCategory?.categoryLabel ?? row.label,
        customCategory: resolvedCustomCategory,
        displayName: row.label,
        amount: row.amount,
        note: 'Imported from SMS',
      })
    })

    const { error: transactionInsertError } = await timePerf('sms-import.save', 'transaction-insert', async () =>
      (supabase.from('transactions') as any).insert(transactionRecords),
      {
        rowCount: transactionRecords.length,
        debtRowCount: debtLinkedMeta.length,
      }
    )
    if (transactionInsertError) {
      throw new Error(`Failed to insert transactions: ${transactionInsertError.message}`)
    }
  }

  for (const { row, entryDate } of debtLinkedMeta) {
    const debt = resolvedDebts.get(row.debtId!)!
    const entryType = debt.direction === 'owed_by_me' ? 'payment_out' : 'payment_in'
    const dateStr = toLocalDateStr(entryDate)

    const debtTxn = await addDebtTransaction({
      debtId: debt.id,
      entryType,
      amount: row.amount,
      currency: debt.currency,
      transactionDate: dateStr,
      note: 'Imported from SMS',
    })

    if (debtTxn) {
      try {
        const txnDate = new Date(`${dateStr}T00:00:00`)
        const cycleId = await getCycleIdForDate(supabase as any, user.id, profile as any, txnDate)

        const { data: mirrorData, error: mirrorError } = await (supabase.from('transactions') as any)
          .insert(buildTransactionRecord({
            userId: user.id,
            cycleId,
            date: dateStr,
            categoryType: 'debt',
            categoryKey: 'debt_repayment',
            categoryLabel: debt.name,
            displayName: `${debt.name} payment`,
            amount: row.amount,
            note: 'Imported from SMS',
          }))
          .select('id')
          .single()

        if (!mirrorError && mirrorData) {
          await (supabase.from('debt_transactions') as any)
            .update({ linked_transaction_id: mirrorData.id })
            .eq('id', debtTxn.id)
            .eq('user_id', user.id)
        }
      } catch {
        // Mirror is best-effort; debt transaction already committed.
      }
    }
  }
  mark('transaction-write', {
    rowCount: persistedRows.length,
    genericRowCount: genericRows.length,
    debtRowCount: debtLinkedMeta.length,
  })

  const importRows = persistedRows
    .map(({ row }) => row.sourceHash)
    .filter((sourceHash) => sourceHash.length > 0)
    .map((sourceHash) => ({ user_id: user.id, source_hash: sourceHash }))

  if (importRows.length > 0) {
    const { error: importInsertError } = await (supabase.from('sms_import_lines') as any).insert(importRows)
    if (importInsertError && importInsertError.code !== '23505') {
      throw new Error(`Failed to record imported messages: ${importInsertError.message}`)
    }
  }
  mark('import-line-write', { rowCount: importRows.length })

  const trackingRowsByCycle = new Map<string, Array<{ key: string; label: string; monthly: number }>>()
  for (const { row, cycleId, persistedKey } of persistedRows) {
    if (row.categoryType === 'debt' || row.repeatsMonthly !== true) continue

    const monthly = Number(row.amount)
    if (!Number.isFinite(monthly) || monthly <= 0) continue

    const items = trackingRowsByCycle.get(cycleId) ?? []
    items.push({
      key: recurringExpenseKey(row.categoryType, persistedKey),
      label: row.label,
      monthly,
    })
    trackingRowsByCycle.set(cycleId, items)
  }

  if (trackingRowsByCycle.size > 0) {
    for (const [cycleId, trackingRows] of trackingRowsByCycle.entries()) {
      await timePerf('sms-import.save', 'reminder-write', async () =>
        saveMonthlyReminderEntriesForCycle(supabase, user.id, cycleId, trackingRows),
        {
          cycleCount: trackingRowsByCycle.size,
          reminderCount: trackingRows.length,
        }
      )
    }
  }
  mark('reminder-writes', {
    cycleCount: trackingRowsByCycle.size,
    reminderCount: Array.from(trackingRowsByCycle.values()).reduce((sum, entries) => sum + entries.length, 0),
  })

  revalidatePath('/log')
  revalidatePath('/history')
  revalidatePath('/app')
  mark('revalidation', { pathCount: 3 })

  mark('response-ready')
  const overridden = confirmOverride && duplicates > 0
  logSaveTiming(
    overridden ? 'saveParsedSmsExpenses:overridden' : 'saveParsedSmsExpenses:write',
    startedAt,
    blockingTiming.marks
  )

  const backgroundStartedAt = Date.now()
  after(async () => {
    const backgroundTiming = createTimingMarks(backgroundStartedAt, 'sms-import.save.background', {
      rowCount: persistedRows.length,
    })
    try {
      await rememberDictionaryItems(
        supabase,
        user.id,
        // Skip uncategorized historical rows — there's no category to remember,
        // and dictionary entries require a real categoryType. The user can
        // categorize later via the normal transaction edit flow.
        persistedRows
          .filter(({ row, isUncategorized }) => !isUncategorized && row.categoryType != null)
          .map(({ row, persistedKey, resolvedCustomCategory }) => ({
            label: row.label,
            categoryKey: persistedKey,
            categoryType: (resolvedCustomCategory?.categoryType ?? row.categoryType) as ImportCategoryType,
            customCategory: resolvedCustomCategory,
          }))
      )
      backgroundTiming.mark('dictionary-write', { rowCount: persistedRows.length })

      logSaveTiming('saveParsedSmsExpenses:background', backgroundStartedAt, backgroundTiming.marks)
    } catch (error) {
      backgroundTiming.mark('background-error')
      logSaveTiming('saveParsedSmsExpenses:background', backgroundStartedAt, backgroundTiming.marks)
      console.error('[sms-import] background save work failed', error)
    }
  })

  return ok({
    saved: rowMeta.length,
    duplicates,
    blocked: false,
    overridden,
    rowErrors: {},
    rowWarnings: {},
    affectedCycles: deriveAffectedCycles(profile as any, rowMeta),
  })
  })
}
