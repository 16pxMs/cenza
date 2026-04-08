'use client'
export const dynamic = 'force-dynamic'

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { formatAmount } from '@/lib/formatting/amount'
import type { HistoryCategoryRow, HistoryPageData } from '@/lib/loaders/history'

const T = {
  white:     'var(--white)',
  text1:     'var(--text-1)',
  text2:     'var(--text-2)',
  text3:     'var(--text-3)',
  textMuted: 'var(--text-muted)',
}

function recapDisplayLabel(label: string) {
  if (label === 'Fixed' || label === 'Fixed spending') return 'Essentials'
  if (label === 'Daily' || label === 'Daily spending') return 'Life'
  if (label === 'Debts') return 'Debt'
  return label
}

// Segmented bar per row — only shown when budget is set
function BarFill({ pct, type }: { pct: number; type: HistoryCategoryRow['type'] }) {
  const color = type === 'goal'
    ? 'var(--brand-dark)'
    : type === 'fixed' || type === 'subscription'
      ? (pct > 100 ? 'var(--red)' : 'var(--green)')
      : pct > 100 ? 'var(--red)' : pct > 75 ? 'var(--amber)' : 'var(--green)'

  return (
    <div style={{ height: 'var(--size-bar-sm)', background: 'var(--grey-100)', borderRadius: 'var(--radius-full)', marginTop: 'var(--space-sm)' }}>
      <div style={{
        height: '100%',
        width: `${Math.min(100, pct)}%`,
        background: color,
        borderRadius: 'var(--radius-full)',
        transition: 'width 0.4s ease',
        minWidth: pct > 0 ? 'var(--space-xs)' : 0,
      }} />
    </div>
  )
}

// Verdict — single sentence that answers "how did this month go?"
function verdictLine(totalIncome: number, totalSpent: number): string {
  if (totalIncome === 0 || totalSpent === 0) return ''
  const pctKept = Math.round(((totalIncome - totalSpent) / totalIncome) * 100)
  const tone = pctKept >= 50 ? 'Clean month.' : pctKept >= 20 ? 'Decent control.' : pctKept >= 0 ? 'Tight month.' : 'You went over budget.'
  if (pctKept < 0) return tone
  return `You kept ${pctKept}% of your income. ${tone}`
}

interface HistoryPageClientProps {
  data: HistoryPageData
  targetMonth?: string  // 'YYYY-MM', undefined = current month
}

