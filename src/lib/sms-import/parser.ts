import type { CategoryType } from '@/types/database'

export type ImportCategoryType = Extract<CategoryType, 'everyday' | 'fixed' | 'debt'>

export interface ImportDictionaryEntry {
  nameNormalized: string
  label: string
  categoryType: ImportCategoryType
  categoryKey: string
}

export interface ParsedSmsExpense {
  id: string
  raw: string
  label: string
  categoryType: ImportCategoryType
  categoryKey: string
  amount: number
  currency: string
  date: string
  include: boolean
  confidence: 'high' | 'medium' | 'low'
}

export interface SmsParseResult {
  rows: ParsedSmsExpense[]
  scanned: number
  skippedCredits: number
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
  'received',
  'deposit',
  'salary',
  'reversal',
  'refund',
  'inflow',
]

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

function toIsoLocalDate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isCreditMessage(text: string) {
  const lower = text.toLowerCase()
  const hasCredit = CREDIT_HINTS.some((hint) => lower.includes(hint))
  const hasDebit = DEBIT_HINTS.some((hint) => lower.includes(hint))
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

function parseDate(raw: string): string {
  const lower = raw.toLowerCase()
  const now = new Date()
  now.setHours(12, 0, 0, 0)

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

  const monthName = raw.match(/\b(?:on\s+)?([A-Za-z]{3,9})\s+(\d{1,2})(?:,?\s*(\d{2,4}))?\b/)
  if (monthName) {
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

    const month = monthMap[monthName[1].toLowerCase()]
    if (month != null) {
      const day = Number(monthName[2])
      const yearRaw = monthName[3] ? Number(monthName[3]) : now.getFullYear()
      const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw
      const d = new Date(year, month, day, 12, 0, 0, 0)
      return toIsoLocalDate(d)
    }
  }

  return toIsoLocalDate(now)
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

  if (dictionary[normalized]) return dictionary[normalized]

  if (normalized.length < 4) return null
  const entries = Object.values(dictionary)
  const containsMatch = entries.find((entry) =>
    normalized.includes(entry.nameNormalized) || entry.nameNormalized.includes(normalized)
  )

  return containsMatch ?? null
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
    if (isCreditMessage(line)) {
      skippedCredits += 1
      return
    }

    const amountMatch = parseAmount(line)
    if (!amountMatch) return

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
      amount: amountMatch.amount,
      currency: amountMatch.currency || options.defaultCurrency,
      date: parseDate(line),
      include: true,
      confidence: dict ? 'high' : amountMatch.confidence,
    })
  })

  return {
    rows,
    scanned: lines.length,
    skippedCredits,
  }
}
