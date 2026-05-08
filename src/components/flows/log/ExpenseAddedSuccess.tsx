'use client'

import { PrimaryBtn, SecondaryBtn } from '@/components/ui/Button/Button'

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
  brandLight: 'var(--brand)',
  brandDark: 'var(--brand-dark)',
  borderSubtle: 'var(--border-subtle)',
  border: 'var(--border)',
  white: 'var(--white)',
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
    <div>
      <div
        style={{
          background: T.white,
          border: `var(--border-width) solid ${T.border}`,
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-lg)',
          display: 'grid',
          gap: 'var(--space-lg)',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-md)',
        }}>
          <p style={{
            margin: 0,
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--weight-semibold)',
            color: T.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            Expense added
          </p>
        </div>

        <div>
          {singleEntry ? (
            <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
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
                margin: 0,
                fontSize: 'var(--text-base)',
                fontWeight: 'var(--weight-semibold)',
                color: T.text1,
                lineHeight: 1.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {singleEntry.name}
              </p>
              <p style={{
                margin: 0,
                fontSize: 'var(--text-sm)',
                color: T.textMuted,
                lineHeight: 1.4,
              }}>
                {singleEntry.metaLabel}
              </p>
              {singleEntry.hasMonthlyReminder && <MonthlyReminderChip />}
            </div>
          ) : (
            <>
              <p style={{
                margin: 0,
                fontSize: 'var(--text-2xl)',
                fontWeight: 'var(--weight-bold)',
                color: T.text1,
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
              }}>
                {entries.length} expenses added
              </p>
              <div style={{ marginTop: 'var(--space-lg)' }}>
                {entries.map((entry, index) => (
                  <div
                    key={entry.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 'var(--space-md)',
                      padding: `${index === 0 ? '0' : 'var(--space-md)'} 0 ${index < entries.length - 1 ? 'var(--space-md)' : '0'}`,
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
                      <p style={{ margin: 'var(--space-xs) 0 0', fontSize: 'var(--text-xs)', color: T.textMuted, lineHeight: 1.35 }}>
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

        <div style={{
          display: 'grid',
          gap: 'var(--space-sm)',
          paddingTop: 'var(--space-sm)',
        }}>
          <PrimaryBtn size="lg" onClick={onBack}>
            Back to overview
          </PrimaryBtn>
          <SecondaryBtn size="lg" onClick={onAddAnother}>
            Add another expense
          </SecondaryBtn>
        </div>
      </div>
    </div>
  )
}
