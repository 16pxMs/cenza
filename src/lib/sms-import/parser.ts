import type { CategoryType } from '@/types/database'
import { getCategoriesByType, resolveCategoryKey } from '@/lib/categories/config'

export type ImportCategoryType = Extract<CategoryType, 'everyday' | 'fixed' | 'debt'>
export type ImportSourceType = 'sms' | 'simple_text' | 'past_text' | 'pasted_table' | 'csv'
export type ImportDateSource = 'explicit' | 'default_month'
export type CsvImportField = 'date' | 'name' | 'amount' | 'category' | 'note'

export type CsvImportMapping = Partial<Record<CsvImportField, number>>

export interface CsvMappingRequest {
  headers: string[]
  missing: Array<'name' | 'amount'>
}

export interface ImportDictionaryEntry {
  nameNormalized: string
  label: string
  categoryType: ImportCategoryType
  categoryKey: string
  customCategoryId?: string | null
  usageCount?: number
}

export interface ParsedSmsExpense {
  id: string
  raw: string
  label: string
  categoryType: ImportCategoryType
  categoryKey: string
  customCategoryId?: string | null
  amount: number
  currency: string
  date: string
  dateSource?: ImportDateSource | null
  isImportedMessage: boolean
  include: boolean
  confidence: 'high' | 'medium' | 'low'
  sourceHash: string
  sourceType?: ImportSourceType
  sourceRowIndex?: number
  blockedReason?: string | null
}

export function hashSmsLine(raw: string): string {
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, ' ')
  let hash = 2166136261

  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0).toString(16).padStart(8, '0')
}

export interface SmsParseResult {
  rows: ParsedSmsExpense[]
  scanned: number
  skippedCredits: number
}

export interface ParsedPaymentImport {
  amount: number | null
  currency: string | null
  date: string | null
  note: string | null
}

const DEBIT_HINTS = [
  'debited',
  'debit',
  'spent',
  'purchase',
  'paid',
  'payment',
  'sent',
  'withdrawn',
  'withdrawal',
  'transfer',
]

const CREDIT_HINTS = [
  'credited',
  'credit',
  'receive',
  'received',
  'added',
  'deposited',
  'deposit',
  'paid in',
  'incoming',
  'salary',
  'reversal',
  'refund',
  'inflow',
]

export const INCOME_SMS_BLOCKED_MESSAGE =
  "This looks like money received, so it can’t be saved as an expense."

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hintPattern(hint: string) {
  const escaped = escapeRegex(hint).replace(/\s+/g, '\\s+')
  return new RegExp(`\\b${escaped}\\b`, 'i')
}

const DEBIT_HINT_PATTERNS = DEBIT_HINTS.map(hintPattern)
const CREDIT_HINT_PATTERNS = CREDIT_HINTS.map(hintPattern)

const CURRENCY_CODES = [
  'KES', 'KSH', 'KSHS',
  'USD', 'NGN', 'ZAR', 'UGX', 'TZS', 'GHS',
  'GBP', 'EUR', 'AED',
]

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function slugify(value: string) {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function parseBareAmount(value: string): number | null {
  const cleaned = value.trim().replace(/[, ]/g, '')
  if (!/^[0-9]+(?:\.[0-9]{1,2})?$/.test(cleaned)) return null
  const amount = Number(cleaned)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

function parseAmountCell(value: string): number | null {
  return parseBareAmount(value) ?? parseAmount(value)?.amount ?? null
}

function defaultDateForMonth(month: string | null | undefined): string | null {
  const normalized = month?.trim() ?? ''
  if (!/^\d{4}-\d{2}$/.test(normalized)) return null
  return `${normalized}-01`
}

function extractLastBareAmount(raw: string): { amount: number; token: string; index: number } | null {
  const matches = [...raw.matchAll(/\b[0-9][0-9,]*(?:\.[0-9]{1,2})?\b/g)]
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index]
    const token = match[0]
    const amount = parseBareAmount(token)
    if (amount == null || match.index == null) continue
    return { amount, token, index: match.index }
  }
  return null
}

