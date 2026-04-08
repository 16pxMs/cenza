'use client'

const T = {
  pageBg:    'var(--page-bg)',
  white:     'var(--white)',
  border:    'var(--border)',
  brandDark: 'var(--brand-dark)',
  text1:     'var(--text-1)',
  text2:     'var(--text-2)',
  text3:     'var(--text-3)',
  textMuted: 'var(--text-muted)',
}

function fmt(n: number, cur: string) {
  if (!n) return `${cur} 0`
  return `${cur} ${n.toLocaleString()}`
}

export interface RecapCategory {
  key:      string
  label:    string
  budgeted: number
  spent:    number
}

export interface RecapData {
  prevCycleLabel: string
  incomeTotal:    number
  totalSpent:     number
  fixedTotal:     number
  categories:     RecapCategory[]
}

interface Props {
  data:              RecapData
  currency:          string
  currentCycleLabel: string
  isDesktop?:        boolean
  onContinue:        () => void
}

export function LastCycleRecapSection({
  data,
  currency,
  showHeader = true,
}: {
  data: RecapData
  currency: string
  showHeader?: boolean
}) {
  const prevLabel       = data.prevCycleLabel
  const totalOut        = data.totalSpent + data.fixedTotal
  const saved           = data.incomeTotal - totalOut
  const hasSaved        = data.incomeTotal > 0 && saved > 0
  const savedPct        = data.incomeTotal > 0 ? Math.round((saved / data.incomeTotal) * 100) : 0
  const catsWithBudget  = data.categories.filter(c => c.budgeted > 0)
  const underCount      = catsWithBudget.filter(c => c.spent <= c.budgeted).length

  return (
    <>
      {showHeader && (
        <div style={{ marginBottom: 16 }}>
          <h1 style={{
            margin: '0 0 6px',
            fontSize: 24,
            fontWeight: 700,
            color: T.text1,
            letterSpacing: '-0.5px',
            fontFamily: 'var(--font-display)',
          }}>
            {prevLabel} in review
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: T.textMuted }}>
            Here's how your month went
          </p>
        </div>
      )}

      <div style={{
        background: T.white,
        border: `1px solid var(--border)`,
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: 16,
      }}>
        <div style={{ padding: '22px 20px 18px' }}>
          <p style={{
            margin: '0 0 4px',
            fontSize: 12,
            fontWeight: 600,
            color: T.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
          }}>
            Total spent
          </p>
          <p style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontSize: 40,
            fontWeight: 700,
            letterSpacing: '-1.5px',
            lineHeight: 1,
            color: T.text1,
          }}>
            {fmt(data.totalSpent, currency)}
          </p>
          {hasSaved && (
            <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--green-dark)' }}>
              You kept {fmt(saved, currency)} — {savedPct}% of your income
            </p>
          )}
        </div>

        {data.incomeTotal > 0 && (
          <div style={{ display: 'flex', borderTop: `1px solid var(--border-subtle)` }}>
            {[
              { label: 'Income', value: fmt(data.incomeTotal, currency) },
              { label: 'Kept', value: fmt(Math.max(saved, 0), currency) },
            ].map((col, i) => (
              <div
                key={col.label}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  borderLeft: i > 0 ? `1px solid var(--border-subtle)` : 'none',
                }}
              >
                <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {col.label}
                </p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: T.text2 }}>
                  {col.value}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {catsWithBudget.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{
            margin: '0 0 10px',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: T.textMuted,
          }}>
            Spending budget
          </p>

          <div style={{
            background: T.white,
            border: `1px solid var(--border)`,
            borderRadius: 16,
            overflow: 'hidden',
          }}>
            {catsWithBudget.map((cat, i) => {
              const over = cat.spent > cat.budgeted
              const diff = Math.abs(cat.spent - cat.budgeted)
              const isLast = i === catsWithBudget.length - 1

              return (
                <div
                  key={cat.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '13px 16px',
                    borderBottom: isLast ? 'none' : `1px solid var(--border-subtle)`,
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: T.text1 }}>{cat.label}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: T.textMuted }}>
                      budgeted {fmt(cat.budgeted, currency)}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: over ? 'var(--red-dark)' : T.text1 }}>
                      {fmt(cat.spent, currency)}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: over ? 'var(--red-dark)' : 'var(--green-dark)' }}>
                      {over
                        ? `+${fmt(diff, currency)} over`
                        : diff > 0 ? `${fmt(diff, currency)} under` : 'on budget'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {catsWithBudget.length > 1 && (
            <p style={{ margin: '10px 0 0', fontSize: 13, color: T.text3, textAlign: 'center' }}>
              {underCount === catsWithBudget.length
                ? `Within budget on all ${catsWithBudget.length} categories`
                : `Within budget on ${underCount} of ${catsWithBudget.length} categories`}
            </p>
          )}
        </div>
      )}
    </>
  )
}

export function MonthRecapScreen({ data, currency, currentCycleLabel, isDesktop, onContinue }: Props) {
  const currentLabel = currentCycleLabel

  return (
    <div style={{ minHeight: '100vh', background: T.pageBg, padding: isDesktop ? '48px 0' : '32px 0 48px' }}>
      <div style={{ maxWidth: isDesktop ? 520 : '100%', margin: '0 auto', padding: '0 20px' }}>
        <LastCycleRecapSection data={data} currency={currency} />

        <div style={{ marginTop: 32 }}>
          <button
            onClick={onContinue}
            style={{
              width: '100%',
              height: 54,
              borderRadius: 14,
              background: T.brandDark,
              border: 'none',
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Plan {currentLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
