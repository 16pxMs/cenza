'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { getAppSession } from '@/lib/auth/app-session'
import { createClient } from '@/lib/supabase/server'
import { buildTransactionRecord } from '@/lib/supabase/transactions-db'
import { deriveCycleIdForDate } from '@/lib/supabase/cycles-db'
import { getCycleByDate, profileToPaySchedule, toLocalDateStr } from '@/lib/cycles'
import {
  parseSmsBlob,
  parseSimpleExpenseLines,
  type ImportCategoryType,
  type ParsedSmsExpense,
} from '@/lib/sms-import/parser'
import { ok, runAction, unauthorized, type ActionResult } from '@/lib/actions/result'
import { canonicalizeFixedBillKey } from '@/lib/fixed-bills/canonical'

interface ParsedRowInput {
  id: string
  label: string
  categoryType: ImportCategoryType
  categoryKey: string
  amount: number
  date: string
  sourceHash: string
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

async function rememberDictionaryItems(
  supabase: any,
  userId: string,
  items: Array<{ label: string; categoryKey: string; categoryType: ImportCategoryType }>
) {
  const usageInBatch = new Map<string, number>()
  const latestItemByNormalized = new Map<string, { label: string; categoryKey: string; categoryType: ImportCategoryType }>()

  for (const item of items) {
    const normalized = normalize(item.label)
    if (!normalized) continue
    usageInBatch.set(normalized, (usageInBatch.get(normalized) ?? 0) + 1)
    latestItemByNormalized.set(normalized, item)
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
      usage_count: (existingUsage.get(normalized) ?? 0) + (usageInBatch.get(normalized) ?? 0),
    }
  })

  const { error } = await table.upsert(upserts, { onConflict: 'user_id,name_normalized' })
  if (error) {
    throw new Error(`Failed to remember items: ${error.message}`)
  }
}

function validateDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
}

