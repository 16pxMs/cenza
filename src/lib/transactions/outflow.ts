export type OutflowCategoryType = 'fixed' | 'goal' | 'everyday' | 'debt'

export interface OutflowCategoryRow {
  key: string
  label: string
  type: OutflowCategoryType
  spent: number
}

export interface OutflowTransaction {
  category_type?: string | null
  amount?: number | string | null
}

export function normalizeOutflowCategoryType(categoryType: string | null | undefined): OutflowCategoryType {
  if (categoryType === 'essentials' || categoryType === 'fixed' || categoryType === 'subscription') {
    return 'fixed'
  }
  if (categoryType === 'goal') return 'goal'
  if (categoryType === 'debt') return 'debt'
  return 'everyday'
}

export function deriveOutflowCategoryRows(txns: OutflowTransaction[]): OutflowCategoryRow[] {
  const byType: Record<OutflowCategoryType, OutflowCategoryRow> = {
    fixed: { key: 'fixed', type: 'fixed', label: 'Fixed', spent: 0 },
    everyday: { key: 'everyday', type: 'everyday', label: 'Spending', spent: 0 },
    goal: { key: 'goal', type: 'goal', label: 'Goals', spent: 0 },
    debt: { key: 'debt-entries', type: 'debt', label: 'Debt', spent: 0 },
  }

  for (const txn of txns) {
    const type = normalizeOutflowCategoryType(txn.category_type)
    byType[type].spent += Number(txn.amount ?? 0)
  }

  return Object.values(byType)
    .filter((row) => row.spent !== 0)
    .sort((a, b) => b.spent - a.spent)
}

export function deriveOutflowTotalFromCategories(rows: Array<Pick<OutflowCategoryRow, 'spent'>>): number {
  return rows.reduce((sum, row) => sum + row.spent, 0)
}
