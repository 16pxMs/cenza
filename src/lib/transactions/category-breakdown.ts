import { getCategoryConfig } from '@/lib/categories/config'
import type { CategoryType } from '@/types/database'

export interface CategoryBreakdownTransaction {
  category_type?: string | null
  category_key?: string | null
  category_label?: string | null
  custom_category_id?: string | null
  amount?: number | string | null
}

export interface CategoryBreakdownRow {
  categoryKey: string
  customCategoryId: string | null
  categoryLabel: string
  categoryType: CategoryType
  totalAmount: number
  percentageOfTotal: number
  transactionCount: number
}

const EXCLUDED_KEYS = new Set<string>([
  'debt_opening_balance',
])

const EXCLUDED_TYPES = new Set<string>([
  'transfer',
])

function isSpendingTransaction(txn: CategoryBreakdownTransaction): boolean {
  const key = typeof txn.category_key === 'string' ? txn.category_key.trim() : ''
  if (!key) return false
  if (EXCLUDED_KEYS.has(key)) return false

  const type = typeof txn.category_type === 'string' ? txn.category_type.trim() : ''
  if (EXCLUDED_TYPES.has(type)) return false

  const amount = Number(txn.amount ?? 0)
  if (!Number.isFinite(amount) || amount <= 0) return false

  return true
}

interface InternalBucket {
  total: number
  count: number
  rawType: string | null
  rawLabel: string | null
  rawKey: string
  customCategoryId: string | null
}

/**
 * Groups transactions by custom category id when present, otherwise by
 * canonical `category_key`.
 *
 * Rules:
 * - Excludes `debt_opening_balance` (accounting entry, not spending).
 * - Excludes any row with `category_type === 'transfer'` (defensive).
 * - Excludes non-positive amounts (refunds/credits).
 * - Groups by custom category id first, then `category_key` — never by label.
 * - Sorts by `totalAmount` descending; ties broken by key ascending.
 */
export function deriveCategoryBreakdown(
  txns: CategoryBreakdownTransaction[],
): CategoryBreakdownRow[] {
  const buckets = new Map<string, InternalBucket>()
  let grandTotal = 0

  for (const txn of txns) {
    if (!isSpendingTransaction(txn)) continue

    const rawKey = (txn.category_key as string).trim()
    const customCategoryId =
      typeof txn.custom_category_id === 'string' && txn.custom_category_id.trim()
        ? txn.custom_category_id.trim()
        : null
    const bucketKey = customCategoryId ? `custom:${customCategoryId}` : rawKey
    const amount = Number(txn.amount ?? 0)
    const bucket = buckets.get(bucketKey)

    if (bucket) {
      bucket.total += amount
      bucket.count += 1
    } else {
      buckets.set(bucketKey, {
        total: amount,
        count: 1,
        rawType: typeof txn.category_type === 'string' ? txn.category_type : null,
        rawLabel: typeof txn.category_label === 'string' ? txn.category_label : null,
        rawKey,
        customCategoryId,
      })
    }

    grandTotal += amount
  }

  const rows: CategoryBreakdownRow[] = []
  for (const [bucketKey, bucket] of buckets.entries()) {
    const key = bucket.rawKey || bucketKey
    const config = getCategoryConfig(key)
    const label = bucket.customCategoryId
      ? bucket.rawLabel?.trim() ?? key
      : config?.label ?? bucket.rawLabel?.trim() ?? key
    const type: CategoryType = (config?.type
      ?? (bucket.rawType as CategoryType | null)
      ?? 'other')

    rows.push({
      categoryKey: key,
      customCategoryId: bucket.customCategoryId,
      categoryLabel: label,
      categoryType: type,
      totalAmount: bucket.total,
      percentageOfTotal: grandTotal > 0 ? (bucket.total / grandTotal) * 100 : 0,
      transactionCount: bucket.count,
    })
  }

  rows.sort((a, b) => {
    if (b.totalAmount !== a.totalAmount) return b.totalAmount - a.totalAmount
    if (a.categoryKey < b.categoryKey) return -1
    if (a.categoryKey > b.categoryKey) return 1
    return 0
  })

  return rows
}
