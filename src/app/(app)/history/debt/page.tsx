export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAppSession } from '@/lib/auth/app-session'
import { formatAmount } from '@/lib/formatting/amount'
import type { AmountFormatPreference } from '@/lib/formatting/amount'
import { getDebts, type Debt } from '@/lib/supabase/debt-db'
import { getDebtListVisibility } from '@/lib/debts/state'
import { AppSubpageHeader } from '@/components/layout/AppSubpageHeader/AppSubpageHeader'
import { AppSubpageLayout } from '@/components/layout/AppSubpageLayout/AppSubpageLayout'
import { PrimaryLink } from '@/components/ui/Button/Button'

interface DebtListPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function toDisplayDebt(debt: Debt) {
  return {
    id: debt.id,
    name: debt.name.trim() || 'Untitled debt',
    balance: debt.current_balance,
    currency: debt.currency.trim() || 'KES',
    visibility: getDebtListVisibility(debt),
  }
}

function DebtRow({
  debt,
  showSeparator,
  returnTo,
  amountFormatPreference,
}: {
  debt: ReturnType<typeof toDisplayDebt>
  showSeparator: boolean
  returnTo?: string
  amountFormatPreference: AmountFormatPreference
}) {
  const href = returnTo
    ? `/history/debt/${debt.id}?returnTo=${encodeURIComponent(returnTo)}`
    : `/history/debt/${debt.id}`
  return (
    <Link
      href={href}
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
        color: debt.visibility === 'settled' ? 'var(--text-3)' : 'var(--text-1)',
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
        color: debt.visibility === 'settled' ? 'var(--text-3)' : 'var(--text-1)',
        flexShrink: 0,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {formatAmount(debt.balance, { currency: debt.currency, preference: amountFormatPreference, context: 'row' })}
      </span>
    </Link>
  )
}

export default async function DebtListPage({ searchParams }: DebtListPageProps) {
  const { user, profile } = await getAppSession()
  if (!user || !profile) redirect('/')
  const amountFormatPreference = profile.amount_format_preference ?? 'smart'

  const resolvedSearchParams = searchParams ? await searchParams : {}
  const view = firstValue(resolvedSearchParams.view) === 'settled' ? 'settled' : 'active'
  const allDebts = (await getDebts(user.id)).map(toDisplayDebt)
  const active = allDebts.filter((d) => d.visibility === 'active').sort((a, b) => b.balance - a.balance)
  const settled = allDebts.filter((d) => d.visibility === 'settled')

  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--page-bg)',
    }}>
      <AppSubpageLayout maxWidth={720}>
        <AppSubpageHeader
          title={view === 'settled' ? 'Settled debts' : 'Debts'}
          backHref={view === 'settled' ? '/history/debt' : '/menu'}
          ariaLabel={view === 'settled' ? 'Back to debts' : 'Back to More'}
        />

        {view === 'active' ? (
          <>
            <PrimaryLink
              href="/history/debt/new?returnTo=/history/debt"
              size="md"
              style={{ marginBottom: 'var(--space-md)' }}
            >
              Add debt
            </PrimaryLink>

            {settled.length > 0 ? (
              <Link
                href="/history/debt?view=settled"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 'var(--button-height-md)',
                  padding: '0 18px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--white)',
                  color: 'var(--text-1)',
                  border: '1px solid var(--border)',
                  textDecoration: 'none',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--weight-medium)',
                  marginBottom: 'var(--space-lg)',
                }}
              >
                View settled debts
              </Link>
            ) : (
              <div style={{ marginBottom: 'var(--space-lg)' }} />
            )}
          </>
        ) : null}

        {view === 'active' && active.length === 0 ? (
          <p style={{
            margin: 0,
            fontSize: 'var(--text-sm)',
            color: 'var(--text-muted)',
            lineHeight: 1.5,
          }}>
            <span style={{ display: 'block', color: 'var(--text-1)', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', marginBottom: 'var(--space-2xs)' }}>
              No active debts
            </span>
            Add a debt to start tracking what you owe or what is owed to you.
          </p>
        ) : null}

        {view === 'settled' && settled.length === 0 ? (
          <p style={{
            margin: 0,
            fontSize: 'var(--text-sm)',
            color: 'var(--text-muted)',
            lineHeight: 1.5,
          }}>
            No settled debts yet.
          </p>
        ) : null}

        {view === 'active' && active.length > 0 ? (
          <div style={{
            background: 'var(--white)',
            borderRadius: 'var(--radius-xl)',
            overflow: 'hidden',
          }}>
            {active.map((debt, i) => (
              <DebtRow key={debt.id} debt={debt} showSeparator={i > 0} amountFormatPreference={amountFormatPreference} />
            ))}
          </div>
        ) : null}

        {view === 'settled' && settled.length > 0 ? (
          <div style={{
            background: 'var(--white)',
            borderRadius: 'var(--radius-xl)',
            overflow: 'hidden',
          }}>
            {settled.map((debt, i) => (
              <DebtRow
                key={debt.id}
                debt={debt}
                showSeparator={i > 0}
                returnTo="/history/debt?view=settled"
                amountFormatPreference={amountFormatPreference}
              />
            ))}
          </div>
        ) : null}
      </AppSubpageLayout>
    </main>
  )
}
