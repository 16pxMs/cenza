'use client'

import { useEffect, useState } from 'react'
import './AddIncomeSheet.css'
import { Input } from '@/components/ui/Input/Input'
import { PrimaryBtn } from '@/components/ui/Button/Button'
import { IconBack, IconPlus, IconTrash } from '@/components/ui/Icons'
import { sumAmounts, safeNum } from '@/lib/math/finance'

type IncomeType = 'salaried' | 'variable'

interface ExtraIncome {
  id: number
  label: string
  amount: string
}

export interface IncomeData {
  income: number
  extraIncome: { id: string; label: string; amount: number }[]
  total: number
  incomeType?: IncomeType
}

interface Props {
  incomeType?: IncomeType | null
  currency: string
  onSave: (data: IncomeData) => void
  onBack?: () => void
  step?: 'type' | 'amount'
  onStepChange?: (step: 'type' | 'amount') => void
  showInnerBack?: boolean
}

const TYPE_OPTIONS: { type: IncomeType; title: string; subtitle: string }[] = [
  {
    type: 'salaried',
    title: 'Regular salary',
    subtitle: 'Fixed amount, same day each month',
  },
  {
    type: 'variable',
    title: 'It varies',
    subtitle: 'Freelance or variable month-to-month',
  },
]

function fmt(n: number, cur = 'KES') {
  if (!n) return `${cur} 0`
  return `${cur} ${n.toLocaleString()}`
}

export function AddIncomeFlow({
  incomeType,
  currency,
  onSave,
  onBack,
  step: controlledStep,
  onStepChange,
  showInnerBack = true,
}: Props) {
  const isFirstTime = incomeType == null

  const [step, setStep] = useState<'type' | 'amount'>(isFirstTime ? 'type' : 'amount')
  const [selectedType, setSelectedType] = useState<IncomeType | null>(incomeType ?? null)
  const [salary, setSalary] = useState('')
  const [extras, setExtras] = useState<ExtraIncome[]>([])
  const [error, setError] = useState<string | null>(null)
  const activeStep = controlledStep ?? step

  const setActiveStep = (nextStep: 'type' | 'amount') => {
    if (controlledStep === undefined) {
      setStep(nextStep)
    }
    onStepChange?.(nextStep)
  }

  useEffect(() => {
    if (controlledStep === undefined) {
      setStep(isFirstTime ? 'type' : 'amount')
    }
    setSelectedType(incomeType ?? null)
    setSalary('')
    setExtras([])
    setError(null)
  }, [incomeType, isFirstTime])

  const activeType = selectedType ?? incomeType

  const addExtra = () => setExtras(e => [...e, { id: Date.now(), label: '', amount: '' }])
  const updateExtra = (id: number, field: keyof ExtraIncome, val: string) =>
    setExtras(e => e.map(x => x.id === id ? { ...x, [field]: val } : x))
  const removeExtra = (id: number) => setExtras(e => e.filter(x => x.id !== id))

  const salaryNum = safeNum(salary)
  const canSave = salary !== '' && salaryNum > 0
  const validExtras = extras.filter(x => x.label && safeNum(x.amount) > 0)
  const extrasTotal = activeType === 'variable' ? 0 : sumAmounts(validExtras)
  const total = canSave ? safeNum(salaryNum) + extrasTotal : 0

  const handleSave = () => {
    if (!salary || isNaN(salaryNum) || salaryNum <= 0) {
      setError('Please enter your monthly income')
      return
    }
    setError(null)
    onSave({
      income: salaryNum,
      extraIncome: activeType === 'variable'
        ? []
        : validExtras.map(x => ({
            id: String(x.id), label: x.label, amount: Number(x.amount),
          })),
      total,
      ...(isFirstTime && selectedType ? { incomeType: selectedType } : {}),
    })
  }

  return (
    <>
      {activeStep === 'type' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {TYPE_OPTIONS.map(opt => (
            <button
              key={opt.type}
              onClick={() => { setSelectedType(opt.type); setActiveStep('amount') }}
              style={{
                display: 'flex', alignItems: 'center',
                width: '100%', padding: '16px 18px', textAlign: 'left',
                background: 'var(--white)', border: '1px solid var(--border)',
                borderRadius: 14, cursor: 'pointer',
              }}
            >
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

      {activeStep === 'amount' && (
        <>
          {showInnerBack && (isFirstTime || onBack) && (
            <button
              onClick={() => {
                if (isFirstTime) setActiveStep('type')
                else onBack?.()
              }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                width: 44, height: 44, padding: 0, marginBottom: 16, color: 'var(--grey-900)',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Go back"
            >
              <IconBack size={18} />
            </button>
          )}

          <Input
            label={activeType === 'variable' ? 'Expected income this month' : 'Monthly salary / main income'}
            value={salary}
            onChange={v => { setSalary(v); if (error) setError(null) }}
            prefix={currency}
            placeholder="e.g. 50,000"
            type="number"
            autoFocus
            hint={
              activeType === 'variable'
                ? 'A realistic estimate. You can log actual money received as the month goes.'
                : 'Your regular take-home pay this month.'
            }
            error={error ?? undefined}
          />

          {activeType !== 'variable' && extras.map((x, i) => (
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
                autoFocus={false}
              />
            </div>
          ))}

          {activeType !== 'variable' && (
            <button className="income-add-extra" onClick={addExtra}>
              <IconPlus color="var(--text-3)" size={13} />
              Add extra income source
            </button>
          )}

          {total > 0 && (
            <div className="income-total">
              <span className="income-total__label">Total income</span>
              <span className="income-total__amount">{fmt(total, currency)}</span>
            </div>
          )}

          <PrimaryBtn size="lg" onClick={handleSave} disabled={!canSave}>Save income</PrimaryBtn>
        </>
      )}
    </>
  )
}
