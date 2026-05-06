import { createClient } from '@supabase/supabase-js'

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

function asTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function isBlank(value) {
  return asTrimmedString(value) === ''
}

async function loadTransactionsNeedingBackfill(supabase) {
  const rows = []
  let from = 0

  while (true) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .or('display_name.is.null,display_name.eq.""')
      .order('id', { ascending: true })
      .range(from, to)

    if (error) {
      throw new Error(`Failed to read transactions for display_name backfill preview: ${error.message}`)
    }

    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return rows
}

async function loadDebtNameMap(supabase, linkedTransactionIds) {
  const ids = Array.from(new Set(linkedTransactionIds.filter(Boolean)))
  if (ids.length === 0) return new Map()

  const { data: debtTxRows, error: debtTxError } = await supabase
    .from('debt_transactions')
    .select('id, debt_id, linked_transaction_id, created_at')
    .in('linked_transaction_id', ids)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  if (debtTxError) {
    throw new Error(`Failed to read debt transaction links for display_name backfill preview: ${debtTxError.message}`)
  }

  const latestDebtIdByLinkedTransactionId = new Map()
  for (const row of debtTxRows ?? []) {
    const linkedTransactionId = row?.linked_transaction_id
    const debtId = row?.debt_id
    if (!linkedTransactionId || !debtId) continue
    if (!latestDebtIdByLinkedTransactionId.has(linkedTransactionId)) {
      latestDebtIdByLinkedTransactionId.set(linkedTransactionId, debtId)
    }
  }

  const debtIds = Array.from(new Set(Array.from(latestDebtIdByLinkedTransactionId.values())))
  if (debtIds.length === 0) return new Map()

  const { data: debtRows, error: debtError } = await supabase
    .from('debts')
    .select('id, name')
    .in('id', debtIds)

  if (debtError) {
    throw new Error(`Failed to read debts for display_name backfill preview: ${debtError.message}`)
  }

  const debtNameByDebtId = new Map()
  for (const row of debtRows ?? []) {
    if (!row?.id) continue
    debtNameByDebtId.set(row.id, asTrimmedString(row.name))
  }

  const debtNameByTransactionId = new Map()
  for (const [linkedTransactionId, debtId] of latestDebtIdByLinkedTransactionId.entries()) {
    const debtName = debtNameByDebtId.get(debtId)
    if (debtName) debtNameByTransactionId.set(linkedTransactionId, debtName)
  }

  return debtNameByTransactionId
}

function getProposedDisplayName(row, debtNameByTransactionId) {
  const legacyName = asTrimmedString(row.name)
  if (legacyName) {
    return {
      proposedDisplayName: legacyName,
      sourceUsed: 'legacy_name',
    }
  }

  const legacyTitle = asTrimmedString(row.title)
  if (legacyTitle) {
    return {
      proposedDisplayName: legacyTitle,
      sourceUsed: 'legacy_title',
    }
  }

  const categoryType = asTrimmedString(row.category_type)
  const categoryKey = asTrimmedString(row.category_key)
  const categoryLabel = asTrimmedString(row.category_label)

  if (categoryType === 'goal' && categoryLabel) {
    return {
      proposedDisplayName: categoryLabel,
      sourceUsed: 'goal_category_label',
    }
  }

  const debtName = debtNameByTransactionId.get(row.id) || ''
  if (categoryKey === 'debt_opening_balance' && debtName) {
    return {
      proposedDisplayName: `${debtName} balance`,
      sourceUsed: 'debt_balance_from_debt_name',
    }
  }

  if (categoryKey === 'debt_repayment' && debtName) {
    return {
      proposedDisplayName: `${debtName} payment`,
      sourceUsed: 'debt_payment_from_debt_name',
    }
  }

  if (categoryLabel) {
    return {
      proposedDisplayName: categoryLabel,
      sourceUsed: 'category_label_fallback',
    }
  }

  return {
    proposedDisplayName: null,
    sourceUsed: 'unresolved',
  }
}

async function main() {
  const supabase = createReadOnlyClient()
  const transactions = await loadTransactionsNeedingBackfill(supabase)
  const debtNameByTransactionId = await loadDebtNameMap(
    supabase,
    transactions
      .filter((row) => {
        const key = asTrimmedString(row.category_key)
        return key === 'debt_opening_balance' || key === 'debt_repayment'
      })
      .map((row) => row.id)
  )

  const previewRows = transactions.map((row) => {
    const proposal = getProposedDisplayName(row, debtNameByTransactionId)
    return {
      id: row.id,
      currentDisplayName: isBlank(row.display_name) ? null : asTrimmedString(row.display_name),
      proposedDisplayName: proposal.proposedDisplayName,
      categoryKey: asTrimmedString(row.category_key) || null,
      categoryLabel: asTrimmedString(row.category_label) || null,
      categoryType: asTrimmedString(row.category_type) || null,
      sourceUsed: proposal.sourceUsed,
    }
  })

  const sourceSummaryMap = new Map()
  for (const row of previewRows) {
    sourceSummaryMap.set(row.sourceUsed, (sourceSummaryMap.get(row.sourceUsed) ?? 0) + 1)
  }

  const output = {
    totalRowsNeedingBackfill: previewRows.length,
    sourceSummary: Array.from(sourceSummaryMap.entries())
      .map(([sourceUsed, rowCount]) => ({ sourceUsed, rowCount }))
      .sort((a, b) => a.sourceUsed.localeCompare(b.sourceUsed)),
    unresolvedCount: previewRows.filter((row) => row.proposedDisplayName == null).length,
    previewRows,
  }

  console.log(JSON.stringify(output, null, 2))
}

main().catch((error) => {
  console.error('[preview-display-name-backfill] failed')
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
