'use client'
export const dynamic = 'force-dynamic'

import { useRouter } from 'next/navigation'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { IconBack, IconChevronRight } from '@/components/ui/Icons'
import { fmt } from '@/lib/finance'
import type { HistoryCategoryRow, HistoryPageData } from '@/lib/loaders/history'

const T = {
  brandDark: '#5C3489',
  white: '#FFFFFF',
  text1: '#101828',
  text2: '#475467',
  text3: '#667085',
  textMuted: '#98A2B3',
}

function BarFill({ pct, type }: { pct: number; type: HistoryCategoryRow['type'] }) {
  const color = type === 'goal'
    ? T.brandDark
    : type === 'fixed' || type === 'subscription'
      ? (pct > 100 ? '#EF4444' : '#22C55E')
      : pct > 100 ? '#EF4444' : pct > 75 ? '#F59E0B' : '#22C55E'

  return (
    <div style={{ height: 4, background: '#EBEBED', borderRadius: 99, marginTop: 10 }}>
      <div style={{
        height: '100%',
        width: `${Math.min(100, pct)}%`,
        background: color,
        borderRadius: 99,
        transition: 'width 0.4s ease',
        minWidth: pct > 0 ? 4 : 0,
      }} />
    </div>
  )
}

interface HistoryPageClientProps {
  data: HistoryPageData
}

