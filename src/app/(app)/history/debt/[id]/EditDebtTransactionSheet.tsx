'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { PrimaryBtn, TertiaryBtn, SecondaryBtn } from '@/components/ui/Button/Button'
import { updateDebtTransactionForDebt } from './actions'

interface Props {
  debtId: string
  transactionId: string
  amount: number
  date: string
  note: string | null
}

export function EditDebtTransactionSheet({
  debtId,
  transactionId,
  amount,
  date,
  note,
}: Props) {
  const router = useRouter()
  const amountRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [amountValue, setAmountValue] = useState(String(amount))
  const [dateValue, setDateValue] = useState(date)
  const [noteValue, setNoteValue] = useState(note ?? '')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setAmountValue(String(amount))
    setDateValue(date)
    setNoteValue(note ?? '')
    setError(null)
    setTimeout(() => amountRef.current?.focus(), 250)
  }, [open, amount, date, note])

  const handleAmountChange = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '')
    const parts = cleaned.split('.')
    if (parts.length > 2) return
    if (parts[1] && parts[1].length > 2) return
    setAmountValue(cleaned)
  }

  const validate = () => {
    const nextAmount = Number(amountValue)
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      return 'Amount must be greater than zero'
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue.trim())) {
      return 'Enter a valid date'
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
        await updateDebtTransactionForDebt({
          debtId,
          transactionId,
          amount: Number(amountValue),
          date: dateValue,
          note: noteValue,
        })
        setOpen(false)
        router.refresh()
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : 'Failed to update debt transaction'
        )
      }
    })
  }

  return (
    <>
      <TertiaryBtn
        size="sm"
        onClick={() => setOpen(true)}
        style={{
          minHeight: 'auto',
          padding: 0,
          fontSize: 'var(--text-xs)',
          color: 'var(--text-3)',
        }}
      >
        Edit
      </TertiaryBtn>

      <Sheet open={open} onClose={() => setOpen(false)} title="Edit transaction">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
              value={amountValue}
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
              value={dateValue}
              onChange={event => setDateValue(event.target.value)}
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
              value={noteValue}
              onChange={event => setNoteValue(event.target.value)}
              placeholder="Add a note"
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
              {isPending ? 'Saving…' : 'Save changes'}
            </PrimaryBtn>
          </div>
        </div>
      </Sheet>
    </>
  )
}
