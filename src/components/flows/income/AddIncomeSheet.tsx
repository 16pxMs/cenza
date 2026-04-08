// ─────────────────────────────────────────────────────────────
// AddIncomeSheet — compatibility wrapper around AddIncomeFlow
// The main app now uses the page-first route at /income/new for income setup.
// Keep this only for demo/internal contexts that specifically need a Sheet shell.
// ─────────────────────────────────────────────────────────────
'use client'
import { AddIncomeFlow, type IncomeData } from './AddIncomeFlow'
import { Sheet } from '@/components/layout/Sheet/Sheet'

type IncomeType = 'salaried' | 'variable'

interface Props {
  open:        boolean
  onClose:     () => void
  onSave:      (data: IncomeData) => void
  currency:    string
  isDesktop?:  boolean
  incomeType?: IncomeType | null  // null = first time, show type step; set = skip type step
}

export function AddIncomeSheet({ open, onClose, onSave, currency, isDesktop, incomeType }: Props) {
  const isFirstTime = incomeType == null
  const sheetTitle = isFirstTime ? 'How do you earn?' : 'Add income'

  return (
    <Sheet open={open} onClose={onClose} title={sheetTitle} isDesktop={isDesktop}>
      <AddIncomeFlow
        incomeType={incomeType}
        currency={currency}
        onSave={onSave}
      />
    </Sheet>
  )
}
