'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/lib/context/ToastContext'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import type { IncomePageData } from '@/lib/loaders/income'

const T = {
  pageBg: 'var(--page-bg)',
  white: 'var(--white)',
  border: 'var(--border)',
  brandDark: 'var(--brand-dark)',
  text1: 'var(--text-1)',
  text2: 'var(--text-2)',
  text3: 'var(--text-3)',
  textMuted: 'var(--text-muted)',
}

const EXPENSE_ICONS: Record<string, string> = {
  rent: '🏠', electricity: '⚡', water: '💧', gas: '🔥',
  internet: '📡', phone: '📱', houseKeeping: '🧹',
  blackTax: '🤲', schoolFees: '🎓', childcare: '👶',
}

const EXPENSE_LABELS: Record<string, string> = {
  rent: 'Rent', electricity: 'Electricity', water: 'Water', gas: 'Cooking fuel',
  internet: 'Internet', phone: 'Phone', houseKeeping: 'Housekeeping',
  blackTax: 'Black tax', schoolFees: 'School fees', childcare: 'Childcare',
}

function fmt(n: number, cur = 'KES') {
  if (!n) return `${cur} 0`
  return `${cur} ${n.toLocaleString()}`
}

function titleCase(s: string) {
  return s.replace(/\b\w/g, char => char.toUpperCase())
}

function monthLabel(iso: string) {
  const [year, month] = iso.split('-')
  return new Date(Number(year), Number(month) - 1).toLocaleDateString('en', { month: 'long', year: 'numeric' })
}

