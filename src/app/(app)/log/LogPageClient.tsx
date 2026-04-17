'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { PrimaryBtn } from '@/components/ui/Button/Button'
import { IconBack } from '@/components/ui/Icons'
import { fmt } from '@/lib/finance'
import type { LogEntry, LogPageData } from '@/lib/loaders/log'

const CATEGORY_LABEL: Record<string, string> = {
  everyday: 'Spending',
  fixed: 'Essentials',
  debt: 'Debt',
}


const T = {
  brandDark: 'var(--brand-dark)',
  pageBg: 'var(--page-bg)',
  white: 'var(--white)',
  border: 'var(--border)',
  borderSubtle: 'var(--border-subtle)',
  text1: 'var(--text-1)',
  text2: 'var(--text-2)',
  text3: 'var(--text-3)',
  textMuted: 'var(--text-muted)',
  textInverse: 'var(--text-inverse)',
}

interface LogPageClientProps {
  data: LogPageData
}

export default function LogPageClient({ data }: LogPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isDesktop } = useBreakpoint()


  const autoOpened = useRef(false)
  const [filter, setFilter] = useState<'all' | 'everyday' | 'fixed' | 'debt'>('all')

  const entries = data.entries
  const totalLogged = entries.reduce((sum, entry) => sum + entry.amount, 0)
  const totalEntries = entries.length
  const visibleEntries = filter === 'all'
    ? entries
    : entries.filter(entry => entry.categoryType === filter)

  const filterEmptyMessage: Record<typeof filter, string> = {
    all: 'No expenses logged yet for this cycle.',
    everyday: 'No life entries yet',
    fixed: 'No bills logged yet',
    debt: 'No debt entries yet',
  }

  const FILTER_OPTIONS: Array<{ value: typeof filter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'everyday', label: 'Spending' },
    { value: 'fixed', label: 'Essentials' },
    { value: 'debt', label: 'Debt' },
  ]

  const pageX = isDesktop ? 'var(--space-page-desktop)' : 'var(--space-page-mobile)'

  const categoryDisplayName = (key: string, fallback: string) => {
    const cleaned = key.replace(/[_-]+/g, ' ').trim()
    if (!cleaned) return fallback
    return cleaned.replace(/\b\w/g, c => c.toUpperCase())
  }
  const topCategories = (() => {
    const sums = new Map<string, { name: string; amount: number }>()
    for (const entry of entries) {
      const existing = sums.get(entry.categoryKey)
      if (existing) existing.amount += entry.amount
      else sums.set(entry.categoryKey, {
        name: categoryDisplayName(entry.categoryKey, entry.name),
        amount: entry.amount,
      })
    }
    return Array.from(sums.values()).sort((a, b) => b.amount - a.amount).slice(0, 3)
  })()

  const logOther = () => {
    router.push('/log/new?isOther=true&returnTo=/log')
  }

  useEffect(() => {
    if (autoOpened.current) return
    if (searchParams.get('open') !== 'true') return

    autoOpened.current = true
    logOther()
  }, [router, searchParams])

  const formatSavedAt = (iso: string | null | undefined) => {
    if (!iso) return null
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return null
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const renderEntryRow = (entry: LogEntry) => {
    const categoryLabel = CATEGORY_LABEL[entry.categoryType] ?? 'Other'
    const savedAt = formatSavedAt(entry.createdAt)

    return (
      <div
        key={entry.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          background: T.white,
          minHeight: 72,
          padding: `0 ${pageX}`,
          borderTop: `var(--border-width) solid ${T.borderSubtle}`,
        }}
      >
        <button
          onClick={() => router.push(`/log/${entry.id}`)}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-md)',
            border: 'none',
            background: 'transparent',
            padding: 'var(--space-md) 0',
            minHeight: 72,
            cursor: 'pointer',
            textAlign: 'left',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-base)',
              fontWeight: 'var(--weight-regular)',
              color: T.text2,
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {entry.name}
            </div>
            <div style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--weight-regular)',
              color: T.text3,
              marginTop: 'var(--space-sm)',
              lineHeight: 1.3,
            }}>
              {categoryLabel}{savedAt ? ` · ${savedAt}` : ''}
            </div>
          </div>

          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-base)',
            fontWeight: 'var(--weight-semibold)',
            color: T.text1,
            flexShrink: 0,
            marginLeft: 'var(--space-sm)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {fmt(entry.amount, data.currency)}
          </span>
        </button>
      </div>
    )
  }


  const content = (
    <div style={{ paddingBottom: isDesktop ? 'var(--space-xxl)' : 144, paddingTop: 'var(--space-xs)' }}>
      {/* Header */}
      <div style={{
        padding: isDesktop
          ? `var(--space-xl) var(--space-page-desktop) var(--space-md)`
          : `var(--space-lg) var(--space-page-mobile) var(--space-md)`,
      }}>
        <button
          onClick={() => router.push('/app')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            width: 44,
            height: 44,
            padding: 0,
            marginBottom: 'var(--space-sm)',
            marginLeft: -10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconBack size={18} color="var(--grey-900)" />
        </button>
        <p style={{
          margin: '0 0 var(--space-xs)',
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--weight-semibold)',
          color: T.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          {data.cycleLabel}
        </p>
        <h1 style={{
          fontSize: 'var(--text-lg)',
          fontWeight: 'var(--weight-semibold)',
          color: T.text2,
          margin: 0,
          letterSpacing: '-0.01em',
          lineHeight: 1.2,
        }}>
          Expense log
        </h1>
      </div>

      {/* Summary */}
      <div style={{
        padding: `0 ${pageX}`,
        marginBottom: 'var(--space-lg)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 'var(--space-md)',
        }}>
          <div>
            <p style={{
              margin: '0 0 var(--space-xs)',
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-semibold)',
              color: T.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              Logged total
            </p>
            <p style={{
              margin: 0,
              fontSize: 'var(--text-sm)',
              color: T.text3,
              lineHeight: 1.4,
            }}>
              {totalEntries} {totalEntries === 1 ? 'expense' : 'expenses'} logged
            </p>
          </div>
          <p style={{
            margin: 0,
            fontSize: 'var(--text-xl)',
            fontWeight: 'var(--weight-semibold)',
            color: T.text1,
            letterSpacing: '-0.02em',
            lineHeight: 1,
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {fmt(totalLogged, data.currency)}
          </p>
        </div>
      </div>

      {/* Insight — permanent, contained surface */}
      {topCategories.length > 0 && (
        <div style={{
          padding: `0 ${pageX}`,
          marginBottom: 'var(--space-lg)',
        }}>
          <div style={{
            background: T.white,
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-md)',
            border: `var(--border-width) solid ${T.borderSubtle}`,
          }}>
            <p style={{
              margin: '0 0 var(--space-sm)',
              fontSize: 'var(--text-base)',
              fontWeight: 'var(--weight-semibold)',
              color: T.text1,
              lineHeight: 1.3,
            }}>
              Top expenses this month
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2xs)' }}>
              {topCategories.map(cat => (
                <div key={cat.name} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 'var(--space-md)',
                }}>
                  <span style={{
                    fontSize: 'var(--text-sm)',
                    color: T.text2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {cat.name}
                  </span>
                  <span style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--weight-semibold)',
                    color: T.text1,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {fmt(cat.amount, data.currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filter controls */}
      <div style={{
        padding: `0 ${pageX}`,
        marginBottom: 'var(--space-md)',
        display: 'flex',
        gap: 'var(--space-sm)',
        flexWrap: 'wrap',
      }}>
        {FILTER_OPTIONS.map(option => {
          const selected = filter === option.value
          return (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              style={{
                height: 'var(--control-sm)',
                padding: '0 var(--space-md)',
                borderRadius: 'var(--radius-full)',
                border: selected
                  ? `var(--border-width-thick) solid ${T.brandDark}`
                  : `var(--border-width) solid ${T.border}`,
                background: selected ? T.brandDark : T.white,
                color: selected ? T.textInverse : T.text2,
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      {/* List */}
      <div style={{ padding: `0 ${pageX}` }}>
        <div style={{
          background: T.white,
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
        }}>
          {visibleEntries.length === 0 ? (
            <p style={{
              fontSize: 'var(--text-sm)',
              color: T.textMuted,
              margin: 0,
              padding: `var(--space-lg) ${pageX}`,
            }}>
              {filterEmptyMessage[filter]}
            </p>
          ) : (
            visibleEntries.map(renderEntryRow)
          )}
        </div>
      </div>

      {isDesktop && (
        <div style={{ padding: `var(--space-lg) var(--space-page-desktop) 0` }}>
          <PrimaryBtn
            size="lg"
            onClick={() => router.push('/log/new?returnTo=/log')}
            style={{ background: T.brandDark, color: T.textInverse }}
          >
            Add expense
          </PrimaryBtn>
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
      <div style={{
        position: 'fixed',
        bottom: 72,
        left: 0,
        right: 0,
        padding: '10px 16px',
        background: T.pageBg,
        borderTop: '1px solid var(--border-subtle)',
        zIndex: 40,
      }}>
        <PrimaryBtn
          size="lg"
          onClick={() => router.push('/log/new?returnTo=/log')}
          style={{
            background: T.brandDark,
            color: T.textInverse,
          }}
        >
          Add expense
        </PrimaryBtn>
      </div>
      <BottomNav />
    </div>
  )
}
