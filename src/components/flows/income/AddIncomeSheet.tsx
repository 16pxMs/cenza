// ─────────────────────────────────────────────────────────────
// AddIncomeSheet — Sheet for entering monthly income
// Props: open, onClose, onSave(data), currency, isDesktop
// onSave returns: { income, extraIncome[], total }
// Extra income rows are dynamic — add/remove at will
// ─────────────────────────────────────────────────────────────
'use client'
import { useState } from 'react'
import './AddIncomeSheet.css'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { Input } from '@/components/ui/Input/Input'
import { PrimaryBtn } from '@/components/ui/Button/Button'
import { IconPlus, IconTrash } from '@/components/ui/Icons'

interface ExtraIncome {
  id: number
  label: string
  amount: string
}

interface IncomeData {
  income: number
  extraIncome: { id: string; label: string; amount: number }[]
  total: number
}

interface Props {
  open: boolean
  onClose: () => void
  onSave: (data: IncomeData) => void
  currency: string
  isDesktop?: boolean
}

function fmt(n: number, cur = 'KES') {
  if (!n) return `${cur} 0`
  if (n >= 1000000) return `${cur} ${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${cur} ${(n / 1000).toFixed(0)}K`
  return `${cur} ${n.toLocaleString()}`
}

export function AddIncomeSheet({ open, onClose, onSave, currency, isDesktop }: Props) {
  const [salary, setSalary] = useState('')
  const [extras, setExtras] = useState<ExtraIncome[]>([])
  const [error, setError] = useState<string | null>(null)

  // Extra income row helpers
  const addExtra = () => setExtras(e => [...e, { id: Date.now(), label: '', amount: '' }])
  const updateExtra = (id: number, field: keyof ExtraIncome, val: string) =>
    setExtras(e => e.map(x => x.id === id ? { ...x, [field]: val } : x))
  const removeExtra = (id: number) => setExtras(e => e.filter(x => x.id !== id))

  const salaryNum = Number(salary)
  const canSave = salary !== '' && !isNaN(salaryNum) && salaryNum > 0

  // Only include extras with both fields filled and a positive amount
  const validExtras = extras.filter(x => x.label && Number(x.amount) > 0)
  const extrasTotal = validExtras.reduce((s, x) => s + Number(x.amount), 0)
  const total = canSave ? salaryNum + extrasTotal : 0

  const handleSalaryChange = (val: string) => {
    setSalary(val)
    if (error) setError(null)
  }

  const handleSave = () => {
    // Frontend validation — never allow zero or empty
    if (!salary || isNaN(salaryNum) || salaryNum <= 0) {
      setError('Please enter your monthly income')
      return
    }

    setError(null)
    onSave({
      income: salaryNum,
      extraIncome: validExtras.map(x => ({
        id: String(x.id),
        label: x.label,
        amount: Number(x.amount),
      })),
      total,
    })
    setSalary('')
    setExtras([])
    // Do NOT call onClose() here — parent closes only after a successful save
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add income" isDesktop={isDesktop}>
      <Input
        label="Monthly salary / main income"
        value={salary}
        onChange={handleSalaryChange}
        prefix={currency}
        placeholder="e.g. 50,000"
        type="number"
        hint="Your regular take home pay this month."
        error={error ?? undefined}
      />

      {extras.map((x, i) => (
        <div key={x.id} className="income-extra-row">
          <div className="income-extra-row__header">
            <span className="income-extra-row__label">Extra income {i + 1}</span>
            <button className="income-extra-row__remove" onClick={() => removeExtra(x.id)}>
              <IconTrash size={14} />
            </button>
          </div>
          <Input
            label="Source"
            value={x.label}
            onChange={v => updateExtra(x.id, 'label', v)}
            placeholder="e.g. Freelance, Dividends"
          />
          <Input
            label="Amount"
            value={x.amount}
            onChange={v => updateExtra(x.id, 'amount', v)}
            prefix={currency}
            placeholder="e.g. 10,000"
            type="number"
          />
        </div>
      ))}

      <button className="income-add-extra" onClick={addExtra}>
        <IconPlus color="var(--text-3)" size={13} />
        Add extra income source
      </button>

      {total > 0 && (
        <div className="income-total">
          <span className="income-total__label">Total income</span>
          <span className="income-total__amount">{fmt(total, currency)}</span>
        </div>
      )}

      <PrimaryBtn onClick={handleSave} disabled={!canSave}>Save income</PrimaryBtn>
    </Sheet>
  )
}
