export type OutflowCategoryType = 'fixed' | 'goal' | 'everyday' | 'debt' | 'uncategorized'

export interface OutflowCategoryRow {
  key: string
  label: string
  type: OutflowCategoryType
  spent: number
}

export interface OutflowTransaction {
  category_type?: string | null
  category_key?: string | null
  amount?: number | string | null
}

export function isDebtOpeningBalanceTransaction(
  txn: Pick<OutflowTransaction, 'category_type' | 'category_key'>
) {
  return txn.category_type === 'debt' && txn.category_key === 'debt_opening_balance'
}

export function normalizeOutflowCategoryType(categoryType: string | null | undefined): OutflowCategoryType {
  if (categoryType === 'essentials' || categoryType === 'fixed' || categoryType === 'subscription') {
    return 'fixed'
  }
  if (categoryType === 'goal') return 'goal'
  if (categoryType === 'debt') return 'debt'
  // Sentinel category_type used by past-import uncategorized historical rows.
  // Routing them through their own bucket keeps Spending honest — they are no
  // longer silently inflated into the everyday total — while still counting
  // toward overall outflow (the math adds up).
  if (categoryType === 'other' || categoryType === 'uncategorized') return 'uncategorized'
  return 'everyday'
}

export function deriveOutflowCategoryRows(txns: OutflowTransaction[]): OutflowCategoryRow[] {
  const byType: Record<OutflowCategoryType, OutflowCategoryRow> = {
    fixed: { key: 'fixed', type: 'fixed', label: 'Fixed', spent: 0 },
    everyday: { key: 'everyday', type: 'everyday', label: 'Spending', spent: 0 },
    goal: { key: 'goal', type: 'goal', label: 'Goals', spent: 0 },
    debt: { key: 'debt-entries', type: 'debt', label: 'Debt', spent: 0 },
    uncategorized: { key: 'uncategorized', type: 'uncategorized', label: 'Uncategorized', spent: 0 },
  }

  for (const txn of txns) {
    if (isDebtOpeningBalanceTransaction(txn)) continue
    const type = normalizeOutflowCategoryType(txn.category_type)
    byType[type].spent += Number(txn.amount ?? 0)
  }

  return Object.values(byType)
    .filter((row) => row.spent !== 0)
    .sort((a, b) => {
      // Uncategorized always trails categorized buckets so it visually recedes,
      // regardless of amount.
      if (a.type === 'uncategorized' && b.type !== 'uncategorized') return 1
      if (b.type === 'uncategorized' && a.type !== 'uncategorized') return -1
      return b.spent - a.spent
    })
}

export function deriveOutflowTotalFromCategories(rows: Array<Pick<OutflowCategoryRow, 'spent'>>): number {
  return rows.reduce((sum, row) => sum + row.spent, 0)
}
