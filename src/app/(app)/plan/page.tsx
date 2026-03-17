// ─────────────────────────────────────────────────────────────
// /plan — "Your plan is ready" reveal screen
//
// Data model:
//   monthlySavingCapacity = income - fixedMonthly - spendingTotal
//   (if expenses not set, capacity = income)
//   timeToGoal (months) = goalTotal / monthlySavingCapacity
//
// NO "over plan" or "exceeds income" logic.
// Goals are total target amounts, not monthly deductions.
// ─────────────────────────────────────────────────────────────
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useBreakpoint } from '@/hooks/useBreakpoint'

const T = {
  pageBg:      '#FAFAF8',
  white:       '#FFFFFF',
  border:      '#EDE8F5',
  sectionBg:   '#F7F5FC',
  text1:       '#1A1025',
  text2:       '#4A3B66',
  text3:       '#8B7BA8',
  brandDark:   '#5C3489',
  brand:       '#EADFF4',
  greenLight:  '#F0FDF4',
  greenBorder: '#BBF7D0',
  greenDark:   '#15803D',
}

function fmt(n: number, cur = 'KES') {
  if (n >= 1_000_000) return `${cur} ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${cur} ${(n / 1_000).toFixed(0)}K`
  return `${cur} ${n.toLocaleString()}`
}

function formatMonths(months: number): string {
  if (months < 12) return `about ${months} month${months === 1 ? '' : 's'}`
  const years = Math.floor(months / 12)
  const rem   = months % 12
  if (rem === 0) return `about ${years} year${years === 1 ? '' : 's'}`
  return `about ${years} year${years === 1 ? '' : 's'} and ${rem} month${rem === 1 ? '' : 's'}`
}

// ─── Plan row ─────────────────────────────────────────────────
function PlanRow({
  icon, label, sublabel, amount, currency,
}: {
  icon: string
  label: string
  sublabel?: string
  amount: number | null   // null = not set by user
  currency: string
}) {
  const isNotSet = amount === null
  return (
    <div style={{
      padding: '16px 24px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      borderBottom: `1px solid ${T.border}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: T.brand, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 19,
        }}>
          {icon}
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 500, color: T.text2, fontFamily: 'var(--font-sans)' }}>
            {label}
          </p>
          {sublabel && (
            <p style={{ margin: '2px 0 0', fontSize: 12, color: T.text3, fontFamily: 'var(--font-sans)' }}>
              {sublabel}
            </p>
          )}
        </div>
      </div>
      <span style={{
        fontSize: isNotSet ? 12 : 16,
        fontWeight: isNotSet ? 400 : 600,
        color: isNotSet ? T.text3 : T.text1,
        fontFamily: isNotSet ? 'var(--font-sans)' : 'var(--font-serif)',
        fontStyle: isNotSet ? 'italic' : 'normal',
      }}>
        {isNotSet ? 'Not set yet' : fmt(amount!, currency)}
      </span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────