function stripDateText(raw: string) {
  return raw
    .replace(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/g, ' ')
    .replace(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/g, ' ')
    .replace(/\b(\d{1,2})\s+([A-Za-z]{3,9})(?:,?\s*(\d{2,4}))?\b/g, (match) =>
      findDateInText(match) ? ' ' : match
    )
    .replace(/\b(?:on\s+)?([A-Za-z]{3,9})\s+(\d{1,2})(?:,?\s*(\d{2,4}))?\b/g, (match) =>
      findDateInText(match) ? ' ' : match
    )
    .replace(/\b(?:today|yesterday)\b/gi, ' ')
}

function splitPastedColumns(line: string): string[] {
  const delimiter = line.includes('\t')
    ? '\t'
    : line.includes('|')
    ? '|'
    : line.includes(',')
    ? ','
    : ''

  if (!delimiter) return []
  return line
    .split(delimiter)
    .map((part) => part.trim().replace(/^"|"$/g, ''))
}

function parseDelimitedRecord(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        index += 1
        continue
      }
      inQuotes = !inQuotes
      continue
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  cells.push(current.trim())
  return cells
}

function parseCsvRecords(rawInput: string): string[][] {
  const records: string[][] = []
  let currentRecord: string[] = []
  let currentCell = ''
  let inQuotes = false

  for (let index = 0; index < rawInput.length; index += 1) {
    const char = rawInput[index]
    const next = rawInput[index + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"'
        index += 1
        continue
      }
      inQuotes = !inQuotes
      continue
    }

    if (char === ',' && !inQuotes) {
      currentRecord.push(currentCell.trim())
      currentCell = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1
      currentRecord.push(currentCell.trim())
      currentCell = ''
      if (currentRecord.some((cell) => cell.trim())) {
        records.push(currentRecord)
      }
      currentRecord = []
      continue
    }

    currentCell += char
  }

  currentRecord.push(currentCell.trim())
  if (currentRecord.some((cell) => cell.trim())) {
    records.push(currentRecord)
  }

  return records
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function headerIndex(headers: string[], names: string[]) {
  const accepted = new Set(names)
  return headers.findIndex((header) => accepted.has(normalizeHeader(header)))
}

function optionalHeaderIndex(headers: string[], names: string[]) {
  const index = headerIndex(headers, names)
  return index >= 0 ? index : undefined
}

function looksLikeHeader(columns: string[]) {
  if (columns.length < 2) return false
  const normalized = columns.map(normalizeHeader)
  const hasDate = normalized.some((value) => ['date', 'transactiondate', 'day'].includes(value))
  const hasAmount = normalized.some((value) => ['amount', 'cost', 'price', 'total', 'debit'].includes(value))
  const hasName = normalized.some((value) => ['name', 'description', 'merchant', 'item', 'expense', 'details'].includes(value))
  return hasDate && hasAmount && hasName
}

const CSV_DATE_HEADERS = ['date', 'transactiondate', 'paidat', 'createdat', 'day']
const CSV_NAME_HEADERS = ['name', 'description', 'merchant', 'payee', 'details', 'item', 'expense']
const CSV_AMOUNT_HEADERS = ['amount', 'debit', 'value', 'total', 'cost', 'price']
const CSV_CATEGORY_HEADERS = ['category', 'type', 'bucket']
const CSV_NOTE_HEADERS = ['note', 'memo']

function looksLikeCsvHeader(columns: string[]) {
  if (columns.length < 2) return false
  const normalized = columns.map(normalizeHeader)
  const knownHeaders = [
    ...CSV_DATE_HEADERS,
    ...CSV_NAME_HEADERS,
    ...CSV_AMOUNT_HEADERS,
    ...CSV_CATEGORY_HEADERS,
    ...CSV_NOTE_HEADERS,
  ]
  return normalized.some((value) => knownHeaders.includes(value))
}

function detectCsvHeaderMapping(headers: string[]): CsvImportMapping {
  return {
    date: optionalHeaderIndex(headers, CSV_DATE_HEADERS),
    name: optionalHeaderIndex(headers, CSV_NAME_HEADERS),
    amount: optionalHeaderIndex(headers, CSV_AMOUNT_HEADERS),
    category: optionalHeaderIndex(headers, CSV_CATEGORY_HEADERS),
    note: optionalHeaderIndex(headers, CSV_NOTE_HEADERS),
  }
}

