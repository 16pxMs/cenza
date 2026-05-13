'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { PrimaryBtn, SecondaryBtn } from '@/components/ui/Button/Button'
import { MoneyInput } from '@/components/ui/MoneyInput/MoneyInput'
import { addOpeningBalance } from './actions'

interface Props {
  debtId: string
  debtName: string
  currency: string
}

function formatToday() {
  return new Date().toISOString().slice(0, 10)
}

export function AddOpeningBalanceSheet({ debtId, debtName, currency }: Props) {
  const router = useRouter()
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
  }, [open])

  const amountValue = Number(amount)

  const handleSubmit = () => {
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setError('Amount must be greater than zero')
      return
    }
    if (!date.trim()) {
      setError('Date is required')
      return
    }

    setError(null)
    startTransition(async () => {
      try {
        await addOpeningBalance({
          debtId,
          amount: amountValue,
          date,
          note,
        })
        setOpen(false)
        router.refresh()
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Failed to add Money I owe')
      }
    })
  }

  return (
    <>
      <PrimaryBtn
        size="sm"
        onClick={() => setOpen(true)}
        style={{
          minWidth: 156,
          justifyContent: 'center',
        }}
      >
        Add Money I owe
      </PrimaryBtn>

      <Sheet open={open} onClose={() => setOpen(false)} title="Add Money I owe">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--text-base)',
                fontWeight: 'var(--weight-medium)',
                color: 'var(--text-1)',
              }}
            >
              {debtName}
            </p>
            <p
              style={{
                margin: '6px 0 0',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-3)',
              }}
            >
              Money I owe.
            </p>
          </div>

          <MoneyInput
            label="Amount"
            currency={currency}
            value={amount}
            onChange={setAmount}
            autoFocus
            placeholder="0"
          />

          <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                color: 'var(--text-2)',
              }}
            >
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
            <span
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                color: 'var(--text-2)',
              }}
            >
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
            <p
              style={{
                margin: 0,
                fontSize: 'var(--text-sm)',
                color: '#D93025',
                lineHeight: 1.45,
              }}
            >
              {error}
            </p>
          ) : null}

          <div style={{ display: 'flex', gap: 12 }}>
            <SecondaryBtn size="lg" onClick={() => setOpen(false)} disabled={isPending} style={{ flex: 1 }}>
              Cancel
            </SecondaryBtn>
            <PrimaryBtn size="lg" onClick={handleSubmit} disabled={isPending} style={{ flex: 1 }}>
              {isPending ? 'Saving…' : 'Save Money I owe'}
            </PrimaryBtn>
          </div>
        </div>
      </Sheet>
    </>
  )
}