export default function PlanPage() {
  const router   = useRouter()
  const supabase = createClient()
  const { isDesktop } = useBreakpoint()

  const [loading,       setLoading]       = useState(true)
  const [mounted,       setMounted]       = useState(false)
  const [name,          setName]          = useState('')
  const [currency,      setCurrency]      = useState('KES')
  const [income,        setIncome]        = useState(0)
  const [goalTotal,     setGoalTotal]     = useState(0)
  const [goalCount,     setGoalCount]     = useState(0)
  const [fixedMonthly,  setFixedMonthly]  = useState<number | null>(null)
  const [spendingTotal, setSpendingTotal] = useState<number | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const month = new Date().toISOString().slice(0, 7)

      const { data: profile } = await (supabase
        .from('user_profiles')
        .select('name, currency')
        .eq('id', user.id)
        .single() as any)

      if (profile) {
        setName(profile.name ?? '')
        setCurrency(profile.currency ?? 'KES')
      }

      const { data: incomeRow } = await (supabase
        .from('income_entries')
        .select('salary, extra_income')
        .eq('user_id', user.id)
        .eq('month', month)
        .single() as any)

      if (incomeRow) {
        const extras = (incomeRow.extra_income ?? []) as { amount: number }[]
        setIncome((incomeRow.salary ?? 0) + extras.reduce((s, e) => s + (Number(e.amount) || 0), 0))
      }

      const { data: targets } = await (supabase
        .from('goal_targets')
        .select('amount')
        .eq('user_id', user.id) as any)

      if (targets && targets.length > 0) {
        setGoalTotal(targets.reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0))
        setGoalCount(targets.length)
      }

      const { data: expenses, error: expErr } = await (supabase
        .from('fixed_expenses')
        .select('total_monthly')
        .eq('user_id', user.id)
        .eq('month', month)
        .single() as any)

      if (expErr) console.error('[plan] fixed_expenses query error:', expErr)
      else console.log('[plan] fixed_expenses row:', expenses, 'month queried:', month)
      if (expenses) setFixedMonthly(expenses.total_monthly ?? 0)

      const { data: budgets, error: budgetErr } = await (supabase
        .from('spending_budgets')
        .select('total_budget')
        .eq('user_id', user.id)
        .eq('month', month)
        .single() as any)

      if (budgetErr) console.error('[plan] spending_budgets query error:', budgetErr)
      else console.log('[plan] spending_budgets row:', budgets, 'month queried:', month)
      if (budgets) setSpendingTotal(budgets.total_budget ?? 0)

      setLoading(false)
      setTimeout(() => setMounted(true), 60)
    }
    load()
  }, [])

  // ── Timeline calc ────────────────────────────────────────────
  // If we have real expense data, use it.
  // If not, apply the 50/30/20 rule: estimate savings at 20% of income.
  // Never use full income as capacity — nobody saves 100%.
  const hasExpenseData   = fixedMonthly !== null
  const estimatedCapacity = Math.round(income * 0.20)
  const monthlySavingCapacity = hasExpenseData
    ? income - (fixedMonthly ?? 0) - (spendingTotal ?? 0)
    : estimatedCapacity
  const timeToGoalMonths = (goalTotal > 0 && monthlySavingCapacity > 0)
    ? Math.ceil(goalTotal / monthlySavingCapacity)
    : null

  const fade = (delay: number): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(14px)',
    transition: `all 0.45s ease ${delay}s`,
  })

  const bleed = isDesktop ? 0 : -16

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: T.pageBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-sans)', color: T.text3, fontSize: 14,
      }}>
        Loading...
      </div>
    )
  }

  const firstName = name ? name.split(' ')[0] : ''

  return (
    <div style={{
      minHeight: '100vh', background: T.pageBg,
      fontFamily: 'var(--font-sans)',
      marginLeft: bleed, marginRight: bleed,
      paddingBottom: isDesktop ? 80 : 120,
    }}>
      <div style={{
        maxWidth: 520, margin: '0 auto',
        padding: isDesktop ? '60px 40px 0' : '40px 20px 0',
      }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 32, ...fade(0) }}>
          <h1 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: isDesktop ? 32 : 27,
            fontWeight: 700, color: T.text1,
            margin: '0 0 10px', letterSpacing: '-0.5px', lineHeight: 1.2,
          }}>
            {firstName ? `Your plan is ready, ${firstName}` : 'Your plan is ready'}
          </h1>
          <p style={{ fontSize: 15, color: T.text2, margin: 0, lineHeight: 1.65 }}>
            Here is what you have set up. Cenza will use this to help you stay on track.
          </p>
        </div>

        {/* ── Summary card: income ── */}
        <div style={{
          background: T.white,
          border: `1px solid ${T.border}`,
          borderRadius: 16, padding: '20px 24px',
          boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 12,
          ...fade(0.08),
        }}>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '0.8px', fontFamily: 'var(--font-sans)' }}>
              Monthly income
            </p>
          </div>
          <span style={{ fontSize: 22, fontWeight: 700, color: T.text1, fontFamily: 'var(--font-serif)' }}>
            {fmt(income, currency)}
          </span>
        </div>

        {/* ── Plan card ── */}
        <div style={{
          background: T.white,
          border: `1px solid ${T.border}`,
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
          marginBottom: 12,
          ...fade(0.13),
        }}>
          <div style={{ padding: '12px 24px 10px', background: T.sectionBg }}>
            <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--font-sans)' }}>
              Your plan
            </p>
          </div>

          <PlanRow
            icon="🎯"
            label="Goal savings"
            sublabel={goalCount > 0 ? `${goalCount} ${goalCount === 1 ? 'goal' : 'goals'}` : undefined}
            amount={goalTotal > 0 ? goalTotal : null}
            currency={currency}
          />
          <PlanRow
            icon="🏠"
            label="Fixed costs"
            amount={fixedMonthly}
            currency={currency}
          />
          <div style={{ borderBottom: 'none' }}>
            <PlanRow
              icon="🛒"
              label="Spending budget"
              amount={spendingTotal}
              currency={currency}
            />
          </div>
        </div>

        {/* ── Timeline card ── */}
        {goalTotal > 0 && (
          <div style={{
            background: T.white,
            border: `1px solid ${T.border}`,
            borderRadius: 20,
            overflow: 'hidden',
            boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
            marginBottom: 12,
            ...fade(0.18),
          }}>
            {/* Header row: label + optional estimate badge */}
            <div style={{
              padding: '12px 24px 10px', background: T.sectionBg,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--font-sans)' }}>
                Your goal timeline
              </p>
              {!hasExpenseData && (
                <span style={{
                  fontSize: 10, fontWeight: 700, color: T.brandDark,
                  background: T.brand, borderRadius: 99, padding: '3px 8px',
                  fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.5px',
                }}>
                  Estimate
                </span>
              )}
            </div>

            <div style={{ padding: '20px 24px' }}>
              {timeToGoalMonths !== null ? (
                <>
                  <p style={{
                    margin: '0 0 8px',
                    fontSize: 22, fontWeight: 700, color: T.text1,
                    fontFamily: 'var(--font-serif)', letterSpacing: '-0.3px',
                  }}>
                    {formatMonths(timeToGoalMonths)}
                  </p>
                  {hasExpenseData ? (
                    <p style={{ margin: 0, fontSize: 13.5, color: T.text2, lineHeight: 1.65, fontFamily: 'var(--font-sans)' }}>
                      Based on your costs, you have{' '}
                      <strong style={{ color: T.text1 }}>{fmt(monthlySavingCapacity, currency)}/month</strong>{' '}
                      available to save. At that rate you can reach your{' '}
                      {goalCount === 1 ? 'goal' : `${goalCount} goals`} in {formatMonths(timeToGoalMonths)}.
                    </p>
                  ) : (
                    <p style={{ margin: 0, fontSize: 13.5, color: T.text2, lineHeight: 1.65, fontFamily: 'var(--font-sans)' }}>
                      A common personal finance rule is to save 20% of your income —{' '}
                      <strong style={{ color: T.text1 }}>{fmt(estimatedCapacity, currency)}/month</strong>{' '}
                      in your case. If your cost of living stays within that range, you could reach your{' '}
                      {goalCount === 1 ? 'goal' : `${goalCount} goals`} in {formatMonths(timeToGoalMonths)}.
                      {' '}Add your costs to see your real timeline.
                    </p>
                  )}
                </>
              ) : (
                <p style={{ margin: 0, fontSize: 13.5, color: T.text2, lineHeight: 1.65, fontFamily: 'var(--font-sans)' }}>
                  Your current costs leave little room for saving. Consider adjusting your plan or timeline — Cenza will help you find opportunities as you track your spending.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── CTA ── */}
        <div style={{ marginTop: 24, ...fade(0.25) }}>
          <button
            onClick={() => router.push('/')}
            style={{
              width: '100%', height: 56, borderRadius: 16,
              background: T.brandDark, border: 'none', color: '#fff',
              fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}
          >
            My plan looks good <ArrowRight size={18} />
          </button>
          <p style={{
            textAlign: 'center', marginTop: 14,
            fontSize: 12.5, color: T.text3, lineHeight: 1.5,
            fontFamily: 'var(--font-sans)',
          }}>
            You can update any of this at any time.
          </p>
        </div>

      </div>
    </div>
  )
}
