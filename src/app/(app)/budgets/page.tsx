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
}

const fmt = (n: number, cur = 'KES') => {
  if (!n) return `${cur} 0`
  if (n >= 1_000_000) return `${cur} ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${cur} ${(n / 1_000).toFixed(0)}K`
  return `${cur} ${n.toLocaleString()}`
}

// ─── Spending categories ───────────────────────────────────────────────────────
const ALL_BUDGET_CATEGORIES: { key: string; label: string; icon: string; group: string; tip: string }[] = [
  { key: 'groceries',     label: 'Groceries',        icon: '🛒', group: 'Daily living',
    tip: 'Most households spend between 10–20% of income here. Tell us what you actually spend — even a rough number is enough.' },
  { key: 'eatingOut',     label: 'Eating out',        icon: '🍽️', group: 'Daily living',
    tip: 'This one surprises most people when they add it up. Include takeaways, coffee, and casual meals. A rough monthly total is fine.' },
  { key: 'transport',     label: 'Transport',         icon: '🚌', group: 'Daily living',
    tip: 'Think about fuel, public transit, and ride-hailing combined. If it varies, use a typical month.' },
  { key: 'entertainment', label: 'Entertainment',     icon: '🎬', group: 'Lifestyle',
    tip: 'Movies, events, streaming, games. What does a normal month actually look like for you?' },
  { key: 'personalCare',  label: 'Personal care',     icon: '💆', group: 'Lifestyle',
    tip: 'Haircuts, skincare, salon visits. These happen regularly — what does a typical month cost you?' },
  { key: 'clothing',      label: 'Clothing & shoes',  icon: '👕', group: 'Lifestyle',
    tip: 'This varies month to month. Think about what you spend in a year and divide by 12 for a fair average.' },
  { key: 'socialising',   label: 'Drinks & going out', icon: '🍻', group: 'Lifestyle',
    tip: 'Social spending is real spending. What does a typical month of going out actually cost you?' },
  { key: 'health',        label: 'Health & pharmacy',  icon: '💊', group: 'Health & wellness',
    tip: 'Medication, doctor visits, supplements. Use a recent month or your average if it varies.' },
  { key: 'fitness',       label: 'Fitness',            icon: '🏃', group: 'Health & wellness',
    tip: 'Gym membership, classes, equipment. What does this regularly cost you each month?' },
  { key: 'savings',       label: 'Savings',            icon: '💰', group: 'Growth',
    tip: 'How much do you currently set aside each month? If nothing yet, that is completely fine — that is what we are here to help with.' },
  { key: 'investments',   label: 'Investments',        icon: '📈', group: 'Growth',
    tip: 'Stocks, SACCO contributions, money market. What do you typically invest each month? Zero is a valid answer too.' },
  { key: 'subscriptions', label: 'Subscriptions',      icon: '📱', group: 'Growth',
    tip: 'Netflix, Spotify, apps, cloud storage. These add up more than people expect — count everything.' },
  { key: 'gifts',         label: 'Gifts & events',     icon: '🎁', group: 'Occasional',
    tip: 'Think about what you spend on birthdays, weddings, and celebrations across a year and divide by 12.' },
  { key: 'travel',        label: 'Travel & holidays',  icon: '✈️', group: 'Occasional',
    tip: 'Think about your last year of travel and divide by 12. Even a rough number helps build an accurate picture.' },
  { key: 'other',         label: 'Other',              icon: '💸', group: 'Occasional',
    tip: 'A buffer for things that do not fit elsewhere. What does a typical unexpected spend look like for you in a month?' },
]

