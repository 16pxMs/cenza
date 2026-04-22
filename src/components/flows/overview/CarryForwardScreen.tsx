// ─────────────────────────────────────────────────────────────
// CarryForwardScreen — shown at the start of a new month when
// previous month's plan exists.
//
// User sees last month's income, fixed costs, and spending
// categories. They can remove items they no longer need.
// "Start [Month]" copies the selected plan to the new month.
// "Start fresh" dismisses and shows the normal empty state.
// ─────────────────────────────────────────────────────────────
'use client'
import { useState } from 'react'
import { TertiaryBtn } from '@/components/ui/Button/Button'

const T = {
  brandDark:    '#5C3489',
  brand:        '#EADFF4',
  white:        '#FFFFFF',
  pageBg:       '#FAFAF8',
  border:       '#EDE8F5',
  borderStrong: '#D5CDED',
  text1:        '#1A1025',
  text2:        '#4A3B66',
  text3:        '#8B7BA8',
  textMuted:    '#B8AECE',
}

function fmt(n: number, cur: string) {
  if (!n) return `${cur} 0`
  return `${cur} ${n.toLocaleString()}`
}

export interface CarryForwardData {
  prevCycleLabel: string
  income: {
    salary:       number
    extra_income: any[]
    total:        number
  }
  expenses: {
    monthlyTotal: number
    entries:       any[]
  } | null
  budgets: {
    total_budget: number
    categories:   any[]
  } | null
}

interface Props {
  data:         CarryForwardData
  currency:          string
  currentCycleLabel: string
  isDesktop?:        boolean
  onConfirm:         (selectedEntries: any[], selectedCategories: any[]) => Promise<void>
  onFresh:           () => void
}

export function CarryForwardScreen({ data, currency, currentCycleLabel, isDesktop, onConfirm, onFresh }: Props) {
  // Track which expense entries and budget categories the user keeps
  const initialEntries    = (data.expenses?.entries ?? []).filter((e: any) => e.monthly > 0)
  const initialCategories = (data.budgets?.categories ?? [])

  const [selectedEntries, setSelectedEntries]       = useState<Set<string>>(new Set(initialEntries.map((e: any) => e.key)))
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(initialCategories.map((c: any) => c.key)))
  const [saving, setSaving] = useState(false)

  const toggleEntry    = (key: string) => setSelectedEntries(s    => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n })
  const toggleCategory = (key: string) => setSelectedCategories(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n })

  const handleConfirm = async () => {
    setSaving(true)
    const entries    = initialEntries.filter((e: any) => selectedEntries.has(e.key))
    const categories = initialCategories.filter((c: any) => selectedCategories.has(c.key))
    await onConfirm(entries, categories)
    setSaving(false)
  }

  const prevLabel    = data.prevCycleLabel
  const currentLabel = currentCycleLabel
  const totalIncome  = data.income.salary + (data.income.extra_income ?? []).reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0)

  return (
    <div style={{
      minHeight: '100vh',
      background: T.pageBg,
      padding: isDesktop ? '48px 0' : '32px 0 48px',
    }}>
      <div style={{ maxWidth: isDesktop ? 520 : '100%', margin: '0 auto', padding: '0 20px' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{
            fontSize: isDesktop ? 30 : 26,
            color: T.text1,
            margin: '0 0 8px',
            letterSpacing: '-0.3px',
          }}>
            New month, same plan?
          </h1>
          <p style={{ fontSize: 14, color: T.text3, margin: 0, lineHeight: 1.6 }}>
            Here's what you had in {prevLabel}. Remove anything that no longer applies.
          </p>
        </div>

        {/* Income — informational only */}
        <Section label="Your income">
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '13px 16px',
            background: T.white,
            border: `1px solid var(--border)`,
            borderRadius: 12,
          }}>
            <span style={{ fontSize: 14, color: T.text2 }}>
              {data.income.extra_income?.length > 0 ? 'Salary + extras' : 'Monthly income'}
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, color: T.text1 }}>
              {fmt(totalIncome, currency)}
            </span>
          </div>
        </Section>

        {/* Fixed costs */}
        {initialEntries.length > 0 && (
          <Section label="Fixed costs">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {initialEntries.map((e: any) => {
                const on = selectedEntries.has(e.key)
                return (
                  <ItemRow
                    key={e.key}
                    label={e.label ?? e.key}
                    sublabel={fmt(e.monthly, currency) + '/mo'}
                    on={on}
                    onToggle={() => toggleEntry(e.key)}
                  />
                )
              })}
            </div>
          </Section>
        )}

        {/* Spending budget */}
        {initialCategories.length > 0 && (
          <Section label="Spending budget">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {initialCategories.map((c: any) => {
                const on = selectedCategories.has(c.key)
                return (
                  <ItemRow
                    key={c.key}
                    label={c.label ?? c.key}
                    sublabel={c.budget ? fmt(c.budget, currency) + '/mo' : null}
                    on={on}
                    onToggle={() => toggleCategory(c.key)}
                  />
                )
              })}
            </div>
          </Section>
        )}

        {/* CTAs */}
        <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={handleConfirm}
            disabled={saving}
            style={{
              height: 54, borderRadius: 14,
              background: T.brandDark,
              border: 'none', color: '#fff',
              fontSize: 15, fontWeight: 600,
              cursor: 'pointer',
              width: '100%',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Setting up…' : `Start ${currentLabel} with this plan`}
          </button>

          <TertiaryBtn
            size="sm"
            onClick={onFresh}
            style={{
              height: 44,
              fontSize: 13,
              color: T.text3,
            }}
          >
            Start fresh instead
          </TertiaryBtn>
        </div>

      </div>
    </div>
  )
}

// ─── Section ──────────────────────────────────────────────────
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{
        margin: '0 0 10px',
        fontSize: 11, fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: T.textMuted,
      }}>
        {label}
      </p>
      {children}
    </div>
  )
}

// ─── ItemRow ──────────────────────────────────────────────────
function ItemRow({ label, sublabel, on, onToggle }: {
  label:    string
  sublabel: string | null
  on:       boolean
  onToggle: () => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '13px 16px',
      background: on ? T.white : '#F7F7F5',
      border: on ? `1px solid var(--border)` : `1px solid var(--border-strong)`,
      borderRadius: 12,
      opacity: on ? 1 : 0.45,
      transition: 'all 0.15s',
    }}>
      <div>
        <span style={{ fontSize: 14, color: T.text1, fontWeight: 500, textDecoration: on ? 'none' : 'line-through' }}>
          {label}
        </span>
        {sublabel && (
          <span style={{ fontSize: 12.5, color: T.text3, marginLeft: 8 }}>
            {sublabel}
          </span>
        )}
      </div>
      <button
        onClick={onToggle}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '4px 6px', fontSize: 13,
          color: on ? T.text3 : T.brandDark,
          fontWeight: 500,
          flexShrink: 0,
        }}
      >
        {on ? 'Remove' : 'Keep'}
      </button>
    </div>
  )
}
