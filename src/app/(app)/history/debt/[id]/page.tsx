export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getAppSession } from '@/lib/auth/app-session'
import { fmt, formatDate } from '@/lib/finance'
import { deleteDebt, getDebt, getDebtTransactions, type Debt, type DebtTransaction } from '@/lib/supabase/debt-db'
import { IconBack } from '@/components/ui/Icons'
import { AddOpeningBalanceSheet } from './AddOpeningBalanceSheet'
import { AddRepaymentSheet } from './AddRepaymentSheet'
import { DebtOptionsMenu } from './DebtOptionsMenu'
import { DebtTransactionList } from './DebtTransactionList'
import { EditStandardDebtDueDateSheet } from './EditStandardDebtDueDateSheet'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function firstSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function resolveDebtBackHref(value: string | string[] | undefined) {
  const candidate = firstSearchParam(value)?.trim()
  if (!candidate) return '/history/debt'
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return '/history/debt'
  if (candidate.includes('\\')) return '/history/debt'
  return candidate
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function monthsBetween(fromDate: Date, toDate: Date) {
  const yearDiff = toDate.getFullYear() - fromDate.getFullYear()
  const monthDiff = toDate.getMonth() - fromDate.getMonth()
  let months = yearDiff * 12 + monthDiff

  if (toDate.getDate() < fromDate.getDate()) {
    months -= 1
  }

  return months
}

function parseDate(value: string | null) {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatDebtDirection(direction: Debt['direction']) {
  return direction === 'owed_by_me' ? 'You owe' : 'They owe you'
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

function formatDebtSummaryLine(direction: Debt['direction'], status: Debt['status']) {
  if (status === 'cleared') {
    return direction === 'owed_by_me' ? 'You paid this off' : 'Paid back to you'
  }
  if (status === 'cancelled') {
    return 'Cancelled'
  }
  return direction === 'owed_by_me' ? 'You owe this' : 'They owe you'
}

function formatDebtTransactionLabel(entryType: DebtTransaction['entry_type']) {
  switch (entryType) {
    case 'principal_increase':
      return 'Starting balance'
    case 'payment_in':
      return 'Payment received'
    case 'payment_out':
      return 'Payment made'
    case 'adjustment_increase':
      return 'Balance increased'
    case 'adjustment_decrease':
      return 'Balance reduced'
    default:
      return entryType
  }
}

function getStandardDueDateState(dueDate: string | null) {
  const parsedDueDate = parseDate(dueDate)
  const today = parseDate(new Date().toISOString().slice(0, 10))

  if (!parsedDueDate || !today) return 'none' as const
  if (parsedDueDate < today) return 'overdue' as const
  if (parsedDueDate.getTime() === today.getTime()) return 'due' as const
  return 'upcoming' as const
}

function isFinancingOverdue(targetDate: string | null) {
  const parsedTargetDate = parseDate(targetDate)
  const today = parseDate(new Date().toISOString().slice(0, 10))

  if (!parsedTargetDate || !today) return false
  return parsedTargetDate < today
}

function toDisplayDebt(debt: Debt, fallbackId: string) {
  const totalCost =
    debt.debt_kind === 'financing' && debt.financing_total_cost != null && debt.financing_total_cost > 0
      ? debt.financing_total_cost
      : null
  const remaining = debt.current_balance > 0 ? debt.current_balance : 0
  const paid = totalCost != null ? Math.max(0, totalCost - remaining) : null
  const progress =
    totalCost != null && totalCost > 0 && paid != null
      ? clamp(paid / totalCost, 0, 1)
      : null
  const targetDate = parseDate(debt.financing_target_date)
  const createdAt = parseDate(debt.created_at.slice(0, 10))
  const today = parseDate(new Date().toISOString().slice(0, 10))
  const monthsLeft =
    targetDate != null && today != null
      ? monthsBetween(today, targetDate)
      : null
  const expectedMonthly =
    totalCost != null && monthsLeft != null && monthsLeft > 0
      ? Math.max(0, remaining / monthsLeft)
      : null
  const totalMonths =
    targetDate != null && createdAt != null
      ? Math.max(1, monthsBetween(createdAt, targetDate))
      : null
  const elapsedMonths =
    totalMonths != null && monthsLeft != null
      ? clamp(totalMonths - Math.max(monthsLeft, 0), 0, totalMonths)
      : null
  const paidRatio =
    totalCost != null && totalCost > 0 && paid != null
      ? clamp(paid / totalCost, 0, 1)
      : null
  const expectedPaidRatio =
    totalMonths != null && totalMonths > 0 && elapsedMonths != null
      ? clamp(elapsedMonths / totalMonths, 0, 1)
      : null
  const paceStatus =
    monthsLeft == null || totalCost == null || paidRatio == null || expectedPaidRatio == null
      ? null
      : monthsLeft <= 0
        ? 'Overdue'
        : paidRatio >= expectedPaidRatio - 0.05
          ? 'You’re on track'
        : paidRatio >= expectedPaidRatio - 0.2
          ? 'You may need to pay more'
            : 'You may need to pay more'

  return {
    id: debt.id,
    name: debt.name.trim() || fallbackId,
    direction: formatDebtDirection(debt.direction),
    status: formatDebtStatus(debt.status),
    summaryLine: formatDebtSummaryLine(debt.direction, debt.status),
    balance: debt.current_balance,
    currency: debt.currency.trim() || 'KES',
    debtKind: debt.debt_kind,
    standardDueDate: debt.standard_due_date,
    standardDueDateState: getStandardDueDateState(debt.standard_due_date),
    isOverdue:
      debt.debt_kind === 'standard'
        ? getStandardDueDateState(debt.standard_due_date) === 'overdue'
        : isFinancingOverdue(debt.financing_target_date),
    financingPrincipalTxId: debt.financing_principal_tx_id,
    financingTotalCost: totalCost,
    financingPaid: paid,
    financingRemaining: totalCost != null ? remaining : null,
    financingProgress: progress,
    financingTargetDate: debt.financing_target_date,
    financingMonthsLeft: monthsLeft,
    financingExpectedMonthly: expectedMonthly,
    financingPaceStatus: paceStatus,
  }
}

function toDisplayTransaction(txn: DebtTransaction, fallbackIndex: number, currency: string) {
  return {
    id: txn.id || `${fallbackIndex}`,
    primary: formatDebtTransactionLabel(txn.entry_type) || `Transaction ${fallbackIndex + 1}`,
    date: txn.transaction_date,
    note: txn.note?.trim() || null,
    amount: txn.amount,
    currency: txn.currency.trim() || currency,
  }
}

export default async function DebtDetailPage({ params, searchParams }: PageProps) {
  const { user } = await getAppSession()
  if (!user) redirect('/')

  const { id } = await params
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const shouldOpenAddPayment = firstSearchParam(resolvedSearchParams.action) === 'add-payment'
  const backHref = resolveDebtBackHref(resolvedSearchParams.returnTo)
  const [debt, transactions] = await Promise.all([
    getDebt(id),
    getDebtTransactions(id),
  ])

  if (!debt) notFound()
  if (transactions.length === 0 && debt.status === 'active') {
    try {
      await deleteDebt(id, user.id)
    } catch {
      // If cleanup fails, fall through and hide the orphaned empty debt anyway.
    }
    redirect('/history/debt')
  }

  const detail = toDisplayDebt(debt, id)
  const items = transactions.map((txn, index) => toDisplayTransaction(txn, index, detail.currency))
  const hasTransactions = items.length > 0
  const canAddPayment = hasTransactions && debt.status === 'active' && detail.balance > 0

  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--page-bg)',
      padding: 'var(--space-xl) var(--space-page-mobile) calc(var(--space-xxl) + var(--bottom-nav-height, 0px))',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link
          href={backHref}
          aria-label="Back"
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
          }}>
            <h1 style={{
              margin: 0,
              fontSize: 'var(--text-xl)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-1)',
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              minWidth: 0,
            }}>
              {detail.name}
            </h1>
            <DebtOptionsMenu
              debtId={detail.id}
              debtName={detail.name}
              debtKind={detail.debtKind}
              currentDueDate={detail.standardDueDate}
            />
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-xs)',
            flexWrap: 'wrap',
            marginTop: 'var(--space-xs)',
          }}>
            <span style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-2)',
              lineHeight: 1.4,
              fontWeight: 'var(--weight-medium)',
            }}>
              {detail.direction}
            </span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: 24,
              padding: '0 10px',
              borderRadius: 999,
              background: 'var(--grey-100)',
              color: 'var(--text-3)',
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-semibold)',
              letterSpacing: '0.02em',
            }}>
              {detail.status}
            </span>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-lg)',
            marginTop: 'var(--space-lg)',
          }}>
            <div>
              <p style={{
                margin: '0 0 var(--space-xs)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                fontWeight: 'var(--weight-semibold)',
              }}>
                Remaining balance
              </p>
              <p style={{
                margin: 0,
                fontSize: 'var(--text-2xl)',
                lineHeight: 1,
                letterSpacing: '-0.02em',
                color: 'var(--text-1)',
                fontWeight: 'var(--weight-medium)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {fmt(detail.balance, detail.currency)}
              </p>
              {detail.status !== 'Active' ? (
                <p style={{
                  margin: 'var(--space-xs) 0 0',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-3)',
                  lineHeight: 1.4,
                }}>
                  {detail.summaryLine}
                </p>
              ) : null}
            </div>

            {canAddPayment || !hasTransactions ? (
              <div>
                {canAddPayment ? (
                  <AddRepaymentSheet
                    debtId={detail.id}
                    debtName={detail.name}
                    currency={detail.currency}
                    currentBalance={detail.balance}
                    emphasized={detail.isOverdue}
                    initialOpen={shouldOpenAddPayment}
                  />
                ) : (
                  <AddOpeningBalanceSheet
                    debtId={detail.id}
                    debtName={detail.name}
                    currency={detail.currency}
                  />
                )}
              </div>
            ) : null}

            {detail.debtKind === 'standard' ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-sm)',
                paddingTop: 'var(--space-sm)',
                borderTop: 'var(--border-width) solid var(--border-subtle)',
              }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    margin: 0,
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    fontWeight: 'var(--weight-semibold)',
                  }}>
                    Due date
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', flexWrap: 'wrap', justifyContent: 'flex-end', minWidth: 0 }}>
                    <p style={{
                      margin: 0,
                      fontSize: 'var(--text-sm)',
                      fontWeight: 'var(--weight-medium)',
                      color: detail.standardDueDate ? 'var(--text-1)' : 'var(--text-3)',
                    }}>
                      {detail.standardDueDate ? formatDate(detail.standardDueDate) : 'None set'}
                    </p>
                    {detail.standardDueDateState === 'overdue' ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '4px 10px',
                        borderRadius: 999,
                        background: '#FDE8E6',
                        color: 'var(--red-dark)',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 'var(--weight-medium)',
                        letterSpacing: '0.02em',
                      }}>
                        Overdue
                      </span>
                    ) : null}
                  <EditStandardDebtDueDateSheet
                    debtId={detail.id}
                    debtName={detail.name}
                    currentDueDate={detail.standardDueDate}
                    compact
                  />
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {detail.debtKind === 'financing' && detail.financingTotalCost != null && detail.financingPaid != null && detail.financingRemaining != null && detail.financingProgress != null ? (
          <section style={{
            marginTop: 'var(--space-lg)',
            background: 'var(--white)',
            border: 'var(--border-width) solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-lg)',
          }}>
            <p style={{
              margin: '0 0 var(--space-md)',
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
            }}>
              Your progress
            </p>

            <div style={{
              height: 6,
              borderRadius: 999,
              background: 'var(--progress-track)',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${detail.financingProgress * 100}%`,
                height: '100%',
                borderRadius: 999,
                background: 'var(--brand-dark)',
                transition: 'width 0.2s ease',
              }} />
            </div>
            <p style={{
              margin: 'var(--space-xs) 0 0',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-3)',
            }}>
              You’ve paid {Math.round(detail.financingProgress * 100)}%
            </p>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-sm)',
              marginTop: 'var(--space-lg)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>Total cost</span>
                <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(detail.financingTotalCost, detail.currency)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>You’ve paid</span>
                <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(detail.financingPaid, detail.currency)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>Left to pay</span>
                <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(detail.financingRemaining, detail.currency)}
                </span>
              </div>
            </div>

            {detail.financingTargetDate ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-sm)',
                marginTop: 'var(--space-md)',
                paddingTop: 'var(--space-md)',
                borderTop: 'var(--border-width) solid var(--border-subtle)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>Finish by</span>
                  <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', color: 'var(--text-1)' }}>
                    {formatDate(detail.financingTargetDate)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>Time remaining</span>
                  <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', color: 'var(--text-1)' }}>
                    {detail.financingMonthsLeft != null && detail.financingMonthsLeft > 0
                      ? `${detail.financingMonthsLeft} month${detail.financingMonthsLeft === 1 ? '' : 's'}`
                      : 'Overdue'}
                  </span>
                </div>
                {detail.financingExpectedMonthly != null ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>Pay about</span>
                    <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(detail.financingExpectedMonthly, detail.currency)}/month
                    </span>
                  </div>
                ) : null}
                {detail.financingPaceStatus ? (
                  <p style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', color: 'var(--text-1)' }}>
                    {detail.financingPaceStatus}
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        <section style={{ marginTop: 'var(--space-lg)' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-sm)',
          }}>
            <h2 style={{
              margin: 0,
              fontSize: 'var(--text-lg)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-1)',
            }}>
              Transactions
            </h2>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>
              {items.length}
            </span>
          </div>

          {items.length === 0 ? (
            <div style={{
              background: 'var(--white)',
              border: 'var(--border-width) solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-lg)',
            }}>
              <p style={{ margin: '0 0 var(--space-2xs)', fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
                This debt is saved, but it has no entries yet.
              </p>
              <p style={{ margin: '0 0 var(--space-card-sm)', fontSize: 'var(--text-base)', color: 'var(--text-2)', lineHeight: 1.6 }}>
                Add an opening balance to start tracking it again. We keep the debt record for now so you do not lose the name, direction, or financing details.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                <AddOpeningBalanceSheet
                  debtId={detail.id}
                  debtName={detail.name}
                  currency={detail.currency}
                />
                <Link
                  href="/history/debt"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 'var(--button-height-sm)',
                    padding: '0 16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--white)',
                    color: 'var(--text-1)',
                    border: '1px solid var(--border)',
                    textDecoration: 'none',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--weight-medium)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  View all debts
                </Link>
              </div>
              <p style={{ margin: 'var(--space-sm) 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-3)', lineHeight: 1.5 }}>
                If this was created by mistake, leaving it empty is safer than deleting it automatically.
              </p>
            </div>
          ) : (
            <DebtTransactionList
              debtId={detail.id}
              items={items}
              lockedTransactionId={
                detail.debtKind === 'financing'
                  ? detail.financingPrincipalTxId
                  : null
              }
            />
          )}
        </section>
      </div>
    </main>
  )
}
