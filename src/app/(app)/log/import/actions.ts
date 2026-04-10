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

export async function saveParsedSmsExpenses(rows: ParsedRowInput[]): Promise<SaveParsedSmsExpensesResult> {
  const { user, profile } = await getAppSession()
  if (!user || !profile) throw new Error('Not authenticated')

  const selectedRows = rows.map((row) => ({
    ...row,
    label: row.label.trim(),
    categoryKey: row.categoryKey.trim(),
    amount: Number(row.amount),
  }))

  if (selectedRows.length === 0) {
    return {
      saved: 0,
      duplicates: 0,
      blocked: false,
      rowErrors: {},
    }
  }

  const rowErrors: Record<string, string[]> = {}
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

  // Prevent duplicates in the same pasted batch.
  const seenInBatch = new Set<string>()
  for (const meta of rowMeta) {
    if (seenInBatch.has(meta.fingerprint)) {
      rowErrors[meta.row.id] = [...(rowErrors[meta.row.id] ?? []), 'Duplicate in this SMS batch.']
      continue
    }
    seenInBatch.add(meta.fingerprint)
  }

  const hasValidationErrors = Object.keys(rowErrors).length > 0
  if (hasValidationErrors) {
    return {
      saved: 0,
      duplicates: 0,
      blocked: true,
      rowErrors,
    }
  }

  const supabase = await createClient()
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

  let duplicates = 0
  for (const meta of rowMeta) {
    if (!existingFingerprints.has(meta.fingerprint)) continue
    rowErrors[meta.row.id] = [...(rowErrors[meta.row.id] ?? []), 'Already logged for this cycle.']
    duplicates += 1
  }

  if (Object.keys(rowErrors).length > 0) {
    return {
      saved: 0,
      duplicates,
      blocked: true,
      rowErrors,
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
  }

  revalidatePath('/log')
  revalidatePath('/history')
  revalidatePath('/app')

  return {
    saved: rowMeta.length,
    duplicates: 0,
    blocked: false,
    rowErrors: {},
  }
}
