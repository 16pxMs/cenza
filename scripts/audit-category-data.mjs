import { createClient } from '@supabase/supabase-js'
import { buildCategoryAuditReport } from '../src/lib/categories/audit.ts'

const PAGE_SIZE = 1000

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
      throw new Error(`Failed to read transactions for audit: ${error.message}`)
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
  const report = buildCategoryAuditReport(rows)

  const output = {
    generatedAt: new Date().toISOString(),
    totalRows: report.totalRows,
    categoryTypes: report.categoryTypes,
    categoryKeys: report.categoryKeys,
    categoryLabels: report.categoryLabels,
    combinations: report.combinations,
    problemSummary: report.problemRows.reduce((summary, row) => {
      for (const flag of row.flags) {
        summary[flag] = (summary[flag] ?? 0) + 1
      }
      return summary
    }, {}),
    problemRows: report.problemRows,
  }

  console.log(JSON.stringify(output, null, 2))
}

main().catch((error) => {
  console.error('[audit-category-data] failed')
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