function currentYM(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatHeroAmount(amount: number, currency: string): string {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''

  if (abs < 100_000) {
    return `${sign}${formatAmount(abs, { currency, variant: 'full' })}`
  }

  if (abs < 1_000_000) {
    const compact = (abs / 1_000).toFixed(abs % 1_000 === 0 ? 0 : 1).replace(/\.0$/, '')
    return `${sign}${currency} ${compact}K`
  }

  const compact = (abs / 1_000_000).toFixed(2).replace(/\.?0+$/, '')
  return `${sign}${currency} ${compact}M`
}

export default function HistoryPageClient({ data, targetMonth }: HistoryPageClientProps) {
  const router = useRouter()
  const { isDesktop } = useBreakpoint()

  const activeYM    = targetMonth ?? currentYM()
  const activeIndex = data.availableMonths.indexOf(activeYM)
  const canGoPrev   = activeIndex > 0
  const canGoNext   = activeIndex >= 0 && activeIndex < data.availableMonths.length - 1
  const pad         = isDesktop ? '0 var(--space-page-desktop)' : '0 var(--space-page-mobile)'

  function navToMonth(ym: string) {
    router.push(ym === currentYM() ? '/history' : `/history?month=${ym}`)
  }

  const unallocated = data.totalIncome - data.totalSpent
  const verdict     = verdictLine(data.totalIncome, data.totalSpent)

  // Breakdown segments for the bar
  const segments = [
    { label: 'Essentials', amount: data.breakdown.find(i => i.label === 'Fixed')?.amount ?? 0, color: 'var(--brand-dark)' },
    { label: 'Goals',  amount: data.breakdown.find(i => i.label === 'Goals')?.amount  ?? 0, color: 'var(--brand-deep)' },
    { label: 'Life', amount: data.breakdown.find(i => i.label === 'Daily')?.amount ?? 0, color: 'var(--brand-mid)' },
    { label: 'Debt', amount: data.breakdown.find(i => i.label === 'Debts')?.amount ?? 0, color: 'var(--red)' },
  ].filter(s => s.amount > 0)

  const content = (
    <div style={{ paddingBottom: isDesktop ? 'var(--size-touch-footer-desktop)' : 'var(--size-touch-footer-mobile)' }}>

      {/* ── Header + month nav ── */}
      <div style={{ padding: isDesktop ? 'var(--space-xl) var(--space-page-desktop) var(--space-card-md)' : 'var(--space-lg) var(--space-page-mobile) var(--space-md)' }}>
        <p style={{ margin: '0 0 var(--space-2xs)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Recap
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: T.text1, letterSpacing: '-0.02em' }}>
            {data.monthLabel}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
            <button
              onClick={() => canGoPrev && navToMonth(data.availableMonths[activeIndex - 1])}
              disabled={!canGoPrev}
              style={{ width: 'var(--control-sm)', height: 'var(--control-sm)', borderRadius: 'var(--radius-sm)', border: 'var(--border-width) solid var(--border)', background: T.white, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canGoPrev ? 'pointer' : 'default', opacity: canGoPrev ? 1 : 0.3 }}
            >
              <ChevronLeft size={15} color={T.text3} />
            </button>
            <button
              onClick={() => canGoNext && navToMonth(data.availableMonths[activeIndex + 1])}
              disabled={!canGoNext}
              style={{ width: 'var(--control-sm)', height: 'var(--control-sm)', borderRadius: 'var(--radius-sm)', border: 'var(--border-width) solid var(--border)', background: T.white, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canGoNext ? 'pointer' : 'default', opacity: canGoNext ? 1 : 0.3 }}
            >
              <ChevronRight size={15} color={T.text3} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: pad }}>

        {/* ── 1. Verdict line ── */}
        {verdict && (
          <p style={{ margin: '0 0 var(--space-card-md)', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', color: T.text2, lineHeight: 1.5 }}>
            {verdict}
          </p>
        )}

        {/* ── 2. Hero card — In Hand ── */}
        {data.totalIncome > 0 && (
          <div style={{
            background: T.white,
            borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--shadow-sm)',
            padding: 'var(--space-lg) var(--space-card-md) var(--space-card-sm)',
            marginBottom: 'var(--space-card-md)',
          }}>
            <p style={{ margin: '0 0 var(--space-xs)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              In hand
            </p>
            <p style={{
              margin: '0 0 var(--space-card-sm)',
              fontSize: 'var(--text-xl)',
              fontWeight: 'var(--weight-bold)',
              lineHeight: 1,
              letterSpacing: '-0.02em',
              color: T.text1,
            }}>
              {formatHeroAmount(unallocated, data.currency)}
            </p>

            <div style={{ height: 'var(--border-width)', background: 'var(--border-subtle)', marginBottom: 'var(--space-md)' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'calc(var(--space-sm) + var(--space-xs))' }}>
              <div>
                <p style={{ margin: '0 0 var(--space-xs)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Income</p>
                <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: T.text2 }}>
                  {formatAmount(data.totalIncome, { currency: data.currency, variant: 'compact' })}
                </span>
              </div>
              <div>
                <p style={{ margin: '0 0 var(--space-xs)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Spent</p>
                <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: T.text2 }}>
                  {formatAmount(data.totalSpent, { currency: data.currency, variant: 'compact' })}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── 3. Where It Went — bar + all rows as one section ── */}
        {data.totalSpent > 0 && (
          <div style={{ marginBottom: 'var(--space-card-md)' }}>
            <p style={{ margin: '0 0 var(--space-sm)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Where it went
            </p>

            <div style={{ background: T.white, border: 'var(--border-width) solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>

              {/* Segmented bar */}
              {segments.length > 0 && (
                <div style={{ padding: 'var(--space-card-sm) var(--space-card-sm) var(--radius-md)' }}>
                  <div style={{ display: 'flex', height: 'var(--size-bar-md)', borderRadius: 'var(--radius-full)', overflow: 'hidden', marginBottom: 'var(--radius-md)', gap: 'var(--space-xs)' }}>
                    {segments.map(s => (
                      <div
                        key={s.label}
                        style={{
                          height: '100%',
                          width: `${(s.amount / data.totalSpent) * 100}%`,
                          background: s.color,
                          borderRadius: 'var(--radius-full)',
                          transition: 'width 0.4s ease',
                          minWidth: 'var(--space-xs)',
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                    {segments.map(s => (
                      <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                          <div style={{ width: 'var(--size-dot-sm)', height: 'var(--size-dot-sm)', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 'var(--text-sm)', color: T.text3 }}>{s.label}</span>
                        </div>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: s.label === 'Debt' ? 'var(--red)' : T.text2 }}>
                          {formatAmount(s.amount, { currency: data.currency, variant: 'compact' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All category rows — no per-type section headers */}
              {data.rows.length > 0 && (
                <>
                  <div style={{ height: 1, background: 'var(--border-subtle)' }} />
                  {data.rows.map((row, index) => {
                    const rowPct    = row.planned > 0 ? (row.spent / row.planned) * 100 : 0
                    const rowOver   = row.planned > 0 && row.spent > row.planned
                    const isLast    = index === data.rows.length - 1
                    const hasLogged = row.spent > 0
                    const showBar   = hasLogged && row.planned > 0

                    const inner = (
                      <div style={{ padding: `${showBar ? 'var(--radius-md)' : 'var(--radius-md)'} var(--space-card-sm) ${showBar ? 'var(--space-sm)' : 'var(--radius-md)'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', color: hasLogged ? T.text1 : T.textMuted }}>
                            {recapDisplayLabel(row.label)}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2xs)', flexShrink: 0, marginLeft: 'var(--space-md)' }}>
                            {hasLogged ? (
                              <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: rowOver ? 'var(--red)' : T.text1 }}>
                                {formatAmount(row.spent, { currency: data.currency, variant: 'compact' })}
                              </span>
                            ) : (
                              <span style={{ fontSize: 'var(--text-sm)', color: T.textMuted }}>—</span>
                            )}
                          </div>
                        </div>
                        {showBar && <BarFill pct={rowPct} type={row.type} />}
                      </div>
                    )

                    return (
                      <div key={row.key} style={{ borderBottom: isLast ? 'none' : 'var(--border-width) solid var(--border-subtle)' }}>
                        {inner}
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── 4. Empty state ── */}
        {data.rows.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--space-xl) 0' }}>
            <p style={{ fontSize: 'var(--text-base)', color: T.textMuted, marginBottom: 'var(--space-card-md)' }}>
              Nothing logged yet this cycle.
            </p>
            <button
              onClick={() => router.push('/log')}
              style={{
                height: 'var(--button-height-sm)', borderRadius: 'var(--radius-sm)',
                background: 'var(--brand-dark)', color: 'var(--text-inverse)',
                border: 'none', padding: '0 var(--space-xl)',
                fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-base)', cursor: 'pointer',
              }}
            >
              Log a payment
            </button>
          </div>
        )}

        {/* ── 5. CTA ── */}
        {data.rows.length > 0 && (
          <button
          onClick={() => router.push('/log')}
          style={{
            width: '100%', height: 'var(--button-height-md)', borderRadius: 'var(--radius-md)',
            background: 'var(--brand-dark)', color: 'var(--text-inverse)',
            border: 'none', fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-base)',
            cursor: 'pointer', marginBottom: 'var(--space-sm)',
          }}
          >
            Log an expense
          </button>
        )}

      </div>
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
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', paddingBottom: 'calc(var(--bottom-nav-height) + var(--space-lg))' }}>
      <main>{content}</main>
      <BottomNav />
    </div>
  )
}
