'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useBreakpoint } from '@/hooks/useBreakpoint'

// ─── Tokens ───────────────────────────────────────────────────────────────────
const T = {
  brand:        '#EADFF4',
  brandMid:     '#C9AEE8',
  brandDeep:    '#9B6FCC',
  brandDark:    '#5C3489',
  pageBg:       '#FAFAF8',
  white:        '#FFFFFF',
  border:       '#EDE8F5',
  borderStrong: '#D5CDED',
  text1:        '#1A1025',
  text2:        '#4A3B66',
  text3:        '#8B7BA8',
  textMuted:    '#B8AECE',
  green:        '#22C55E',
  greenLight:   '#F0FDF4',
  greenBorder:  '#BBF7D0',
  greenDark:    '#15803D',
  red:          '#EF4444',
  redLight:     '#FFF1F2',
  redBorder:    '#FECACA',
  redDark:      '#991B1B',
  amber:        '#F59E0B',
  amberLight:   '#FFFBEB',
  amberBorder:  '#FDE68A',
  amberDark:    '#92400E',
}

// ─── Frequency config ─────────────────────────────────────────────────────────
const FREQUENCIES = [
  { value: 'monthly',   label: 'Monthly',    divisor: 1       },
  { value: 'quarterly', label: 'Every 3 mo', divisor: 3       },
  { value: 'biannual',  label: 'Every 6 mo', divisor: 6       },
  { value: 'yearly',    label: 'Yearly',     divisor: 12      },
  { value: 'weekly',    label: 'Weekly',     divisor: 1 / 4.33 },
]
const toMonthly = (amount: number | string, freq: string) => {
  const f = FREQUENCIES.find(x => x.value === freq) ?? FREQUENCIES[0]
  return Math.round((Number(amount) || 0) / f.divisor)
}
const freqLabel = (freq: string) => FREQUENCIES.find(f => f.value === freq)?.label ?? 'Monthly'

// ─── Expense categories ───────────────────────────────────────────────────────
const ALL_EXPENSE_CATEGORIES: { key: string; label: string; icon: string; group: string; defaultFreq: string; tip: string; canBeUnsure?: boolean }[] = [
  { key: 'rent',         label: 'Rent',          icon: '🏠', group: 'Housing',   defaultFreq: 'monthly',
    tip: 'Rent is usually the biggest fixed cost. If it is above 30% of your take-home, that is not unusual in cities but worth being aware of as you plan.' },
  { key: 'electricity',  label: 'Electricity',   icon: '⚡', group: 'Housing',   defaultFreq: 'monthly', canBeUnsure: true,
    tip: 'Electricity tends to spike in certain months. Use your highest recent bill as your baseline. It gives you a safe buffer.' },
  { key: 'water',        label: 'Water',          icon: '💧', group: 'Housing',   defaultFreq: 'monthly', canBeUnsure: true,
    tip: 'Water bills can vary. Use your average recent amount, or your highest if you want to be on the safe side.' },
  { key: 'gas',          label: 'Cooking fuel',   icon: '🔥', group: 'Housing',   defaultFreq: 'monthly', canBeUnsure: true,
    tip: 'If you refill a gas cylinder, enter the cost of one refill and pick how often you typically do it.' },
  { key: 'internet',     label: 'Internet',       icon: '📡', group: 'Utilities', defaultFreq: 'monthly',
    tip: 'Internet is a real cost of living, especially if you work from home or run any kind of business.' },
  { key: 'phone',        label: 'Phone',           icon: '📱', group: 'Utilities', defaultFreq: 'monthly',
    tip: 'On a contract, enter your plan cost. If you top up, estimate what you typically spend in a month.' },
  { key: 'houseKeeping', label: 'Housekeeping',   icon: '🧹', group: 'Household', defaultFreq: 'monthly', canBeUnsure: true,
    tip: 'Easy to underestimate. Include everything: cleaner, household supplies, small repairs.' },
  { key: 'blackTax',     label: 'Black tax',       icon: '🤲', group: 'Family',    defaultFreq: 'monthly', canBeUnsure: true,
    tip: 'Supporting family financially is a real and recurring cost for many people. It belongs in your budget as a real line, not an afterthought. You are not alone in carrying this.' },
  { key: 'schoolFees',   label: 'School fees',     icon: '🎓', group: 'Family',    defaultFreq: 'quarterly',
    tip: 'School fees are usually paid per term. Enter the full term amount and pick Every 3 months. The app works out your monthly equivalent.' },
  { key: 'childcare',    label: 'Childcare',        icon: '👶', group: 'Family',    defaultFreq: 'monthly',
    tip: 'Childcare is one of the most significant costs for families. An accurate number here makes everything else more realistic.' },
]

