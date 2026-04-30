'use client'

import { useEffect, useState, useTransition } from 'react'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { Input } from '@/components/ui/Input/Input'
import { PrimaryBtn, SecondaryBtn, TertiaryBtn } from '@/components/ui/Button/Button'
import { IconMore } from '@/components/ui/Icons'

interface Props {
  goalName: string
  currency: string
  currentTarget: number | null
  currentTargetDate: string | null
  editGoalRequestKey?: number
  focusTargetDateOnOpen?: boolean
  onSaveGoal: (input: { amount: number | null; targetDate: string | null }) => Promise<void>
  onEditMilestones: () => void
  onRemoveGoal: () => void
}

type MenuMode = 'menu' | 'editGoal'

export function GoalOptionsMenu({
  goalName,
  currency,
  currentTarget,
  currentTargetDate,
  editGoalRequestKey = 0,
  focusTargetDateOnOpen = false,
  onSaveGoal,
  onEditMilestones,
  onRemoveGoal,
}: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<MenuMode>('menu')
  const [targetAmount, setTargetAmount] = useState(currentTarget != null ? String(currentTarget) : '')
  const [targetDate, setTargetDate] = useState(currentTargetDate ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    setTargetAmount(currentTarget != null ? String(currentTarget) : '')
    setTargetDate(currentTargetDate ?? '')
    setError(null)
  }, [open, currentTarget, currentTargetDate])

  useEffect(() => {
    if (editGoalRequestKey === 0) return
    setMode('editGoal')
    setOpen(true)
  }, [editGoalRequestKey])

  const close = () => {
    if (isPending) return
    setOpen(false)
    setMode('menu')
    setError(null)
  }

  const handleSaveGoal = () => {
    setError(null)
    startTransition(async () => {
      try {
        const parsed = parseFloat(targetAmount)
        await onSaveGoal({
          amount: Number.isFinite(parsed) ? parsed : null,
          targetDate: targetDate.trim() || null,
        })
        setOpen(false)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Failed to update goal')
      }
    })
  }

  const sheetTitle = mode === 'editGoal' ? 'Edit goal' : 'Goal options'

  return (
    <>
      <button
        type="button"
        aria-label="Goal options"
        onClick={() => {
          setMode('menu')
          setOpen(true)
        }}
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
                setMode('editGoal')
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
              Edit goal
            </button>

            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onEditMilestones()
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
              Manage milestones
            </button>

            <div style={{ height: 1, background: 'var(--border-subtle)', margin: '6px 0' }} />

            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onRemoveGoal()
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
              Remove goal
            </button>

            <TertiaryBtn size="md" onClick={close} style={{ padding: '12px' }}>
              Cancel
            </TertiaryBtn>
          </div>
        ) : null}

        {mode === 'editGoal' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <p style={{
                margin: 0,
                fontSize: 'var(--text-base)',
                fontWeight: 'var(--weight-medium)',
                color: 'var(--text-1)',
              }}>
                {goalName}
              </p>
            </div>

            <Input
              label="Target amount"
              value={targetAmount}
              onChange={setTargetAmount}
              prefix={currency}
              placeholder="e.g. 500,000"
              type="number"
              autoFocus={!focusTargetDateOnOpen}
            />

            <Input
              label="Target date"
              value={targetDate}
              onChange={setTargetDate}
              placeholder="Optional"
              type="date"
              autoFocus={focusTargetDateOnOpen}
            />

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
                onClick={handleSaveGoal}
                disabled={isPending}
                style={{ flex: 1 }}
              >
                {isPending ? 'Saving...' : 'Save goal'}
              </PrimaryBtn>
            </div>
          </div>
        ) : null}
      </Sheet>
    </>
  )
}
