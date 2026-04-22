'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { PrimaryBtn, SecondaryBtn, TertiaryBtn } from '@/components/ui/Button/Button'
import { fmt, formatDate } from '@/lib/finance'
import { deleteDebtTransactionForDebt, updateDebtTransactionForDebt } from './actions'

export interface DebtTransactionListItem {
  id: string
  primary: string
  date: string
  note: string | null
  amount: number
  currency: string
}

interface Props {
  debtId: string
  items: DebtTransactionListItem[]
  lockedTransactionId: string | null
}

type SheetMode = 'actions' | 'edit' | 'delete'

export function DebtTransactionList({ debtId, items, lockedTransactionId }: Props) {
  const router = useRouter()
  const amountRef = useRef<HTMLInputElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<SheetMode>('actions')
  const [isPending, startTransition] = useTransition()
  const [amountValue, setAmountValue] = useState('')
  const [dateValue, setDateValue] = useState('')
  const [noteValue, setNoteValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  )
  const selectedIsLocked = selected != null && selected.id === lockedTransactionId

  const closeSheet = () => {
    if (isPending) return
    setSelectedId(null)
    setMode('actions')
    setError(null)
  }

  const openActions = (item: DebtTransactionListItem) => {
    setSelectedId(item.id)
    setMode('actions')
    setError(null)
  }

  const openEdit = () => {
    if (!selected || selectedIsLocked) return
    setAmountValue(String(selected.amount))
    setDateValue(selected.date)
    setNoteValue(selected.note ?? '')
    setError(null)
    setMode('edit')
    setTimeout(() => amountRef.current?.focus(), 250)
  }

  const handleAmountChange = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '')
    const parts = cleaned.split('.')
    if (parts.length > 2) return
    if (parts[1] && parts[1].length > 2) return
    setAmountValue(cleaned)
  }

  const validateEdit = () => {
    const nextAmount = Number(amountValue)
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      return 'Amount must be greater than zero'
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue.trim())) {
      return 'Enter a valid date'
    }
    return null
  }

  const handleSaveEdit = () => {
    if (!selected || selectedIsLocked) return
    const nextError = validateEdit()
    if (nextError) {
      setError(nextError)
      return
    }

    setError(null)
    startTransition(async () => {
      try {
        await updateDebtTransactionForDebt({
          debtId,
          transactionId: selected.id,
          amount: Number(amountValue),
          date: dateValue,
          note: noteValue,
        })
        setSelectedId(null)
        setMode('actions')
        router.refresh()
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Failed to update debt transaction')
      }
    })
  }

  const handleDelete = () => {
    if (!selected || selectedIsLocked) return
    setError(null)
    startTransition(async () => {
      try {
        const result = await deleteDebtTransactionForDebt({
          debtId,
          transactionId: selected.id,
        })
        setSelectedId(null)
        setMode('actions')
        if (result.deletedDebt && result.redirectTo) {
          router.replace(result.redirectTo)
          router.refresh()
          return
        }
        router.refresh()
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Failed to delete debt transaction')
      }
    })
  }

  const title = selected?.primary ?? 'Transaction'

  const formatSecondary = (item: DebtTransactionListItem) => {
    const dateLabel = item.date ? formatDate(item.date) : 'Date unavailable'
    return item.id === lockedTransactionId ? `${dateLabel} · Financing plan` : dateLabel
  }

  return (
    <>
      <div style={{
        background: 'var(--white)',
        border: 'var(--border-width) solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}>
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => openActions(item)}
            style={{
              width: '100%',
              padding: '12px var(--space-md)',
              border: 'none',
              borderTop: index === 0 ? 'none' : 'var(--border-width) solid var(--border-subtle)',
              background: 'var(--white)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-md)',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{
                margin: 0,
                fontSize: 'var(--text-base)',
                color: 'var(--text-1)',
                fontWeight: 'var(--weight-regular)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {item.primary}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>
                {formatSecondary(item)}
              </p>
            </div>
            <span style={{
              flexShrink: 0,
              fontSize: 'var(--text-base)',
              fontWeight: 'var(--weight-medium)',
              color: 'var(--text-1)',
              whiteSpace: 'nowrap',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {fmt(item.amount, item.currency)}
            </span>
          </button>
        ))}
      </div>

      <Sheet open={selected != null} onClose={closeSheet} title={title}>
        {selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <p style={{
                margin: 0,
                fontSize: 'var(--text-2xl)',
                fontWeight: 'var(--weight-medium)',
                color: 'var(--text-1)',
                lineHeight: 1.1,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {fmt(selected.amount, selected.currency)}
              </p>
              <p style={{ margin: '6px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>
                {selected.date ? formatDate(selected.date) : 'Date unavailable'}
              </p>
              {selected.note ? (
                <p style={{ margin: '8px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-2)', lineHeight: 1.5 }}>
                  {selected.note}
                </p>
              ) : null}
            </div>

            {mode === 'actions' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {!selectedIsLocked ? (
                  <>
                    <button
                      type="button"
                      onClick={openEdit}
                      style={{
                        width: '100%',
                        minHeight: 48,
                        borderRadius: 14,
                        border: '1px solid var(--border)',
                        background: 'var(--white)',
                        color: 'var(--text-1)',
                        fontSize: 'var(--text-base)',
                        fontWeight: 'var(--weight-medium)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        padding: '0 14px',
                      }}
                    >
                      Edit transaction
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('delete')
                        setError(null)
                      }}
                      style={{
                        width: '100%',
                        minHeight: 48,
                        borderRadius: 14,
                        border: '1px solid var(--border)',
                        background: 'var(--white)',
                        color: 'var(--red-dark)',
                        fontSize: 'var(--text-base)',
                        fontWeight: 'var(--weight-medium)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        padding: '0 14px',
                      }}
                    >
                      Delete transaction
                    </button>
                  </>
                ) : (
                  <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-3)', lineHeight: 1.5 }}>
                    This is the original debt amount.<br />
                    It&apos;s set by the financing plan and can&apos;t be changed here.
                  </p>
                )}
                <TertiaryBtn size="md" onClick={closeSheet} style={{ padding: '12px' }}>
                  Cancel
                </TertiaryBtn>
              </div>
            ) : null}

            {mode === 'edit' ? (
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
                  <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: '#D93025', lineHeight: 1.45 }}>
                    {error}
                  </p>
                ) : null}

                <div style={{ display: 'flex', gap: 12 }}>
                  <SecondaryBtn
                    size="lg"
                    onClick={() => {
                      if (isPending) return
                      setMode('actions')
                      setError(null)
                    }}
                    disabled={isPending}
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </SecondaryBtn>
                  <PrimaryBtn
                    size="lg"
                    onClick={handleSaveEdit}
                    disabled={isPending}
                    style={{ flex: 1 }}
                  >
                    {isPending ? 'Saving...' : 'Save changes'}
                  </PrimaryBtn>
                </div>
              </div>
            ) : null}

            {mode === 'delete' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ margin: 0, fontSize: 'var(--text-base)', color: 'var(--text-2)', lineHeight: 1.5 }}>
                  {items.length === 1
                    ? 'This will delete the entire debt. Continue?'
                    : 'Delete this transaction?'}
                </p>
                {error ? (
                  <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: '#D93025', lineHeight: 1.45 }}>
                    {error}
                  </p>
                ) : null}
                <div style={{ display: 'flex', gap: 12 }}>
                  <SecondaryBtn
                    size="lg"
                    onClick={() => {
                      if (isPending) return
                      setMode('actions')
                      setError(null)
                    }}
                    disabled={isPending}
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </SecondaryBtn>
                  <TertiaryBtn
                    size="lg"
                    onClick={handleDelete}
                    disabled={isPending}
                    style={{ flex: 1, color: 'var(--red-dark)' }}
                  >
                    {isPending ? 'Deleting...' : 'Delete'}
                  </TertiaryBtn>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </>
  )
}
