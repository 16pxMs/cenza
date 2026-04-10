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
  paydayDay?: number | null
  cycleStartMode?: 'full_month' | 'mid_month'
  openingBalance?: number | null
}

interface Props {
  incomeType?: IncomeType | null
  paydayDay?: number | null
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
  paydayDay = null,
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
  const [selectedPayday, setSelectedPayday] = useState<number | null>(incomeType === 'salaried' ? paydayDay : null)
  const [cycleStartMode, setCycleStartMode] = useState<'full_month' | 'mid_month'>('full_month')
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
    setSelectedPayday(incomeType === 'salaried' ? paydayDay : null)
    setCycleStartMode('full_month')
    setSalary('')
    setExtras([])
    setError(null)
  }, [incomeType, paydayDay, isFirstTime])

  const activeType = selectedType ?? incomeType

  const addExtra = () => setExtras(e => [...e, { id: Date.now(), label: '', amount: '' }])
  const updateExtra = (id: number, field: keyof ExtraIncome, val: string) =>
    setExtras(e => e.map(x => x.id === id ? { ...x, [field]: val } : x))
  const removeExtra = (id: number) => setExtras(e => e.filter(x => x.id !== id))

  const salaryNum = safeNum(salary)
  const needsPayday = activeType === 'salaried'
  const isMidMonth = cycleStartMode === 'mid_month'
  const canSave = salary !== '' && salaryNum > 0 && (!needsPayday || !!selectedPayday)
  const validExtras = extras.filter(x => x.label && safeNum(x.amount) > 0)
  const extrasTotal = activeType === 'variable' || isMidMonth ? 0 : sumAmounts(validExtras)
  const total = canSave
    ? (isMidMonth ? safeNum(salaryNum) : safeNum(salaryNum) + extrasTotal)
    : 0

  const handleSave = () => {
    if (!salary || isNaN(salaryNum) || salaryNum <= 0) {
      setError(isMidMonth ? 'Please enter what you currently have left' : 'Please enter your monthly income')
      return
    }
    if (needsPayday && !selectedPayday) {
      setError('Select your pay day to continue')
      return
    }
    setError(null)
    onSave({
      income: isMidMonth ? 0 : salaryNum,
      extraIncome: activeType === 'variable' || isMidMonth
        ? []
        : validExtras.map(x => ({
            id: String(x.id), label: x.label, amount: Number(x.amount),
          })),
      total,
      cycleStartMode,
      openingBalance: isMidMonth ? salaryNum : null,
      ...(activeType === 'salaried' ? { paydayDay: selectedPayday } : { paydayDay: null }),
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
            label={
              isMidMonth
                ? 'Money left right now'
                : activeType === 'variable'
                  ? 'Expected income this month'
                  : 'Monthly salary / main income'
            }
            value={salary}
            onChange={v => { setSalary(v); if (error) setError(null) }}
            prefix={currency}
            placeholder="e.g. 50,000"
            type="number"
            autoFocus
            hint={
              isMidMonth
                ? 'Use your current balance so the app starts from your real position this cycle.'
                : activeType === 'variable'
                ? 'A realistic estimate. You can log actual money received as the month goes.'
                : 'Your regular take-home pay this month.'
            }
            error={error ?? undefined}
          />

          {isFirstTime && (
            <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setCycleStartMode('full_month')}
                style={{
                  height: 36,
                  padding: '0 14px',
                  borderRadius: 999,
                  border: `1px solid ${cycleStartMode === 'full_month' ? 'var(--brand-mid)' : 'var(--border)'}`,
                  background: cycleStartMode === 'full_month' ? 'var(--brand)' : 'var(--grey-50)',
                  color: cycleStartMode === 'full_month' ? 'var(--brand-dark)' : 'var(--text-2)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Starting from payday
              </button>
              <button
                type="button"
                onClick={() => setCycleStartMode('mid_month')}
                style={{
                  height: 36,
                  padding: '0 14px',
                  borderRadius: 999,
                  border: `1px solid ${cycleStartMode === 'mid_month' ? 'var(--brand-mid)' : 'var(--border)'}`,
                  background: cycleStartMode === 'mid_month' ? 'var(--brand)' : 'var(--grey-50)',
                  color: cycleStartMode === 'mid_month' ? 'var(--brand-dark)' : 'var(--text-2)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Starting mid-month
              </button>
            </div>
          )}

          {activeType === 'salaried' && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
                What day do you usually get paid?
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => {
                  const isSelected = selectedPayday === day
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => { setSelectedPayday(day); if (error) setError(null) }}
                      style={{
                        height: 36,
                        borderRadius: 10,
                        border: `1px solid ${isSelected ? 'var(--brand-dark)' : 'var(--border)'}`,
                        background: isSelected ? 'var(--brand-dark)' : 'var(--white)',
                        color: isSelected ? 'var(--white)' : 'var(--text-2)',
                        fontSize: 13,
                        fontWeight: isSelected ? 600 : 500,
                        cursor: 'pointer',
                      }}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-3)' }}>
                We’ll use this for your monthly income confirmation reminder.
              </p>
            </div>
          )}

          {activeType !== 'variable' && !isMidMonth && extras.map((x, i) => (
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

          {activeType !== 'variable' && !isMidMonth && (
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
