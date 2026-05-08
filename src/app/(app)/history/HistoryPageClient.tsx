'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { AppSubpageHeader } from '@/components/layout/AppSubpageHeader/AppSubpageHeader'
import { AppSubpageLayout } from '@/components/layout/AppSubpageLayout/AppSubpageLayout'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { GlobalAddButton } from '@/components/layout/GlobalAddButton'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { SegmentedControl } from '@/components/ui/SegmentedControl/SegmentedControl'
import { formatAmount } from '@/lib/formatting/amount'
import { deriveHistorySummaryData } from '@/lib/history/recap-summary'
import type { AmountFormatPreference } from '@/lib/formatting/amount'
import type { HistoryCategoryRow, HistoryPageData, HistorySpendingGroup } from '@/lib/loaders/history'

const T = {
  white: 'var(--white)',
  text1: 'var(--text-1)',
  text2: 'var(--text-2)',
  text3: 'var(--text-3)',
  textMuted: 'var(--text-muted)',
  brandDark: 'var(--brand-dark)',
  brandDarker: 'var(--brand-darker)',
  brandSoft: 'var(--brand)',
}

interface HistoryPageClientProps {
  data: HistoryPageData
  targetCycleId?: string
  currentCycleId: string
}

type RecapViewMode = 'summary' | 'detailed'

const RECAP_VIEW_OPTIONS: Array<{ value: RecapViewMode; label: string }> = [
  { value: 'summary', label: 'Summary' },
  { value: 'detailed', label: 'Detailed' },
]

function formatHeroAmount(amount: number, currency: string, preference: AmountFormatPreference): string {
  return formatAmount(amount, { currency, preference, context: 'summary' })
}

const SECTION_TITLE_STYLE: React.CSSProperties = {
  margin: '0 0 var(--space-md)',
  fontSize: 'var(--text-base)',
  fontWeight: 'var(--weight-medium)',
  color: 'var(--text-1)',
  lineHeight: 1.35,
}

function categoryColor(type: HistoryCategoryRow['categoryType'] | HistorySpendingGroup['key']) {
  if (type === 'fixed' || type === 'subscription') return 'var(--category-essentials)'
  if (type === 'goal') return 'var(--category-goals)'
  if (type === 'debt') return 'var(--category-debt)'
  return 'var(--category-life)'
}

