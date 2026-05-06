import type { CategoryType } from '../../types/database'
import {
  CATEGORY_ALIASES,
  CATEGORY_CONFIG,
  getCategoryTypeFromKey,
  isKnownCategoryKey,
  resolveCategoryKey,
} from './config-data.js'

export interface CategoryAuditSourceRow {
  id?: string | null
  category_type?: string | null
  category_key?: string | null
  category_label?: string | null
}

export interface CategoryAuditProblemRow {
  id: string | null
  categoryType: string | null
  categoryKey: string | null
  categoryLabel: string | null
  flags: string[]
  canonicalKey: string | null
  expectedType: CategoryType | null
}

export interface CategoryAuditCountRow {
  value: string
  count: number
}

export interface CategoryAuditCombinationRow {
  categoryType: string | null
  categoryKey: string | null
  categoryLabel: string | null
  count: number
}

export interface CategoryAuditReport {
  totalRows: number
  categoryTypes: CategoryAuditCountRow[]
  categoryKeys: CategoryAuditCountRow[]
  categoryLabels: CategoryAuditCountRow[]
  combinations: CategoryAuditCombinationRow[]
  problemRows: CategoryAuditProblemRow[]
}

const LEGACY_CATEGORY_TYPES = new Set(['essentials', 'subscription', 'other'])

function asTrimmedString(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed ? trimmed : null
}

function slugifyLabel(value: string | null | undefined): string | null {
  const trimmed = asTrimmedString(value)
  if (!trimmed) return null

  return trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function hasCanonicalKeyStyle(value: string) {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(value)
}

function countValues(values: Array<string | null>): CategoryAuditCountRow[] {
  const counts = new Map<string, number>()

  for (const value of values) {
    const key = value ?? '(null)'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

export function analyzeCategoryRow(row: CategoryAuditSourceRow): CategoryAuditProblemRow | null {
  const categoryType = asTrimmedString(row.category_type)
  const categoryKey = asTrimmedString(row.category_key)
  const categoryLabel = asTrimmedString(row.category_label)
  const canonicalKey = resolveCategoryKey(categoryKey)
  const expectedType = categoryKey ? getCategoryTypeFromKey(categoryKey) : null
  const flags: string[] = []

  if (!categoryType) flags.push('missing_category_type')
  if (!categoryKey) flags.push('missing_category_key')
  if (!categoryLabel) flags.push('missing_category_label')

  if (categoryType && LEGACY_CATEGORY_TYPES.has(categoryType)) {
    flags.push('legacy_category_type')
  }

  if (categoryKey && !isKnownCategoryKey(categoryKey)) {
    flags.push('unknown_category_key')
  }

  if (categoryKey && !hasCanonicalKeyStyle(categoryKey)) {
    flags.push('non_canonical_key_style')
  }

  if (categoryKey && categoryLabel) {
    const labelSlug = slugifyLabel(categoryLabel)
    if (labelSlug && labelSlug === categoryKey && !isKnownCategoryKey(categoryKey)) {
      flags.push('likely_label_derived_key')
    }
  }

  if (categoryType && expectedType && categoryType !== expectedType) {
    flags.push('category_type_mismatch')
  }

  if (flags.length === 0) return null

  return {
    id: asTrimmedString(row.id ?? null),
    categoryType,
    categoryKey,
    categoryLabel,
    flags,
    canonicalKey,
    expectedType,
  }
}

export function buildCategoryAuditReport(rows: CategoryAuditSourceRow[]): CategoryAuditReport {
  const normalizedRows = rows.map((row) => ({
    id: asTrimmedString(row.id ?? null),
    categoryType: asTrimmedString(row.category_type),
    categoryKey: asTrimmedString(row.category_key),
    categoryLabel: asTrimmedString(row.category_label),
  }))

  const combinations = new Map<string, CategoryAuditCombinationRow>()

  for (const row of normalizedRows) {
    const key = [
      row.categoryType ?? '(null)',
      row.categoryKey ?? '(null)',
      row.categoryLabel ?? '(null)',
    ].join('|')

    const existing = combinations.get(key)
    if (existing) {
      existing.count += 1
    } else {
      combinations.set(key, {
        categoryType: row.categoryType,
        categoryKey: row.categoryKey,
        categoryLabel: row.categoryLabel,
        count: 1,
      })
    }
  }

  return {
    totalRows: normalizedRows.length,
    categoryTypes: countValues(normalizedRows.map((row) => row.categoryType)),
    categoryKeys: countValues(normalizedRows.map((row) => row.categoryKey)),
    categoryLabels: countValues(normalizedRows.map((row) => row.categoryLabel)),
    combinations: Array.from(combinations.values()).sort(
      (a, b) => b.count - a.count
        || (a.categoryType ?? '').localeCompare(b.categoryType ?? '')
        || (a.categoryKey ?? '').localeCompare(b.categoryKey ?? '')
        || (a.categoryLabel ?? '').localeCompare(b.categoryLabel ?? '')
    ),
    problemRows: rows
      .map((row) => analyzeCategoryRow(row))
      .filter((row): row is CategoryAuditProblemRow => row != null),
  }
}