// ─── Budget benchmarks ────────────────────────────────────────────────────────
const BUDGET_BENCHMARKS: Record<string, { low: number; high: number; positive?: boolean }> = {
  groceries:     { low: 15, high: 25 },
  eatingOut:     { low: 10, high: 20 },
  transport:     { low: 8,  high: 15 },
  entertainment: { low: 5,  high: 12 },
  personalCare:  { low: 5,  high: 12 },
  clothing:      { low: 5,  high: 12 },
  socialising:   { low: 5,  high: 12 },
  health:        { low: 5,  high: 12 },
  fitness:       { low: 3,  high: 8  },
  savings:       { low: 10, high: 20, positive: true },
  investments:   { low: 5,  high: 15, positive: true },
  subscriptions: { low: 3,  high: 7  },
  gifts:         { low: 3,  high: 10 },
  travel:        { low: 3,  high: 12 },
  other:         { low: 3,  high: 10 },
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
function BudgetSelectPage({ onBack, onContinue, isDesktop }: {
  onBack: () => void
  onContinue: (keys: string[]) => void
  isDesktop: boolean
}) {
  const [selected, setSelected] = useState(new Set<string>())
  const [mounted, setMounted]   = useState(false)
  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t) }, [])

  const toggle = (key: string) =>
    setSelected(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n })

  const groups = [...new Set(ALL_BUDGET_CATEGORIES.map(c => c.group))]
  const bleedMargin = isDesktop ? 0 : -16
  const canContinue = selected.size >= 2

  return (
    <div style={{ minHeight: '100vh', background: T.pageBg, fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', marginLeft: bleedMargin, marginRight: bleedMargin }}>

      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: T.pageBg, borderBottom: `1px solid ${T.border}`, height: 56, display: 'flex', alignItems: 'center', padding: isDesktop ? '0 80px' : '0 16px', gap: 16 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', gap: 4, color: T.text2, fontSize: 13, fontFamily: 'var(--font-sans)' }}>
          ← Back
        </button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 600, color: T.text1 }}>Spending categories</span>
        <div style={{ width: 48 }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: isDesktop ? '40px 80px 140px' : '24px 20px 140px', maxWidth: isDesktop ? 680 : '100%', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(8px)', transition: 'all 0.4s ease', marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: isDesktop ? 28 : 24, fontWeight: 600, color: T.text1, margin: '0 0 8px' }}>
            How do you spend?
          </h1>
          <p style={{ fontSize: 14, color: T.text2, margin: 0, lineHeight: 1.65 }}>
            Pick the categories that are part of your life. You can set amounts on the next screen — or skip any that you are not sure about yet.
          </p>
        </div>

        {groups.map((group, gi) => (
          <div key={group} style={{ marginBottom: 24, opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(10px)', transition: `all 0.4s ease ${0.05 * gi + 0.1}s` }}>
            <p style={{ fontSize: 11.5, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '1.2px', margin: '0 0 10px' }}>{group}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {ALL_BUDGET_CATEGORIES.filter(c => c.group === group).map(cat => {
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
            onClick={() => canContinue && onContinue([...selected])}
            disabled={!canContinue}
            style={{
              width: '100%', height: 52, borderRadius: 14,
              background: canContinue ? T.brandDark : T.border,
              border: 'none', color: canContinue ? '#fff' : T.textMuted,
              fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: canContinue ? 'pointer' : 'not-allowed',
            }}
          >
            {selected.size < 2
              ? `Pick at least ${2 - selected.size} more`
              : `Continue with ${selected.size} ${selected.size === 1 ? 'category' : 'categories'}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Phase 2: Budget entry ─────────────────────────────────────────────────────
interface BudgetState { amount: string }

function BudgetEntryFlow({ selectedKeys, currency, totalIncome, remainingAfterExpenses, onBack, onDone, isDesktop }: {
  selectedKeys: string[]
  currency: string
  totalIncome: number
  remainingAfterExpenses: number
  onBack: () => void
  onDone: (result: { categories: any[]; totalBudget: number }) => void
  isDesktop: boolean
}) {
  const [step, setStep]             = useState(0)
  const [budgets, setBudgets]       = useState<Record<string, BudgetState>>(() =>
    Object.fromEntries(selectedKeys.map(k => [k, { amount: '' }]))
  )
  const [otherLabel, setOtherLabel] = useState('')
  const [mounted, setMounted]       = useState(false)

  const renderBenchmark = (key: string, amountStr: string) => {
    const amount = Number(amountStr)
    if (!amount || !totalIncome) return null
    const bm = BUDGET_BENCHMARKS[key]
    if (!bm) return null
    const p = Math.round((amount / totalIncome) * 100)

    if (bm.positive) {
      // High % is good for savings/investments
      if (p >= bm.high) return (
        <div style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
          <p style={{ margin: '0 0 3px', fontSize: 13, fontWeight: 700, color: '#15803D' }}>Setting aside {p}% of income — that is excellent.</p>
          <p style={{ margin: 0, fontSize: 12.5, color: '#15803D', opacity: 0.85, lineHeight: 1.6 }}>Most people save far less. We will build your plan around this strength.</p>
        </div>
      )
      if (p >= bm.low) return (
        <div style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#15803D' }}>{p}% going towards this — a solid habit.</p>
        </div>
      )
      return null
    }

    if (p > bm.high) return (
      <div style={{ background: '#FFF1F2', border: '1.5px solid #FECACA', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
        <p style={{ margin: '0 0 3px', fontSize: 13, fontWeight: 700, color: '#991B1B' }}>{p}% of income on this. That is on the high side.</p>
        <p style={{ margin: 0, fontSize: 12.5, color: '#991B1B', opacity: 0.85, lineHeight: 1.6 }}>You are not alone in this — it is one of the most common areas we help people improve. We will work through this together when we build your plan.</p>
      </div>
    )
    if (p > bm.low) return (
      <div style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
        <p style={{ margin: '0 0 3px', fontSize: 13, fontWeight: 700, color: '#92400E' }}>{p}% of income here. Slightly above average.</p>
        <p style={{ margin: 0, fontSize: 12.5, color: '#92400E', opacity: 0.85, lineHeight: 1.6 }}>Manageable, but worth keeping an eye on. Knowing this helps us build a more accurate picture for you.</p>
      </div>
    )
    return null
  }

  useEffect(() => {
    setMounted(false)
    const t = setTimeout(() => setMounted(true), 60)
    return () => clearTimeout(t)
  }, [step])

  const current  = ALL_BUDGET_CATEGORIES.find(c => c.key === selectedKeys[step])!
  const next     = ALL_BUDGET_CATEGORIES.find(c => c.key === selectedKeys[step + 1])
  const budget   = budgets[current?.key] ?? { amount: '' }
  const isLast   = step === selectedKeys.length - 1
  const progress = ((step + 1) / selectedKeys.length) * 100

  const runningBudget = selectedKeys.slice(0, step).reduce((s, k) => {
    return s + (Number(budgets[k]?.amount) || 0)
  }, 0)
  const runningPct = remainingAfterExpenses > 0
    ? Math.round((runningBudget / remainingAfterExpenses) * 100)
    : 0

  const buildResult = (overrides?: Record<string, BudgetState>) => {
    const src = overrides ?? budgets
    const cats = selectedKeys.map(k => {
      const cat = ALL_BUDGET_CATEGORIES.find(c => c.key === k)!
      const amount = Number(src[k]?.amount) || 0
      const label = k === 'other' && otherLabel.trim() ? otherLabel.trim() : cat.label
      return { key: k, label, budget: amount || null }
    })
    return { categories: cats, totalBudget: cats.reduce((s, c) => s + (c.budget ?? 0), 0) }
  }

  const handleNext = () => {
    if (!isLast) { setStep(s => s + 1); return }
    onDone(buildResult())
  }

  const handleSkip = () => {
    if (!isLast) { setStep(s => s + 1); return }
    onDone(buildResult())
  }

  if (!current) return null
  const bleedMargin = isDesktop ? 0 : -16

  return (
    <div style={{ minHeight: '100vh', background: T.pageBg, fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', marginLeft: bleedMargin, marginRight: bleedMargin }}>

      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: T.pageBg, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ height: 56, display: 'flex', alignItems: 'center', padding: isDesktop ? '0 80px' : '0 16px' }}>
          <div style={{ flex: 1 }}>
            <button onClick={() => step === 0 ? onBack() : setStep(s => s - 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: T.text2, fontFamily: 'var(--font-sans)', padding: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
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
      <div style={{ flex: 1, padding: isDesktop ? '48px 80px 200px' : '32px 24px 200px', maxWidth: isDesktop ? 560 : '100%', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

        <div style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(10px)', transition: 'all 0.35s ease', marginBottom: 28 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: isDesktop ? 28 : 24, fontWeight: 600, color: T.text1, margin: '0 0 6px' }}>
            {current.key === 'other' && otherLabel.trim() ? otherLabel.trim() : current.label}
          </h2>
          <p style={{ fontSize: 14, color: T.text3, margin: 0, lineHeight: 1.6 }}>
            How much do you usually spend on this per month?
          </p>
        </div>

        {/* Other: custom name input */}
        {current.key === 'other' && (
          <div style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.35s ease', marginBottom: 12 }}>
            <input
              type="text"
              value={otherLabel}
              onChange={e => setOtherLabel(e.target.value)}
              placeholder="What is this for? e.g. Pet care"
              style={{
                width: '100%', height: 48, borderRadius: 12, boxSizing: 'border-box',
                border: `1.5px solid ${T.border}`, padding: '0 16px',
                fontSize: 14, color: T.text1, background: T.white,
                fontFamily: 'var(--font-sans)', outline: 'none',
              }}
            />
          </div>
        )}

        {/* Amount input */}
        <div style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(12px)', transition: 'all 0.35s ease 0.1s', marginBottom: 12 }}>
          <AmountInput value={budget.amount} onChange={v => setBudgets(b => ({ ...b, [current.key]: { amount: v } }))} prefix={currency} />
        </div>

        {/* Reactive benchmark */}
        {renderBenchmark(current.key, budget.amount)}

        {/* Tip */}
        <div style={{ background: T.brand + '22', border: `1px solid ${T.border}`, borderRadius: 12, padding: '12px 16px', marginBottom: 24, opacity: mounted ? 1 : 0, transition: 'opacity 0.4s ease 0.2s' }}>
          <p style={{ margin: 0, fontSize: 13, color: T.text2, lineHeight: 1.65 }}>{current.tip}</p>
        </div>

        {/* Running total */}
        {runningBudget > 0 && remainingAfterExpenses > 0 && (
          <div style={{ background: T.white, border: `1.5px solid ${T.border}`, borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: T.text2 }}>Budgeted so far</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: T.text1 }}>{fmt(runningBudget, currency)}/mo</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, padding: '2px 8px', borderRadius: 99, color: T.greenDark, background: T.greenLight }}>
                {runningPct}% of available
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
            {isLast ? 'Save budgets' : 'Next'}
          </button>
          <button onClick={handleSkip} style={{ width: '100%', height: 40, marginTop: 8, borderRadius: 14, background: 'none', border: 'none', color: T.text3, fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
            {isLast ? 'Save without amount' : 'Skip for now'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
type Phase = 'select' | 'entry'

export default function BudgetsPage() {
  const router    = useRouter()
  const supabase  = createClient()
  const { isDesktop } = useBreakpoint()

  const [loading,              setLoading]              = useState(true)
  const [currency,             setCurrency]             = useState('KES')
  const [totalIncome,          setTotalIncome]          = useState(0)
  const [remainingAfterExpenses, setRemainingAfterExpenses] = useState(0)
  const [userId,               setUserId]               = useState<string | null>(null)
  const [phase,                setPhase]                = useState<Phase>('select')
  const [selectedKeys,         setSelectedKeys]         = useState<string[]>([])

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

      let total = 0
      if (income) {
        const extras = (income.extra_income || []) as { amount: number }[]
        total = (income.salary || 0) + extras.reduce((s: number, e: { amount: number }) => s + (e.amount || 0), 0)
        setTotalIncome(total)
      }

      const { data: expenses } = await (supabase
        .from('fixed_expenses')
        .select('total_monthly')
        .eq('user_id', user.id)
        .order('month', { ascending: false })
        .limit(1)
        .single() as any)

      const fixedMonthly = expenses?.total_monthly ?? 0
      setRemainingAfterExpenses(total - fixedMonthly)

      setLoading(false)
    }
    load()
  }, [])

  const handleDone = async (result: { categories: any[]; totalBudget: number }) => {
    if (!userId) { router.push('/login'); return }

    const month = new Date().toISOString().slice(0, 7)
    await (supabase.from('spending_budgets') as any).upsert({
      user_id:      userId,
      month,
      categories:   result.categories,
      total_budget: result.totalBudget,
    }, { onConflict: 'user_id,month' })

    router.push('/plan')
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
      <BudgetEntryFlow
        selectedKeys={selectedKeys}
        currency={currency}
        totalIncome={totalIncome}
        remainingAfterExpenses={remainingAfterExpenses}
        onBack={() => setPhase('select')}
        onDone={handleDone}
        isDesktop={isDesktop}
      />
    )
  }

  return (
    <BudgetSelectPage
      onBack={() => router.back()}
      onContinue={keys => { setSelectedKeys(keys); setPhase('entry') }}
      isDesktop={isDesktop}
    />
  )
}
