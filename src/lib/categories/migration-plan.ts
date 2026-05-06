import type { CategoryType } from '../../types/database'
import { getCategoryLabel, getCategoryTypeFromKey, resolveCategoryKey } from './config-data.js'
import type { CategoryAuditSourceRow } from './audit'

export type CategoryMigrationBucket =
  | 'valid'
  | 'needs_type_fix'
  | 'needs_label_fix'
  | 'needs_key_fix'
  | 'unknown'

export interface CategoryMigrationPreviewRow {
  id: string | null
  bucket: CategoryMigrationBucket
  current: {
    type: string | null
    key: string | null
    label: string | null
  }
  derived: {
    canonicalKey: string | null
    expectedType: CategoryType | null
    expectedLabel: string | null
  }
  proposed: {
    type: string | null
    key: string | null
    label: string | null
  } | null
  reasons: string[]
}

export interface CategoryMigrationSummaryRow {
  bucket: CategoryMigrationBucket
  count: number
}

export interface CategoryMappingTableRow {
  changeType: 'type' | 'key' | 'label'
  from: string
  to: string
  reason: string
  count: number
}

export interface CategoryMigrationPlanReport {
  totalRows: number
  summary: CategoryMigrationSummaryRow[]
  mappingTable: CategoryMappingTableRow[]
  examplesByBucket: Record<CategoryMigrationBucket, CategoryMigrationPreviewRow[]>
  preview: {
    total: number
    pageSize: number
    rows: CategoryMigrationPreviewRow[]
  }
  unknownCount: number
}

function asTrimmedString(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed ? trimmed : null
}

function normalizeLabelForCompare(value: string | null | undefined): string | null {
  const trimmed = asTrimmedString(value)
  if (!trimmed) return null

  return trimmed
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function labelsMatch(current: string | null, expected: string | null) {
  if (!current || !expected) return false
  return normalizeLabelForCompare(current) === normalizeLabelForCompare(expected)
}

export function buildCategoryMigrationPreviewRow(
  row: CategoryAuditSourceRow
): CategoryMigrationPreviewRow {
  const currentType = asTrimmedString(row.category_type)
  const currentKey = asTrimmedString(row.category_key)
  const currentLabel = asTrimmedString(row.category_label)
  const canonicalKey = resolveCategoryKey(currentKey)
  const expectedType = canonicalKey ? getCategoryTypeFromKey(canonicalKey) : null
  const expectedLabel = canonicalKey ? getCategoryLabel(canonicalKey) : null
  const reasons: string[] = []

  if (!canonicalKey) {
    reasons.push('Unknown category key; no safe canonical mapping found.')
    return {
      id: asTrimmedString(row.id ?? null),
      bucket: 'unknown',
      current: { type: currentType, key: currentKey, label: currentLabel },
      derived: { canonicalKey: null, expectedType: null, expectedLabel: null },
      proposed: null,
      reasons,
    }
  }

  const keyNeedsFix = currentKey !== canonicalKey
  const typeNeedsFix = Boolean(expectedType && currentType !== expectedType)
  const labelNeedsFix = !currentLabel || !labelsMatch(currentLabel, expectedLabel)

  if (keyNeedsFix) {
    reasons.push('Current key can be safely resolved to a canonical key.')
  }
  if (typeNeedsFix) {
    reasons.push('Current category_type does not match the canonical key type.')
  }
  if (labelNeedsFix) {
    reasons.push(
      currentLabel
        ? 'Current category_label is inconsistent with the canonical category label.'
        : 'Current category_label is missing.'
    )
  }

  const proposed = {
    type: expectedType,
    key: canonicalKey,
    label: expectedLabel,
  }

  let bucket: CategoryMigrationBucket = 'valid'
  if (keyNeedsFix) bucket = 'needs_key_fix'
  else if (typeNeedsFix) bucket = 'needs_type_fix'
  else if (labelNeedsFix) bucket = 'needs_label_fix'

  if (bucket === 'valid') {
    reasons.push('Current row already matches the canonical category config.')
  }

  return {
    id: asTrimmedString(row.id ?? null),
    bucket,
    current: { type: currentType, key: currentKey, label: currentLabel },
    derived: { canonicalKey, expectedType, expectedLabel },
    proposed: bucket === 'valid' ? proposed : proposed,
    reasons,
  }
}

function summarizeBuckets(rows: CategoryMigrationPreviewRow[]): CategoryMigrationSummaryRow[] {
  const counts = new Map<CategoryMigrationBucket, number>([
    ['valid', 0],
    ['needs_type_fix', 0],
    ['needs_label_fix', 0],
    ['needs_key_fix', 0],
    ['unknown', 0],
  ])

  for (const row of rows) {
    counts.set(row.bucket, (counts.get(row.bucket) ?? 0) + 1)
  }

  return Array.from(counts.entries()).map(([bucket, count]) => ({ bucket, count }))
}

function buildMappingTable(rows: CategoryMigrationPreviewRow[]): CategoryMappingTableRow[] {
  const counts = new Map<string, CategoryMappingTableRow>()

  for (const row of rows) {
    if (!row.proposed || row.bucket === 'valid' || row.bucket === 'unknown') continue

    const register = (changeType: 'type' | 'key' | 'label', from: string | null, to: string | null, reason: string) => {
      if (!from || !to || from === to) return
      const id = `${changeType}|${from}|${to}|${reason}`
      const existing = counts.get(id)
      if (existing) {
        existing.count += 1
      } else {
        counts.set(id, { changeType, from, to, reason, count: 1 })
      }
    }

    register('key', row.current.key, row.proposed.key, 'Canonical key mapping')
    register('type', row.current.type, row.proposed.type, 'Canonical type alignment')
    register('label', row.current.label, row.proposed.label, 'Canonical label alignment')
  }

  return Array.from(counts.values()).sort(
    (a, b) => b.count - a.count
      || a.changeType.localeCompare(b.changeType)
      || a.from.localeCompare(b.from)
      || a.to.localeCompare(b.to)
  )
}

export function buildCategoryMigrationPlan(
  rows: CategoryAuditSourceRow[],
  options?: { exampleLimit?: number; previewPageSize?: number }
): CategoryMigrationPlanReport {
  const exampleLimit = options?.exampleLimit ?? 10
  const previewPageSize = options?.previewPageSize ?? 200
  const previewRows = rows.map((row) => buildCategoryMigrationPreviewRow(row))
  const examplesByBucket: Record<CategoryMigrationBucket, CategoryMigrationPreviewRow[]> = {
    valid: [],
    needs_type_fix: [],
    needs_label_fix: [],
    needs_key_fix: [],
    unknown: [],
  }

  for (const row of previewRows) {
    const list = examplesByBucket[row.bucket]
    if (list.length < exampleLimit) list.push(row)
  }

  return {
    totalRows: previewRows.length,
    summary: summarizeBuckets(previewRows),
    mappingTable: buildMappingTable(previewRows),
    examplesByBucket,
    preview: {
      total: previewRows.length,
      pageSize: previewPageSize,
      rows: previewRows.slice(0, previewPageSize),
    },
    unknownCount: previewRows.filter((row) => row.bucket === 'unknown').length,
  }
}