export function getCsvMappingRequest(rawInput: string): CsvMappingRequest | null {
  const records = parseCsvRecords(rawInput)
  const headers = records[0] ?? []
  if (!looksLikeCsvHeader(headers)) return null

  const mapping = detectCsvHeaderMapping(headers)
  const missing: Array<'name' | 'amount'> = []
  if (mapping.name == null) missing.push('name')
  if (mapping.amount == null) missing.push('amount')

  return missing.length > 0 ? { headers, missing } : null
}

function findKnownCategory(raw: string): { key: string; label: string; type: ImportCategoryType } | null {
  const normalized = normalize(raw)
  if (!normalized) return null

  const key = resolveCategoryKey(slugify(normalized)) ?? resolveCategoryKey(normalized)
  if (key) {
    const category = [...getCategoriesByType('everyday'), ...getCategoriesByType('fixed'), ...getCategoriesByType('debt')]
      .find((option) => option.key === key)
    if (category && (category.type === 'everyday' || category.type === 'fixed' || category.type === 'debt')) {
      return { key: category.key, label: category.label, type: category.type }
    }
  }

  for (const category of [...getCategoriesByType('everyday'), ...getCategoriesByType('fixed'), ...getCategoriesByType('debt')]) {
    if (normalize(category.label) === normalized && (category.type === 'everyday' || category.type === 'fixed' || category.type === 'debt')) {
      return { key: category.key, label: category.label, type: category.type }
    }
  }

  return null
}

function toIsoLocalDate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isCreditMessage(text: string) {
  const hasCredit = CREDIT_HINT_PATTERNS.some((pattern) => pattern.test(text))
  const hasDebit = DEBIT_HINT_PATTERNS.some((pattern) => pattern.test(text))
  return hasCredit && !hasDebit
}

function parseAmount(raw: string): { amount: number; currency: string; confidence: 'high' | 'medium' } | null {
  const patterns: Array<RegExp> = [
    new RegExp(`\\b(${CURRENCY_CODES.join('|')})\\s*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)\\b`, 'ig'),
    /([$£])\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/g,
    new RegExp(`\\b([0-9][0-9,]*(?:\\.[0-9]{1,2})?)\\s*(${CURRENCY_CODES.join('|')})\\b`, 'ig'),
  ]

  const candidates: Array<{ amount: number; currency: string; index: number; confidence: 'high' | 'medium' }> = []

  for (const pattern of patterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(raw)) !== null) {
      const [whole] = match
      const parts = whole.trim().split(/\s+/)

      let currency = ''
      let amountString = ''

      if (parts.length >= 2) {
        if (/^[0-9]/.test(parts[0])) {
          amountString = parts[0]
          currency = parts[1].toUpperCase()
        } else {
          currency = parts[0].toUpperCase()
          amountString = parts[1]
        }
      } else {
        const symbol = whole[0]
        if (symbol === '$') currency = 'USD'
        else if (symbol === '£') currency = 'GBP'
        amountString = whole.replace(/[^0-9.,]/g, '')
      }

      if (currency === 'KSH' || currency === 'KSHS') currency = 'KES'

      const amount = Number(amountString.replace(/,/g, ''))
      if (!Number.isFinite(amount) || amount <= 0) continue

      const leading = raw.slice(Math.max(0, match.index - 24), match.index).toLowerCase()
      const confidence: 'high' | 'medium' = DEBIT_HINTS.some((hint) => leading.includes(hint)) ? 'high' : 'medium'

      candidates.push({
        amount,
        currency,
        index: match.index,
        confidence,
      })
    }
  }

  if (candidates.length === 0) return null

  candidates.sort((a, b) => {
    if (a.confidence !== b.confidence) return a.confidence === 'high' ? -1 : 1
    return a.index - b.index
  })

  return {
    amount: candidates[0].amount,
    currency: candidates[0].currency,
    confidence: candidates[0].confidence,
  }
}

