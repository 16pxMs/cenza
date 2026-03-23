'use client'

// ─────────────────────────────────────────────────────────────────────────────
// CommittedExpenseConfirmSheet
//
// Monthly check-in for all committed (recurring) expenses:
//   • Subscriptions  (source = 'subscription')
//   • Fixed expenses (source = 'fixed')
//
// For each item the user can:
//   • Confirm at the expected amount (one tap)
//   • Edit the amount if it changed
//   • Skip — marks confirmed without logging a transaction
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { CheckCircle2, ChevronRight } from 'lucide-react'

export interface CommittedExpense {
  id:     string
  label:  string
  amount: number | null
  source: 'subscription' | 'fixed'
}

interface Props {
  open:         boolean
  onClose:      () => void
  expenses:     CommittedExpense[]
  currency:     string
  currentMonth: string
  onConfirm:    (expense: CommittedExpense, amount: number) => Promise<void>
  onSkip:       (expense: CommittedExpense) => Promise<void>
}

export function CommittedExpenseConfirmSheet({
  open, onClose, expenses, currency, currentMonth, onConfirm, onSkip,
}: Props) {
  const [editing,    setEditing]    = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)
  const [confirmed,  setConfirmed]  = useState<Set<string>>(new Set())

  const monthLabel = new Date(`${currentMonth}-01`).toLocaleString('default', {
    month: 'long', year: 'numeric',
  })

  const pending = expenses.filter(e => !confirmed.has(e.id))
  const allDone = pending.length === 0

  const handleConfirm = async (expense: CommittedExpense) => {
    const amount = editing === expense.id
      ? parseFloat(editAmount) || expense.amount || 0
      : expense.amount || 0

    if (amount <= 0) {
      setEditing(expense.id)
      setEditAmount(String(expense.amount ?? ''))
      return
    }

    setConfirming(expense.id)
    await onConfirm(expense, amount)
    setConfirmed(prev => new Set(prev).add(expense.id))
    setEditing(null)
    setConfirming(null)
  }

  const handleSkip = async (expense: CommittedExpense) => {
    await onSkip(expense)
    setConfirmed(prev => new Set(prev).add(expense.id))
  }

  return (
    <Sheet open={open} onClose={onClose} title="Monthly check-in">

      <p style={{
        margin: '0 0 var(--space-lg)',
        fontSize: 'var(--text-sm)',
        color: 'var(--text-2)',
        lineHeight: 1.6,
      }}>
        Confirm what you paid for {monthLabel}. We'll log each one as an expense.
      </p>

      {allDone ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: 'var(--space-xxl) 0',
          gap: 'var(--space-sm)',
        }}>
          <CheckCircle2 size={40} color="var(--green-dark)" fill="var(--green-light)" strokeWidth={1.5} />
          <p style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-1)' }}>
            All done
          </p>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>
            Your committed expenses have been logged.
          </p>
        </div>
      ) : (
        <div style={{
          background: 'var(--white)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: 'var(--space-md)',
        }}>
          {pending.map((expense, i) => {
            const isEditing = editing === expense.id
            const isSaving  = confirming === expense.id
            const isLast    = i === pending.length - 1

            return (
              <div
                key={expense.id}
                style={{
                  borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
                  padding: 'var(--space-md)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: '0 0 2px',
                      fontSize: 'var(--text-base)',
                      fontWeight: 'var(--weight-semibold)',
                      color: 'var(--text-1)',
                    }}>
                      {expense.label}
                    </p>

                    {isEditing ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>{currency}</span>
                        <input
                          autoFocus
                          type="number"
                          inputMode="decimal"
                          value={editAmount}
                          onChange={e => setEditAmount(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleConfirm(expense)}
                          placeholder="Enter amount"
                          style={{
                            width: 120,
                            height: 36,
                            border: '1.5px solid var(--border-focus)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0 10px',
                            fontSize: 'var(--text-sm)',
                            color: 'var(--text-1)',
                            background: 'var(--white)',
                            outline: 'none',
                            fontFamily: 'inherit',
                          }}
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditing(expense.id); setEditAmount(String(expense.amount ?? '')) }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: 0, display: 'flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>
                          {expense.amount != null
                            ? `${currency} ${expense.amount.toLocaleString()}`
                            : 'Tap to set amount'}
                        </span>
                        <ChevronRight size={12} color="var(--text-muted)" />
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => handleConfirm(expense)}
                    disabled={isSaving}
                    style={{
                      height: 36,
                      padding: '0 var(--space-md)',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--brand-dark)',
                      border: 'none',
                      color: 'var(--text-inverse)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 'var(--weight-semibold)',
                      cursor: isSaving ? 'default' : 'pointer',
                      flexShrink: 0,
                      transition: 'opacity 0.15s',
                      opacity: isSaving ? 0.6 : 1,
                    }}
                  >
                    {isSaving ? '…' : isEditing ? 'Log it' : 'Paid ✓'}
                  </button>
                </div>

                <button
                  onClick={() => handleSkip(expense)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: 'var(--space-xs) 0 0',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-muted)',
                    fontFamily: 'inherit',
                  }}
                >
                  Didn't pay this month
                </button>
              </div>
            )
          })}
        </div>
      )}

      <button
        onClick={onClose}
        style={{
          width: '100%', height: 52,
          borderRadius: 'var(--radius-lg)',
          background: allDone ? 'var(--brand-dark)' : 'transparent',
          border: allDone ? 'none' : '1.5px solid var(--border-strong)',
          color: allDone ? 'var(--text-inverse)' : 'var(--text-2)',
          fontSize: 'var(--text-base)',
          fontWeight: 'var(--weight-semibold)',
          cursor: 'pointer',
        }}
      >
        {allDone ? 'Done' : "I'll do this later"}
      </button>

    </Sheet>
  )
}
