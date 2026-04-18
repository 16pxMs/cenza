'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { SecondaryBtn, TertiaryBtn } from '@/components/ui/Button/Button'
import { deleteDebtTransactionForDebt } from './actions'

interface Props {
  debtId: string
  transactionId: string
  deletesEntireDebt?: boolean
}

export function DebtTransactionDeleteButton({
  debtId,
  transactionId,
  deletesEntireDebt = false,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = () => {
    setError(null)
    startTransition(async () => {
      try {
        const result = await deleteDebtTransactionForDebt({ debtId, transactionId })
        setConfirming(false)
        if (result.deletedDebt && result.redirectTo) {
          router.replace(result.redirectTo)
          router.refresh()
          return
        }
        router.refresh()
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Failed to delete debt transaction'
        )
      }
    })
  }

  if (confirming) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 6,
      }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <SecondaryBtn
            size="sm"
            onClick={() => {
              if (isPending) return
              setConfirming(false)
              setError(null)
            }}
            disabled={isPending}
          >
            Cancel
          </SecondaryBtn>
          <TertiaryBtn
            size="sm"
            onClick={handleDelete}
            disabled={isPending}
            style={{ color: 'var(--red-dark)', opacity: 0.92 }}
          >
            {isPending ? 'Deleting…' : 'Delete'}
          </TertiaryBtn>
        </div>
        <p style={{
          margin: 0,
          fontSize: 'var(--text-xs)',
          color: 'var(--text-3)',
          lineHeight: 1.4,
          textAlign: 'right',
          maxWidth: 220,
        }}>
          {deletesEntireDebt
            ? 'This will delete the entire debt. Continue?'
            : 'Delete this transaction?'}
        </p>
        {error ? (
          <p style={{
            margin: 0,
            fontSize: 'var(--text-xs)',
            color: '#D93025',
            lineHeight: 1.4,
            textAlign: 'right',
            maxWidth: 220,
          }}>
            {error}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 4,
    }}>
      <TertiaryBtn
        size="sm"
        onClick={() => {
          setConfirming(true)
          setError(null)
        }}
        style={{
          minHeight: 'auto',
          padding: 0,
          fontSize: 'var(--text-xs)',
          color: 'var(--text-3)',
        }}
      >
        Delete
      </TertiaryBtn>
      {error ? (
        <p style={{
          margin: 0,
          fontSize: 'var(--text-xs)',
          color: '#D93025',
          lineHeight: 1.4,
          textAlign: 'right',
          maxWidth: 220,
        }}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
