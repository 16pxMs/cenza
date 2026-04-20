'use client'

import { SecondaryBtn } from '@/components/ui/Button/Button'

interface Props {
  onCreateGoal?: () => void
}

const PREVIEW_ROWS = [
  { icon: '🛒', label: 'Groceries' },
  { icon: '🚌', label: 'Transport' },
  { icon: '🍽️', label: 'Eating out' },
  { icon: '📱', label: 'Airtime / Data' },
  { icon: '💡', label: 'Utilities' },
]

export function OverviewEmptyState({ onCreateGoal }: Props) {
  return (
    <div style={{ marginTop: 8 }}>
      <h2 style={{ margin: '0 0 14px', fontSize: 'var(--text-2xl)', color: 'var(--text-1)', letterSpacing: '-0.015em', lineHeight: 1.2 }}>
        Your overview is empty.
      </h2>

      <div style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        padding: 20,
        marginBottom: 14,
      }}>
        <p style={{
          margin: '0 0 14px',
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--weight-semibold)',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: 'var(--text-muted)',
        }}>
          Your spending
        </p>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 14 }}>
          {[14, 22, 18, 34, 20, 26, 19].map((h, i) => (
            <span
              key={i}
              style={{
                width: 34,
                height: h,
                borderRadius: 6,
                background: 'var(--grey-100)',
                display: 'inline-block',
              }}
            />
          ))}
        </div>

        <p style={{ margin: '0 0 14px', fontSize: 'var(--text-md)', color: 'var(--text-2)' }}>
          Your spending will appear here.
        </p>

      </div>

      <p style={{
        margin: '0 0 8px',
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--weight-semibold)',
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        color: 'var(--text-muted)',
      }}>
        Category preview
      </p>

      <div style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 18,
        overflow: 'hidden',
        marginBottom: 14,
      }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>
            We’ll organize your entries here automatically.
          </p>
        </div>
        {PREVIEW_ROWS.slice(0, 3).map((row, i) => (
          <div
            key={row.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'var(--grey-50)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
              }}>
                {row.icon}
              </div>
              <span style={{ fontSize: 'var(--text-md)', color: 'var(--text-1)', fontWeight: 'var(--weight-medium)' }}>
                {row.label}
              </span>
            </div>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>—</span>
          </div>
        ))}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>
            +{Math.max(0, PREVIEW_ROWS.length - 3)} more categories
          </p>
        </div>
      </div>

      <div style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 18,
        padding: 18,
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          borderRadius: 999,
          border: '1px solid #B7E4C1',
          background: '#EAF8EE',
          color: '#1A7A45',
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--weight-semibold)',
          padding: '6px 12px',
          marginBottom: 10,
        }}>
          Set up your first goal
        </div>
        <p style={{ margin: '0 0 8px', fontSize: 'var(--text-md)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
          Give your money a purpose.
        </p>
        <p style={{ margin: '0 0 16px', fontSize: 'var(--text-md)', color: 'var(--text-2)', lineHeight: 1.6 }}>
          Whether it is school fees, an emergency fund, or something else. Set a goal and track it here.
        </p>
        {onCreateGoal && (
          <SecondaryBtn
            type="button"
            size="md"
            onClick={onCreateGoal}
            style={{
              width: '100%',
            }}
          >
            Add your first goal
          </SecondaryBtn>
        )}
      </div>
    </div>
  )
}
