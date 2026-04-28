'use client'
export const dynamic = 'force-dynamic'

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { AppSubpageHeader } from '@/components/layout/AppSubpageHeader/AppSubpageHeader'
import { AppSubpageLayout } from '@/components/layout/AppSubpageLayout/AppSubpageLayout'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { GlobalAddButton } from '@/components/layout/GlobalAddButton'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { formatAmount } from '@/lib/formatting/amount'
import type { HistoryCategoryRow, HistoryPageData } from '@/lib/loaders/history'

const T = {
  white: 'var(--white)',
  text1: 'var(--text-1)',
  text2: 'var(--text-2)',
  text3: 'var(--text-3)',
  textMuted: 'var(--text-muted)',
}

interface HistoryPageClientProps {
  data: HistoryPageData
  targetCycleId?: string
  currentCycleId: string
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

function categoryColor(type: HistoryCategoryRow['type']) {
  if (type === 'fixed') return 'var(--category-essentials)'
  if (type === 'goal') return 'var(--category-goals)'
  if (type === 'debt') return 'var(--category-debt)'
  return 'var(--category-life)'
}

export default function HistoryPageClient({ data, targetCycleId, currentCycleId }: HistoryPageClientProps) {
  const router = useRouter()
  const { isDesktop } = useBreakpoint()

  const activeCycleId = targetCycleId ?? currentCycleId
  const activeIndex = data.availableCycleIds.indexOf(activeCycleId)
  const currentCycleIndex = data.availableCycleIds.indexOf(currentCycleId)
  const canGoPrev = activeIndex > 0
  const canGoNext = activeIndex >= 0 && activeIndex < data.availableCycleIds.length - 1
  const currentCycleRoute = activeCycleId === currentCycleId ? '/history' : `/history?cycle=${activeCycleId}`
  const remaining = data.totalIncome - data.totalSpent
  const canShowSegmentedBar = data.totalSpent > 0 && data.rows.every((row) => row.spent > 0)
  const periodContext = (() => {
    if (activeCycleId === currentCycleId) {
      return {
        label: 'This period',
        hint: 'This is your current period so far.',
        showContinueAction: false,
      }
    }

    if (currentCycleIndex >= 0 && activeIndex === currentCycleIndex - 1) {
      return {
        label: 'Last period',
        hint: 'This is a summary of your previous period. You’re now in a new month.',
        showContinueAction: true,
      }
    }

    return {
      label: 'Earlier period',
      hint: 'This is a summary from an earlier period.',
      showContinueAction: false,
    }
  })()

  function navToCycle(cycleId: string) {
    router.push(cycleId === currentCycleId ? '/history' : `/history?cycle=${cycleId}`)
  }

  function categoryHref(row: HistoryCategoryRow) {
    const params = new URLSearchParams({
      label: row.label,
      type: row.type,
      returnTo: currentCycleRoute,
    })
    if (activeCycleId !== currentCycleId) {
      params.set('cycle', activeCycleId)
    }
    return `/history/${row.key}?${params.toString()}`
  }

  const content = (
    <AppSubpageLayout>
      <AppSubpageHeader title="Recap" backHref="/menu" ariaLabel="Back to More" />

      <div style={{ marginBottom: 'var(--space-card-md)' }}>
        <p style={{ margin: '0 0 var(--space-2xs)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {periodContext.label}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', color: T.text1 }}>
            {data.cycleLabel}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
            <button
              onClick={() => canGoPrev && navToCycle(data.availableCycleIds[activeIndex - 1])}
              disabled={!canGoPrev}
              aria-label="Previous period"
              style={{ width: 'var(--control-sm)', height: 'var(--control-sm)', borderRadius: 'var(--radius-sm)', border: 'var(--border-width) solid var(--border)', background: T.white, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canGoPrev ? 'pointer' : 'default', opacity: canGoPrev ? 1 : 0.3 }}
            >
              <ChevronLeft size={15} color={T.text3} />
            </button>
            <button
              onClick={() => canGoNext && navToCycle(data.availableCycleIds[activeIndex + 1])}
              disabled={!canGoNext}
              aria-label="Next period"
              style={{ width: 'var(--control-sm)', height: 'var(--control-sm)', borderRadius: 'var(--radius-sm)', border: 'var(--border-width) solid var(--border)', background: T.white, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canGoNext ? 'pointer' : 'default', opacity: canGoNext ? 1 : 0.3 }}
            >
              <ChevronRight size={15} color={T.text3} />
            </button>
          </div>
        </div>
      </div>

      <div>
        <div style={{
          background: T.white,
          borderRadius: 'var(--radius-card)',
          boxShadow: 'var(--shadow-sm)',
          padding: 'var(--space-lg) var(--space-card-md) var(--space-card-sm)',
          marginBottom: 'var(--space-card-md)',
        }}>
          <p style={{ margin: '0 0 var(--space-xs)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Remaining
          </p>
          <p style={{
            margin: '0 0 var(--space-card-sm)',
            fontSize: 'var(--text-xl)',
            fontWeight: 'var(--weight-bold)',
            lineHeight: 1,
            letterSpacing: '-0.02em',
            color: T.text1,
          }}>
            {formatHeroAmount(remaining, data.currency)}
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
              <p style={{ margin: '0 0 var(--space-xs)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Outflow</p>
              <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: T.text2 }}>
                {formatAmount(data.totalSpent, { currency: data.currency, variant: 'compact' })}
              </span>
            </div>
          </div>

          <p style={{ margin: 'var(--space-md) 0 0', fontSize: 'var(--text-sm)', color: T.text3, lineHeight: 1.5 }}>
            {periodContext.hint}
          </p>
          {periodContext.showContinueAction && (
            <button
              type="button"
              onClick={() => router.push('/app')}
              style={{
                marginTop: 'var(--space-sm)',
                padding: 0,
                background: 'none',
                border: 'none',
                color: 'var(--brand-dark)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-semibold)',
                cursor: 'pointer',
              }}
            >
              Continue this month
            </button>
          )}
        </div>

        {data.rows.length > 0 && (
          <div style={{ marginBottom: 'var(--space-card-md)' }}>
            <p style={{ margin: '0 0 var(--space-2xs)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Where your money went
            </p>

            <div style={{ background: T.white, border: 'var(--border-width) solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              {canShowSegmentedBar && (
                <div style={{ padding: 'var(--space-card-sm) var(--space-card-sm) var(--space-md)' }}>
                  <div style={{ display: 'flex', height: 'var(--size-bar-sm)', borderRadius: 'var(--radius-full)', overflow: 'hidden', gap: 'var(--space-2xs)' }}>
                    {data.rows.map(row => (
                      <div
                        key={row.key}
                        style={{
                          height: '100%',
                          width: `${(row.spent / data.totalSpent) * 100}%`,
                          background: categoryColor(row.type),
                          borderRadius: 'var(--radius-full)',
                          minWidth: 'var(--space-2xs)',
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {data.rows.length > 0 && (
                <>
                  <div style={{ height: 1, background: 'var(--border-subtle)' }} />
                  {data.rows.map((row, index) => {
                    const isLast = index === data.rows.length - 1

                    return (
                      <button
                        key={row.key}
                        type="button"
                        onClick={() => router.push(categoryHref(row))}
                        style={{
                          width: '100%',
                          background: T.white,
                          border: 'none',
                          borderBottom: isLast ? 'none' : 'var(--border-width) solid var(--border-subtle)',
                          cursor: 'pointer',
                          padding: 'var(--radius-md) var(--space-card-sm)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', minWidth: 0 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: categoryColor(row.type), flexShrink: 0 }} />
                          <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', color: T.text1 }}>
                            {row.label}
                          </span>
                        </span>
                        <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: T.text1, flexShrink: 0, marginLeft: 'var(--space-md)' }}>
                          {formatAmount(row.spent, { currency: data.currency, variant: 'compact' })}
                        </span>
                      </button>
                    )
                  })}
                </>
              )}
            </div>
          </div>
        )}

        {data.rows.length === 0 && (
          <div style={{
            background: T.white,
            border: 'var(--border-width) solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-card-sm)',
            marginBottom: 'var(--space-card-md)',
          }}>
            <p style={{
              margin: '0 0 var(--space-xs)',
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-semibold)',
              color: T.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              Recap
            </p>
            <p style={{
              margin: '0 0 var(--space-card-sm)',
              fontSize: 'var(--text-lg)',
              fontWeight: 'var(--weight-semibold)',
              color: T.text1,
              letterSpacing: '-0.01em',
            }}>
              Nothing logged yet.
            </p>
          </div>
        )}
      </div>
    </AppSubpageLayout>
  )

  if (isDesktop) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <SideNav />
        <main style={{ flex: 1, maxWidth: 720, margin: '0 auto' }}>{content}</main>
        <GlobalAddButton returnTo={currentCycleRoute} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', paddingBottom: 'calc(var(--bottom-nav-height) + var(--space-lg))' }}>
      <main>{content}</main>
      <GlobalAddButton returnTo={currentCycleRoute} />
      <BottomNav />
    </div>
  )
}