function findDateInText(raw: string): string | null {
  const lower = raw.toLowerCase()
  const now = new Date()
  now.setHours(12, 0, 0, 0)
  const monthMap: Record<string, number> = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, sept: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11,
  }

  if (lower.includes('yesterday')) {
    const d = new Date(now)
    d.setDate(d.getDate() - 1)
    return toIsoLocalDate(d)
  }
  if (lower.includes('today')) {
    return toIsoLocalDate(now)
  }

  const iso = raw.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/)
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12, 0, 0, 0)
    return toIsoLocalDate(d)
  }

  const dm = raw.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/)
  if (dm) {
    const day = Number(dm[1])
    const month = Number(dm[2]) - 1
    const yearRaw = dm[3] ? Number(dm[3]) : now.getFullYear()
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw
    const d = new Date(year, month, day, 12, 0, 0, 0)
    return toIsoLocalDate(d)
  }

  const dayMonthName = raw.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})(?:,?\s*(\d{2,4}))?\b/)
  if (dayMonthName) {
    const month = monthMap[dayMonthName[2].toLowerCase()]
    if (month != null) {
      const day = Number(dayMonthName[1])
      const yearRaw = dayMonthName[3] ? Number(dayMonthName[3]) : now.getFullYear()
      const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw
      const d = new Date(year, month, day, 12, 0, 0, 0)
      return toIsoLocalDate(d)
    }
  }

  const monthName = raw.match(/\b(?:on\s+)?([A-Za-z]{3,9})\s+(\d{1,2})(?:,?\s*(\d{2,4}))?\b/)
  if (monthName) {
    const month = monthMap[monthName[1].toLowerCase()]
    if (month != null) {
      const day = Number(monthName[2])
      const yearRaw = monthName[3] ? Number(monthName[3]) : now.getFullYear()
      const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw
      const d = new Date(year, month, day, 12, 0, 0, 0)
      return toIsoLocalDate(d)
    }
  }

  return null
}

function parseDate(raw: string): string {
  const now = new Date()
  now.setHours(12, 0, 0, 0)
  return findDateInText(raw) ?? toIsoLocalDate(now)
}

