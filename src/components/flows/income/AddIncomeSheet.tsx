// ─────────────────────────────────────────────────────────────
// AddIncomeSheet — Sheet for entering monthly income
// Props: open, onClose, onSave(data), currency, isDesktop, incomeType
// If incomeType is null (first time), shows a type selection step first.
// onSave returns: { income, extraIncome[], total, incomeType? }
// ─────────────────────────────────────────────────────────────
'use client'
import { useState, useEffect } from 'react'
import './AddIncomeSheet.css'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { Input } from '@/components/ui/Input/Input'
import { PrimaryBtn } from '@/components/ui/Button/Button'
import { IconPlus, IconTrash } from '@/components/ui/Icons'

type IncomeType = 'salaried' | 'variable'

interface ExtraIncome {
  id: number
  label: string
  amount: string
}

export interface IncomeData {
  income:      number
  extraIncome: { id: string; label: string; amount: number }[]
  total:       number
  incomeType?: IncomeType   // only present when selected for the first time
}

interface Props {
  open:        boolean
  onClose:     () => void
  onSave:      (data: IncomeData) => void
  currency:    string
  isDesktop?:  boolean
  incomeType?: IncomeType | null  // null = first time, show type step; set = skip type step
}

const TYPE_OPTIONS: { type: IncomeType; emoji: string; title: string; subtitle: string }[] = [
  {
    type:     'salaried',
    emoji:    '💼',
    title:    'Regular salary',
    subtitle: 'Same amount each month, on a set pay day',
  },
  {
    type:     'variable',
    emoji:    '📊',
    title:    'It varies',
    subtitle: 'Freelance, business, or income that changes month to month',
  },
]

function fmt(n: number, cur = 'KES') {
  if (!n) return `${cur} 0`
  if (n >= 1000000) return `${cur} ${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${cur} ${(n / 1000).toFixed(0)}K`
  return `${cur} ${n.toLocaleString()}`
}

export function AddIncomeSheet({ open, onClose, onSave, currency, isDesktop, incomeType }: Props) {
  const isFirstTime = incomeType == null

  const [step,         setStep]         = useState<'type' | 'amount'>(isFirstTime ? 'type' : 'amount')
  const [selectedType, setSelectedType] = useState<IncomeType | null>(incomeType ?? null)
  const [salary,       setSalary]       = useState('')
  const [extras,       setExtras]       = useState<ExtraIncome[]>([])
  const [error,        setError]        = useState<string | null>(null)

  // Reset when sheet opens
  useEffect(() => {
    if (open) {
      setStep(isFirstTime ? 'type' : 'amount')
      setSelectedType(incomeType ?? null)
      setSalary('')
      setExtras([])
      setError(null)
    }
  }, [open])

  const activeType = selectedType ?? incomeType

  // Extra income row helpers
  const addExtra    = () => setExtras(e => [...e, { id: Date.now(), label: '', amount: '' }])
  const updateExtra = (id: number, field: keyof ExtraIncome, val: string) =>
    setExtras(e => e.map(x => x.id === id ? { ...x, [field]: val } : x))
  const removeExtra = (id: number) => setExtras(e => e.filter(x => x.id !== id))

  const salaryNum   = Number(salary)
  const canSave     = salary !== '' && !isNaN(salaryNum) && salaryNum > 0
  const validExtras = extras.filter(x => x.label && Number(x.amount) > 0)
  const extrasTotal = validExtras.reduce((s, x) => s + Number(x.amount), 0)
  const total       = canSave ? salaryNum + extrasTotal : 0

  const handleSave = () => {
    if (!salary || isNaN(salaryNum) || salaryNum <= 0) {
      setError('Please enter your monthly income')
      return
    }
    setError(null)
    onSave({
      income: salaryNum,
      extraIncome: validExtras.map(x => ({
        id: String(x.id), label: x.label, amount: Number(x.amount),
      })),
      total,
      ...(isFirstTime && selectedType ? { incomeType: selectedType } : {}),
    })
  }

  const sheetTitle = step === 'type' ? 'How do you earn?' : 'Add income'

  return (
    <Sheet open={open} onClose={onClose} title={sheetTitle} isDesktop={isDesktop}>

      {/* ── Step 1: Type selection (first time only) ── */}
      {step === 'type' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: '0 0 4px', fontSize: 14, color: 'var(--text-3)', lineHeight: 1.6 }}>
            This helps us shape the experience around how you actually get paid.
          </p>

          {TYPE_OPTIONS.map(opt => (
            <button
              key={opt.type}
              onClick={() => { setSelectedType(opt.type); setStep('amount') }}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                width: '100%', padding: '16px 18px', textAlign: 'left',
                background: 'var(--white)', border: `1px solid var(--border)`,
                borderRadius: 14, cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>{opt.emoji}</span>
              <div>
                <p style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>
                  {opt.title}
                </p>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>
                  {opt.subtitle}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Step 2: Amount entry ── */}
      {step === 'amount' && (
        <>
          {isFirstTime && (
            <button
              onClick={() => setStep('type')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '0 0 16px', fontSize: 13, color: 'var(--text-3)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              ← Back
            </button>
          )}

          <Input
            label={activeType === 'variable' ? 'Typical monthly income' : 'Monthly salary / main income'}
            value={salary}
            onChange={v => { setSalary(v); if (error) setError(null) }}
            prefix={currency}
            placeholder="e.g. 50,000"
            type="number"
            hint={
              activeType === 'variable'
                ? 'Your rough average — you can update this any time.'
                : 'Your regular take-home pay this month.'
            }
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
        </>
      )}

    </Sheet>
  )
}
