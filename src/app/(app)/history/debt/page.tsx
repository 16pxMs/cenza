export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAppSession } from '@/lib/auth/app-session'
import { fmt } from '@/lib/finance'
import { getDebts, type Debt } from '@/lib/supabase/debt-db'
import { IconPlus } from '@/components/ui/Icons'

function toDisplayDebt(debt: Debt) {
  return {
    id: debt.id,
    name: debt.name.trim() || 'Untitled debt',
    balance: debt.current_balance,
    currency: debt.currency.trim() || 'KES',
    isCleared: debt.status === 'cleared' || debt.status === 'cancelled',
  }
}

function DebtRow({ debt, showSeparator }: { debt: ReturnType<typeof toDisplayDebt>; showSeparator: boolean }) {
  return (
    <Link
      href={`/history/debt/${debt.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-md)',
        padding: '12px var(--space-md)',
        textDecoration: 'none',
        color: 'inherit',
        borderTop: showSeparator ? 'var(--border-width) solid var(--border-subtle)' : 'none',
      }}
    >
      <p style={{
        margin: 0,
        fontSize: 'var(--text-base)',
        fontWeight: 'var(--weight-regular)',
        color: debt.isCleared ? 'var(--text-3)' : 'var(--text-1)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        minWidth: 0,
        flex: 1,
      }}>
        {debt.name}
      </p>
      <span style={{
        fontSize: 'var(--text-base)',
        fontWeight: 'var(--weight-medium)',
        color: debt.isCleared ? 'var(--text-3)' : 'var(--text-1)',
        flexShrink: 0,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {fmt(debt.balance, debt.currency)}
      </span>
    </Link>
  )
}

export default async function DebtListPage() {
  const { user } = await getAppSession()
  if (!user) redirect('/')

  const allDebts = (await getDebts(user.id)).map(toDisplayDebt)
  const active = allDebts.filter((d) => !d.isCleared).sort((a, b) => b.balance - a.balance)
  const cleared = allDebts.filter((d) => d.isCleared)

  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--page-bg)',
      padding: 'var(--space-xl) var(--space-page-mobile) 160px',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{
          margin: '0 0 var(--space-lg)',
          fontSize: 'var(--text-2xl)',
          fontWeight: 'var(--weight-bold)',
          color: 'var(--text-1)',
          letterSpacing: '-0.02em',
          lineHeight: 1.15,
        }}>
          Debts
        </h1>

        {allDebts.length === 0 ? (
          <p style={{
            margin: 0,
            fontSize: 'var(--text-sm)',
            color: 'var(--text-muted)',
            lineHeight: 1.5,
          }}>
            No debts yet.
          </p>
        ) : (
          <>
            {active.length > 0 && (
              <div style={{
                background: 'var(--white)',
                borderRadius: 'var(--radius-xl)',
                overflow: 'hidden',
              }}>
                {active.map((debt, i) => (
                  <DebtRow key={debt.id} debt={debt} showSeparator={i > 0} />
                ))}
              </div>
            )}

            {cleared.length > 0 && (
              <div style={{ marginTop: active.length > 0 ? 'var(--space-lg)' : 0 }}>
                <p style={{
                  margin: '0 0 var(--space-sm)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--weight-semibold)',
                  color: 'var(--text-muted)',
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                }}>
                  Cleared
                </p>
                <div style={{
                  background: 'var(--white)',
                  borderRadius: 'var(--radius-xl)',
                  overflow: 'hidden',
                }}>
                  {cleared.map((debt, i) => (
                    <DebtRow key={debt.id} debt={debt} showSeparator={i > 0} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Link
        href="/history/debt/new?returnTo=/history/debt"
        aria-label="Create debt"
        style={{
          position: 'fixed',
          right: 20,
          bottom: 'calc(var(--bottom-nav-height, 0px) + 20px)',
          width: 56,
          height: 56,
          borderRadius: 'var(--radius-full)',
          border: 'none',
          background: 'var(--brand-dark)',
          color: 'var(--text-inverse)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 10px 24px rgba(0,0,0,0.16)',
          zIndex: 45,
          textDecoration: 'none',
        }}
      >
        <IconPlus size={22} color="currentColor" />
      </Link>
    </main>
  )
}