function categoryAccent(type: HistoryCategoryRow['categoryType'] | HistorySpendingGroup['key']) {
  if (type === 'fixed' || type === 'subscription') {
    return { bg: '#F3F2FF', border: '#D8D6FF', text: '#3730A3', bar: '#6D68D9' }
  }
  if (type === 'goal') {
    return { bg: '#EEF7FF', border: '#CFE5FF', text: '#1E4E8C', bar: '#4F8FD6' }
  }
  if (type === 'debt') {
    return { bg: '#F3F4F6', border: '#D9DEE7', text: '#4B5563', bar: '#8A94A6' }
  }
  return { bg: '#EEF9F7', border: '#CBEAE5', text: '#1F6F68', bar: '#46B7A8' }
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0%'
  if (value < 1 && value > 0) return '<1%'
  return `${Math.round(value)}%`
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

export default function HistoryPageClient({ data, targetCycleId, currentCycleId }: HistoryPageClientProps) {
  const router = useRouter()
  const { isDesktop } = useBreakpoint()
  const [viewMode, setViewMode] = useState<RecapViewMode>('summary')

  const activeCycleId = targetCycleId ?? currentCycleId
  const activeIndex = data.availableCycleIds.indexOf(activeCycleId)
  const currentCycleIndex = data.availableCycleIds.indexOf(currentCycleId)
  const canGoPrev = activeIndex > 0
  const canGoNext = activeIndex >= 0 && activeIndex < data.availableCycleIds.length - 1
  const currentCycleRoute = activeCycleId === currentCycleId ? '/history' : `/history?cycle=${activeCycleId}`
  const remaining = data.totalIncome - data.totalSpent
  const amountFormatPreference = data.amountFormatPreference
  const summaryData = deriveHistorySummaryData(data)
  const largestCategoryAmount = data.rows.reduce((max, row) => Math.max(max, row.totalAmount), 0)
  const largestGroupAmount = data.spendingGroups.reduce((max, group) => Math.max(max, group.amount), 0)
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
      label: row.categoryLabel,
      type: row.categoryType,
      returnTo: currentCycleRoute,
    })
    if (activeCycleId !== currentCycleId) {
      params.set('cycle', activeCycleId)
    }
    return `/history/${row.categoryKey}?${params.toString()}`
  }

  function transactionHref(id: string) {
    return `/log/${id}?returnTo=${encodeURIComponent(currentCycleRoute)}`
  }

  const cardStyle: React.CSSProperties = {
    background: T.white,
    border: 'var(--border-width) solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-card-sm)',
    marginBottom: 'var(--space-card-md)',
  }

  const detailedSummaryCard = (
    <section style={cardStyle}>
      <p style={SECTION_TITLE_STYLE}>Monthly summary</p>
      <p style={{
        margin: '0 0 var(--space-xs)',
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--weight-semibold)',
        color: T.textMuted,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>
        Total outflow
      </p>
      <p style={{
        margin: '0 0 var(--space-card-sm)',
        fontSize: 'var(--text-xl)',
        fontWeight: 'var(--weight-bold)',
        lineHeight: 1,
        letterSpacing: '-0.02em',
        color: T.text1,
      }}>
        {formatAmount(data.totalSpent, { currency: data.currency, preference: amountFormatPreference, context: 'detail' })}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 'var(--space-md)', rowGap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
        {[
          ['Income', formatAmount(data.totalIncome, { currency: data.currency, preference: amountFormatPreference, context: 'detail' })],
          ['Remaining', formatAmount(remaining, { currency: data.currency, preference: amountFormatPreference, context: 'detail' })],
          ['Expenses', String(data.expenseCount)],
          ['Period', data.cycleLabel],
        ].map(([label, value]) => (
          <div key={label} style={{ borderTop: 'var(--border-width) solid var(--border-subtle)', paddingTop: 'var(--space-sm)' }}>
            <p style={{ margin: '0 0 var(--space-xs)', fontSize: 'var(--text-sm)', color: T.textMuted, fontWeight: 'var(--weight-medium)' }}>
              {label}
            </p>
            <p style={{ margin: 0, fontSize: 'var(--text-base)', color: T.text1, fontWeight: 'var(--weight-semibold)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.25 }}>
              {value}
            </p>
          </div>
        ))}
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
            color: T.brandDark,
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--weight-semibold)',
            cursor: 'pointer',
          }}
        >
          Continue this month
        </button>
      )}
    </section>
  )

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

      <div style={{ marginBottom: 'var(--space-card-md)' }}>
        <SegmentedControl
          ariaLabel="Recap view"
          value={viewMode}
          options={RECAP_VIEW_OPTIONS}
          onChange={setViewMode}
        />
      </div>

      <div>
        {viewMode === 'summary' ? (
          <>
            <section style={{
              ...cardStyle,
              background: T.brandDarker,
              border: `var(--border-width) solid ${T.brandDarker}`,
              color: 'var(--text-inverse)',
              padding: 'calc(var(--space-card-sm) + var(--space-xs))',
            }}>
              <p style={{ margin: '0 0 var(--space-sm)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'rgba(255,255,255,0.72)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Your month in money
              </p>
              <p style={{
                margin: '0 0 var(--space-md)',
                fontSize: 'var(--text-xl)',
                fontWeight: 'var(--weight-bold)',
                lineHeight: 1.04,
                letterSpacing: '-0.02em',
                color: 'var(--text-inverse)',
              }}>
                You spent {formatHeroAmount(data.totalSpent, data.currency, amountFormatPreference)}
              </p>
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.76)', lineHeight: 1.5 }}>
                {summaryData.biggestDriver
                  ? `${summaryData.biggestDriver.categoryLabel} was your biggest driver at ${formatPercent(summaryData.biggestDriver.percentageOfTotal)} of outflow.`
                  : 'Once you add expenses, this recap will turn your month into a clear story.'}
              </p>
            </section>

            {data.expenseCount === 0 ? (
              <section style={cardStyle}>
                <p style={SECTION_TITLE_STYLE}>Nothing to recap yet</p>
                <p style={{ margin: '0 0 var(--space-md)', fontSize: 'var(--text-sm)', color: T.text3, lineHeight: 1.5 }}>
                  Add expenses during the month and this page will explain where your money went.
                </p>
                <button
                  type="button"
                  onClick={() => router.push(`/log/new?returnTo=${encodeURIComponent(currentCycleRoute)}`)}
                  style={{
                    width: '100%',
                    height: 'var(--button-height-md)',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    background: T.brandDark,
                    color: 'var(--text-inverse)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--weight-semibold)',
                    cursor: 'pointer',
                  }}
                >
                  Add expense
                </button>
              </section>
            ) : (
              <>
                {summaryData.biggestDriver && (
                  (() => {
                    const accent = categoryAccent(summaryData.biggestDriver.categoryType)
                    return (
                  <section style={{
                    ...cardStyle,
                    background: accent.bg,
                    border: `var(--border-width) solid ${accent.border}`,
                  }}>
                    <p style={{ margin: '0 0 var(--space-sm)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: accent.text, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Biggest money moment
                    </p>
                    <p style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', lineHeight: 1.12, color: T.text1 }}>
                      {summaryData.biggestDriver.categoryLabel}
                    </p>
                    <p style={{ margin: 'var(--space-xs) 0 0', fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', lineHeight: 1, color: T.text1, fontVariantNumeric: 'tabular-nums' }}>
                      {formatAmount(summaryData.biggestDriver.totalAmount, { currency: data.currency, preference: amountFormatPreference, context: 'summary' })}
                    </p>
                    <div style={{ marginTop: 'var(--space-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-sm)' }}>
                      <span style={{ fontSize: 'var(--text-sm)', color: T.text2, lineHeight: 1.4 }}>
                        {formatCount(summaryData.biggestDriver.transactionCount, 'transaction')}
                      </span>
                      <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: accent.text }}>
                        {formatPercent(summaryData.biggestDriver.percentageOfTotal)}
                      </span>
                    </div>
                  </section>
                    )
                  })()
                )}

                <section style={cardStyle}>
                  <p style={SECTION_TITLE_STYLE}>Top 5 expenses</p>
                  <div>
                    {data.topTransactions.map((txn, index) => (
                      <button
                        key={txn.id}
                        type="button"
                        onClick={() => router.push(transactionHref(txn.id))}
                        style={{
                          width: '100%',
                          border: 'none',
                          borderTop: index === 0 ? 'none' : 'var(--border-width) solid var(--border-subtle)',
                          background: 'transparent',
                          padding: index === 0 ? '0 0 var(--space-sm)' : 'var(--space-sm) 0',
                          display: 'grid',
                          gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                          alignItems: 'center',
                          gap: 'var(--space-sm)',
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: 'var(--grey-100)',
                          color: T.text2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 'var(--text-xs)',
                          fontWeight: 'var(--weight-semibold)',
                          flexShrink: 0,
                        }}>
                          {index + 1}
                        </span>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: T.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {txn.title}
                          </span>
                        </span>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: T.text1, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                          {formatAmount(txn.amount, { currency: data.currency, preference: amountFormatPreference, context: 'row' })}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>

                <section style={cardStyle}>
                  <p style={SECTION_TITLE_STYLE}>Your spending mix</p>
                  <div style={{ display: 'flex', height: 12, gap: 3, marginBottom: 'var(--space-md)' }}>
                    {summaryData.spendingMix.map((group) => {
                      const accent = categoryAccent(group.key)
                      return (
                        <div
                          key={group.key}
                          title={`${group.label}: ${formatPercent(group.percentageOfTotal)}`}
                          style={{
                            flex: Math.max(group.amount, 1),
                            minWidth: 12,
                            borderRadius: 'var(--radius-full)',
                            background: accent.bar,
                          }}
                        />
                      )
                    })}
                  </div>
                  <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
                    {summaryData.spendingMix.map((group) => {
                      const accent = categoryAccent(group.key)
                      return (
                        <div key={group.key} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-sm)' }}>
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', minWidth: 0 }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: accent.bar, flexShrink: 0 }} />
                              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: T.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {group.label}
                              </span>
                            </span>
                            <p style={{ margin: '2px 0 0 calc(7px + var(--space-xs))', fontSize: 'var(--text-xs)', color: T.text3 }}>
                              {formatPercent(group.percentageOfTotal)} of outflow
                            </p>
                          </span>
                          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: T.text1, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                            {formatAmount(group.amount, { currency: data.currency, preference: amountFormatPreference, context: 'summary' })}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </section>
              </>
            )}

            <section style={cardStyle}>
              <p style={SECTION_TITLE_STYLE}>Next up</p>
              {summaryData.nextRecurringItem ? (
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-md)' }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: T.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {summaryData.nextRecurringItem.label}
                    </span>
                    <span style={{ display: 'block', marginTop: 2, fontSize: 'var(--text-xs)', color: T.text3 }}>
                      {summaryData.recurringCount === 1
                        ? '1 upcoming item'
                        : `${summaryData.recurringCount} upcoming items`}
                    </span>
                  </span>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: T.text1, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {formatAmount(summaryData.nextRecurringItem.amount, { currency: data.currency, preference: amountFormatPreference, context: 'row' })}
                  </span>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: T.text3, lineHeight: 1.5 }}>
                  No fixed recurring items or monthly reminders saved for this period.
                </p>
              )}
            </section>
          </>
        ) : (
          <>
            {detailedSummaryCard}
            {data.expenseCount === 0 ? (
              <section style={cardStyle}>
                <p style={SECTION_TITLE_STYLE}>Nothing to recap yet</p>
                <p style={{ margin: '0 0 var(--space-md)', fontSize: 'var(--text-sm)', color: T.text3, lineHeight: 1.5 }}>
                  Add expenses during the month and this page will explain where your money went.
                </p>
                <button
                  type="button"
                  onClick={() => router.push(`/log/new?returnTo=${encodeURIComponent(currentCycleRoute)}`)}
                  style={{
                    width: '100%',
                    height: 'var(--button-height-md)',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    background: T.brandDark,
                    color: 'var(--text-inverse)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--weight-semibold)',
                    cursor: 'pointer',
                  }}
                >
                  Add expense
                </button>
              </section>
            ) : (
              <>
                <section style={cardStyle}>
                  <p style={SECTION_TITLE_STYLE}>Where your money went</p>
                  <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
                    {data.rows.map((row) => {
                      const width = largestCategoryAmount > 0
                        ? Math.max(6, (row.totalAmount / largestCategoryAmount) * 100)
                        : 0

                      return (
                        <button
                          key={row.categoryKey}
                          type="button"
                          onClick={() => router.push(categoryHref(row))}
                          style={{
                            border: 'none',
                            padding: 0,
                            background: 'transparent',
                            textAlign: 'left',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-sm)' }}>
                            <span style={{ minWidth: 0, fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: T.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {row.categoryLabel}
                            </span>
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: T.text1, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                              {formatAmount(row.totalAmount, { currency: data.currency, preference: amountFormatPreference, context: 'summary' })}
                            </span>
                          </div>
                          <div style={{ marginTop: 'var(--space-xs)', height: 8, display: 'flex', alignItems: 'center' }}>
                            <div style={{ width: `${width}%`, minWidth: 24, height: '100%', borderRadius: 'var(--radius-full)', background: categoryColor(row.categoryType) }} />
                          </div>
                          <p style={{ margin: 'var(--space-2xs) 0 0', fontSize: 'var(--text-xs)', color: T.text3, lineHeight: 1.4 }}>
                            {formatPercent(row.percentageOfTotal)} of outflow · {formatCount(row.transactionCount, 'transaction')}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </section>

                <section style={cardStyle}>
                  <p style={SECTION_TITLE_STYLE}>Spending groups</p>
                  <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
                    {data.spendingGroups.map((group) => {
                      const width = largestGroupAmount > 0
                        ? Math.max(6, (group.amount / largestGroupAmount) * 100)
                        : 0

                      return (
                        <div key={group.key}>
                          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-sm)' }}>
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: T.text1 }}>
                              {group.label}
                            </span>
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: T.text1, fontVariantNumeric: 'tabular-nums' }}>
                              {formatAmount(group.amount, { currency: data.currency, preference: amountFormatPreference, context: 'summary' })}
                            </span>
                          </div>
                          <div style={{ marginTop: 'var(--space-xs)', height: 8, display: 'flex', alignItems: 'center' }}>
                            <div style={{ width: `${width}%`, minWidth: 24, height: '100%', borderRadius: 'var(--radius-full)', background: categoryColor(group.key) }} />
                          </div>
                          <p style={{ margin: 'var(--space-2xs) 0 0', fontSize: 'var(--text-xs)', color: T.text3, lineHeight: 1.4 }}>
                            {formatPercent(group.percentageOfTotal)} · {group.description}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </section>

                <section style={cardStyle}>
                  <p style={SECTION_TITLE_STYLE}>Largest individual expenses</p>
                  <div>
                    {data.topTransactions.map((txn, index) => (
                      <button
                        key={txn.id}
                        type="button"
                        onClick={() => router.push(transactionHref(txn.id))}
                        style={{
                          width: '100%',
                          border: 'none',
                          borderTop: index === 0 ? 'none' : 'var(--border-width) solid var(--border-subtle)',
                          background: 'transparent',
                          padding: index === 0 ? '0 0 var(--space-sm)' : 'var(--space-sm) 0',
                          display: 'flex',
                          alignItems: 'baseline',
                          justifyContent: 'space-between',
                          gap: 'var(--space-md)',
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: T.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {txn.title}
                          </span>
                          <span style={{ display: 'block', marginTop: 2, fontSize: 'var(--text-xs)', color: T.text3 }}>
                            {txn.categoryLabel}
                          </span>
                        </span>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: T.text1, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                          {formatAmount(txn.amount, { currency: data.currency, preference: amountFormatPreference, context: 'row' })}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              </>
            )}

            <section style={data.recurringItems.length > 0 ? cardStyle : { marginBottom: 'var(--space-card-md)' }}>
              <p style={SECTION_TITLE_STYLE}>Upcoming and recurring</p>
              {data.recurringItems.length > 0 ? (
                <div>
                  {data.recurringItems.slice(0, 5).map((item, index) => (
                    <div
                      key={`${item.kind}-${item.key}`}
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        gap: 'var(--space-md)',
                        borderTop: index === 0 ? 'none' : 'var(--border-width) solid var(--border-subtle)',
                        padding: index === 0 ? '0 0 var(--space-sm)' : 'var(--space-sm) 0',
                      }}
                    >
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: T.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.label}
                        </span>
                        <span style={{ display: 'block', marginTop: 2, fontSize: 'var(--text-xs)', color: T.text3 }}>
                          {item.kind === 'fixed' ? 'Fixed recurring item' : 'Monthly reminder'}
                        </span>
                      </span>
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: T.text1, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                        {formatAmount(item.amount, { currency: data.currency, preference: amountFormatPreference, context: 'row' })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: T.text3, lineHeight: 1.5 }}>
                  No fixed recurring items or monthly reminders saved for this period.
                </p>
              )}
            </section>
          </>
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
