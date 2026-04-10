'use server'

import { revalidatePath } from 'next/cache'
import { getAppSession } from '@/lib/auth/app-session'
import { createClient } from '@/lib/supabase/server'
import { createCycleTransaction } from '@/lib/supabase/transactions-db'
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
  include: boolean
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

export async function saveParsedSmsExpenses(rows: ParsedRowInput[]): Promise<{ saved: number }> {
  const { user, profile } = await getAppSession()
  if (!user || !profile) throw new Error('Not authenticated')

  const validRows = rows
    .filter((row) => row.include)
    .map((row) => ({
      ...row,
      label: row.label.trim(),
      categoryKey: row.categoryKey.trim(),
      amount: Number(row.amount),
    }))
    .filter((row) =>
      row.label.length > 0 &&
      row.categoryKey.length > 0 &&
      Number.isFinite(row.amount) &&
      row.amount > 0 &&
      validateDate(row.date)
    )

  if (validRows.length === 0) return { saved: 0 }

  const supabase = await createClient()

  for (const row of validRows) {
    const entryDate = new Date(`${row.date}T12:00:00`)

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

  return { saved: validRows.length }
}