function normalizeLabel(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function amountToMinorUnits(amount: number) {
  return Math.round(amount * 100)
}

function buildRowFingerprint(input: {
  cycleId: string
  date: string
  amount: number
  label: string
  categoryType: ImportCategoryType
}) {
  const normalizedLabel = normalizeLabel(input.label)
  return [
    input.cycleId,
    input.date,
    String(amountToMinorUnits(input.amount)),
    normalizedLabel,
    input.categoryType,
  ].join('|')
}

function logSaveTiming(
  label: string,
  startedAt: number,
  marks: Array<{ step: string; ms: number }>
) {
  const totalMs = Date.now() - startedAt
  const summary = marks.map((mark) => `${mark.step}=${mark.ms}ms`).join(' | ')
  console.info(`[sms-import] ${label} total=${totalMs}ms${summary ? ` | ${summary}` : ''}`)
}

function createTimingMarks(startedAt: number) {
  const marks: Array<{ step: string; ms: number }> = []
  let lastMark = startedAt

  return {
    marks,
    mark(step: string) {
      const now = Date.now()
      marks.push({ step, ms: now - lastMark })
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

function validateParsedRow(row: ParsedRowInput) {
  const errors: string[] = []
  const trimmedLabel = row.label.trim()
  const trimmedCategoryKey = row.categoryKey.trim()

  if (!trimmedLabel) {
    errors.push('Name is required.')
  }
  if (!trimmedCategoryKey) {
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
  rowErrors: Record<string, string[]>
  rowWarnings: Record<string, string[]>
}

export interface ParseSmsImportData {
  rows: ParsedSmsExpense[]
  scanned: number
  skippedCredits: number
  hasLowConfidence: boolean
  // True when rows came from the plain-language fallback parser. Used only
  // to surface a short clarifier in the review UI; no business-logic impact.
  usedFallback: boolean
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

export async function parseSmsImport(rawText: string): Promise<ActionResult<ParseSmsImportData>> {
  return runAction<ParseSmsImportData>(async () => {
    const { user, profile } = await getAppSession()
    if (!user || !profile) return unauthorized()

    const input = rawText?.trim() ?? ''
    if (!input) {
      return ok({ rows: [], scanned: 0, skippedCredits: 0, hasLowConfidence: false, usedFallback: false })
    }

    const supabase = await createClient()
    const { data: dictionaryRows, error } = await (supabase.from('item_dictionary') as any)
      .select('name_normalized,label,category_type,category_key')
      .eq('user_id', user.id)
      .limit(300)

    if (error) {
      throw new Error(`Failed to load dictionary: ${error.message}`)
    }

    const parsed = parseSmsBlob(input, {
      defaultCurrency: profile.currency || 'USD',
      dictionary: (dictionaryRows ?? []).map((row: any) => ({
        nameNormalized: row.name_normalized,
        label: row.label,
        categoryType: row.category_type,
        categoryKey: row.category_key,
      })),
    })

    // Fallback: when the SMS parser finds nothing in non-empty input, try a
    // plain-language parser ("500 for food"). Never mixed with SMS results —
    // only used when SMS parsing returns zero rows.
    if (parsed.rows.length === 0) {
      const fallbackRows = parseSimpleExpenseLines(input, {
        defaultCurrency: profile.currency || 'USD',
      })
      if (fallbackRows.length > 0) {
        return ok({
          rows: fallbackRows,
          scanned: parsed.scanned,
          skippedCredits: parsed.skippedCredits,
          hasLowConfidence: computeHasLowConfidence(fallbackRows),
          usedFallback: true,
        })
      }
    }

    return ok({
      ...parsed,
      hasLowConfidence: computeHasLowConfidence(parsed.rows),
      usedFallback: false,
    })
  })
}

export async function saveParsedSmsExpenses(
  rows: ParsedRowInput[],
  opts?: { confirmOverride?: boolean }
): Promise<ActionResult<SaveParsedSmsExpensesResult>> {
  return runAction<SaveParsedSmsExpensesResult>(async () => {
  const startedAt = Date.now()
  const blockingTiming = createTimingMarks(startedAt)
  const mark = blockingTiming.mark

  const { user, profile } = await getAppSession()
  mark('session')
  if (!user || !profile) {
    logSaveTiming('saveParsedSmsExpenses:blocking', startedAt, blockingTiming.marks)
    return unauthorized()
  }

  const confirmOverride = opts?.confirmOverride === true

  const selectedRows = rows.map((row) => ({
    ...row,
    label: row.label.trim(),
    categoryKey: row.categoryKey.trim(),
    amount: Number(row.amount),
    sourceHash: (row.sourceHash ?? '').trim(),
  }))
  mark('client-payload-normalize')

  if (selectedRows.length === 0) {
    logSaveTiming('saveParsedSmsExpenses:blocking', startedAt, blockingTiming.marks)
    return ok({
      saved: 0,
      duplicates: 0,
      blocked: false,
      rowErrors: {},
      rowWarnings: {},
    })
  }

  const rowErrors: Record<string, string[]> = {}
  const rowWarnings: Record<string, string[]> = {}

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

  for (const { row } of rowMeta) {
    const errors = validateParsedRow(row)
    if (errors.length > 0) {
      rowErrors[row.id] = errors
    }
  }
  mark('server-validate')

  const supabase = await createClient()
  mark('create-client')

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
  mark('duplicate-hash-check')

  const seenHashInBatch = new Set<string>()
  for (const { row } of rowMeta) {
    if (!row.sourceHash) continue
    if (importedHashes.has(row.sourceHash) || seenHashInBatch.has(row.sourceHash)) {
      rowErrors[row.id] = [...(rowErrors[row.id] ?? []), 'This message was already added']
      continue
    }
    seenHashInBatch.add(row.sourceHash)
  }

  if (Object.keys(rowErrors).length > 0) {
    logSaveTiming('saveParsedSmsExpenses:blocking', startedAt, blockingTiming.marks)
    return ok({
      saved: 0,
      duplicates: 0,
      blocked: true,
      rowErrors,
      rowWarnings: {},
    })
  }

  // ── SOFT WARNING: content fingerprint matches another row in this batch
  //    or an existing transaction in the same cycle.
  const seenFingerprintInBatch = new Set<string>()
  let duplicates = 0
  if (!confirmOverride) {
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
  mark(confirmOverride ? 'duplicate-fingerprint-skip' : 'duplicate-fingerprint-check')

  if (Object.keys(rowWarnings).length > 0 && !confirmOverride) {
    logSaveTiming('saveParsedSmsExpenses:blocking', startedAt, blockingTiming.marks)
    return ok({
      saved: 0,
      duplicates,
      blocked: true,
      rowErrors: {},
      rowWarnings,
    })
  }

  const persistedRows = rowMeta.map(({ row, entryDate, cycleId }) => {
    const persistedKey =
      row.categoryType === 'fixed'
        ? canonicalizeFixedBillKey(row.categoryKey)
        : row.categoryKey

    return {
      row,
      entryDate,
      cycleId,
      persistedKey,
    }
  })

  await ensureCycleRows(supabase, user.id, profile as any, persistedRows)
  mark('db-write-cycles')

  const transactionRecords = persistedRows.map(({ row, cycleId, entryDate, persistedKey }) =>
    buildTransactionRecord({
      userId: user.id,
      cycleId,
      date: toLocalDateStr(entryDate),
      categoryType: row.categoryType,
      categoryKey: persistedKey,
      categoryLabel: row.label,
      amount: row.amount,
      note: 'Imported from SMS',
    })
  )

  const { error: transactionInsertError } = await (supabase.from('transactions') as any).insert(transactionRecords)
  if (transactionInsertError) {
    throw new Error(`Failed to insert transactions: ${transactionInsertError.message}`)
  }
  mark('db-write-transactions')

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
  mark('db-write-import-lines')

  mark('response-ready')
  logSaveTiming('saveParsedSmsExpenses:blocking', startedAt, blockingTiming.marks)

  const backgroundStartedAt = Date.now()
  after(async () => {
    const backgroundTiming = createTimingMarks(backgroundStartedAt)
    try {
      await rememberDictionaryItems(
        supabase,
        user.id,
        persistedRows.map(({ row, persistedKey }) => ({
          label: row.label,
          categoryKey: persistedKey,
          categoryType: row.categoryType,
        }))
      )
      backgroundTiming.mark('db-write-dictionary')

      revalidatePath('/log')
      revalidatePath('/app')
      backgroundTiming.mark('post-save-revalidate')

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
    rowErrors: {},
    rowWarnings: {},
  })
  })
}
