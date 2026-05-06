import { writeFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import { buildCategoryMigrationPlan } from '../src/lib/categories/migration-plan.ts'

const PAGE_SIZE = 1000
const OUTPUT_PATH = 'category-normalization-20260506.sql'

function quoteSqlString(value) {
  return `'${value.replace(/'/g, "''")}'`
}

function quoteNullable(value) {
  return value == null ? 'NULL' : quoteSqlString(value)
}

function buildCategoryMigrationSqlPlan(rows) {
  const plan = buildCategoryMigrationPlan(rows, { exampleLimit: 0, previewPageSize: rows.length })
  const updateRows = []

  for (const row of plan.preview.rows) {
    if (!row.id || !row.proposed) continue
    if (row.bucket === 'valid' || row.bucket === 'unknown') continue

    const to = {
      category_key: row.proposed.key,
      category_label: row.proposed.label,
      category_type: row.proposed.type,
    }

    if (row.bucket === 'needs_key_fix') {
      updateRows.push({
        id: row.id,
        bucket: row.bucket,
        columns: ['category_key', 'category_label', 'category_type'],
        to,
      })
      continue
    }

    if (row.bucket === 'needs_label_fix') {
      updateRows.push({
        id: row.id,
        bucket: row.bucket,
        columns: ['category_label'],
        to,
      })
      continue
    }

    if (row.bucket === 'needs_type_fix') {
      updateRows.push({
        id: row.id,
        bucket: row.bucket,
        columns: ['category_type'],
        to,
      })
    }
  }

  const sortedIds = updateRows.map((row) => row.id).sort()
  const previewQuery = [
    `-- Preview expected affected rows before any UPDATE`,
    `-- Expected row count: ${sortedIds.length}`,
    `SELECT id, category_key, category_label, category_type`,
    `FROM transactions`,
    `WHERE id IN (${sortedIds.map(quoteSqlString).join(', ')})`,
    `ORDER BY id;`,
  ].join('\n')

  const groups = new Map()

  for (const row of updateRows) {
    const groupKey = JSON.stringify({
      bucket: row.bucket,
      columns: row.columns,
      to: row.to,
    })
    const existing = groups.get(groupKey)
    if (existing) existing.push(row)
    else groups.set(groupKey, [row])
  }

  const updateQueries = Array.from(groups.values())
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

  return [
    'BEGIN;',
    previewQuery,
    '',
    '-- Verify the preview row count and values before running the UPDATE statements below.',
    ...updateQueries,
    'COMMIT;',
  ].join('\n\n')
}

function createReadOnlyClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const adminKey = secretKey || serviceRoleKey

  console.log('[env check]')
  console.log(`- SUPABASE_URL: ${url ? 'present' : 'missing'}`)
  console.log(`- SUPABASE_SECRET_KEY: ${secretKey ? 'present' : 'missing'}`)
  console.log(`- SUPABASE_SERVICE_ROLE_KEY: ${serviceRoleKey ? 'present' : 'missing'}`)

  if (!url || !adminKey) {
    throw new Error(
      'Missing Supabase credentials. Set SUPABASE_SECRET_KEY (preferred) or SUPABASE_SERVICE_ROLE_KEY.'
    )
  }

  return createClient(url, adminKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

async function loadTransactionCategoryRows() {
  const supabase = createReadOnlyClient()
  const rows = []
  let from = 0

  while (true) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('transactions')
      .select('id, category_type, category_key, category_label')
      .order('id', { ascending: true })
      .range(from, to)

    if (error) {
      throw new Error(`Failed to read transactions for SQL generation: ${error.message}`)
    }

    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return rows
}

async function main() {
  const rows = await loadTransactionCategoryRows()
  const transactionSql = buildCategoryMigrationSqlPlan(rows)
  await writeFile(OUTPUT_PATH, `${transactionSql}\n`, 'utf8')
  console.log(`[write-category-migration-sql] wrote ${OUTPUT_PATH}`)
}

main().catch((error) => {
  console.error('[write-category-migration-sql] failed')
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
