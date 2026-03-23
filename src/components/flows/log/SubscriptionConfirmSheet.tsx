'use client'

// ─────────────────────────────────────────────────────────────
// SubscriptionConfirmSheet
//
// Monthly check-in for known subscriptions.
// Shows each unconfirmed subscription, lets the user:
//   • Confirm at the expected amount (one tap)
//   • Edit the amount if it changed
//   • Skip (marks needs_check = false without logging)
//
// On confirm: inserts a transaction + updates last_confirmed_month.
// ─────────────────────────────────────────────────────────────

import { useState } from 'react'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { CheckCircle2, ChevronRight } from 'lucide-react'

interface Subscription {
  id:     string
  key:    string
  label:  string
  amount: number | null
}

interface Props {
  open:          boolean
  onClose:       () => void
  subscriptions: Subscription[]
  currency:      string
  currentMonth:  string
  onConfirm:     (sub: Subscription, amount: number) => Promise<void>
  onSkip:        (subId: string) => Promise<void>
}

export function SubscriptionConfirmSheet({
  open, onClose, subscriptions, currency, currentMonth, onConfirm, onSkip,
}: Props) {
  const [editing,     setEditing]     = useState<string | null>(null)
  const [editAmount,  setEditAmount]  = useState('')
  const [confirming,  setConfirming]  = useState<string | null>(null)
  const [confirmed,   setConfirmed]   = useState<Set<string>>(new Set())

  const monthLabel = new Date(`${currentMonth}-01`).toLocaleString('default', {
    month: 'long', year: 'numeric',
  })

  const pending = subscriptions.filter(s => !confirmed.has(s.id))
  const allDone = pending.length === 0

  const handleConfirm = async (sub: Subscription) => {
    const amount = editing === sub.id
      ? parseFloat(editAmount) || sub.amount || 0
      : sub.amount || 0

    if (amount <= 0) { setEditing(sub.id); setEditAmount(String(sub.amount ?? '')); return }

    setConfirming(sub.id)
    await onConfirm(sub, amount)
    setConfirmed(prev => new Set(prev).add(sub.id))
    setEditing(null)
    setConfirming(null)
  }

  const handleSkip = async (subId: string) => {
    await onSkip(subId)
    setConfirmed(prev => new Set(prev).add(subId))
  }

  return (
    <Sheet open={open} onClose={onClose} title="Monthly subscriptions">

      {/* Context line */}
      <p style={{
        margin: '0 0 var(--space-lg)',
        fontSize: 'var(--text-sm)',
        color: 'var(--text-2)',
        lineHeight: 1.6,
      }}>
        Confirm what you paid for {monthLabel}. We'll log each one as an expense.
      </p>

      {allDone ? (
        /* Done state */
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: 'var(--space-xxl) 0',
          gap: 'var(--space-sm)',
        }}>
          <CheckCircle2 size={40} color="var(--green-dark)" fill="var(--green-light)" strokeWidth={1.5} />
          <p style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-1)' }}>
            All subscriptions confirmed
          </p>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>
            They've been added to your expenses.
          </p>
        </div>
      ) : (
        /* Subscription list */
        <div style={{
          background: 'var(--white)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: 'var(--space-md)',
        }}>
          {pending.map((sub, i) => {
            const isEditing = editing === sub.id
            const isSaving  = confirming === sub.id
            const isLast    = i === pending.length - 1

            return (
              <div
                key={sub.id}
                style={{
                  borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
                  padding: 'var(--space-md)',
                }}
              >
                {/* Row: label + amount + confirm button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: '0 0 2px',
                      fontSize: 'var(--text-base)',
                      fontWeight: 'var(--weight-semibold)',
                      color: 'var(--text-1)',
                    }}>
                      {sub.label}
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
                          onKeyDown={e => e.key === 'Enter' && handleConfirm(sub)}
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
                        onClick={() => { setEditing(sub.id); setEditAmount(String(sub.amount ?? '')) }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: 0, display: 'flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>
                          {sub.amount != null
                            ? `${currency} ${sub.amount.toLocaleString()}`
                            : 'Tap to set amount'}
                        </span>
                        <ChevronRight size={12} color="var(--text-muted)" />
                      </button>
                    )}
                  </div>

                  {/* Confirm button */}
                  <button
                    onClick={() => handleConfirm(sub)}
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

                {/* Skip link */}
                <button
                  onClick={() => handleSkip(sub.id)}
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

      {/* Close / Done */}
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
        {allDone ? 'Done' : 'I\'ll do this later'}
      </button>

    </Sheet>
  )
}
