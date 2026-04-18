export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAppSession } from '@/lib/auth/app-session'
import { fmt } from '@/lib/finance'
import { getDebts, type Debt } from '@/lib/supabase/debt-db'
import { IconBack } from '@/components/ui/Icons'

interface DebtListPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function formatDebtDirection(direction: Debt['direction']) {
  return direction === 'owed_by_me' ? 'You owe' : 'Owed to you'
}

function formatDebtStatus(status: Debt['status']) {
  switch (status) {
    case 'active':
      return 'Active'
    case 'cleared':
      return 'Cleared'
    case 'cancelled':
      return 'Cancelled'
    default:
      return status
  }
}

function toDisplayDebt(debt: Debt) {
  const totalCost =
    debt.debt_kind === 'financing' && debt.financing_total_cost != null && debt.financing_total_cost > 0
      ? debt.financing_total_cost
      : null
  const remaining = debt.current_balance > 0 ? debt.current_balance : 0
  const paid = totalCost != null ? Math.max(0, totalCost - remaining) : null
  const progress =
    totalCost != null && totalCost > 0 && paid != null
      ? Math.min(1, Math.max(0, paid / totalCost))
      : null

  return {
    id: debt.id,
    name: debt.name.trim() || 'Untitled debt',
    direction: formatDebtDirection(debt.direction),
    balance: debt.current_balance,
    currency: debt.currency.trim() || 'KES',
    status: formatDebtStatus(debt.status),
    debtKind: debt.debt_kind,
    financingTotalCost: totalCost,
    financingPaid: paid,
    financingProgress: progress,
  }
}

export default async function DebtListPage({ searchParams }: DebtListPageProps) {
  const { user } = await getAppSession()
  if (!user) redirect('/')

  if (searchParams) {
    await searchParams
  }
  const debts = (await getDebts(user.id)).map(toDisplayDebt)
  const createHref = `/history/debt/new?returnTo=${encodeURIComponent('/history/debt')}`

  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--page-bg)',
      padding: 'var(--space-lg) var(--space-page-mobile) calc(var(--space-xxl) + var(--bottom-nav-height, 0px))',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link
          href="/app"
          aria-label="Back to overview"
          style={{
            width: 44,
            height: 44,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 'var(--space-lg)',
            color: 'var(--grey-900)',
            textDecoration: 'none',
          }}
        >
          <IconBack size={20} />
        </Link>

        <section style={{
          background: 'var(--white)',
          border: 'var(--border-width) solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-lg)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 'var(--space-md)',
            flexWrap: 'wrap',
          }}>
            <div>
              <p style={{
                margin: '0 0 var(--space-2xs)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}>
                Debt
              </p>
              <h1 style={{
                margin: 0,
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-2xl)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--text-1)',
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
              }}>
                Your debts
              </h1>
              <p style={{
                margin: 'var(--space-sm) 0 0',
                fontSize: 'var(--text-base)',
                color: 'var(--text-2)',
                lineHeight: 1.6,
              }}>
                Keep every debt in one place so you can open the full detail whenever you need it.
              </p>
            </div>
            <Link
              href={createHref}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 'var(--button-height-sm)',
                padding: '0 16px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--brand-dark)',
                color: 'var(--text-inverse)',
                textDecoration: 'none',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-semibold)',
                whiteSpace: 'nowrap',
              }}
            >
              Create debt
            </Link>
          </div>
        </section>

        <section style={{ marginTop: 'var(--space-lg)' }}>
          {debts.length === 0 ? (
            <div style={{
              background: 'var(--white)',
              border: 'var(--border-width) solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-lg)',
            }}>
              <p style={{
                margin: '0 0 var(--space-2xs)',
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--text-1)',
                letterSpacing: '-0.01em',
              }}>
                No debts yet.
              </p>
              <p style={{
                margin: '0 0 var(--space-card-sm)',
                fontSize: 'var(--text-base)',
                color: 'var(--text-2)',
                lineHeight: 1.6,
              }}>
                Add your first debt to track what you owe or what is owed to you.
              </p>
              <Link
                href={createHref}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 'var(--button-height-lg)',
                  padding: '0 18px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--white)',
                  color: 'var(--text-1)',
                  border: '1px solid var(--border)',
                  textDecoration: 'none',
                  fontSize: 'var(--text-base)',
                  fontWeight: 'var(--weight-semibold)',
                }}
              >
                Add your first debt
              </Link>
            </div>
          ) : (
            <div style={{
              background: 'var(--white)',
              border: 'var(--border-width) solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
            }}>
              {debts.map((debt, index) => (
                <Link
                  key={debt.id}
                  href={`/history/debt/${debt.id}`}
                  style={{
                    display: 'block',
                    padding: 'var(--space-lg)',
                    textDecoration: 'none',
                    borderTop: index === 0 ? 'none' : 'var(--border-width) solid var(--border-subtle)',
                    color: 'inherit',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 'var(--space-md)',
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{
                        margin: 0,
                        fontSize: 'var(--text-base)',
                        fontWeight: 'var(--weight-semibold)',
                        color: 'var(--text-1)',
                      }}>
                        {debt.name}
                      </p>
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 'var(--space-xs)',
                        marginTop: 'var(--space-xs)',
                      }}>
                        <span style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--text-3)',
                          background: 'var(--grey-50)',
                          borderRadius: 999,
                          padding: '6px 10px',
                        }}>
                          {debt.direction}
                        </span>
                        <span style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--text-3)',
                          background: 'var(--grey-50)',
                          borderRadius: 999,
                          padding: '6px 10px',
                        }}>
                          {debt.status}
                        </span>
                      </div>
                    </div>
                    <div style={{
                      flexShrink: 0,
                      textAlign: 'right',
                      minWidth: 132,
                    }}>
                      {debt.debtKind === 'financing' && debt.financingTotalCost != null && debt.financingPaid != null && debt.financingProgress != null ? (
                        <>
                          <p style={{
                            margin: 0,
                            fontSize: 'var(--text-sm)',
                            fontWeight: 'var(--weight-semibold)',
                            color: 'var(--text-1)',
                            whiteSpace: 'nowrap',
                          }}>
                            {fmt(debt.financingPaid, debt.currency)} / {fmt(debt.financingTotalCost, debt.currency)} paid
                          </p>
                          <div style={{
                            marginTop: 'var(--space-xs)',
                            width: '100%',
                            height: 6,
                            borderRadius: 999,
                            background: 'var(--grey-100, var(--grey-50))',
                            overflow: 'hidden',
                          }}>
                            <div style={{
                              width: `${debt.financingProgress * 100}%`,
                              height: '100%',
                              borderRadius: 999,
                              background: 'var(--brand-dark)',
                            }} />
                          </div>
                          <p style={{
                            margin: '6px 0 0',
                            fontSize: 'var(--text-xs)',
                            color: 'var(--text-3)',
                          }}>
                            {Math.round(debt.financingProgress * 100)}% complete
                          </p>
                        </>
                      ) : (
                        <p style={{
                          margin: 0,
                          fontSize: 'var(--text-base)',
                          fontWeight: 'var(--weight-semibold)',
                          color: 'var(--text-1)',
                          whiteSpace: 'nowrap',
                        }}>
                          {fmt(debt.balance, debt.currency)}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
