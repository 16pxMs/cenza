interface IncomeExtraLike {
  amount?: number | string | null
}

interface IncomeRowLike {
  salary?: number | string | null
  extra_income?: IncomeExtraLike[] | null
  total?: number | string | null
  cycle_start_mode?: 'full_month' | 'mid_month' | null
  opening_balance?: number | string | null
  received?: number | string | null
}

export function deriveIncomeTotal(row: IncomeRowLike | null | undefined): number {
  if (!row) return 0

  const cycleStartMode = row.cycle_start_mode === 'mid_month' ? 'mid_month' : 'full_month'
  const salary = Number(row.salary ?? 0)
  const openingBalance = Number(row.opening_balance ?? 0)
  const extras = Array.isArray(row.extra_income) ? row.extra_income : []
  const extrasTotal = extras.reduce((sum, item) => sum + Number(item?.amount ?? 0), 0)
  const derived = cycleStartMode === 'mid_month' ? openingBalance : salary + extrasTotal

  if (Number.isFinite(derived) && derived > 0) return derived

  const storedTotal = Number(row.total ?? 0)
  return Number.isFinite(storedTotal) ? storedTotal : 0
}

export function hasIncomeForCycle(row: IncomeRowLike | null | undefined): boolean {
  if (!row) return false

  return (
    deriveIncomeTotal(row) > 0 ||
    Number(row.received ?? 0) > 0
  )
}