const fmt = (n: number, cur = 'KES') => {
  if (!n) return `${cur} 0`
  if (n >= 1_000_000) return `${cur} ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${cur} ${(n / 1_000).toFixed(0)}K`
  return `${cur} ${n.toLocaleString()}`
}

// ─── FreqSelector ─────────────────────────────────────────────────────────────
function FreqSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
      {FREQUENCIES.map(f => {
        const active = value === f.value
        return (
          <button key={f.value} onClick={() => onChange(f.value)} style={{
            height: 32, padding: '0 14px', borderRadius: 99,
            background: active ? T.brandDark : T.white,
            border: `1.5px solid ${active ? T.brandDark : T.border}`,
            color: active ? '#fff' : T.text3,
            fontSize: 13, fontWeight: active ? 600 : 400,
            fontFamily: 'var(--font-sans)', cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}>
            {f.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── AmountInput ──────────────────────────────────────────────────────────────
function AmountInput({ value, onChange, prefix }: { value: string; onChange: (v: string) => void; prefix: string }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      height: 54, borderRadius: 14,
      border: `1.5px solid ${focused ? T.brandDeep : T.border}`,
      background: T.white, overflow: 'hidden',
      transition: 'border-color 0.2s ease',
    }}>
      <span style={{
        padding: '0 14px 0 16px', fontSize: 15, color: T.text3,
        fontWeight: 600, borderRight: `1px solid ${T.border}`,
        height: '100%', display: 'flex', alignItems: 'center',
        background: T.brand + '33', flexShrink: 0,
        fontFamily: 'var(--font-sans)',
      }}>
        {prefix}
      </span>
      <input
        type="number"
        autoFocus
        value={value}
        placeholder="0"
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          flex: 1, height: '100%', border: 'none', outline: 'none',
          padding: '0 16px', fontSize: 22, fontWeight: 600,
          fontFamily: 'var(--font-serif)', color: T.text1, background: 'transparent',
        }}
      />
    </div>
  )
}

// ─── Phase 1: Select ──────────────────────────────────────────────────────────
function ExpenseSelectPage({ onBack, onContinue, isDesktop }: {
  onBack: () => void
  onContinue: (keys: string[]) => void
  isDesktop: boolean
}) {
  const [selected, setSelected] = useState(new Set(['rent']))
  const [mounted, setMounted]   = useState(false)
  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t) }, [])

  const toggle = (key: string) =>
    setSelected(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n })

  const groups = [...new Set(ALL_EXPENSE_CATEGORIES.map(c => c.group))]
  const bleedMargin = isDesktop ? 0 : -16

  return (
    <div style={{ minHeight: '100vh', background: T.pageBg, fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', marginLeft: bleedMargin, marginRight: bleedMargin }}>

      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: T.pageBg, borderBottom: `1px solid ${T.border}`, height: 56, display: 'flex', alignItems: 'center', padding: isDesktop ? '0 80px' : '0 16px', gap: 16 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', gap: 4, color: T.text2, fontSize: 13, fontFamily: 'var(--font-sans)' }}>
          ← Back
        </button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 600, color: T.text1 }}>Fixed expenses</span>
        <div style={{ width: 48 }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: isDesktop ? '40px 80px 140px' : '24px 20px 140px', maxWidth: isDesktop ? 680 : '100%', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(8px)', transition: 'all 0.4s ease', marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: isDesktop ? 28 : 24, fontWeight: 600, color: T.text1, margin: '0 0 8px' }}>
            What are your living costs?
          </h1>
          <p style={{ fontSize: 14, color: T.text2, margin: 0, lineHeight: 1.65 }}>
            Pick everything that is part of your regular life. We will go through them one by one.
          </p>
        </div>

        {groups.map((group, gi) => (
          <div key={group} style={{ marginBottom: 24, opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(10px)', transition: `all 0.4s ease ${0.05 * gi + 0.1}s` }}>
            <p style={{ fontSize: 11.5, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '1.2px', margin: '0 0 10px' }}>{group}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {ALL_EXPENSE_CATEGORIES.filter(c => c.group === group).map(cat => {
                const on = selected.has(cat.key)
                return (
                  <button key={cat.key} onClick={() => toggle(cat.key)} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '13px 14px', borderRadius: 14, textAlign: 'left',
                    background: on ? T.brand + '55' : T.white,
                    border: `1.5px solid ${on ? T.brandDeep : T.border}`,
                    cursor: 'pointer', transition: 'all 0.15s ease',
                    fontFamily: 'var(--font-sans)',
                  }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{cat.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: on ? 600 : 400, color: on ? T.brandDark : T.text2, lineHeight: 1.3, flex: 1 }}>{cat.label}</span>
                    {on && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                        <circle cx="8" cy="8" r="7.5" fill={T.brandDark} />
                        <path d="M5 8l2 2 4-4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ position: 'fixed', bottom: isDesktop ? 0 : 64, left: 0, right: 0, background: T.pageBg, borderTop: `1px solid ${T.border}`, padding: isDesktop ? '16px 0' : '12px 20px 16px' }}>
        <div style={{ maxWidth: isDesktop ? 680 : '100%', margin: '0 auto', padding: isDesktop ? '0 80px' : 0 }}>
          <button
            onClick={() => selected.size > 0 && onContinue([...selected])}
            disabled={selected.size === 0}
            style={{
              width: '100%', height: 52, borderRadius: 14,
              background: selected.size === 0 ? T.border : T.brandDark,
              border: 'none', color: selected.size === 0 ? T.textMuted : '#fff',
              fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {selected.size === 0 ? 'Select at least one' : `Continue with ${selected.size} expense${selected.size === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Phase 2: Entry ───────────────────────────────────────────────────────────
interface EntryState { amount: string; frequency: string; confidence: 'known' | 'unsure' }

function ExpenseEntryFlow({ selectedKeys, currency, totalIncome, onBack, onDone, isDesktop }: {
  selectedKeys: string[]
  currency: string
  totalIncome: number
  onBack: () => void
  onDone: (result: { entries: any[]; totalMonthly: number }) => void
  isDesktop: boolean
}) {
  const [step, setStep]       = useState(0)
  const [entries, setEntries] = useState<Record<string, EntryState>>(() =>
    Object.fromEntries(selectedKeys.map(k => {
      const cat = ALL_EXPENSE_CATEGORIES.find(c => c.key === k)
      return [k, { amount: '', frequency: cat?.defaultFreq ?? 'monthly', confidence: 'known' }]
    }))
  )
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(false)
    const t = setTimeout(() => setMounted(true), 60)
    return () => clearTimeout(t)
  }, [step])

  const current = ALL_EXPENSE_CATEGORIES.find(c => c.key === selectedKeys[step])!
  const next    = ALL_EXPENSE_CATEGORIES.find(c => c.key === selectedKeys[step + 1])
  const entry   = entries[current?.key] ?? { amount: '', frequency: 'monthly', confidence: 'known' as const }
  const isLast  = step === selectedKeys.length - 1
  const progress = ((step + 1) / selectedKeys.length) * 100

  const monthly = entry.frequency !== 'monthly' && Number(entry.amount) > 0
    ? toMonthly(entry.amount, entry.frequency) : null

  const runningMonthly = selectedKeys.slice(0, step).reduce((s, k) => {
    const e = entries[k]
    if (e?.confidence === 'unsure') return s
    return s + toMonthly(e?.amount || 0, e?.frequency || 'monthly')
  }, 0)
  const runningPct = totalIncome > 0 ? Math.round((runningMonthly / totalIncome) * 100) : 0

  const setField = (field: keyof EntryState, val: string) =>
    setEntries(e => ({ ...e, [current.key]: { ...e[current.key], [field]: val } }))

  const handleNext = () => {
    if (!isLast) { setStep(s => s + 1); return }
    const result = selectedKeys.map(k => {
      const e = entries[k]
      const confidence = e?.confidence ?? 'known'
      const monthly = confidence === 'unsure' ? 0 : toMonthly(e?.amount || 0, e?.frequency || 'monthly')
      return { key: k, amount: Number(e?.amount) || 0, frequency: e?.frequency || 'monthly', confidence, monthly }
    })
    onDone({ entries: result, totalMonthly: result.filter(r => r.confidence === 'known').reduce((s, r) => s + r.monthly, 0) })
  }

  const handleNotSure = () => {
    setEntries(e => ({ ...e, [current.key]: { ...e[current.key], confidence: 'unsure', amount: '0' } }))
    if (!isLast) setStep(s => s + 1)
    else {
      const updatedEntries = { ...entries, [current.key]: { ...entries[current.key], confidence: 'unsure' as const, amount: '0' } }
      const result = selectedKeys.map(k => {
        const e = updatedEntries[k]
        const confidence = e?.confidence ?? 'known'
        const monthly = confidence === 'unsure' ? 0 : toMonthly(e?.amount || 0, e?.frequency || 'monthly')
        return { key: k, amount: Number(e?.amount) || 0, frequency: e?.frequency || 'monthly', confidence, monthly }
      })
      onDone({ entries: result, totalMonthly: result.filter(r => r.confidence === 'known').reduce((s, r) => s + r.monthly, 0) })
    }
  }

  const handleBack = () => {
    if (step === 0) onBack()
    else setStep(s => s - 1)
  }

  // Benchmark for key categories
  const renderBenchmark = () => {
    const entryMonthly = entry.frequency === 'monthly'
      ? Number(entry.amount)
      : monthly ?? 0
    if (!entryMonthly || !totalIncome) return null
    const p = Math.round((entryMonthly / totalIncome) * 100)

    const benchmarks: Record<string, { low: number; high: number; label: string }> = {
      rent:        { low: 30, high: 40, label: 'rent' },
      electricity: { low: 5,  high: 10, label: 'electricity' },
      water:       { low: 3,  high: 6,  label: 'water' },
      internet:    { low: 3,  high: 6,  label: 'internet' },
      phone:       { low: 3,  high: 6,  label: 'phone' },
      blackTax:    { low: 10, high: 20, label: 'family support' },
      schoolFees:  { low: 10, high: 20, label: 'school fees' },
    }
    const bm = benchmarks[current.key]
    if (!bm) return null

    const isHigh = p > bm.high
    const isMid  = p > bm.low
    const bg     = isHigh ? T.redLight   : isMid ? T.amberLight  : T.greenLight
    const border = isHigh ? T.redBorder  : isMid ? T.amberBorder : T.greenBorder
    const color  = isHigh ? T.redDark    : isMid ? T.amberDark   : T.greenDark

    const headline = isHigh
      ? `${p}% of income on ${bm.label}. That is on the high side.`
      : isMid
      ? `${p}% of income on ${bm.label}. Slightly above average.`
      : `${p}% of income on ${bm.label}. That is healthy.`

    const body = isHigh
      ? `Most guidelines suggest keeping ${bm.label} under ${bm.low}% of take-home. You are not alone in this — it is one of the most common things we help with. We will factor this in and help you find more room over time.`
      : isMid
      ? `Slightly above the ${bm.low}% guideline. Manageable — knowing this helps us build a more accurate picture for you.`
      : `Under ${bm.low}% keeps things balanced and leaves room for other goals.`

    return (
      <div style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
        <p style={{ margin: '0 0 3px', fontSize: 13, fontWeight: 700, color, lineHeight: 1.4 }}>{headline}</p>
        <p style={{ margin: 0, fontSize: 12.5, color, opacity: 0.85, lineHeight: 1.6 }}>{body}</p>
      </div>
    )
  }

  if (!current) return null
  const bleedMargin = isDesktop ? 0 : -16

  return (
    <div style={{ minHeight: '100vh', background: T.pageBg, fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', marginLeft: bleedMargin, marginRight: bleedMargin }}>

      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: T.pageBg, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ height: 56, display: 'flex', alignItems: 'center', padding: isDesktop ? '0 80px' : '0 16px' }}>
          <div style={{ flex: 1 }}>
            <button onClick={handleBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: T.text2, fontFamily: 'var(--font-sans)', padding: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              ← Back
            </button>
          </div>
          <span style={{ fontSize: 13, color: T.text3 }}>{step + 1} of {selectedKeys.length}</span>
          <div style={{ flex: 1 }} />
        </div>
        <div style={{ height: 3, background: T.border }}>
          <div style={{ height: '100%', background: T.brandDeep, borderRadius: 99, width: `${progress}%`, transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)' }} />
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: isDesktop ? '48px 80px 180px' : '32px 24px 180px', maxWidth: isDesktop ? 560 : '100%', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

        <div style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(10px)', transition: 'all 0.35s ease', marginBottom: 28 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: isDesktop ? 28 : 24, fontWeight: 600, color: T.text1, margin: '0 0 6px' }}>
            {current.label}
          </h2>
          <p style={{ fontSize: 14, color: T.text3, margin: 0, lineHeight: 1.6 }}>How often do you pay this?</p>
        </div>

        {/* Frequency selector */}
        <div style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.35s ease 0.06s', marginBottom: 24 }}>
          <FreqSelector value={entry.frequency} onChange={v => setField('frequency', v)} />
        </div>

        {/* Amount input */}
        <div style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(12px)', transition: 'all 0.35s ease 0.12s', marginBottom: 8 }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, color: T.text3 }}>
            {entry.frequency === 'monthly'   ? 'How much per month?'      :
             entry.frequency === 'yearly'    ? 'How much per year?'       :
             entry.frequency === 'quarterly' ? 'How much per term?'       :
             entry.frequency === 'biannual'  ? 'How much every 6 months?' :
             entry.frequency === 'weekly'    ? 'How much per week?'       : 'Amount'}
          </p>
          <AmountInput value={entry.amount} onChange={v => setField('amount', v)} prefix={currency} />
        </div>

        {/* Monthly equivalent pill */}
        {monthly !== null && Number(entry.amount) > 0 && (
          <div style={{ background: T.greenLight, border: `1.5px solid ${T.greenBorder}`, borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <p style={{ margin: 0, fontSize: 13.5, color: T.greenDark, lineHeight: 1.5 }}>
              {currency} {Number(entry.amount).toLocaleString()} {freqLabel(entry.frequency).toLowerCase()} = <strong>{fmt(monthly, currency)} per month</strong>
            </p>
          </div>
        )}

        {renderBenchmark()}

        {/* Tip card */}
        {current.tip && (
          <div style={{ background: T.brand + '22', border: `1px solid ${T.border}`, borderRadius: 12, padding: '12px 16px', marginBottom: 24, opacity: mounted ? 1 : 0, transition: 'opacity 0.4s ease 0.2s' }}>
            <p style={{ margin: 0, fontSize: 13, color: T.text2, lineHeight: 1.65 }}>{current.tip}</p>
          </div>
        )}

        {/* Running total */}
        {runningMonthly > 0 && totalIncome > 0 && (
          <div style={{ background: T.white, border: `1.5px solid ${T.border}`, borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: T.text2 }}>Fixed costs so far</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: T.text1 }}>{fmt(runningMonthly, currency)}/mo</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, padding: '2px 8px', borderRadius: 99, color: runningPct > 70 ? T.redDark : runningPct > 50 ? T.amberDark : T.greenDark, background: runningPct > 70 ? T.redLight : runningPct > 50 ? T.amberLight : T.greenLight }}>
                {runningPct}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ position: 'fixed', bottom: isDesktop ? 0 : 64, left: 0, right: 0, background: T.pageBg, borderTop: `1px solid ${T.border}`, padding: isDesktop ? '16px 0' : '12px 20px 16px' }}>
        <div style={{ maxWidth: isDesktop ? 560 : '100%', margin: '0 auto', padding: isDesktop ? '0 80px' : 0 }}>
          {next && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 12px', background: T.border + '66', borderRadius: 10 }}>
              <span style={{ fontSize: 12.5, color: T.text3 }}>Up next: <strong style={{ color: T.text2 }}>{next.label}</strong></span>
            </div>
          )}
          <button onClick={handleNext} style={{ width: '100%', height: 52, borderRadius: 14, background: T.brandDark, border: 'none', color: '#fff', fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
            {isLast ? 'Save expenses' : 'Next'}
          </button>
          {current.canBeUnsure && (
            <button onClick={handleNotSure} style={{ width: '100%', height: 40, marginTop: 8, borderRadius: 14, background: 'none', border: 'none', color: T.text3, fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
              Not sure yet
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
type Phase = 'select' | 'entry'

export default function ExpensesPage() {
  const router    = useRouter()
  const supabase  = createClient()
  const { isDesktop } = useBreakpoint()

  const [loading,     setLoading]     = useState(true)
  const [currency,    setCurrency]    = useState('KES')
  const [totalIncome, setTotalIncome] = useState(0)
  const [userId,      setUserId]      = useState<string | null>(null)
  const [phase,       setPhase]       = useState<Phase>('select')
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: profile } = await (supabase
        .from('user_profiles')
        .select('currency')
        .eq('id', user.id)
        .single() as any)

      if (profile) setCurrency(profile.currency || 'KES')

      const { data: income } = await (supabase
        .from('income_entries')
        .select('salary, extra_income')
        .eq('user_id', user.id)
        .order('month', { ascending: false })
        .limit(1)
        .single() as any)

      if (income) {
        const extras = (income.extra_income || []) as { amount: number }[]
        setTotalIncome((income.salary || 0) + extras.reduce((s: number, e: { amount: number }) => s + (e.amount || 0), 0))
      }

      setLoading(false)
    }
    load()
  }, [])

  const handleDone = async (result: { entries: any[]; totalMonthly: number }) => {
    if (!userId) { router.push('/login'); return }

    const month = new Date().toISOString().slice(0, 7)
    const { error: saveErr } = await (supabase.from('fixed_expenses') as any).upsert({
      user_id:       userId,
      month,
      entries:       result.entries,
      total_monthly: result.totalMonthly,
    }, { onConflict: 'user_id,month' })

    if (saveErr) console.error('[expenses] upsert error:', saveErr)
    else console.log('[expenses] saved OK, month:', month, 'total_monthly:', result.totalMonthly)

    router.push('/')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: T.pageBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)', color: T.text3, fontSize: 14 }}>
        Loading...
      </div>
    )
  }

  if (phase === 'entry') {
    return (
      <ExpenseEntryFlow
        selectedKeys={selectedKeys}
        currency={currency}
        totalIncome={totalIncome}
        onBack={() => setPhase('select')}
        onDone={handleDone}
        isDesktop={isDesktop}
      />
    )
  }

  return (
    <ExpenseSelectPage
      onBack={() => router.back()}
      onContinue={keys => { setSelectedKeys(keys); setPhase('entry') }}
      isDesktop={isDesktop}
    />
  )
}
