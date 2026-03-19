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
  redDark:      '#991B1B',
  amber:        '#F59E0B',
  amberLight:   '#FFFBEB',
  amberDark:    '#92400E',
}

// ─── Goal metadata ─────────────────────────────────────────────────────────────
const GOAL_META: Record<string, {
  label: string; icon: string
  color: string; light: string; border: string; dark: string
  description: string; tip: string
}> = {
  emergency: {
    label: 'Emergency Fund', icon: '🛡️',
    color: T.green, light: T.greenLight, border: T.greenBorder, dark: T.greenDark,
    description: 'How much do you want in your emergency fund? A common starting point is 3 months of income.',
    tip: 'An emergency fund means you do not have to borrow when something unexpected happens. Even a small one makes a real difference.',
  },
  car: {
    label: 'Car Fund', icon: '🚗',
    color: T.brandDeep, light: T.brand + '44', border: T.brandMid, dark: T.brandDark,
    description: 'What is your target for buying or maintaining a car?',
    tip: 'Enter the full amount you are working towards. We will show you how long it will take based on what you can realistically set aside.',
  },
  travel: {
    label: 'Travel Buffer', icon: '✈️',
    color: T.amber, light: T.amberLight, border: '#FDE68A', dark: T.amberDark,
    description: 'How much do you want to set aside for travel?',
    tip: 'Setting a number — even a rough one — means you will know when you can actually book, instead of just hoping the money is there.',
  },
  home: {
    label: 'Home', icon: '🏠',
    color: T.brandDeep, light: T.brand + '44', border: T.brandMid, dark: T.brandDark,
    description: 'What is your target? This could be a deposit, rent advance, or renovation fund.',
    tip: 'Housing goals are usually the biggest ones. Knowing your number is the first step — we will help you map a realistic path to get there.',
  },
  education: {
    label: 'Education', icon: '📚',
    color: T.brandDeep, light: T.brand + '44', border: T.brandMid, dark: T.brandDark,
    description: 'What are you saving towards? A course, degree, or professional certification?',
    tip: 'Saving ahead for education means you get to choose without being forced into debt. Enter the full cost and we will work backwards from there.',
  },
  business: {
    label: 'Business', icon: '💼',
    color: T.brandDeep, light: T.brand + '44', border: T.brandMid, dark: T.brandDark,
    description: 'What amount do you need to get started or grow your business?',
    tip: 'A clear number makes all the difference. It turns a dream into a deadline. Enter what you genuinely think you need to get started.',
  },
  family: {
    label: 'Family', icon: '👨‍👩‍👧',
    color: T.brandDeep, light: T.brand + '44', border: T.brandMid, dark: T.brandDark,
    description: 'What are you saving towards for your family?',
    tip: 'Family goals tend to be the ones that matter most. Keeping them visible in your plan means they do not get pushed aside when money is tight.',
  },
  other: {
    label: 'Other Goal', icon: '⭐',
    color: T.brandDeep, light: T.brand + '44', border: T.brandMid, dark: T.brandDark,
    description: 'What is your target for this goal?',
    tip: 'You can update and rename this goal at any time. For now, even a rough number is enough to get started.',
  },
}

const fmt = (n: number, cur = 'KES') => {
  if (!n) return `${cur} 0`
  if (n >= 1000000) return `${cur} ${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${cur} ${(n / 1000).toFixed(0)}K`
  return `${cur} ${n.toLocaleString()}`
}

// ─── AmountInput ───────────────────────────────────────────────────────────────
function AmountInput({ value, onChange, prefix, placeholder }: {
  value: string; onChange: (v: string) => void; prefix: string; placeholder?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      height: 54, borderRadius: 14,
      border: focused ? `2px solid var(--border-focus)` : `1px solid var(--border)`,
      background: T.white, overflow: 'hidden',
      transition: 'border-color 0.2s ease',
    }}>
      <span style={{
        padding: '0 14px 0 16px', fontSize: 15, color: T.text3,
        fontWeight: 600, borderRight: `1px solid var(--border-subtle)`,
        height: '100%', display: 'flex', alignItems: 'center',
        background: T.brand + '33', flexShrink: 0,
      }}>
        {prefix}
      </span>
      <input
        type="number"
        autoFocus
        value={value}
        placeholder={placeholder ?? '0'}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          flex: 1, height: '100%', border: 'none', outline: 'none',
          padding: '0 16px', fontSize: 24, fontWeight: 600,
          fontFamily: 'var(--font-display)', color: T.text1, background: 'transparent',
        }}
      />
    </div>
  )
}

