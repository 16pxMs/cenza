'use client'

import { useEffect, useState } from 'react'
import './AddIncomeSheet.css'
import { Input } from '@/components/ui/Input/Input'
import { PrimaryBtn, SecondaryBtn, TertiaryBtn } from '@/components/ui/Button/Button'
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
  step?: 'type' | 'amount' | 'cycle' | 'payday'
  onStepChange?: (step: 'type' | 'amount' | 'cycle' | 'payday') => void
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

  const [step, setStep] = useState<'type' | 'amount' | 'cycle' | 'payday'>(isFirstTime ? 'type' : 'amount')
  const [selectedType, setSelectedType] = useState<IncomeType | null>(incomeType ?? null)
  const [selectedPayday, setSelectedPayday] = useState<number | null>(incomeType === 'salaried' ? paydayDay : null)
  const [cycleStartMode, setCycleStartMode] = useState<'full_month' | 'mid_month' | null>(null)
  const [salary, setSalary] = useState('')
  const [extras, setExtras] = useState<ExtraIncome[]>([])
  const [error, setError] = useState<string | null>(null)
  const activeStep = controlledStep ?? step

  const setActiveStep = (nextStep: 'type' | 'amount' | 'cycle' | 'payday') => {
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
    setCycleStartMode(null)
    setSalary('')
    setExtras([])
    setError(null)
  }, [incomeType, paydayDay, isFirstTime])

  const activeType: IncomeType = selectedType ?? incomeType ?? 'salaried'

  const addExtra = () => setExtras(e => [...e, { id: Date.now(), label: '', amount: '' }])
  const updateExtra = (id: number, field: keyof ExtraIncome, val: string) =>
    setExtras(e => e.map(x => x.id === id ? { ...x, [field]: val } : x))
  const removeExtra = (id: number) => setExtras(e => e.filter(x => x.id !== id))

  const salaryNum = safeNum(salary)
  const needsPayday = activeType === 'salaried'
  const isMidMonth = cycleStartMode === 'mid_month'
  const canProceedFromAmount = salary !== '' && salaryNum > 0
  const canSave = canProceedFromAmount && (!needsPayday || !!selectedPayday)
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
    const resolvedIncomeType: IncomeType | undefined = isFirstTime ? activeType : undefined

    onSave({
      income: isMidMonth ? 0 : salaryNum,
      extraIncome: activeType === 'variable' || isMidMonth
        ? []
        : validExtras.map(x => ({
            id: String(x.id), label: x.label, amount: Number(x.amount),
          })),
      total,
      cycleStartMode: cycleStartMode ?? 'full_month',
      openingBalance: isMidMonth ? salaryNum : null,
      ...(activeType === 'salaried' ? { paydayDay: selectedPayday } : { paydayDay: null }),
      ...(resolvedIncomeType ? { incomeType: resolvedIncomeType } : {}),
    })
  }

  const handleContinueFromAmount = () => {
    if (!salary || isNaN(salaryNum) || salaryNum <= 0) {
      setError(isMidMonth ? 'Please enter what you currently have left' : 'Please enter your monthly income')
      return
    }
    setError(null)
    if (isFirstTime) {
      setActiveStep('cycle')
      return
    }
    setActiveStep('payday')
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
                borderRadius: 'var(--radius-md)', cursor: 'pointer',
              }}
            >
              <div>
                <p style={{ margin: '0 0 2px', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-1)' }}>
                  {opt.title}
                </p>
                <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-3)', lineHeight: 1.5 }}>
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
                  : 'Monthly income'
            }
            value={salary}
            onChange={v => { setSalary(v); if (error) setError(null) }}
            prefix={currency}
            placeholder="e.g. 50,000"
            type="number"
            autoFocus
            hint={
              isMidMonth
                ? 'Use what you currently have so your starting balance is accurate.'
                : activeType === 'variable'
                ? 'Use your best estimate. You can adjust with actual money received later.'
                : 'Your regular take-home amount.'
            }
            error={error ?? undefined}
          />

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
            extras.length === 0 ? (
              <TertiaryBtn
                size="sm"
                onClick={addExtra}
                style={{
                  margin: '4px 0 16px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 'var(--text-sm)',
                }}
              >
                <IconPlus color="var(--text-brand)" size={13} />
                Add extra income source (optional)
              </TertiaryBtn>
            ) : (
              <TertiaryBtn
                size="sm"
                onClick={addExtra}
                style={{
                  width: '100%',
                  height: 42,
                  borderRadius: 10,
                  border: '1.5px dashed var(--border-strong)',
                  background: 'transparent',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  marginBottom: 20,
                  fontSize: 13,
                }}
              >
                <IconPlus color="var(--text-brand)" size={13} />
                Add another income source
              </TertiaryBtn>
            )
          )}

          {total > 0 && (
            <div className="income-total">
              <span className="income-total__label">Total income</span>
              <span className="income-total__amount">{fmt(total, currency)}</span>
            </div>
          )}

          {activeType === 'salaried' ? (
            <PrimaryBtn size="lg" onClick={handleContinueFromAmount} disabled={!canProceedFromAmount}>
              Continue
            </PrimaryBtn>
          ) : (
            <PrimaryBtn
              size="lg"
              onClick={isFirstTime ? () => setActiveStep('cycle') : handleSave}
              disabled={!canProceedFromAmount}
            >
              {isFirstTime ? 'Continue' : 'Save income'}
            </PrimaryBtn>
          )}
        </>
      )}

      {activeStep === 'cycle' && (
        <div>
          <p
            style={{
              margin: '0 0 6px',
              fontSize: 'var(--text-xl)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-1)',
              letterSpacing: '-0.01em',
              lineHeight: 1.2,
            }}
          >
            Have you received your salary this month?
          </p>
          <p
            style={{
              margin: '0 0 14px',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-3)',
              lineHeight: 1.45,
            }}
          >
            This helps us start your month from the right balance.
          </p>
          <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => {
                setCycleStartMode('full_month')
                if (activeType === 'salaried') setActiveStep('payday')
                else handleSave()
              }}
              style={{
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${cycleStartMode === 'full_month' ? 'var(--brand-mid)' : 'var(--border)'}`,
                background: cycleStartMode === 'full_month' ? 'var(--brand)' : 'var(--grey-50)',
                color: 'var(--text-1)',
                cursor: 'pointer',
                textAlign: 'left',
                padding: '12px 14px',
              }}
            >
              <p style={{ margin: '0 0 2px', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: cycleStartMode === 'full_month' ? 'var(--brand-dark)' : 'var(--text-1)' }}>
                Yes, I&apos;ve been paid
              </p>
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: cycleStartMode === 'full_month' ? 'var(--brand-dark)' : 'var(--text-3)', lineHeight: 1.4 }}>
                Start from full monthly income.
              </p>
            </button>
            <button
              type="button"
              onClick={() => {
                setCycleStartMode('mid_month')
                if (activeType === 'salaried') setActiveStep('payday')
                else handleSave()
              }}
              style={{
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${cycleStartMode === 'mid_month' ? 'var(--brand-mid)' : 'var(--border)'}`,
                background: cycleStartMode === 'mid_month' ? 'var(--brand)' : 'var(--grey-50)',
                color: 'var(--text-1)',
                cursor: 'pointer',
                textAlign: 'left',
                padding: '12px 14px',
              }}
            >
              <p style={{ margin: '0 0 2px', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: cycleStartMode === 'mid_month' ? 'var(--brand-dark)' : 'var(--text-1)' }}>
                No, I&apos;m joining mid-month
              </p>
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: cycleStartMode === 'mid_month' ? 'var(--brand-dark)' : 'var(--text-3)', lineHeight: 1.4 }}>
                Start from money available today.
              </p>
            </button>
          </div>
        </div>
      )}

      {activeStep === 'payday' && activeType === 'salaried' && (
        <>
          <div style={{ marginBottom: 16 }}>
            <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
              What day do you usually get paid?
            </p>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
              Pick the day your salary normally comes in.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                const isSelected = selectedPayday === day
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => { setSelectedPayday(day); if (error) setError(null) }}
                    style={{
                      height: 'var(--button-height-sm)',
                      borderRadius: 'var(--radius-sm)',
                      border: `var(--border-width) solid ${isSelected ? 'var(--brand-dark)' : 'var(--border)'}`,
                      background: isSelected ? 'var(--brand-dark)' : 'var(--white)',
                      color: isSelected ? 'var(--white)' : 'var(--text-2)',
                      fontSize: 'var(--text-base)',
                      fontWeight: isSelected ? 'var(--weight-semibold)' : 'var(--weight-medium)',
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
            {error && (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--red-dark)' }}>
                {error}
              </p>
            )}
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <PrimaryBtn size="lg" onClick={handleSave} disabled={!canSave}>
              Save income
            </PrimaryBtn>
            <SecondaryBtn size="lg" onClick={() => setActiveStep('amount')}>
              Back to amount
            </SecondaryBtn>
          </div>
        </>
      )}
    </>
  )
}
