'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { SingleTaskFlowStep } from '@/components/layout/SingleTaskFlowStep/SingleTaskFlowStep'
import { PrimaryBtn } from '@/components/ui/Button/Button'
import cardStyles from '@/components/ui/Card/Card.module.css'
import type { DebtDirection } from '@/lib/supabase/debt-db'
import { createDebtWithOpeningBalance } from './actions'
import styles from './CreateDebtClient.module.css'

interface Props {
  currency: string
  returnTo: string
  activeDebtNames: string[]
  initialName?: string
  initialAmount?: string
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
    helper: 'Pay it back at once',
  },
  {
    value: 'i_owe_over_time',
    label: 'I owe someone over time',
    helper: 'Pay it over time',
  },
  {
    value: 'owed_to_me',
    label: 'Someone owes me',
    helper: 'They’ll pay you back',
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

function normalizeDebtNameForMatch(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function addCommas(raw: string): string {
  if (!raw) return raw
  const parts = raw.split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return parts.join('.')
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
      className={[
        cardStyles.selectableCard,
        active ? cardStyles.selectableCardSelected : '',
      ].filter(Boolean).join(' ')}
    >
      {children}
    </button>
  )
}

function FieldFrame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      height: 48,
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border)',
      background: 'var(--white)',
      overflow: 'hidden',
    }}>
      {children}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--weight-medium)',
      color: 'var(--text-2)',
      display: 'block',
      marginBottom: 'var(--space-xs)',
    }}>
      {children}
    </span>
  )
}

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      margin: 'var(--space-xs) 0',
      fontSize: 'var(--text-sm)',
      color: 'var(--red-dark)',
      fontFamily: 'var(--font-sans)',
      fontWeight: 'var(--weight-regular)',
    }}>
      {children}
    </p>
  )
}

function StepDebtName({
  name,
  error,
  placeholder,
  onChange,
}: {
  name: string
  error?: string
  placeholder: string
  onChange: (value: string) => void
}) {
  return (
    <div style={{ marginBottom: 'var(--space-md)', width: '100%' }}>
      <FieldFrame>
        <input
          aria-label="Debt name"
          className={styles.fieldInput}
          value={name}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoFocus
          autoComplete="off"
        />
      </FieldFrame>
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
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
              <span style={{ display: 'block', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', color: 'var(--text-1)' }}>
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
          fontSize: 'var(--text-sm)',
          color: 'var(--red-dark)',
          fontWeight: 'var(--weight-regular)',
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
    <div style={{ marginBottom: 'var(--space-md)', width: '100%' }}>
      <label style={{ display: 'block' }}>
        <FieldLabel>Amount</FieldLabel>
        <FieldFrame>
          <span style={{
            padding: '0 0 0 14px',
            fontSize: 'var(--text-base)',
            color: 'var(--text-3)',
            fontWeight: 'var(--weight-regular)',
            fontFamily: 'var(--font-sans)',
            pointerEvents: 'none',
            userSelect: 'none',
          }}>
            {currency}
          </span>
          <input
            className={styles.fieldInput}
            inputMode="decimal"
            pattern="[0-9]*"
            enterKeyHint="done"
            value={addCommas(amount)}
            onChange={(event) => {
              const raw = event.target.value.replace(/,/g, '')
              if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return
              onChange(raw)
            }}
            placeholder="0"
            autoFocus
            autoComplete="off"
            style={{ paddingLeft: 'var(--space-sm)' }}
          />
        </FieldFrame>
      </label>
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
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
      <div style={{ marginBottom: 'var(--space-md)', width: '100%' }}>
        <label style={{ display: 'block' }}>
          <FieldLabel>Due date</FieldLabel>
          <FieldFrame>
            <input
              className={styles.fieldInput}
              type="date"
              value={dueDate}
              onChange={(event) => onDueDateChange(event.target.value)}
              autoFocus
            />
          </FieldFrame>
        </label>
        {dueDateError ? <FieldError>{dueDateError}</FieldError> : null}
      </div>

      <label style={{ display: 'block' }}>
        <FieldLabel>Note</FieldLabel>
        <textarea
          className={styles.textArea}
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
            fontFamily: 'var(--font-sans)',
            outline: 'none',
            resize: 'vertical',
            minHeight: 104,
          }}
        />
      </label>
    </div>
  )
}

