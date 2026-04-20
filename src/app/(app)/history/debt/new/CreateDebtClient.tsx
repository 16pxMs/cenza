'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input/Input'
import { PrimaryBtn } from '@/components/ui/Button/Button'
import { IconBack } from '@/components/ui/Icons'
import type { DebtDirection } from '@/lib/supabase/debt-db'
import { createDebtWithOpeningBalance } from './actions'

interface Props {
  currency: string
  returnTo: string
}

type FormErrors = {
  name?: string
  trackingChoice?: string
  amount?: string
  dueDate?: string
  form?: string
}

type CreateDebtMode = 'standard' | 'financing'
type DebtTrackingChoice = 'i_owe' | 'i_owe_over_time' | 'owed_to_me'
type Step = 1 | 2 | 3 | 4

const TRACKING_OPTIONS: Array<{
  value: DebtTrackingChoice
  label: string
  helper: string
}> = [
  {
    value: 'i_owe',
    label: 'I owe someone',
    helper: 'One amount to pay back',
  },
  {
    value: 'i_owe_over_time',
    label: 'I owe someone over time',
    helper: 'Paying in parts',
  },
  {
    value: 'owed_to_me',
    label: 'Someone owes me',
    helper: 'You will collect this',
  },
]

function resolveReturnPath(returnTo: string) {
  const trimmed = (returnTo || '').trim()
  return trimmed.startsWith('/') ? trimmed : '/app'
}

