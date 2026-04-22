'use client'

import { PrimaryBtn } from '@/components/ui/Button/Button'

export interface ExpenseAddedSuccessEntry {
  id: string
  name: string
  amountLabel: string
  metaLabel: string
  hasMonthlyReminder?: boolean
}

interface ExpenseAddedSuccessProps {
  entries: ExpenseAddedSuccessEntry[]
  onBack: () => void
  onAddAnother: () => void
}

const T = {
  text1: 'var(--text-1)',
  text3: 'var(--text-3)',
  textMuted: 'var(--text-muted)',
  brandLight: 'var(--brand-light)',
  brandDark: 'var(--brand-dark)',
  borderSubtle: 'var(--border-subtle)',
}

function MonthlyReminderChip() {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      width: 'fit-content',
      marginTop: 'var(--space-xs)',
      padding: '4px 10px',
      borderRadius: 'var(--radius-full)',
      background: T.brandLight,
      color: T.brandDark,
      fontSize: 'var(--text-xs)',
      fontWeight: 'var(--weight-medium)',
      lineHeight: 1.2,
    }}>
      Monthly reminder
    </span>
  )
}

export function ExpenseAddedSuccess({
  entries,
  onBack,
  onAddAnother,
}: ExpenseAddedSuccessProps) {
  const isSingleEntry = entries.length === 1
  const singleEntry = isSingleEntry ? entries[0] : null

  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{
        margin: '0 0 var(--space-md)',
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--weight-semibold)',
        color: T.textMuted,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>
        Expense added
      </p>

      <div style={{ marginTop: 'var(--space-xl)', marginBottom: 'var(--space-2xl)' }}>
        {singleEntry ? (
          <>
            <p style={{
              margin: 0,
              fontSize: 'var(--text-3xl)',
              fontWeight: 'var(--weight-bold)',
              color: T.text1,
              lineHeight: 1,
              letterSpacing: '-0.035em',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {singleEntry.amountLabel}
            </p>
            <p style={{
              margin: 'var(--space-md) 0 0',
              fontSize: 'var(--text-base)',
              color: T.text1,
              lineHeight: 1.35,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {singleEntry.name}
            </p>
            <p style={{
              margin: '4px 0 0',
              fontSize: 'var(--text-xs)',
              color: T.textMuted,
              lineHeight: 1.4,
              letterSpacing: '0.01em',
            }}>
              {singleEntry.metaLabel}
            </p>
            {singleEntry.hasMonthlyReminder && <MonthlyReminderChip />}
          </>
        ) : (
          <>
            <p style={{
              margin: '0 0 var(--space-md)',
              fontSize: 'var(--text-2xl)',
              fontWeight: 'var(--weight-bold)',
              color: T.text1,
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
            }}>
              {entries.length} expenses added
            </p>
            <div style={{ textAlign: 'left' }}>
              {entries.map((entry, index) => (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 'var(--space-md)',
                    padding: '16px 0',
                    borderBottom: index < entries.length - 1 ? `var(--border-width) solid ${T.borderSubtle}` : 'none',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{
                      margin: 0,
                      fontSize: 'var(--text-sm)',
                      fontWeight: 'var(--weight-medium)',
                      color: T.text1,
                      lineHeight: 1.35,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {entry.name}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: T.textMuted, lineHeight: 1.35 }}>
                      {entry.metaLabel}
                    </p>
                    {entry.hasMonthlyReminder && <MonthlyReminderChip />}
                  </div>
                  <p style={{
                    margin: 0,
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--weight-semibold)',
                    color: T.text1,
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    flexShrink: 0,
                  }}>
                    {entry.amountLabel}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', marginTop: 'var(--space-2xl)' }}>
        <PrimaryBtn size="lg" onClick={onBack}>
          Back to overview
        </PrimaryBtn>
        <button
          type="button"
          onClick={onAddAnother}
          style={{
            background: 'transparent',
            border: 'none',
            color: T.brandDark,
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--weight-medium)',
            cursor: 'pointer',
            padding: 'var(--space-xs) 0',
            marginTop: 12,
          }}
        >
          Add another expense
        </button>
      </div>
    </div>
  )
}