export default function HistoryPageClient({ data }: HistoryPageClientProps) {
  const router = useRouter()
  const { isDesktop } = useBreakpoint()

  const unallocated = data.totalIncome - data.totalSpent
  const sections = [
    { label: 'Fixed', types: ['fixed', 'subscription'] },
    { label: 'Goals', types: ['goal'] },
    { label: 'Daily', types: ['everyday'] },
    { label: 'Debts', types: ['debt'] },
  ]
  const pad = isDesktop ? '0 32px' : '0 16px'

  const content = (
    <div style={{ paddingBottom: isDesktop ? 80 : 100 }}>
      <div style={{ padding: isDesktop ? '32px 32px 20px' : '20px 16px 20px' }}>
        <button
          onClick={() => router.push('/app')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 12px', display: 'flex', alignItems: 'center' }}
        >
          <IconBack size={18} color={T.text3} />
        </button>
        <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Monthly review
        </p>
        <h1 style={{ fontSize: isDesktop ? 28 : 24, color: T.text1, margin: 0 }}>
          {data.monthLabel}
        </h1>
      </div>

      {data.totalIncome > 0 && (
        <div style={{ padding: `0 ${isDesktop ? 32 : 16}px 16px` }}>
          <div style={{
            background: T.white,
            borderRadius: 20,
            boxShadow: '0 1px 10px rgba(0,0,0,0.07)',
            display: 'flex',
            alignItems: 'stretch',
          }}>
            {[
              { label: 'Income', value: data.totalIncome, color: T.text1 },
              { label: 'Spent', value: data.totalSpent, color: T.text1 },
              { label: 'In hand', value: unallocated, color: unallocated >= 0 ? '#1A7A45' : '#D93025' },
            ].map((column, index) => (
              <div key={column.label} style={{ display: 'flex', flex: 1, alignItems: 'stretch' }}>
                {index > 0 && <div style={{ width: 1, background: '#F0F0F0', margin: '18px 0', flexShrink: 0 }} />}
                <div style={{ flex: 1, padding: '22px 0', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 5px', fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {column.label}
                  </p>
                  <span style={{ fontSize: index === 2 ? 17 : 15, fontWeight: 700, color: column.color }}>
                    {fmt(Math.abs(column.value), data.currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.breakdown.length > 0 && data.totalSpent > 0 && (() => {
        const segments = [
          { label: 'Fixed', amount: data.breakdown.find(item => item.label === 'Fixed')?.amount ?? 0, color: '#5C3489' },
          { label: 'Goals', amount: data.breakdown.find(item => item.label === 'Goals')?.amount ?? 0, color: '#9B72CC' },
          { label: 'Daily', amount: data.breakdown.find(item => item.label === 'Daily')?.amount ?? 0, color: '#C4A8E0' },
          { label: 'Debts', amount: data.breakdown.find(item => item.label === 'Debts')?.amount ?? 0, color: '#EF4444' },
        ].filter(segment => segment.amount > 0)

        return (
          <div style={{ padding: `0 ${isDesktop ? 32 : 16}px 24px` }}>
            <div style={{
              background: T.white,
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: '18px 20px',
            }}>
              <p style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Where it went
              </p>

              <div style={{
                display: 'flex',
                height: 8,
                borderRadius: 99,
                overflow: 'hidden',
                marginBottom: 16,
                gap: 2,
              }}>
                {segments.map(segment => (
                  <div
                    key={segment.label}
                    style={{
                      height: '100%',
                      width: `${(segment.amount / data.totalSpent) * 100}%`,
                      background: segment.color,
                      borderRadius: 99,
                      transition: 'width 0.4s ease',
                      minWidth: 4,
                    }}
                  />
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {segments.map(segment => (
                  <div key={segment.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: segment.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13.5, color: T.text2 }}>{segment.label}</span>
                    </div>
                    <span style={{ fontSize: 13.5, fontWeight: 500, color: segment.label === 'Debts' ? '#EF4444' : T.text1 }}>
                      {fmt(segment.amount, data.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      {sections.map(section => {
        const sectionRows = data.rows.filter(row => section.types.includes(row.type))
        if (sectionRows.length === 0) return null

        return (
          <div key={section.label} style={{ padding: pad, marginBottom: 24 }}>
            <p style={{
              margin: '0 0 10px',
              fontSize: 11,
              fontWeight: 600,
              color: T.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              {section.label}
            </p>

            <div style={{ background: T.white, border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
              {sectionRows.map((row, index) => {
                const rowPct = row.planned > 0 ? (row.spent / row.planned) * 100 : 0
                const rowOver = row.planned > 0 && row.spent > row.planned
                const isLast = index === sectionRows.length - 1
                const hasLogged = row.spent > 0
                const showBar = hasLogged && row.planned > 0
                const ledgerUrl = `/history/${row.key}?label=${encodeURIComponent(row.label)}&planned=${row.planned}&type=${row.type}`

                const inner = (
                  <div style={{ padding: `18px 16px ${showBar ? 10 : 18}px` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 28 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: hasLogged ? T.text1 : T.textMuted }}>
                          {row.label}
                        </div>
                        {row.planned > 0 && (
                          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 3 }}>
                            {fmt(row.planned, data.currency)} budget
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 16 }}>
                        {hasLogged ? (
                          <>
                            <span style={{ fontSize: 15, fontWeight: 600, color: rowOver ? '#EF4444' : T.text1 }}>
                              {fmt(row.spent, data.currency)}
                            </span>
                            <IconChevronRight size={16} color={T.textMuted} />
                          </>
                        ) : (
                          <span style={{ fontSize: 14, color: T.textMuted, fontWeight: 400, letterSpacing: '0.05em' }}>
                            —
                          </span>
                        )}
                      </div>
                    </div>

                    {showBar && (
                      <div style={{ marginTop: 10 }}>
                        <BarFill pct={rowPct} type={row.type} />
                      </div>
                    )}
                  </div>
                )

                return (
                  <div key={row.key} style={{ borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)' }}>
                    {hasLogged ? (
                      <button
                        onClick={() => router.push(ledgerUrl)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          boxSizing: 'border-box',
                          display: 'block',
                        }}
                      >
                        {inner}
                      </button>
                    ) : (
                      inner
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {data.rows.length === 0 && (
        <div style={{ padding: pad, textAlign: 'center', paddingTop: 40 }}>
          <p style={{ fontSize: 15, color: T.textMuted, marginBottom: 16 }}>
            Nothing logged yet this month.
          </p>
          <button
            onClick={() => router.push('/log')}
            style={{
              height: 48,
              borderRadius: 12,
              background: T.brandDark,
              color: '#fff',
              border: 'none',
              padding: '0 28px',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Log a payment
          </button>
        </div>
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
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', paddingBottom: 88 }}>
      <main>{content}</main>
      <BottomNav />
    </div>
  )
}
