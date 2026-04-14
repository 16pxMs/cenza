'use server'

import { revalidatePath } from 'next/cache'
import { getAppSession } from '@/lib/auth/app-session'
import { createClient } from '@/lib/supabase/server'
import { createCycleTransaction } from '@/lib/supabase/transactions-db'
import { deriveCycleIdForDate } from '@/lib/supabase/cycles-db'
import {
  parseSmsBlob,
  type ImportCategoryType,
  type ParsedSmsExpense,
} from '@/lib/sms-import/parser'

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

async function rememberDictionaryItem(
  supabase: any,
  userId: string,
  item: { label: string; categoryKey: string; categoryType: ImportCategoryType }
) {
  const normalized = normalize(item.label)
  if (!normalized) return

  const table = supabase.from('item_dictionary') as any
  const { data: existing } = await table
    .select('usage_count')
    .eq('user_id', userId)
    .eq('name_normalized', normalized)
    .maybeSingle()

  const usageCount = Number(existing?.usage_count ?? 0) + 1

  const { error } = await table.upsert(
    {
      user_id: userId,
      name_normalized: normalized,
      label: item.label,
      category_key: item.categoryKey,
      category_type: item.categoryType,
      usage_count: usageCount,
    },
    { onConflict: 'user_id,name_normalized' }
  )

  if (error) {
    throw new Error(`Failed to remember item: ${error.message}`)
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

export async function parseSmsImport(rawText: string): Promise<{
  rows: ParsedSmsExpense[]
  scanned: number
  skippedCredits: number
}> {
  const { user, profile } = await getAppSession()
  if (!user || !profile) throw new Error('Not authenticated')

  const input = rawText?.trim() ?? ''
  if (!input) {
    return { rows: [], scanned: 0, skippedCredits: 0 }
  }

  const supabase = await createClient()
  const { data: dictionaryRows, error } = await (supabase.from('item_dictionary') as any)
    .select('name_normalized,label,category_type,category_key')
    .eq('user_id', user.id)
    .limit(300)

  if (error) {
    throw new Error(`Failed to load dictionary: ${error.message}`)
  }

  return parseSmsBlob(input, {
    defaultCurrency: profile.currency || 'USD',
    dictionary: (dictionaryRows ?? []).map((row: any) => ({
      nameNormalized: row.name_normalized,
      label: row.label,
      categoryType: row.category_type,
      categoryKey: row.category_key,
    })),
  })
}

export async function saveParsedSmsExpenses(
  rows: ParsedRowInput[],
  opts?: { confirmOverride?: boolean }
): Promise<SaveParsedSmsExpensesResult> {
  const { user, profile } = await getAppSession()
  if (!user || !profile) throw new Error('Not authenticated')

  const confirmOverride = opts?.confirmOverride === true

  const selectedRows = rows.map((row) => ({
    ...row,
    label: row.label.trim(),
    categoryKey: row.categoryKey.trim(),
    amount: Number(row.amount),
    sourceHash: (row.sourceHash ?? '').trim(),
  }))

  if (selectedRows.length === 0) {
    return {
      saved: 0,
      duplicates: 0,
      blocked: false,
      rowErrors: {},
      rowWarnings: {},
    }
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

  const supabase = await createClient()

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

  const seenHashInBatch = new Set<string>()
  for (const { row } of rowMeta) {
    if (!row.sourceHash) continue
    if (importedHashes.has(row.sourceHash) || seenHashInBatch.has(row.sourceHash)) {
      rowErrors[row.id] = [...(rowErrors[row.id] ?? []), 'This message was already imported']
      continue
    }
    seenHashInBatch.add(row.sourceHash)
  }

  if (Object.keys(rowErrors).length > 0) {
    return {
      saved: 0,
      duplicates: 0,
      blocked: true,
      rowErrors,
      rowWarnings: {},
    }
  }

  // ── SOFT WARNING: content fingerprint matches another row in this batch
  //    or an existing transaction in the same cycle.
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

  const seenFingerprintInBatch = new Set<string>()
  let duplicates = 0
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

  if (Object.keys(rowWarnings).length > 0 && !confirmOverride) {
    return {
      saved: 0,
      duplicates,
      blocked: true,
      rowErrors: {},
      rowWarnings,
    }
  }

  for (const { row, entryDate } of rowMeta) {
    await createCycleTransaction(supabase as any, user.id, profile as any, {
      categoryType: row.categoryType,
      categoryKey: row.categoryKey,
      categoryLabel: row.label,
      amount: row.amount,
      date: entryDate,
      note: 'Imported from SMS',
    })

    await rememberDictionaryItem(supabase, user.id, {
      label: row.label,
      categoryKey: row.categoryKey,
      categoryType: row.categoryType,
    })

    if (row.sourceHash) {
      const { error: importInsertError } = await (supabase.from('sms_import_lines') as any)
        .insert({ user_id: user.id, source_hash: row.sourceHash })
      // Ignore unique-violation races; the transaction is already saved and
      // a future re-import will still be caught by the pre-save query above.
      if (importInsertError && importInsertError.code !== '23505') {
        throw new Error(`Failed to record imported message: ${importInsertError.message}`)
      }
    }
  }

  revalidatePath('/log')
  revalidatePath('/history')
  revalidatePath('/app')

  return {
    saved: rowMeta.length,
    duplicates,
    blocked: false,
    rowErrors: {},
    rowWarnings: {},
  }
}