function extractMerchant(raw: string): string | null {
  const cleaned = raw
    .replace(/\s+/g, ' ')
    .replace(/\b(?:ref|reference|bal|balance|avail|available|new balance)\b.*$/i, '')

  const match = cleaned.match(/\b(?:to|at|from|via)\s+([A-Za-z0-9][A-Za-z0-9 .,&'*\-_/]{1,40})/i)
  if (!match) return null

  const label = match[1]
    .replace(/\b(?:on|for|amount|kes|usd|ngn|zar|ugx|tzs|ghs|gbp|eur|aed)\b.*$/i, '')
    .replace(/[.,;:-]+$/g, '')
    .trim()

  return label.length >= 2 ? label : null
}

function extractReference(raw: string): string | null {
  const referenceMatch = raw.match(/\b(?:ref|reference|txn|transaction id|receipt)\s*[:#-]?\s*([A-Za-z0-9-]{3,})/i)
  if (referenceMatch?.[1]) {
    return `Ref ${referenceMatch[1].trim()}`
  }

  const merchant = extractMerchant(raw)
  return merchant ? merchant.trim() : null
}

function inferCategory(label: string): ImportCategoryType {
  const lower = label.toLowerCase()
  if (['loan', 'debt', 'credit card', 'repay', 'repayment', 'mortgage'].some((hint) => lower.includes(hint))) {
    return 'debt'
  }
  if (['rent', 'water', 'electricity', 'wifi', 'internet', 'subscription', 'netflix', 'utilities', 'school fees'].some((hint) => lower.includes(hint))) {
    return 'fixed'
  }
  return 'everyday'
}

function resolveDictionary(
  label: string,
  dictionary: Record<string, ImportDictionaryEntry>
): ImportDictionaryEntry | null {
  const normalized = normalize(label)
  if (!normalized) return null

  const exact = dictionary[normalized]
  if (exact && (exact.customCategoryId ? (exact.usageCount ?? 0) >= 1 : (exact.usageCount ?? 0) >= 2)) {
    return exact
  }

  if (normalized.length < 4) return null
  const entries = Object.values(dictionary)
  const containsMatch = entries.find((entry) =>
    (entry.customCategoryId ? (entry.usageCount ?? 0) >= 1 : (entry.usageCount ?? 0) >= 2) &&
    (normalized.includes(entry.nameNormalized) || entry.nameNormalized.includes(normalized))
  )

  return containsMatch ?? null
}

// Plain-language fallback for lines like "500 for food" or "20000 naira fuel".
// Runs ONLY when parseSmsBlob returns zero rows (see actions.ts). Reuses the
// same slugify/inferCategory helpers and the same ParsedSmsExpense shape so
// downstream save/dedupe logic is unchanged.
const FALLBACK_CURRENCY_WORDS = [
  'naira', 'shillings', 'shilling', 'rupees', 'rupee',
  'dollars', 'dollar', 'pounds', 'pound', 'euros', 'euro',
  'cedis', 'rand',
  // Also strip the currency codes the SMS parser already knows about so a
  // user typing "500 KES for food" doesn't leak "KES" into the label.
  'kes', 'ksh', 'kshs', 'usd', 'ngn', 'zar', 'ugx', 'tzs', 'ghs',
  'gbp', 'eur', 'aed',
]

export function parseSimpleExpenseLines(
  rawInput: string,
  options: { defaultCurrency: string }
): ParsedSmsExpense[] {
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const date = toIsoLocalDate(today)

  const lines = rawInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const stripCurrencyWord = new RegExp(
    `\\b(?:${FALLBACK_CURRENCY_WORDS.join('|')})\\b`,
    'ig'
  )

  const parseSimpleAmountToken = (token: string) => {
    if (!/^[0-9][0-9,]*(?:\.[0-9]{1,2})?$/.test(token)) return null
    const amount = Number(token.replace(/,/g, ''))
    return Number.isFinite(amount) && amount > 0 ? amount : null
  }

  const buildSimpleRow = (
    line: string,
    labelSource: string,
    amount: number,
    index: number,
    sourceHash: string
  ): ParsedSmsExpense | null => {
    const label = normalize(labelSource)
    if (!label) return null

    const isIncomeCredit = isCreditMessage(line)
    const reference = extractReference(line)
    const blockedLabel = reference
      ? reference
      : (label || 'Money received')

    const categoryType = inferCategory(label)
    const categoryKey = slugify(isIncomeCredit ? blockedLabel : label) || `entry_${index + 1}`

    return {
      id: `row_${index + 1}_${categoryKey}`,
      raw: line,
      label: isIncomeCredit ? blockedLabel : label,
      categoryType,
      categoryKey,
      customCategoryId: null,
      amount,
      currency: options.defaultCurrency,
      date,
      isImportedMessage: false,
      include: true,
      confidence: 'medium',
      sourceHash,
      sourceType: 'simple_text',
      sourceRowIndex: index,
      blockedReason: isIncomeCredit ? INCOME_SMS_BLOCKED_MESSAGE : null,
    }
  }

  const parseMultiEntryLine = (line: string): ParsedSmsExpense[] | null => {
    const tokenStream = line
      .replace(stripCurrencyWord, ' ')
      .replace(/\bfor\b/gi, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean)

    const amountPositions = tokenStream.reduce<number[]>((positions, token, index) => {
      if (parseSimpleAmountToken(token) != null) positions.push(index)
      return positions
    }, [])

    if (amountPositions.length <= 1) return null

    const memo = new Map<number, Array<{ label: string; amount: number }> | null>()

    const solve = (start: number): Array<{ label: string; amount: number }> | null => {
      if (start === tokenStream.length) return []
      if (memo.has(start)) return memo.get(start) ?? null

      let best: Array<{ label: string; amount: number }> | null = null

      const amountAtStart = parseSimpleAmountToken(tokenStream[start])
      if (amountAtStart != null) {
        for (let end = start + 1; end < tokenStream.length; end += 1) {
          if (parseSimpleAmountToken(tokenStream[end]) != null) break
          const labelTokens = tokenStream.slice(start + 1, end + 1)
          const remainder = solve(end + 1)
          if (!remainder || labelTokens.length === 0) continue
          best = [{ label: labelTokens.join(' '), amount: amountAtStart }, ...remainder]
          break
        }
      } else {
        for (let end = start + 1; end < tokenStream.length; end += 1) {
          const amountAtEnd = parseSimpleAmountToken(tokenStream[end])
          if (amountAtEnd == null) continue
          const labelTokens = tokenStream.slice(start, end)
          if (labelTokens.length === 0) continue
          const remainder = solve(end + 1)
          if (!remainder) continue
          best = [{ label: labelTokens.join(' '), amount: amountAtEnd }, ...remainder]
          break
        }
      }

      memo.set(start, best)
      return best
    }

    const entries = solve(0)
    if (!entries || entries.length <= 1) return null

    return entries
      .map((entry, index) =>
        buildSimpleRow(
          line,
          entry.label,
          entry.amount,
          index,
          hashSmsLine(`${line} :: ${index + 1} :: ${entry.label} :: ${entry.amount}`)
        )
      )
      .filter((row): row is ParsedSmsExpense => row != null)
  }

  const rows: ParsedSmsExpense[] = []

  lines.forEach((line, index) => {
    const multiRows = parseMultiEntryLine(line)
    if (multiRows && multiRows.length > 0) {
      rows.push(...multiRows)
      return
    }

    const amountMatch = line.match(/([0-9][0-9,]*(?:\.[0-9]{1,2})?)/)
    if (!amountMatch || amountMatch.index == null) return

    const amount = Number(amountMatch[1].replace(/,/g, ''))
    if (!Number.isFinite(amount) || amount <= 0) return

    // Treat everything on either side of the amount as label candidate so
    // "food 500" and "500 food" both parse. Then strip currency words and
    // the "for" connector anywhere in the remainder.
    const before = line.slice(0, amountMatch.index)
    const after = line.slice(amountMatch.index + amountMatch[0].length)
    let rest = `${before} ${after}`
      .replace(stripCurrencyWord, ' ')
      .replace(/\bfor\b/gi, ' ')

    const label = normalize(rest)
    if (!label) return

    const row = buildSimpleRow(line, label, amount, index, hashSmsLine(line))
    if (row) rows.push(row)
  })

  return rows
}

export function parsePastExpenseLines(
  rawInput: string,
  options: { defaultCurrency: string; defaultImportMonth?: string | null }
): ParsedSmsExpense[] {
  const lines = rawInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const firstColumns = splitPastedColumns(lines[0] ?? '')
  const hasHeader = looksLikeHeader(firstColumns)
  const headers = hasHeader ? firstColumns : []
  const dateIndex = hasHeader ? headerIndex(headers, ['date', 'transactiondate', 'day']) : -1
  const nameIndex = hasHeader ? headerIndex(headers, ['name', 'description', 'merchant', 'item', 'expense', 'details']) : -1
  const amountIndex = hasHeader ? headerIndex(headers, ['amount', 'cost', 'price', 'total', 'debit']) : -1
  const categoryIndex = hasHeader ? headerIndex(headers, ['category', 'type', 'bucket']) : -1
  const inheritedDate = defaultDateForMonth(options.defaultImportMonth)

  const buildPastRow = (input: Omit<PastExpenseRowInput, 'defaultCurrency' | 'inheritedDate'>): ParsedSmsExpense | null =>
    buildPastExpenseRow({
      ...input,
      defaultCurrency: options.defaultCurrency,
      inheritedDate,
    })

  const parseDelimitedLine = (line: string, sourceLineIndex: number, columns: string[]): ParsedSmsExpense | null => {
    if (hasHeader) {
      const amount = amountIndex >= 0 ? parseAmountCell(columns[amountIndex] ?? '') : null
      const rawDate = dateIndex >= 0 ? columns[dateIndex] ?? '' : ''
      const date = rawDate ? findDateInText(rawDate) : null
      const label = nameIndex >= 0 ? columns[nameIndex] ?? '' : ''
      const categoryText = categoryIndex >= 0 ? columns[categoryIndex] ?? '' : null
      return buildPastRow({
        line,
        sourceLineIndex,
        date,
        label,
        amount,
        categoryText,
        sourceType: 'pasted_table',
      })
    }

    const dateColumnIndex = columns.findIndex((column) => !!findDateInText(column))
    const amountColumnIndex = (() => {
      for (let index = columns.length - 1; index >= 0; index -= 1) {
        if (parseAmountCell(columns[index]) != null) return index
      }
      return -1
    })()

    const amount = amountColumnIndex >= 0 ? parseAmountCell(columns[amountColumnIndex]) : null
    const date = dateColumnIndex >= 0 ? findDateInText(columns[dateColumnIndex]) : null
    const remaining = columns.filter((_, index) => index !== dateColumnIndex && index !== amountColumnIndex)
    const label = remaining[0] ?? ''
    const categoryText = remaining.length >= 2 ? remaining[remaining.length - 1] : null

    return buildPastRow({
      line,
      sourceLineIndex,
      date,
      label,
      amount,
      categoryText,
      sourceType: 'pasted_table',
    })
  }

  return lines
    .map((line, lineIndex) => {
      if (hasHeader && lineIndex === 0) return null

      const columns = splitPastedColumns(line)
      if (columns.length > 0) {
        return parseDelimitedLine(line, lineIndex, columns)
      }

      const amountMatch = extractLastBareAmount(line)
      const date = findDateInText(line)
      const label = amountMatch
        ? stripDateText(`${line.slice(0, amountMatch.index)} ${line.slice(amountMatch.index + amountMatch.token.length)}`)
            .replace(/\s+/g, ' ')
            .trim()
        : stripDateText(line).replace(/\s+/g, ' ').trim()

      return buildPastRow({
        line,
        sourceLineIndex: lineIndex,
        date,
        label,
        amount: amountMatch?.amount ?? null,
        sourceType: 'past_text',
      })
    })
    .filter((row): row is ParsedSmsExpense => row != null)
}

interface PastExpenseRowInput {
  line: string
  sourceLineIndex: number
  date: string | null
  label: string
  amount: number | null
  categoryText?: string | null
  sourceType: ImportSourceType
  defaultCurrency: string
  inheritedDate: string | null
}

function buildPastExpenseRow(input: PastExpenseRowInput): ParsedSmsExpense | null {
  const label = input.label.trim().replace(/\s+/g, ' ')
  if (!label && input.amount == null) return null

  const category = input.categoryText ? findKnownCategory(input.categoryText) : null
  const fallbackKey = slugify(label || input.categoryText || `past_expense_${input.sourceLineIndex + 1}`) || `past_expense_${input.sourceLineIndex + 1}`
  const date = input.date ?? input.inheritedDate ?? ''

  return {
    id: `${input.sourceType}_${input.sourceLineIndex + 1}_${fallbackKey}`,
    raw: input.line,
    label,
    categoryType: category?.type ?? inferCategory(category?.label ?? label),
    categoryKey: category?.key ?? fallbackKey,
    customCategoryId: null,
    amount: input.amount ?? 0,
    currency: input.defaultCurrency,
    date,
    dateSource: input.date ? 'explicit' : input.inheritedDate ? 'default_month' : null,
    isImportedMessage: true,
    include: true,
    confidence: category ? 'high' : 'medium',
    // Past imports intentionally do not use sms_import_lines in this phase.
    // Duplicate detection still runs through the reviewed-row fingerprint.
    sourceHash: '',
    sourceType: input.sourceType,
    sourceRowIndex: input.sourceLineIndex,
    blockedReason: null,
  }
}

export function parsePastExpenseCsv(
  rawInput: string,
  options: {
    defaultCurrency: string
    defaultImportMonth?: string | null
    mapping?: CsvImportMapping | null
  }
): ParsedSmsExpense[] {
  const records = parseCsvRecords(rawInput)
  if (records.length === 0) return []

  const firstRecord = records[0] ?? []
  const hasHeader = looksLikeCsvHeader(firstRecord)
  const mapping = options.mapping ?? (hasHeader ? detectCsvHeaderMapping(firstRecord) : {})
  const inheritedDate = defaultDateForMonth(options.defaultImportMonth)
  const dataRecords = hasHeader ? records.slice(1) : records

  return dataRecords
    .map((columns, index) => {
      const sourceLineIndex = hasHeader ? index + 1 : index
      const rawLine = columns.map((cell) => cell.includes(',') || cell.includes('"') ? `"${cell.replace(/"/g, '""')}"` : cell).join(',')

      if (mapping.amount != null || mapping.name != null || mapping.date != null || mapping.category != null) {
        const dateText = mapping.date != null ? columns[mapping.date] ?? '' : ''
        const noteText = mapping.note != null ? columns[mapping.note] ?? '' : ''
        const label = mapping.name != null ? columns[mapping.name] ?? '' : ''
        const categoryText = mapping.category != null ? columns[mapping.category] ?? '' : null
        return buildPastExpenseRow({
          line: rawLine,
          sourceLineIndex,
          date: dateText ? findDateInText(dateText) : null,
          label,
          amount: mapping.amount != null ? parseAmountCell(columns[mapping.amount] ?? '') : null,
          categoryText,
          sourceType: 'csv',
          defaultCurrency: options.defaultCurrency,
          inheritedDate,
        }) ?? (noteText ? buildPastExpenseRow({
          line: rawLine,
          sourceLineIndex,
          date: dateText ? findDateInText(dateText) : null,
          label: noteText,
          amount: mapping.amount != null ? parseAmountCell(columns[mapping.amount] ?? '') : null,
          categoryText,
          sourceType: 'csv',
          defaultCurrency: options.defaultCurrency,
          inheritedDate,
        }) : null)
      }

      const dateColumnIndex = columns.findIndex((column) => !!findDateInText(column))
      const amountColumnIndex = (() => {
        for (let columnIndex = columns.length - 1; columnIndex >= 0; columnIndex -= 1) {
          if (parseAmountCell(columns[columnIndex]) != null) return columnIndex
        }
        return -1
      })()
      const amount = amountColumnIndex >= 0 ? parseAmountCell(columns[amountColumnIndex]) : null
      const date = dateColumnIndex >= 0 ? findDateInText(columns[dateColumnIndex]) : null
      const remaining = columns.filter((_, columnIndex) => columnIndex !== dateColumnIndex && columnIndex !== amountColumnIndex)
      const label = remaining[0] ?? ''
      const categoryText = remaining.length >= 2 ? remaining[remaining.length - 1] : null

      return buildPastExpenseRow({
        line: rawLine,
        sourceLineIndex,
        date,
        label,
        amount,
        categoryText,
        sourceType: 'csv',
        defaultCurrency: options.defaultCurrency,
        inheritedDate,
      })
    })
    .filter((row): row is ParsedSmsExpense => row != null)
}

export function parsePaymentImportText(
  rawInput: string,
  options: { defaultCurrency: string }
): ParsedPaymentImport | null {
  const text = rawInput.trim()
  if (!text) return null

  const amountMatch = parseAmount(text)
  if (!amountMatch) return null

  return {
    amount: amountMatch.amount,
    currency: amountMatch.currency || options.defaultCurrency,
    date: findDateInText(text),
    note: extractReference(text),
  }
}

export function parseSmsBlob(
  rawInput: string,
  options: { defaultCurrency: string; dictionary: ImportDictionaryEntry[] }
): SmsParseResult {
  const lines = rawInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const dictionaryMap: Record<string, ImportDictionaryEntry> = {}
  for (const entry of options.dictionary) {
    dictionaryMap[entry.nameNormalized] = entry
  }

  const rows: ParsedSmsExpense[] = []
  let skippedCredits = 0

  lines.forEach((line, index) => {
    const amountMatch = parseAmount(line)
    if (!amountMatch) return

    const isIncomeCredit = isCreditMessage(line)
    if (isIncomeCredit) {
      skippedCredits += 1
    }

    const merchant = extractMerchant(line)
    const dict = merchant ? resolveDictionary(merchant, dictionaryMap) : null
    const label = dict?.label ?? (merchant ? merchant.trim() : 'Unknown item')
    const categoryType = dict?.categoryType ?? inferCategory(label)
    const categoryKey = dict?.categoryKey ?? (slugify(label) || `imported_${index + 1}`)

    rows.push({
      id: `row_${index + 1}_${categoryKey}`,
      raw: line,
      label,
      categoryType,
      categoryKey,
      customCategoryId: dict?.customCategoryId ?? null,
      amount: amountMatch.amount,
      currency: amountMatch.currency || options.defaultCurrency,
      date: parseDate(line),
      isImportedMessage: true,
      include: true,
      confidence: dict ? 'high' : 'medium',
      sourceHash: hashSmsLine(line),
      sourceType: 'sms',
      sourceRowIndex: index,
      blockedReason: isIncomeCredit ? INCOME_SMS_BLOCKED_MESSAGE : null,
    })
  })

  return {
    rows,
    scanned: lines.length,
    skippedCredits,
  }
}
