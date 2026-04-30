import type { Debt } from '@/lib/supabase/debt-db'

export type DebtListVisibility = 'active' | 'settled' | 'hidden'
export type DebtDetailState = 'active' | 'orphaned' | 'settled'

type DebtStateInput = Pick<Debt, 'status' | 'current_balance'>

export function getDebtListVisibility(debt: DebtStateInput): DebtListVisibility {
  if (debt.status === 'cancelled') return 'hidden'
  if (debt.status === 'cleared' || debt.current_balance <= 0) return 'settled'
  if (debt.status === 'active') return 'active'
  return 'hidden'
}

export function isDebtSettled(debt: DebtStateInput): boolean {
  return getDebtListVisibility(debt) === 'settled'
}

export function getDebtDetailState(
  debt: DebtStateInput,
  hasTransactions: boolean
): DebtDetailState {
  if (isDebtSettled(debt)) return 'settled'
  if (debt.status === 'active' && !hasTransactions) return 'orphaned'
  return 'active'
}
