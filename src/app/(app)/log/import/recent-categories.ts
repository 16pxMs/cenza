import type { CategoryConfig } from '@/lib/categories/config'
import type { CategoryOptionGroup } from '@/lib/categories/options'

const STORAGE_KEY = 'sms-import:recent-categories'
const MAX_RECENT = 6

function safeLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function dedupeRecentCategoryKeys(keys: string[], max = MAX_RECENT): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const key of keys) {
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(key)
    if (result.length >= max) break
  }
  return result
}

export function loadRecentCategoryKeys(storage?: Storage | null): string[] {
  const target = storage === undefined ? safeLocalStorage() : storage
  if (!target) return []
  try {
    const raw = target.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return dedupeRecentCategoryKeys(
      parsed.filter((value): value is string => typeof value === 'string')
    )
  } catch {
    return []
  }
}

export function recordRecentCategoryKey(key: string, storage?: Storage | null): string[] {
  const target = storage === undefined ? safeLocalStorage() : storage
  if (!key) return loadRecentCategoryKeys(target ?? null)
  if (!target) return dedupeRecentCategoryKeys([key])

  const existing = loadRecentCategoryKeys(target)
  const next = dedupeRecentCategoryKeys([key, ...existing])
  try {
    target.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore write failures (e.g. quota, private mode)
  }
  return next
}

export function getRecentCategoryOptions(
  recentKeys: string[],
  groups: CategoryOptionGroup[],
  excludeKeys: Set<string> | string[] = [],
  max = MAX_RECENT,
): CategoryConfig[] {
  const exclusion = excludeKeys instanceof Set ? excludeKeys : new Set(excludeKeys)
  const optionByKey = new Map<string, CategoryConfig>()
  for (const group of groups) {
    for (const option of group.options) {
      optionByKey.set(option.key, option)
    }
  }

  const result: CategoryConfig[] = []
  const seen = new Set<string>()
  for (const key of recentKeys) {
    if (!key || exclusion.has(key) || seen.has(key)) continue
    const option = optionByKey.get(key)
    if (!option) continue
    result.push(option)
    seen.add(key)
    if (result.length >= max) break
  }
  return result
}

/**
 * Baseline keys used to seed the Frequent section for users with no
 * recent picks yet. Ordered by typical usage in personal-finance entries.
 */
export const FREQUENT_CATEGORY_BASELINE_KEYS: string[] = [
  'groceries',
  'transport',
  'eatingOut',
  'rent',
  'internet',
  'fuel',
]

/**
 * Returns chips for the always-visible "Frequent" section.
 *
 * Ordering: the user's recent picks first (most recent → oldest),
 * then baseline defaults to fill any remaining slots. Anything in
 * `excludeKeys` (typically the keys already shown in Suggested) is
 * skipped. Result is deduped and capped at `max`.
 */
export function getFrequentCategoryOptions(
  recentKeys: string[],
  groups: CategoryOptionGroup[],
  excludeKeys: Set<string> | string[] = [],
  max = MAX_RECENT,
): CategoryConfig[] {
  const merged: string[] = []
  const seen = new Set<string>()
  for (const key of [...recentKeys, ...FREQUENT_CATEGORY_BASELINE_KEYS]) {
    if (!key || seen.has(key)) continue
    seen.add(key)
    merged.push(key)
  }
  return getRecentCategoryOptions(merged, groups, excludeKeys, max)
}

export const RECENT_CATEGORY_STORAGE_KEY = STORAGE_KEY
export const RECENT_CATEGORY_MAX = MAX_RECENT
