'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { PrimaryBtn, SecondaryBtn, TertiaryBtn } from '@/components/ui/Button/Button'
import { Input } from '@/components/ui/Input/Input'
import { IconMore } from '@/components/ui/Icons'
import { useToast } from '@/lib/context/ToastContext'
import { deleteDebtForDebtDetail, updateDebtDetailsAction, updateStandardDebtDueDateAction } from './actions'

interface Props {
  debtId: string
  debtName: string
  currentNote: string
  debtKind: 'standard' | 'financing'
  currentDueDate: string | null
  dueDateSupported: boolean
  returnTo?: string
}

type MenuMode = 'menu' | 'edit' | 'dueDate' | 'delete'

export function DebtOptionsMenu({ debtId, debtName, currentNote, debtKind, currentDueDate, dueDateSupported, returnTo }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<MenuMode>('menu')
  const [dueDate, setDueDate] = useState(currentDueDate ?? '')
  const [editName, setEditName] = useState(debtName)
  const [editNote, setEditNote] = useState('')
  const [editDueDate, setEditDueDate] = useState(currentDueDate ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    setMode('menu')
    setDueDate(currentDueDate ?? '')
    setEditName(debtName)
    setEditNote(currentNote)
    setEditDueDate(currentDueDate ?? '')
    setError(null)
  }, [open, currentDueDate, debtName, currentNote])

  const close = () => {
    if (isPending) return
    setOpen(false)
    setMode('menu')
    setError(null)
  }

  const handleSaveDueDate = () => {
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

  const handleSaveDebt = () => {
    setError(null)
    startTransition(async () => {
      try {
        const result = await updateDebtDetailsAction({
          debtId,
          name: editName,
          note: editNote,
          ...(debtKind === 'standard' && dueDateSupported ? { dueDate: editDueDate.trim() || null } : {}),
        })
        setOpen(false)
        router.refresh()
        if (!result.dueDateSupported) {
          toast('Debt updated')
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Failed to update debt')
      }
    })
  }

  const handleDeleteDebt = () => {
    if (isPending) return
    setError(null)
    startTransition(async () => {
      try {
        const result = await deleteDebtForDebtDetail(debtId)
        setOpen(false)
        setMode('menu')
        toast('Debt removed')
        router.replace(returnTo || result.redirectTo)
        router.refresh()
      } catch {
        setError("We couldn't delete this debt. Try again.")
      }
    })
  }

  const sheetTitle =
    mode === 'edit'
      ? 'Edit debt'
      :
    mode === 'dueDate'
      ? currentDueDate ? 'Edit due date' : 'Add due date'
      : mode === 'delete'
        ? 'Delete debt'
        : 'Debt options'

  return (
    <>
      <button
        type="button"
        aria-label="Debt options"
        onClick={() => setOpen(true)}
        style={{
          width: 40,
          height: 40,
          borderRadius: 'var(--radius-full)',
          border: '1px solid var(--border)',
          background: 'var(--white)',
          color: 'var(--text-2)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <IconMore size={18} />
      </button>

      <Sheet open={open} onClose={close} title={sheetTitle}>
        {mode === 'menu' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="button"
              onClick={() => {
                setMode('edit')
                setError(null)
              }}
              style={{
                width: '100%',
                minHeight: 48,
                borderRadius: 14,
                border: '1px solid var(--border)',
                background: 'var(--white)',
                color: 'var(--text-1)',
                fontSize: 'var(--text-base)',
                fontWeight: 'var(--weight-medium)',
                textAlign: 'left',
                padding: '0 14px',
                cursor: 'pointer',
              }}
            >
              Edit debt
            </button>

            {debtKind === 'standard' && dueDateSupported ? (
              <button
                type="button"
                onClick={() => {
                  setMode('dueDate')
                  setError(null)
                }}
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
                Set due date
              </button>
            ) : null}

            <div style={{ height: 1, background: 'var(--border-subtle)', margin: '6px 0' }} />

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
              Delete debt
            </button>

            <TertiaryBtn size="md" onClick={close} style={{ padding: '12px' }}>
              Cancel
            </TertiaryBtn>
          </div>
        ) : null}

        {mode === 'edit' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Input
              label="Debt name"
              value={editName}
              onChange={setEditName}
            />

            {debtKind === 'standard' && dueDateSupported ? (
              <Input
                label="Due date"
                type="date"
                value={editDueDate}
                onChange={setEditDueDate}
                autoFocus={false}
              />
            ) : null}

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
                value={editNote}
                onChange={(event) => setEditNote(event.target.value)}
                placeholder="Optional note"
                rows={4}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  background: 'var(--white)',
                  padding: '12px 14px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-base)',
                  color: 'var(--text-1)',
                  outline: 'none',
                  resize: 'vertical',
                  minHeight: 104,
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
                  setMode('menu')
                  setError(null)
                }}
                disabled={isPending}
                style={{ flex: 1 }}
              >
                Cancel
              </SecondaryBtn>
              <PrimaryBtn
                size="lg"
                onClick={handleSaveDebt}
                disabled={isPending}
                style={{ flex: 1 }}
              >
                {isPending ? 'Saving...' : 'Save changes'}
              </PrimaryBtn>
            </div>
          </div>
        ) : null}

        {mode === 'dueDate' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <p style={{
                margin: 0,
                fontSize: 'var(--text-base)',
                fontWeight: 'var(--weight-medium)',
                color: 'var(--text-1)',
              }}>
                {debtName}
              </p>
              <p style={{ margin: '6px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>
                We&apos;ll use this to surface the debt when it needs attention.
              </p>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                color: 'var(--text-2)',
              }}>
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
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: '#D93025', lineHeight: 1.45 }}>
                {error}
              </p>
            ) : null}

            <div style={{ display: 'flex', gap: 12 }}>
              <SecondaryBtn
                size="lg"
                onClick={() => {
                  if (isPending) return
                  setMode('menu')
                  setError(null)
                }}
                disabled={isPending}
                style={{ flex: 1 }}
              >
                Cancel
              </SecondaryBtn>
              <PrimaryBtn
                size="lg"
                onClick={handleSaveDueDate}
                disabled={isPending}
                style={{ flex: 1 }}
              >
                {isPending ? 'Saving...' : dueDate ? 'Save due date' : 'Clear due date'}
              </PrimaryBtn>
            </div>
          </div>
        ) : null}

        {mode === 'delete' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ margin: 0, fontSize: 'var(--text-base)', color: 'var(--text-2)', lineHeight: 1.5 }}>
              Delete <strong>{debtName}</strong> and its debt history? This cannot be undone.
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
                  setMode('menu')
                  setError(null)
                }}
                disabled={isPending}
                style={{ flex: 1 }}
              >
                Cancel
              </SecondaryBtn>
              <TertiaryBtn
                size="lg"
                onClick={handleDeleteDebt}
                disabled={isPending}
                style={{ flex: 1, color: 'var(--red-dark)' }}
              >
                {isPending ? 'Deleting...' : 'Delete debt'}
              </TertiaryBtn>
            </div>
          </div>
        ) : null}
      </Sheet>
    </>
  )
}