// ─── GoalSetupFlow ─────────────────────────────────────────────────────────────
interface GoalTarget {
  amount: number
  destination: string | null
}

function GoalSetupFlow({ goals, currency, totalIncome, onDone, isDesktop, onBack, initialStep = 0, existingTargets = {} }: {
  goals: string[]
  currency: string
  totalIncome: number
  onDone: (targets: Record<string, GoalTarget | null>, complete: boolean) => void
  isDesktop: boolean
  onBack: () => void
  initialStep?: number
  existingTargets?: Record<string, GoalTarget | null>
}) {
  const [step, setStep]               = useState(initialStep)
  const [targets, setTargets]         = useState<Record<string, GoalTarget | null>>(existingTargets)
  const [amount, setAmount]           = useState('')
  const [destination, setDestination] = useState('')
  const [destFocused, setDestFocused] = useState(false)
  const [mounted, setMounted]         = useState(false)

  useEffect(() => {
    setMounted(false)
    const existing = targets[goals[step]]
    setAmount(existing ? String(existing.amount) : '')
    setDestination('')
    const t = setTimeout(() => setMounted(true), 60)
    return () => clearTimeout(t)
  }, [step])

  if (!goals.length) { onDone({}, true); return null }

  const goalId  = goals[step]
  const meta    = GOAL_META[goalId]
  const isLast  = step === goals.length - 1
  const progress = ((step + 1) / goals.length) * 100

  const advance = (savedAmount: number | null) => {
    const value: GoalTarget | null = savedAmount && savedAmount > 0
      ? { amount: savedAmount, destination: goalId === 'travel' ? destination.trim() || null : null }
      : null
    const next = { ...targets, [goalId]: value }
    setTargets(next)
    if (isLast) onDone(next, true)   // Save path — complete
    else setStep(s => s + 1)
  }

  const handleSave = () => advance(Number(amount) > 0 ? Number(amount) : null)
  const handleSkip = () => {
    if (isLast) onDone(targets, false)  // Last goal: exit, not complete
    else setStep(s => s + 1)            // More goals: just advance
  }
  const handleBack = () => {
    if (step === 0) onBack()
    else { setStep(s => s - 1) }
  }

  // ── Live benchmark strip ──────────────────────────────────────────────────
  const renderBenchmark = () => {
    const val = Number(amount)
    if (!val || !totalIncome) return null

    const months          = val / totalIncome
    const monthlySaving   = totalIncome * 0.10
    const monthsToSave    = Math.ceil(val / monthlySaving)
    const yearsToSave     = (monthsToSave / 12).toFixed(1)
    const isFeasible      = monthsToSave <= 36

    type BenchResult = { color: string; bg: string; border: string; headline: string; body: string | null }

    const configs: Record<string, () => BenchResult | null> = {
      emergency: () => {
        if (months < 1) return { color: T.amberDark, bg: T.amberLight, border: '#FDE68A', headline: 'Less than 1 month of income covered.', body: 'A useful emergency fund usually starts at 3 months. Build towards that first.' }
        if (months < 3) return { color: T.amberDark, bg: T.amberLight, border: '#FDE68A', headline: `${months.toFixed(1)} months of income covered.`, body: 'A solid starting point is 3 months. Once you log real expenses, the app can refine this target.' }
        if (months < 6) return { color: T.greenDark, bg: T.greenLight, border: T.greenBorder, headline: `${Math.round(months)} months of income covered.`, body: 'That is a solid emergency fund. The app will refine this once it knows your actual spending.' }
        return { color: T.greenDark, bg: T.greenLight, border: T.greenBorder, headline: `${Math.round(months)} months covered. Strong buffer.`, body: null }
      },
      car: () => {
        if (monthsToSave <= 12) return { color: T.greenDark, bg: T.greenLight, border: T.greenBorder, headline: `Reachable in about ${monthsToSave} months.`, body: 'Saving 10% of income each month gets you there within a year. Very achievable.' }
        if (isFeasible)         return { color: T.amberDark, bg: T.amberLight, border: '#FDE68A', headline: `About ${yearsToSave} years saving 10% of income.`, body: 'Realistic. Once we know your full picture, we can find ways to get you there faster.' }
        return                   { color: T.redDark, bg: T.redLight, border: '#FECACA', headline: 'Over 3 years at 10% of income.', body: 'A longer-term goal. That is fine — we will help you build a plan that makes steady progress without stretching you thin.' }
      },
      home: () => {
        if (monthsToSave <= 24) return { color: T.greenDark, bg: T.greenLight, border: T.greenBorder, headline: `About ${monthsToSave} months saving 10% of income.`, body: 'Within reach in roughly 2 years. A focused savings habit will get you there.' }
        if (monthsToSave <= 60) return { color: T.amberDark, bg: T.amberLight, border: '#FDE68A', headline: `About ${yearsToSave} years saving 10% of income.`, body: 'A longer horizon — but housing goals usually are. We will help you find ways to accelerate this as your income grows.' }
        return                   { color: T.redDark, bg: T.redLight, border: '#FECACA', headline: 'Over 5 years at 10% of income.', body: 'This is a big goal. Knowing the number is the first step. We will help you build a realistic path — even if it takes time.' }
      },
      travel: () => {
        if (monthsToSave <= 6)  return { color: T.greenDark, bg: T.greenLight, border: T.greenBorder, headline: `About ${monthsToSave} months saving 10% of income.`, body: 'Very achievable. You could be booking this trip sooner than you think.' }
        if (monthsToSave <= 18) return { color: T.amberDark, bg: T.amberLight, border: '#FDE68A', headline: `About ${monthsToSave} months saving 10% of income.`, body: 'Realistic within a year or two. Once we see your full spending picture, we can show you where to find the extra.' }
        return                   { color: T.redDark, bg: T.redLight, border: '#FECACA', headline: `Over ${yearsToSave} years at 10% of income.`, body: 'That is a significant trip budget. Consider setting a smaller first-trip target — progress now motivates the bigger goal later.' }
      },
      education: () => {
        if (monthsToSave <= 12) return { color: T.greenDark, bg: T.greenLight, border: T.greenBorder, headline: `About ${monthsToSave} months saving 10% of income.`, body: 'Reachable within a year. A clear and very manageable education goal.' }
        if (isFeasible)         return { color: T.amberDark, bg: T.amberLight, border: '#FDE68A', headline: `About ${yearsToSave} years saving 10% of income.`, body: 'Realistic. As your income grows, this becomes easier — we will adjust your plan as things change.' }
        return                   { color: T.redDark, bg: T.redLight, border: '#FECACA', headline: 'Over 3 years at 10% of income.', body: 'Worth starting now regardless. Even small contributions add up — and we will help you find more room as we build your full plan.' }
      },
      business: () => {
        if (monthsToSave <= 12) return { color: T.greenDark, bg: T.greenLight, border: T.greenBorder, headline: `About ${monthsToSave} months saving 10% of income.`, body: 'Within reach in under a year. A focused savings plan could get you started soon.' }
        if (isFeasible)         return { color: T.amberDark, bg: T.amberLight, border: '#FDE68A', headline: `About ${yearsToSave} years saving 10% of income.`, body: 'Realistic for a business fund. You may be able to start with less and grow from there — we will help you see the options.' }
        return                   { color: T.redDark, bg: T.redLight, border: '#FECACA', headline: 'Over 3 years at 10% of income.', body: 'A long runway — but big goals need to start somewhere. We will help you break this into milestones that feel achievable.' }
      },
    }

    const result = configs[goalId]?.()
    if (!result) return null

    return (
      <div style={{ background: result.bg, border: `1px solid ${result.border}`, borderRadius: 12, padding: '12px 16px', marginTop: 10, marginBottom: 4 }}>
        <p style={{ margin: result.body ? '0 0 3px' : 0, fontSize: 13, fontWeight: 600, color: result.color, lineHeight: 1.4 }}>{result.headline}</p>
        {result.body && <p style={{ margin: 0, fontSize: 12.5, color: result.color, opacity: 0.85, lineHeight: 1.6 }}>{result.body}</p>}
      </div>
    )
  }

  if (!meta) return null

  // On mobile, break out of PageContainer's 16px horizontal padding for full-bleed header/footer
  const bleedMargin = isDesktop ? 0 : -16

  return (
    <div style={{
      minHeight: '100vh', background: T.pageBg,
      display: 'flex', flexDirection: 'column',
      marginLeft: bleedMargin, marginRight: bleedMargin,
    }}>

      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: T.pageBg, borderBottom: `1px solid var(--border-subtle)` }}>
        <div style={{ height: 56, display: 'flex', alignItems: 'center', padding: isDesktop ? '0 80px' : '0 16px' }}>
          {/* Back button — always visible */}
          <div style={{ flex: 1 }}>
            <button onClick={handleBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: T.text2, padding: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              ← Back
            </button>
          </div>
          <span style={{ fontSize: 13, color: T.text3 }}>{step + 1} of {goals.length}</span>
          <div style={{ flex: 1 }} />
        </div>
        {/* Progress bar */}
        <div style={{ height: 3, background: T.border }}>
          <div style={{ height: '100%', background: T.brandDeep, borderRadius: 99, width: `${progress}%`, transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)' }} />
        </div>
      </div>

      {/* Content */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        padding: isDesktop ? '48px 80px 180px' : '32px 24px 180px',
        maxWidth: isDesktop ? 560 : '100%',
        margin: '0 auto', width: '100%', boxSizing: 'border-box',
      }}>

        {/* Goal heading */}
        <div style={{
          opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(10px)',
          transition: 'all 0.35s ease', marginBottom: goalId === 'travel' ? 16 : 24,
        }}>
          <h2 style={{
            fontSize: isDesktop ? 30 : 26,
            color: T.text1, margin: '0 0 8px', transition: 'all 0.2s ease',
          }}>
            {goalId === 'travel'
              ? destination.trim() ? `Travel to ${destination.trim()}` : 'Where to?'
              : meta.label}
          </h2>
          {goalId !== 'travel' && (
            <p style={{ fontSize: 14, color: T.text3, margin: 0, lineHeight: 1.65 }}>
              {meta.description}
            </p>
          )}
        </div>

        {/* Travel: destination input first */}
        {goalId === 'travel' && (
          <div style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.3s ease 0.05s', marginBottom: 20 }}>
            <p style={{ margin: '0 0 8px', fontSize: 13, color: T.text3 }}>Where do you want to go?</p>
            <input
              type="text"
              value={destination}
              onChange={e => setDestination(e.target.value)}
              onFocus={() => setDestFocused(true)}
              onBlur={() => setDestFocused(false)}
              placeholder="e.g. Zanzibar, Amsterdam, Japan"
              maxLength={40}
              style={{
                width: '100%', height: 54, borderRadius: 14, boxSizing: 'border-box',
                border: destFocused ? `2px solid var(--border-focus)` : `1px solid var(--border)`,
                padding: '0 16px', fontSize: 16, color: T.text1,
                background: T.white, outline: 'none', transition: 'border-color 0.2s ease',
              }}
            />
            <p style={{ margin: '8px 0 0', fontSize: 13, color: T.text3, lineHeight: 1.55 }}>
              How much do you want to save towards this trip?
            </p>
          </div>
        )}

        {/* Emergency: quick-pick cards */}
        {goalId === 'emergency' && totalIncome > 0 && (
          <div style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.35s ease 0.06s', marginBottom: 16 }}>
            <p style={{ margin: '0 0 8px', fontSize: 12.5, color: T.text3 }}>Common targets based on your income:</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {[3, 6].map(months => {
                const suggested = totalIncome * months
                const isSelected = Number(amount) === suggested
                return (
                  <button key={months} onClick={() => setAmount(String(suggested))} style={{
                    flex: 1, padding: '11px 12px', borderRadius: 12, cursor: 'pointer',
                    background: isSelected ? T.brandDark : T.white,
                    border: isSelected ? `2px solid var(--border-focus)` : `1px solid var(--border)`,
                    textAlign: 'left', transition: 'all 0.15s ease',
                  }}>
                    <div style={{ fontSize: 12, color: isSelected ? 'rgba(234,223,244,0.6)' : T.text3, marginBottom: 2 }}>
                      {months} months
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: isSelected ? '#fff' : T.text1 }}>
                      {fmt(suggested, currency)}
                    </div>
                  </button>
                )
              })}
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 12, color: T.textMuted, lineHeight: 1.5 }}>
              3 months covers most emergencies. 6 months gives you a fuller buffer. Tap one or enter your own below.
            </p>
          </div>
        )}

        {/* Amount input + benchmark */}
        <div style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(8px)', transition: 'all 0.35s ease 0.08s' }}>
          <AmountInput value={amount} onChange={setAmount} prefix={currency} placeholder="0" />
          {renderBenchmark()}
        </div>

        {/* Tip card */}
        {meta.tip && (
          <div style={{
            opacity: mounted ? 1 : 0, transition: 'opacity 0.4s ease 0.15s',
            marginTop: 20, padding: '14px 16px', borderRadius: 14,
            background: meta.light + 'cc', border: `1px solid ${meta.border}`,
          }}>
            <p style={{ margin: 0, fontSize: 13, color: T.text2, lineHeight: 1.65 }}>{meta.tip}</p>
          </div>
        )}
      </div>

      {/* Footer — sits above BottomNav on mobile */}
      <div style={{
        position: 'fixed', bottom: isDesktop ? 0 : 64, left: 0, right: 0,
        background: T.pageBg, borderTop: `1px solid var(--border-subtle)`,
        padding: isDesktop ? '16px 0' : '12px 20px 16px',
      }}>
        <div style={{ maxWidth: isDesktop ? 560 : '100%', margin: '0 auto', padding: isDesktop ? '0 80px' : 0 }}>
          {/* Up next peek */}
          {!isLast && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 12px', background: T.border + '66', borderRadius: 10 }}>
              <span style={{ fontSize: 12.5, color: T.text3 }}>
                Up next: <strong style={{ color: T.text2 }}>{GOAL_META[goals[step + 1]]?.label}</strong>
              </span>
            </div>
          )}
          <button
            onClick={handleSave}
            style={{
              width: '100%', height: 52, borderRadius: 14,
              background: T.brandDark, border: 'none', color: '#fff',
              fontSize: 15, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {isLast ? 'Save targets' : 'Next goal'}
          </button>
          <button
            onClick={handleSkip}
            style={{
              width: '100%', height: 40, marginTop: 8,
              background: 'none', border: 'none', color: T.textMuted,
              fontSize: 13,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function TargetsPage() {
  const router   = useRouter()
  const supabase = createClient()
  const { isDesktop } = useBreakpoint()

  const [loading,      setLoading]      = useState(true)
  const [goals,        setGoals]        = useState<string[]>([])
  const [currency,     setCurrency]     = useState('KES')
  const [totalIncome,  setTotalIncome]  = useState(0)
  const [userId,       setUserId]       = useState<string | null>(null)
  const [initialStep,  setInitialStep]  = useState(0)
  const [existingTargets, setExistingTargets] = useState<Record<string, GoalTarget | null>>({})

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: profile } = await (supabase
        .from('user_profiles')
        .select('goals, currency')
        .eq('id', user.id)
        .single() as any)

      const profileGoals: string[] = profile?.goals || []
      if (profile) {
        setGoals(profileGoals)
        setCurrency(profile.currency || 'KES')
      }

      // Load existing targets to resume at first unfilled goal and prefill inputs
      const { data: savedTargets } = await (supabase
        .from('goal_targets')
        .select('goal_id, amount')
        .eq('user_id', user.id) as any)

      if (savedTargets && savedTargets.length > 0) {
        const filledIds = new Set(savedTargets.map((t: { goal_id: string }) => t.goal_id))
        const firstUnfilled = profileGoals.findIndex(gid => !filledIds.has(gid))
        setInitialStep(firstUnfilled === -1 ? 0 : firstUnfilled)

        // Seed existing amounts into targets map for input prefilling
        const seedMap: Record<string, GoalTarget> = {}
        for (const t of savedTargets as { goal_id: string; amount: number }[]) {
          seedMap[t.goal_id] = { amount: t.amount, destination: null }
        }
        setExistingTargets(seedMap)
      }

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

  const handleDone = async (targets: Record<string, GoalTarget | null>, complete: boolean) => {
    if (!userId) { router.push('/login'); return }

    if (complete) {
      const rows = Object.entries(targets)
        .filter(([, v]) => v !== null && v.amount > 0)
        .map(([goalId, v]) => ({
          user_id: userId,
          goal_id: goalId,
          amount:  v!.amount,
        }))

      if (rows.length > 0) {
        await (supabase.from('goal_targets') as any).upsert(rows, { onConflict: 'user_id,goal_id' })
      }
    }

    router.push('/')
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: T.pageBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.text3, fontSize: 14,
      }}>
        Loading...
      </div>
    )
  }

  return (
    <GoalSetupFlow
      goals={goals}
      currency={currency}
      totalIncome={totalIncome}
      onDone={handleDone}
      isDesktop={isDesktop}
      onBack={() => router.back()}
      initialStep={initialStep}
      existingTargets={existingTargets}
    />
  )
}
