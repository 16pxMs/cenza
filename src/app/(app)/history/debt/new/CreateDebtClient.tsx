'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input/Input'
import { PrimaryBtn, SecondaryBtn } from '@/components/ui/Button/Button'
import { IconBack } from '@/components/ui/Icons'
import type { DebtDirection } from '@/lib/supabase/debt-db'
import { createDebtWithOpeningBalance } from './actions'

interface Props {
  currency: string
  returnTo: string
}

type FormErrors = {
  name?: string
  mode?: string
  direction?: string
  openingAmount?: string
  dueDate?: string
  totalCost?: string
  upfrontPaid?: string
  targetDate?: string
  form?: string
}

type CreateDebtMode = 'standard' | 'financing'

const DIRECTION_OPTIONS: Array<{
  value: DebtDirection
  label: string
  helper: string
}> = [
  {
    value: 'owed_by_me',
    label: 'You owe',
    helper: 'Money you need to pay back',
  },
  {
    value: 'owed_to_me',
    label: 'Owed to you',
    helper: 'Money someone else needs to pay you back',
  },
]

function resolveReturnPath(returnTo: string) {
  const trimmed = (returnTo || '').trim()
  return trimmed.startsWith('/') ? trimmed : '/app'
}

export default function CreateDebtClient({ currency, returnTo }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [mode, setMode] = useState<CreateDebtMode>('standard')
  const [name, setName] = useState('')
  const [direction, setDirection] = useState<DebtDirection | null>(null)
  const [openingAmount, setOpeningAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [totalCost, setTotalCost] = useState('')
  const [upfrontPaid, setUpfrontPaid] = useState('0')
  const [targetDate, setTargetDate] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})

  const nextPath = resolveReturnPath(returnTo)

  const validate = (): FormErrors => {
    const nextErrors: FormErrors = {}

    if (!name.trim()) {
      nextErrors.name = 'Debt name is required'
    }

    if (mode === 'standard') {
      if (!direction) {
        nextErrors.direction = 'Choose whether this debt is yours or owed to you'
      }

      const amount = Number(openingAmount)
      if (!Number.isFinite(amount) || amount <= 0) {
        nextErrors.openingAmount = 'Opening amount must be greater than zero'
      }
    } else {
      const total = Number(totalCost)
      const upfront = Number(upfrontPaid)

      if (!Number.isFinite(total) || total <= 0) {
        nextErrors.totalCost = 'Total cost must be greater than zero'
      }

      if (!Number.isFinite(upfront) || upfront < 0) {
        nextErrors.upfrontPaid = 'Upfront payment must be zero or greater'
      } else if (Number.isFinite(total) && upfront >= total) {
        nextErrors.upfrontPaid = 'Upfront payment must be less than total cost'
      }

      if (!targetDate.trim()) {
        nextErrors.targetDate = 'Target date is required'
      }
    }

    return nextErrors
  }

  const handleSubmit = () => {
    const nextErrors = validate()
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    startTransition(async () => {
      try {
        const debtId = await createDebtWithOpeningBalance(
          mode === 'financing'
            ? {
                mode: 'financing',
                name,
                totalCost: Number(totalCost),
                upfrontPaid: Number(upfrontPaid),
                targetDate,
                note,
              }
            : {
                mode: 'standard',
                name,
                direction: direction as DebtDirection,
                openingAmount: Number(openingAmount),
                dueDate,
                note,
              }
        )
        router.push(`/history/debt/${debtId}`)
        router.refresh()
      } catch (caught) {
        setErrors({
          form: caught instanceof Error ? caught.message : 'Failed to create debt',
        })
      }
    })
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--page-bg)',
      padding: 'var(--space-lg) var(--space-page-mobile) calc(var(--space-xxl) + var(--bottom-nav-height, 0px))',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link
          href={nextPath}
          aria-label="Back"
          style={{
            width: 44,
            height: 44,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 'var(--space-lg)',
            color: 'var(--grey-900)',
            textDecoration: 'none',
          }}
        >
          <IconBack size={20} />
        </Link>

        <section style={{
          background: 'var(--white)',
          border: 'var(--border-width) solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-lg)',
        }}>
          <p style={{
            margin: '0 0 var(--space-2xs)',
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--weight-semibold)',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            New debt
          </p>
          <h1 style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--weight-semibold)',
            color: 'var(--text-1)',
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
          }}>
            Add a debt to track
          </h1>
          <p style={{
            margin: 'var(--space-sm) 0 0',
            fontSize: 'var(--text-base)',
            color: 'var(--text-2)',
            lineHeight: 1.6,
          }}>
            {mode === 'financing'
              ? 'Save the financing purchase and we will create the carried balance automatically.'
              : 'Save the debt first, then we will record the opening balance as the first transaction.'}
          </p>

          <div style={{ marginTop: 'var(--space-lg)' }}>
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <p style={{
                margin: '0 0 6px',
                fontSize: '12.5px',
                fontWeight: 600,
                color: 'var(--text-2)',
                letterSpacing: '0.2px',
              }}>
                Type
              </p>
              <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
                {([
                  {
                    value: 'standard',
                    label: 'Standard debt',
                    helper: 'Track a regular debt with an opening balance',
                  },
                  {
                    value: 'financing',
                    label: 'Financing purchase',
                    helper: 'Track a purchase with total cost, upfront payment, and payoff target',
                  },
                ] as const).map((option) => {
                  const active = mode === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setMode(option.value)
                        setErrors((current) => ({
                          ...current,
                          mode: undefined,
                          direction: undefined,
                          openingAmount: undefined,
                          dueDate: undefined,
                          totalCost: undefined,
                          upfrontPaid: undefined,
                          targetDate: undefined,
                        }))
                      }}
                      style={{
                        border: `1px solid ${active ? 'var(--brand-deep)' : 'var(--border)'}`,
                        borderRadius: 14,
                        padding: '14px 16px',
                        background: active ? 'color-mix(in srgb, var(--brand) 10%, var(--white))' : 'var(--white)',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{
                        fontSize: 'var(--text-base)',
                        fontWeight: 'var(--weight-semibold)',
                        color: 'var(--text-1)',
                      }}>
                        {option.label}
                      </div>
                      <div style={{
                        marginTop: 4,
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-3)',
                        lineHeight: 1.45,
                      }}>
                        {option.helper}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <Input
              label="Debt name"
              value={name}
              onChange={setName}
              error={errors.name}
              placeholder={mode === 'financing' ? 'e.g. Sofa, Laptop, Fridge' : 'e.g. Credit card, Mary, Car loan'}
            />

            {mode === 'standard' ? (
              <>
                <div style={{ marginBottom: 'var(--space-md)' }}>
                  <p style={{
                    margin: '0 0 6px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: 'var(--text-2)',
                    letterSpacing: '0.2px',
                  }}>
                    Direction
                  </p>
                  <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
                    {DIRECTION_OPTIONS.map((option) => {
                      const active = direction === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setDirection(option.value)}
                          style={{
                            border: `1px solid ${active ? 'var(--brand-deep)' : 'var(--border)'}`,
                            borderRadius: 14,
                            padding: '14px 16px',
                            background: active ? 'color-mix(in srgb, var(--brand) 10%, var(--white))' : 'var(--white)',
                            textAlign: 'left',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{
                            fontSize: 'var(--text-base)',
                            fontWeight: 'var(--weight-semibold)',
                            color: 'var(--text-1)',
                          }}>
                            {option.label}
                          </div>
                          <div style={{
                            marginTop: 4,
                            fontSize: 'var(--text-sm)',
                            color: 'var(--text-3)',
                            lineHeight: 1.45,
                          }}>
                            {option.helper}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  {errors.direction ? (
                    <p style={{
                      margin: 'var(--space-xs) 0 0',
                      fontSize: 12,
                      color: 'var(--red-dark)',
                      fontWeight: 500,
                    }}>
                      {errors.direction}
                    </p>
                  ) : null}
                </div>

                <Input
                  label="Opening amount"
                  type="number"
                  prefix={currency}
                  value={openingAmount}
                  onChange={setOpeningAmount}
                  error={errors.openingAmount}
                  placeholder="0"
                />

                <Input
                  label="Due date"
                  type="date"
                  value={dueDate}
                  onChange={(value) => {
                    setDueDate(value)
                    setErrors((current) => ({ ...current, dueDate: undefined }))
                  }}
                  error={errors.dueDate}
                  hint="Optional. Add a due date if you want this debt to appear in reminders."
                />
              </>
            ) : (
              <>
                <Input
                  label="Total cost"
                  type="number"
                  prefix={currency}
                  value={totalCost}
                  onChange={setTotalCost}
                  error={errors.totalCost}
                  placeholder="0"
                />

                <Input
                  label="Upfront payment"
                  type="number"
                  prefix={currency}
                  value={upfrontPaid}
                  onChange={setUpfrontPaid}
                  error={errors.upfrontPaid}
                  placeholder="0"
                />

                <label style={{ display: 'block', marginBottom: 'var(--space-md)' }}>
                  <span style={{
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: 'var(--text-2)',
                    display: 'block',
                    marginBottom: 6,
                    letterSpacing: '0.2px',
                  }}>
                    Target date
                  </span>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(event) => setTargetDate(event.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      height: 48,
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--white)',
                      padding: '0 14px',
                      fontSize: 15,
                      fontFamily: 'var(--font-sans)',
                      color: 'var(--text-1)',
                      outline: 'none',
                    }}
                  />
                  {errors.targetDate ? (
                    <p style={{
                      margin: 'var(--space-xs) 0 0',
                      fontSize: 12,
                      color: 'var(--red-dark)',
                      fontWeight: 500,
                    }}>
                      {errors.targetDate}
                    </p>
                  ) : null}
                </label>
              </>
            )}

            <label style={{ display: 'block', marginBottom: 'var(--space-lg)' }}>
              <span style={{
                fontSize: '12.5px',
                fontWeight: 600,
                color: 'var(--text-2)',
                display: 'block',
                marginBottom: 6,
                letterSpacing: '0.2px',
              }}>
                Note
              </span>
              <textarea
                value={note}
                onChange={event => setNote(event.target.value)}
                placeholder="Optional note"
                rows={4}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--white)',
                  padding: '12px 14px',
                  fontSize: 15,
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--text-1)',
                  outline: 'none',
                  resize: 'vertical',
                  minHeight: 104,
                }}
              />
            </label>

            {errors.form ? (
              <p style={{
                margin: '0 0 var(--space-md)',
                fontSize: 'var(--text-sm)',
                color: 'var(--red-dark)',
                lineHeight: 1.5,
              }}>
                {errors.form}
              </p>
            ) : null}

            <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
              <SecondaryBtn
                size="lg"
                onClick={() => router.push(nextPath)}
                disabled={isPending}
              >
                Cancel
              </SecondaryBtn>
              <PrimaryBtn
                size="lg"
                onClick={handleSubmit}
                disabled={isPending}
              >
                {isPending ? 'Saving…' : 'Create debt'}
              </PrimaryBtn>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
