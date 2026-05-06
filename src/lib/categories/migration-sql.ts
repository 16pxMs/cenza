import { buildCategoryMigrationPlan } from './migration-plan'
import type { CategoryAuditSourceRow } from './audit'

type UpdateColumn = 'category_key' | 'category_label' | 'category_type'
type UpdateBucket = 'needs_key_fix' | 'needs_label_fix' | 'needs_type_fix'

export interface CategoryMigrationUpdateRow {
  id: string
  bucket: UpdateBucket
  columns: UpdateColumn[]
  from: {
    category_key: string | null
    category_label: string | null
    category_type: string | null
  }
  to: {
    category_key: string | null
    category_label: string | null
    category_type: string | null
  }
}

export interface CategoryMigrationSqlSummary {
  total_updates: number
  key_updates: number
  label_updates: number
  type_updates: number
}

export interface CategoryMigrationSqlPlan {
  summary: CategoryMigrationSqlSummary
  previewQuery: string
  updateQueries: string[]
  transactionSql: string
  updateRows: CategoryMigrationUpdateRow[]
}

function quoteSqlString(value: string) {
  return `'${value.replace(/'/g, "''")}'`
}

function quoteNullable(value: string | null) {
  return value == null ? 'NULL' : quoteSqlString(value)
}

function byUpdateBucket(row: CategoryMigrationUpdateRow) {
  return row.bucket
}

export function buildCategoryMigrationUpdateRows(rows: CategoryAuditSourceRow[]): CategoryMigrationUpdateRow[] {
  const plan = buildCategoryMigrationPlan(rows, { exampleLimit: 0, previewPageSize: rows.length })
  const updates: CategoryMigrationUpdateRow[] = []

  for (const row of plan.preview.rows) {
    if (!row.id || !row.proposed) continue
    if (row.bucket === 'valid' || row.bucket === 'unknown') continue

    const from = {
      category_key: row.current.key,
      category_label: row.current.label,
      category_type: row.current.type,
    }
    const to = {
      category_key: row.proposed.key,
      category_label: row.proposed.label,
      category_type: row.proposed.type,
    }

    if (row.bucket === 'needs_key_fix') {
      updates.push({
        id: row.id,
        bucket: row.bucket,
        columns: ['category_key', 'category_label', 'category_type'],
        from,
        to,
      })
      continue
    }

    if (row.bucket === 'needs_label_fix') {
      updates.push({
        id: row.id,
        bucket: row.bucket,
        columns: ['category_label'],
        from,
        to,
      })
      continue
    }

    if (row.bucket === 'needs_type_fix') {
      updates.push({
        id: row.id,
        bucket: row.bucket,
        columns: ['category_type'],
        from,
        to,
      })
    }
  }

  return updates
}

function buildSummary(updateRows: CategoryMigrationUpdateRow[]): CategoryMigrationSqlSummary {
  return {
    total_updates: updateRows.length,
    key_updates: updateRows.filter((row) => row.columns.includes('category_key')).length,
    label_updates: updateRows.filter((row) => row.columns.includes('category_label')).length,
    type_updates: updateRows.filter((row) => row.columns.includes('category_type')).length,
  }
}

function buildPreviewQuery(ids: string[]) {
  const sortedIds = [...ids].sort()
  const idList = sortedIds.map(quoteSqlString).join(', ')

  return [
    `-- Preview expected affected rows before any UPDATE`,
    `-- Expected row count: ${sortedIds.length}`,
    `SELECT id, category_key, category_label, category_type`,
    `FROM transactions`,
    `WHERE id IN (${idList})`,
    `ORDER BY id;`,
  ].join('\n')
}

function buildGroupedUpdateQueries(updateRows: CategoryMigrationUpdateRow[]) {
  const groups = new Map<string, CategoryMigrationUpdateRow[]>()

  for (const row of updateRows) {
    const groupKey = JSON.stringify({
      bucket: byUpdateBucket(row),
      columns: row.columns,
      to: row.to,
    })
    const group = groups.get(groupKey)
    if (group) group.push(row)
    else groups.set(groupKey, [row])
  }

  return Array.from(groups.values())
    .sort((a, b) => a[0].bucket.localeCompare(b[0].bucket))
    .map((group) => {
      const sample = group[0]
      const setClauses = sample.columns.map((column) => `${column} = ${quoteNullable(sample.to[column])}`)
      const idList = group.map((row) => quoteSqlString(row.id)).sort().join(', ')

      return [
        `-- ${sample.bucket}: ${group.length} row(s)`,
        `UPDATE transactions`,
        `SET ${setClauses.join(', ')}`,
        `WHERE id IN (${idList});`,
      ].join('\n')
    })
}

export function buildCategoryMigrationSqlPlan(rows: CategoryAuditSourceRow[]): CategoryMigrationSqlPlan {
  const updateRows = buildCategoryMigrationUpdateRows(rows)
  const summary = buildSummary(updateRows)
  const previewQuery = buildPreviewQuery(updateRows.map((row) => row.id))
  const updateQueries = buildGroupedUpdateQueries(updateRows)
  const transactionSql = [
    'BEGIN;',
    previewQuery,
    '',
    '-- Verify the preview row count and values before running the UPDATE statements below.',
    ...updateQueries,
    'COMMIT;',
  ].join('\n\n')

  return {
    summary,
    previewQuery,
    updateQueries,
    transactionSql,
    updateRows,
  }
}
