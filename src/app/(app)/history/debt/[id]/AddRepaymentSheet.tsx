'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { PrimaryBtn, SecondaryBtn } from '@/components/ui/Button/Button'
import { addRepayment } from './actions'

interface Props {
  debtId: string
  debtName: string
  currency: string
  currentBalance: number
  emphasized?: boolean
}

function formatToday() {
  return new Date().toISOString().slice(0, 10)
}

export function AddRepaymentSheet({
  debtId,
  debtName,
  currency,
  currentBalance,
  emphasized = false,
}: Props) {
  const router = useRouter()
  const amountRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(formatToday())
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setAmount('')
    setDate(formatToday())
    setNote('')
    setError(null)
    setTimeout(() => amountRef.current?.focus(), 250)
  }, [open])

  const amountValue = Number(amount)

  const handleAmountChange = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '')
    const parts = cleaned.split('.')
    if (parts.length > 2) return
    if (parts[1] && parts[1].length > 2) return
    setAmount(cleaned)
  }

  const validate = (): string | null => {
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      return 'Amount must be greater than zero'
    }
    if (amountValue > currentBalance) {
      return 'Repayment cannot be more than the current balance'
    }
    if (!date.trim()) {
      return 'Repayment date is required'
    }
    return null
  }

  const handleSubmit = () => {
    const nextError = validate()
    if (nextError) {
      setError(nextError)
      return
    }

    setError(null)
    startTransition(async () => {
      try {
        await addRepayment({
          debtId,
          amount: amountValue,
          date,
          note,
        })
        setOpen(false)
        router.refresh()
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Failed to add repayment')
      }
    })
  }

  return (
    <>
      {emphasized ? (
        <PrimaryBtn
          size="sm"
          onClick={() => setOpen(true)}
          style={{
            minWidth: 132,
            justifyContent: 'center',
          }}
        >
          Add payment
        </PrimaryBtn>
      ) : (
        <SecondaryBtn
          size="sm"
          onClick={() => setOpen(true)}
          style={{
            minWidth: 132,
            justifyContent: 'center',
          }}
        >
          Add payment
        </SecondaryBtn>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Add payment">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <p style={{
              margin: 0,
              fontSize: 'var(--text-base)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-1)',
            }}>
              {debtName}
            </p>
            <p style={{
              margin: '6px 0 0',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-3)',
            }}>
              Current balance: {new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency,
                maximumFractionDigits: 2,
              }).format(currentBalance)}
            </p>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--weight-medium)',
              color: 'var(--text-2)',
            }}>
              Amount
            </span>
            <input
              ref={amountRef}
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={event => handleAmountChange(event.target.value)}
              placeholder="0.00"
              style={{
                height: 48,
                borderRadius: 14,
                border: '1px solid var(--border)',
                padding: '0 14px',
                fontSize: 'var(--text-base)',
                color: 'var(--text-1)',
                background: 'var(--white)',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--weight-medium)',
              color: 'var(--text-2)',
            }}>
              Date
            </span>
            <input
              type="date"
              value={date}
              onChange={event => setDate(event.target.value)}
              style={{
                height: 48,
                borderRadius: 14,
                border: '1px solid var(--border)',
                padding: '0 14px',
                fontSize: 'var(--text-base)',
                color: 'var(--text-1)',
                background: 'var(--white)',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--weight-medium)',
              color: 'var(--text-2)',
            }}>
              Note
            </span>
            <textarea
              value={note}
              onChange={event => setNote(event.target.value)}
              placeholder="Add a note (optional)"
              rows={3}
              style={{
                borderRadius: 14,
                border: '1px solid var(--border)',
                padding: '12px 14px',
                fontSize: 'var(--text-base)',
                color: 'var(--text-1)',
                background: 'var(--white)',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
                resize: 'vertical',
                minHeight: 88,
                fontFamily: 'inherit',
              }}
            />
          </label>

          {error ? (
            <p style={{
              margin: 0,
              fontSize: 'var(--text-sm)',
              color: '#D93025',
              lineHeight: 1.45,
            }}>
              {error}
            </p>
          ) : null}

          <div style={{ display: 'flex', gap: 12 }}>
            <SecondaryBtn
              size="lg"
              onClick={() => setOpen(false)}
              disabled={isPending}
              style={{ flex: 1 }}
            >
              Cancel
            </SecondaryBtn>
            <PrimaryBtn
              size="lg"
              onClick={handleSubmit}
              disabled={isPending}
              style={{ flex: 1 }}
            >
              {isPending ? 'Saving…' : 'Save'}
            </PrimaryBtn>
          </div>
        </div>
      </Sheet>
    </>
  )
}
