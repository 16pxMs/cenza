'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { PrimaryBtn, SecondaryBtn } from '@/components/ui/Button/Button'
import { updateStandardDebtDueDateAction } from './actions'

interface Props {
  debtId: string
  debtName: string
  currentDueDate: string | null
}

export function EditStandardDebtDueDateSheet({ debtId, debtName, currentDueDate }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [dueDate, setDueDate] = useState(currentDueDate ?? '')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setDueDate(currentDueDate ?? '')
    setError(null)
  }, [open, currentDueDate])

  const handleSubmit = () => {
    setError(null)
    startTransition(async () => {
      try {
        await updateStandardDebtDueDateAction({
          debtId,
          dueDate: dueDate.trim() || null,
        })
        setOpen(false)
        router.refresh()
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Failed to update due date')
      }
    })
  }

  return (
    <>
      <SecondaryBtn size="sm" onClick={() => setOpen(true)}>
        {currentDueDate ? 'Edit due date' : 'Add due date'}
      </SecondaryBtn>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={currentDueDate ? 'Edit due date' : 'Add due date'}
      >
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
              Set an optional due date so this debt can appear in reminders.
            </p>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                color: 'var(--text-2)',
              }}
            >
              Due date
            </span>
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
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
              {isPending ? 'Saving…' : dueDate ? 'Save due date' : 'Clear due date'}
            </PrimaryBtn>
          </div>
        </div>
      </Sheet>
    </>
  )
}