function isValidDateString(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00`)
  return !Number.isNaN(parsed.getTime())
}

function mapTrackingChoice(choice: DebtTrackingChoice | null): { direction: DebtDirection; mode: CreateDebtMode } | null {
  switch (choice) {
    case 'i_owe':
      return { direction: 'owed_by_me', mode: 'standard' }
    case 'i_owe_over_time':
      return { direction: 'owed_by_me', mode: 'financing' }
    case 'owed_to_me':
      return { direction: 'owed_to_me', mode: 'standard' }
    default:
      return null
  }
}

function OptionButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        minHeight: 52,
        border: active ? 'none' : 'var(--border-width) solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 12,
        background: active ? 'var(--brand)' : 'transparent',
        boxShadow: active ? '0 0 0 1px var(--brand-dark)' : 'none',
        color: 'var(--text-1)',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function StepDebtName({
  name,
  error,
  onChange,
}: {
  name: string
  error?: string
  onChange: (value: string) => void
}) {
  return (
    <Input
      label="Debt name"
      value={name}
      onChange={onChange}
      error={error}
      placeholder="e.g. Credit card, Mary, Sofa"
      autoFocus
    />
  )
}

function StepDebtType({
  trackingChoice,
  error,
  onTrackingChoiceChange,
}: {
  trackingChoice: DebtTrackingChoice | null
  error?: string
  onTrackingChoiceChange: (value: DebtTrackingChoice) => void
}) {
  return (
    <div>
      <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
        {TRACKING_OPTIONS.map((option) => {
          const active = trackingChoice === option.value
          return (
            <OptionButton
              key={option.value}
              active={active}
              onClick={() => onTrackingChoiceChange(option.value)}
            >
              <span style={{ display: 'block', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-1)' }}>
                {option.label}
              </span>
              <span style={{ display: 'block', marginTop: 4, fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-regular)', color: 'var(--text-3)', lineHeight: 1.35 }}>
                {option.helper}
              </span>
            </OptionButton>
          )
        })}
      </div>
      {error ? (
        <p style={{
          margin: 'var(--space-xs) 0 0',
          fontSize: 12,
          color: 'var(--red-dark)',
          fontWeight: 500,
        }}>
          {error}
        </p>
      ) : null}
    </div>
  )
}

function StepDebtAmount({
  amount,
  currency,
  error,
  onChange,
}: {
  amount: string
  currency: string
  error?: string
  onChange: (value: string) => void
}) {
  return (
    <Input
      label="Amount"
      type="number"
      prefix={currency}
      value={amount}
      onChange={onChange}
      error={error}
      placeholder="0"
      autoFocus
    />
  )
}

function StepDebtOptionalDetails({
  dueDate,
  note,
  dueDateError,
  onDueDateChange,
  onNoteChange,
}: {
  dueDate: string
  note: string
  dueDateError?: string
  onDueDateChange: (value: string) => void
  onNoteChange: (value: string) => void
}) {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-lg)' }}>
      <Input
        label="Due date"
        type="date"
        value={dueDate}
        onChange={onDueDateChange}
        error={dueDateError}
        autoFocus
      />

      <label style={{ display: 'block' }}>
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
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="Optional note"
          rows={4}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            border: 'var(--border-width) solid var(--border)',
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
    </div>
  )
}

export default function CreateDebtClient({ currency, returnTo }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<Step>(1)
  const [trackingChoice, setTrackingChoice] = useState<DebtTrackingChoice | null>(null)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})

  const nextPath = resolveReturnPath(returnTo)
  const isLastStep = step === 4

  const validateStep = (targetStep: Step): FormErrors => {
    const nextErrors: FormErrors = {}

    if (targetStep === 1 && !name.trim()) {
      nextErrors.name = 'Debt name is required'
    }

    if (targetStep === 2 && !trackingChoice) {
      nextErrors.trackingChoice = 'Choose what you are tracking'
    }

    if (targetStep === 3) {
      const parsedAmount = Number(amount)
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        nextErrors.amount = 'Amount must be greater than zero'
      }
    }

    if (targetStep === 4 && dueDate.trim() && !isValidDateString(dueDate)) {
      nextErrors.dueDate = 'Enter a valid due date'
    }

    return nextErrors
  }

  const validateAll = (): FormErrors => {
    return {
      ...validateStep(1),
      ...validateStep(2),
      ...validateStep(3),
      ...validateStep(4),
    }
  }

  const goBack = () => {
    if (isPending) return
    if (step > 1) {
      setErrors({})
      setStep((current) => (current - 1) as Step)
      return
    }
    router.push(nextPath)
  }

  const handleContinue = () => {
    const nextErrors = validateStep(step)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setStep((current) => Math.min(4, current + 1) as Step)
  }

  const handleSubmit = () => {
    const nextErrors = validateAll()
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      const firstInvalidStep: Step =
        nextErrors.name ? 1 :
        nextErrors.trackingChoice ? 2 :
        nextErrors.amount ? 3 :
        4
      setStep(firstInvalidStep)
      return
    }

    setErrors({})
    startTransition(async () => {
      try {
        const parsedAmount = Number(amount)
        const mappedChoice = mapTrackingChoice(trackingChoice)
        if (!mappedChoice) {
          throw new Error('Choose what you are tracking')
        }

        const debtId = await createDebtWithOpeningBalance(
          mappedChoice.mode === 'financing'
            ? {
                mode: 'financing',
                name,
                totalCost: parsedAmount,
                upfrontPaid: 0,
                targetDate: dueDate || null,
                note,
              }
            : {
                mode: 'standard',
                name,
                direction: mappedChoice.direction,
                openingAmount: parsedAmount,
                dueDate: dueDate || null,
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

  const handleTrackingChoiceChange = (value: DebtTrackingChoice) => {
    setTrackingChoice(value)
    setErrors((current) => ({ ...current, trackingChoice: undefined, form: undefined }))
  }

  const stepContent = (() => {
    switch (step) {
      case 1:
        return (
          <StepDebtName
            name={name}
            error={errors.name}
            onChange={(value) => {
              setName(value)
              setErrors((current) => ({ ...current, name: undefined, form: undefined }))
            }}
          />
        )
      case 2:
        return (
          <StepDebtType
            trackingChoice={trackingChoice}
            error={errors.trackingChoice}
            onTrackingChoiceChange={handleTrackingChoiceChange}
          />
        )
      case 3:
        return (
          <StepDebtAmount
            amount={amount}
            currency={currency}
            error={errors.amount}
            onChange={(value) => {
              setAmount(value)
              setErrors((current) => ({ ...current, amount: undefined, form: undefined }))
            }}
          />
        )
      case 4:
      default:
        return (
          <StepDebtOptionalDetails
            dueDate={dueDate}
            note={note}
            dueDateError={errors.dueDate}
            onDueDateChange={(value) => {
              setDueDate(value)
              setErrors((current) => ({ ...current, dueDate: undefined, form: undefined }))
            }}
            onNoteChange={setNote}
          />
        )
    }
  })()

  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--page-bg)',
      padding: 'var(--space-lg) var(--space-page-mobile) calc(var(--space-xxl) + var(--bottom-nav-height, 0px))',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <button
          type="button"
          onClick={goBack}
          aria-label="Back"
          disabled={isPending}
          style={{
            width: 44,
            height: 44,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 'var(--space-lg)',
            color: 'var(--grey-900)',
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: isPending ? 'default' : 'pointer',
          }}
        >
          <IconBack size={20} />
        </button>

        <div style={{ display: 'grid', gap: 'var(--space-lg)' }}>
          <div>
            <p style={{
              margin: '0 0 var(--space-2xs)',
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              Step {step} of 4
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
              Add a debt
            </h1>
            {step === 2 ? (
              <p style={{
                margin: 'var(--space-sm) 0 0',
                fontSize: 'var(--text-base)',
                color: 'var(--text-2)',
                lineHeight: 1.45,
              }}>
                What are you tracking?
              </p>
            ) : null}
          </div>

          <div style={{ display: 'grid', gap: 'var(--space-lg)' }}>
            {stepContent}

            {errors.form ? (
              <p style={{
                margin: 0,
                fontSize: 'var(--text-sm)',
                color: 'var(--red-dark)',
                lineHeight: 1.5,
              }}>
                {errors.form}
              </p>
            ) : null}

            <PrimaryBtn
              size="lg"
              onClick={isLastStep ? handleSubmit : handleContinue}
              disabled={isPending || (step === 2 && !trackingChoice)}
              style={step === 2 ? (
                !trackingChoice
                  ? {
                      background: 'var(--border-subtle)',
                      color: 'var(--text-muted)',
                    }
                  : {
                      background: 'var(--brand-dark)',
                      color: 'var(--text-inverse)',
                    }
              ) : undefined}
            >
              {isPending ? 'Saving…' : isLastStep ? 'Save debt' : 'Continue'}
            </PrimaryBtn>
          </div>
        </div>
      </div>
    </main>
  )
}
