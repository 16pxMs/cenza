'use client'

import { PrimaryBtn } from '@/components/ui/Button/Button'

export interface ExpenseAddedSuccessEntry {
  id: string
  name: string
  amountLabel: string
  metaLabel: string
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
  brandDark: 'var(--brand-dark)',
  borderSubtle: 'var(--border-subtle)',
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

      <div style={{ marginBottom: 'var(--space-xxl)' }}>
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
            <div style={{ display: 'grid', gap: 'var(--space-sm)', textAlign: 'left' }}>
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 'var(--space-md)',
                    padding: '0 0 var(--space-sm)',
                    borderBottom: `var(--border-width) solid ${T.borderSubtle}`,
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

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 'var(--space-md)' }}>
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
          }}
        >
          Add another expense
        </button>
      </div>
    </div>
  )
}