export default function CreateDebtClient({
  currency,
  returnTo,
  activeDebtNames,
  initialName = '',
  initialAmount = '',
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<Step>(1)
  const [trackingChoice, setTrackingChoice] = useState<DebtTrackingChoice | null>(null)
  const [name, setName] = useState(initialName)
  const [amount, setAmount] = useState(initialAmount)
  const [dueDate, setDueDate] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})

  const nextPath = resolveReturnPath(returnTo)
  const isLastStep = step === 4
  const normalizedActiveDebtNames = new Set(activeDebtNames.map(normalizeDebtNameForMatch))
  const normalizedName = normalizeDebtNameForMatch(name)
  const hasDuplicateActiveDebtName = normalizedName.length > 0 && normalizedActiveDebtNames.has(normalizedName)
  const stepOneBlocked = !trackingChoice
  const stepTwoBlocked = !normalizedName || hasDuplicateActiveDebtName
  const debtNamePlaceholder =
    trackingChoice === 'i_owe_over_time'
      ? 'e.g. Laptop, Sofa, Phone'
      : trackingChoice === 'owed_to_me'
        ? 'e.g. Alex, Client, Sarah'
        : 'e.g. John, Landlord, Mum'
  const debtNameTitle =
    trackingChoice === 'i_owe_over_time'
      ? 'What are you paying for?'
      : trackingChoice === 'owed_to_me'
        ? 'Who owes you?'
        : 'Who do you owe?'
  const stepCopy: Record<Step, { title: string; supportingLine?: string }> = {
    1: { title: "What's this for?" },
    2: { title: debtNameTitle },
    3: { title: 'How much is it?' },
    4: { title: 'Any extra details?', supportingLine: 'Due date and note are optional.' },
  }
  const displayedNameError =
    errors.name ??
    (name.length > 0 && !normalizedName ? 'Debt name is required' : undefined) ??
    (hasDuplicateActiveDebtName ? 'You already have an active debt with this name.' : undefined)

  const validateStep = (targetStep: Step): FormErrors => {
    const nextErrors: FormErrors = {}

    if (targetStep === 1 && !trackingChoice) {
      nextErrors.trackingChoice = 'Choose what you are tracking'
    }

    if (targetStep === 2 && !name.trim()) {
      nextErrors.name = 'Debt name is required'
    } else if (targetStep === 2 && hasDuplicateActiveDebtName) {
      nextErrors.name = 'You already have an active debt with this name.'
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
        nextErrors.trackingChoice ? 1 :
        nextErrors.name ? 2 :
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
          <StepDebtType
            trackingChoice={trackingChoice}
            error={errors.trackingChoice}
            onTrackingChoiceChange={handleTrackingChoiceChange}
          />
        )
      case 2:
        return (
          <StepDebtName
            name={name}
            error={displayedNameError}
            placeholder={debtNamePlaceholder}
            onChange={(value) => {
              setName(value)
              setErrors((current) => ({ ...current, name: undefined, form: undefined }))
            }}
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

  const action = (
    <>
      {errors.form ? (
        <p style={{
          margin: 0,
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--weight-regular)',
          color: 'var(--red-dark)',
          lineHeight: 1.5,
        }}>
          {errors.form}
        </p>
      ) : null}

      <PrimaryBtn
        size="lg"
        onClick={isLastStep ? handleSubmit : handleContinue}
        disabled={isPending || (step === 1 && stepOneBlocked) || (step === 2 && stepTwoBlocked)}
        style={step === 1 || step === 2 ? (
          (step === 1 && stepOneBlocked) || (step === 2 && stepTwoBlocked)
            ? {
                background: 'var(--border-subtle)',
                color: 'var(--text-muted)',
                fontSize: 'var(--text-base)',
                fontWeight: 'var(--weight-medium)',
              }
            : {
                background: 'var(--brand-dark)',
                color: 'var(--text-inverse)',
                fontSize: 'var(--text-base)',
                fontWeight: 'var(--weight-medium)',
              }
        ) : {
          fontSize: 'var(--text-base)',
          fontWeight: 'var(--weight-medium)',
        }}
      >
        {isPending ? 'Saving…' : isLastStep ? 'Save debt' : 'Continue'}
      </PrimaryBtn>
    </>
  )

  return (
    <SingleTaskFlowStep
      stepLabel={`Step ${step} of 4`}
      title={stepCopy[step].title}
      supportingLine={stepCopy[step].supportingLine}
      onBack={goBack}
      backDisabled={isPending}
      action={action}
    >
      {stepContent}
    </SingleTaskFlowStep>
  )
}