export default function IncomePageClient({
  data,
  preview,
}: {
  data: IncomePageData
  preview: boolean
}) {
  const router = useRouter()
  const { isDesktop } = useBreakpoint()
  const currentMonth = new Date().toISOString().slice(0, 7)
  const [isPending] = useTransition()

  const incomeTotal = data.incomeData ? Number(data.incomeData.total ?? 0) : 0
  const fixedTotal = data.fixedExpenses ? Number(data.fixedExpenses.total_monthly ?? 0) : 0
  const budgetTotal = data.spendingBudget ? Number(data.spendingBudget.total_budget ?? 0) : 0
  const available = incomeTotal - fixedTotal
  const extras = data.incomeData?.extra_income ?? []

  const editBtnStyle: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 500, color: T.brandDark, padding: 0,
  }

  const subtleAmt: React.CSSProperties = { fontSize: 12, fontWeight: 400, color: T.textMuted, marginLeft: 1 }

  const hasIncome = !!data.incomeData && !preview
  const hasFixed = !!(data.fixedExpenses && (data.fixedExpenses.entries ?? []).some((entry: any) => entry.confidence !== 'unsure' && entry.monthly > 0))
  const hasBudget = !!(data.spendingBudget && (data.spendingBudget.categories as any[]).some((category: any) => category.budget > 0))
  const isNegative = available < 0
  const fixedPct = incomeTotal > 0 ? Math.round((fixedTotal / incomeTotal) * 100) : 0
  const budgetPct = incomeTotal > 0 ? Math.round((budgetTotal / incomeTotal) * 100) : 0

  const sectionCard: React.CSSProperties = {
    background: T.white,
    border: `1px solid var(--border)`,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 12,
  }

  const sectionHead: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 16px 14px',
    borderBottom: `1px solid var(--border-subtle)`,
  }

  const itemRow = (border: boolean): React.CSSProperties => ({
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '13px 16px',
    borderBottom: border ? `1px solid var(--border-subtle)` : 'none',
  })

  const content = (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: isDesktop ? '48px var(--space-page-desktop) 80px' : '28px var(--space-page-mobile) 100px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 3px', fontSize: isDesktop ? 28 : 25, fontWeight: 700, color: T.text1, letterSpacing: '-0.5px', fontFamily: 'var(--font-display)' }}>
          Budget
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: T.textMuted }}>
          {monthLabel(currentMonth)} · plan your month
        </p>
      </div>

      {!hasIncome && (
        <div>
          <div style={{
            background: T.white, border: `1px solid var(--border)`,
            borderRadius: 20, padding: '28px 24px',
            marginBottom: 16,
          }}>
            <p style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: T.text1 }}>
              Set up your budget
            </p>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: T.text3, lineHeight: 1.6 }}>
              Decide where your money goes before it's spent. Income, fixed bills, and day-to-day spending.
            </p>
            <button
              onClick={() => router.push('/income/new?returnTo=/income')}
              style={{
                width: '100%', height: 48, borderRadius: 14,
                background: T.brandDark, border: 'none', cursor: 'pointer',
                fontSize: 15, fontWeight: 600, color: '#fff',
              }}
            >
              Add your income to get started
            </button>
          </div>

          {[
            { label: 'Income', desc: 'Your salary and other sources' },
            { label: 'Fixed costs', desc: 'Rent, utilities, subscriptions' },
            { label: 'Spending budget', desc: 'Food, transport, entertainment' },
          ].map((step, index) => (
            <div key={index} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 0',
              borderBottom: index < 2 ? `1px solid var(--border-subtle)` : 'none',
              opacity: 0.4,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, background: 'var(--grey-100)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: T.textMuted, flexShrink: 0,
              }}>
                {index + 1}
              </div>
              <div>
                <p style={{ margin: '0 0 1px', fontSize: 14, fontWeight: 600, color: T.text1 }}>{step.label}</p>
                <p style={{ margin: 0, fontSize: 12, color: T.text3 }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasIncome && (
        <>
          <div style={{
            background: T.white, border: `1px solid var(--border)`,
            borderRadius: 20, overflow: 'hidden',
            marginBottom: 20,
          }}>
            <div style={{ padding: '22px 20px 18px' }}>
              <p style={{
                margin: '0 0 5px', fontSize: 12, fontWeight: 600,
                color: isNegative ? 'var(--red-dark)' : T.textMuted,
                textTransform: 'uppercase', letterSpacing: '0.6px',
              }}>
                {hasFixed ? 'Left to allocate' : 'Monthly income'}
              </p>
              <p style={{
                margin: 0, fontFamily: 'var(--font-display)',
                fontSize: 40, fontWeight: 700, letterSpacing: '-1.5px', lineHeight: 1,
                color: isNegative ? 'var(--red-dark)' : T.text1,
              }}>
                {fmt(hasFixed ? available : incomeTotal, data.currency)}
              </p>
              {isNegative && (
                <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--red-dark)' }}>
                  Your fixed costs exceed your income.
                </p>
              )}
            </div>

            {hasFixed && (
              <div style={{ display: 'flex', borderTop: `1px solid var(--border-subtle)` }}>
                {[
                  { label: 'Income', value: fmt(incomeTotal, data.currency) },
                  { label: 'Committed', value: fmt(fixedTotal, data.currency) },
                ].map((column, index) => (
                  <div key={column.label} style={{ flex: 1, padding: '12px 20px', borderLeft: index > 0 ? `1px solid var(--border-subtle)` : 'none' }}>
                    <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{column.label}</p>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: T.text2 }}>{column.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={sectionCard}>
            <div style={sectionHead}>
              <div>
                <p style={{ margin: '0 0 1px', fontSize: 12, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Income</p>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: T.text1 }}>{fmt(incomeTotal, data.currency)}</p>
              </div>
              <button onClick={() => router.push('/income/new?returnTo=/income')} style={editBtnStyle}>Edit</button>
            </div>
            <div style={itemRow(extras.length > 0)}>
              <span style={{ fontSize: 14, color: T.text2 }}>Salary</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: T.text1 }}>{fmt(Number(data.incomeData?.salary ?? 0), data.currency)}</span>
            </div>
            {extras.map((extra: any, index: number) => (
              <div key={index} style={itemRow(index < extras.length - 1)}>
                <span style={{ fontSize: 14, color: T.text2 }}>{extra.label || 'Extra income'}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: T.text1 }}>{fmt(Number(extra.amount ?? 0), data.currency)}</span>
              </div>
            ))}
          </div>

          {hasFixed ? (() => {
            const entries = (data.fixedExpenses?.entries as any[]).filter((entry: any) => entry.confidence !== 'unsure' && entry.monthly > 0)
            return (
              <div style={sectionCard}>
                <div style={sectionHead}>
                  <div>
                    <p style={{ margin: '0 0 1px', fontSize: 12, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Fixed commitments</p>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: T.text1 }}>
                      {fmt(fixedTotal, data.currency)}
                      {fixedPct > 0 && <span style={{ fontSize: 12, fontWeight: 400, color: T.textMuted, marginLeft: 6 }}>{fixedPct}% of income</span>}
                    </p>
                  </div>
                  <button onClick={() => router.push('/income/fixed?returnTo=/income')} style={editBtnStyle}>Edit</button>
                </div>
                {entries.map((entry: any, index: number) => (
                  <div key={entry.key} style={itemRow(index < entries.length - 1)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18, lineHeight: 1 }}>{EXPENSE_ICONS[entry.key] ?? '📋'}</span>
                      <span style={{ fontSize: 14, color: T.text2 }}>{EXPENSE_LABELS[entry.key] ?? titleCase(entry.label)}</span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: T.text1 }}>
                      {fmt(Number(entry.monthly ?? 0), data.currency)}<span style={subtleAmt}>/mo</span>
                    </span>
                  </div>
                ))}
              </div>
            )
          })() : (
            <div style={{ ...sectionCard, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: '0 0 1px', fontSize: 14, fontWeight: 600, color: T.text1 }}>Fixed commitments</p>
                <p style={{ margin: 0, fontSize: 12, color: T.textMuted }}>Rent, bills, subscriptions</p>
              </div>
              <button onClick={() => router.push('/income/fixed?returnTo=/income')} style={{
                background: T.brandDark, border: 'none', borderRadius: 10,
                padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#fff',
              }}>Add</button>
            </div>
          )}

          {hasBudget ? (() => {
            const categories = (data.spendingBudget?.categories as any[]).filter((category: any) => category.budget > 0)
            return (
              <div style={sectionCard}>
                <div style={sectionHead}>
                  <div>
                    <p style={{ margin: '0 0 1px', fontSize: 12, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Spending budget</p>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: T.text1 }}>
                      {fmt(budgetTotal, data.currency)}
                      {budgetPct > 0 && <span style={{ fontSize: 12, fontWeight: 400, color: T.textMuted, marginLeft: 6 }}>{budgetPct}% of income</span>}
                    </p>
                  </div>
                  <button onClick={() => router.push('/income/budget?returnTo=/income')} style={editBtnStyle}>Edit</button>
                </div>
                {categories.map((category: any, index: number) => (
                  <div key={category.key} style={itemRow(index < categories.length - 1)}>
                    <span style={{ fontSize: 14, color: T.text2 }}>{titleCase(category.label)}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: T.text1 }}>
                      {fmt(Number(category.budget ?? 0), data.currency)}<span style={subtleAmt}>/mo</span>
                    </span>
                  </div>
                ))}
              </div>
            )
          })() : (
            <div style={{ ...sectionCard, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: '0 0 1px', fontSize: 14, fontWeight: 600, color: T.text1 }}>Spending budget</p>
                <p style={{ margin: 0, fontSize: 12, color: T.textMuted }}>
                  {Object.keys(data.spendingHistory).length > 0
                    ? 'Based on last month, we have suggestions ready'
                    : 'Food, transport, entertainment'}
                </p>
              </div>
              <button onClick={() => router.push('/income/budget?returnTo=/income')} style={{
                background: T.brandDark, border: 'none', borderRadius: 10,
                padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#fff',
              }}>Add</button>
            </div>
          )}
        </>
      )}
    </div>
  )

  if (isDesktop) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <SideNav />
        <main style={{ flex: 1, maxWidth: 720, margin: '0 auto' }}>{content}</main>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: T.pageBg, paddingBottom: 88 }}>
      <main>{content}</main>
      <BottomNav />
    </div>
  )
}
