'use client'
export const dynamic = 'force-dynamic'

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

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/context/UserContext'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { getCurrentCycleId } from '@/lib/supabase/cycles-db'

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
  if (!n) return `${cur} 0`
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
      borderBottom: `1px solid var(--border-subtle)`,
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
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 500, color: T.text2 }}>
            {label}
          </p>
          {sublabel && (
            <p style={{ margin: '2px 0 0', fontSize: 12, color: T.text3 }}>
              {sublabel}
            </p>
          )}
        </div>
      </div>
      <span style={{
        fontSize: isNotSet ? 12 : 16,
        fontWeight: isNotSet ? 400 : 600,
        color: isNotSet ? T.text3 : T.text1,
        fontFamily: isNotSet ? 'var(--font-sans)' : 'var(--font-display)',
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
  const { user, profile: ctxProfile } = useUser()
  const { isDesktop } = useBreakpoint()

  const [loading,       setLoading]       = useState(true)
  const [mounted,       setMounted]       = useState(false)
  const [currency,      setCurrency]      = useState('KES')
  const [income,        setIncome]        = useState(0)
  const [goalTotal,     setGoalTotal]     = useState(0)
  const [goalCount,     setGoalCount]     = useState(0)
  const [fixedMonthly,  setFixedMonthly]  = useState<number | null>(null)
  const [spendingTotal, setSpendingTotal] = useState<number | null>(null)

  useEffect(() => {
    if (!user) return
    const userId = user.id
    async function load() {
      const cycleId = await getCurrentCycleId(supabase as any, userId, (ctxProfile ?? { pay_schedule_type: null, pay_schedule_days: null }) as any)

      setCurrency(ctxProfile?.currency ?? 'KES')

      const { data: incomeRow } = await (supabase
        .from('income_entries')
        .select('salary, extra_income')
        .eq('user_id', userId)
        .eq('cycle_id', cycleId)
        .maybeSingle() as any)

      if (incomeRow) {
        const extras = (incomeRow.extra_income ?? []) as { amount: number }[]
        setIncome((incomeRow.salary ?? 0) + extras.reduce((s, e) => s + (Number(e.amount) || 0), 0))
      }

      const { data: targets } = await (supabase
        .from('goal_targets')
        .select('amount')
        .eq('user_id', userId) as any)

      if (targets && targets.length > 0) {
        setGoalTotal(targets.reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0))
        setGoalCount(targets.length)
      }

      const { data: expenses, error: expErr } = await (supabase
        .from('fixed_expenses')
        .select('total_monthly')
        .eq('user_id', userId)
        .eq('cycle_id', cycleId)
        .maybeSingle() as any)

      if (expErr) console.error('[plan] fixed_expenses query error:', expErr)
      else console.log('[plan] fixed_expenses row:', expenses, 'cycle_id queried:', cycleId)
      if (expenses) setFixedMonthly(expenses.total_monthly ?? 0)

      const { data: budgets, error: budgetErr } = await (supabase
        .from('spending_budgets')
        .select('total_budget')
        .eq('user_id', userId)
        .eq('cycle_id', cycleId)
        .maybeSingle() as any)

      if (budgetErr) console.error('[plan] spending_budgets query error:', budgetErr)
      else console.log('[plan] spending_budgets row:', budgets, 'cycle_id queried:', cycleId)
      if (budgets) setSpendingTotal(budgets.total_budget ?? 0)

      setLoading(false)
      setTimeout(() => setMounted(true), 60)
    }
    load()
  }, [user, ctxProfile])

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
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.text3, fontSize: 14,
      }}>
        Loading...
      </div>
    )
  }

  const name = ctxProfile?.name ?? ''
  const firstName = name ? name.split(' ')[0] : ''

  return (
    <div style={{
      minHeight: '100vh', background: T.pageBg,
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
            fontSize: isDesktop ? 32 : 27,
            color: T.text1,
            margin: '0 0 10px', letterSpacing: '-0.5px', lineHeight: 1.2,
          }}>
            {firstName ? `Here's your baseline, ${firstName}` : "Here's your baseline"}
          </h1>
          <p style={{ fontSize: 15, color: T.text2, margin: 0, lineHeight: 1.65 }}>
            Based on what you have shared so far. The more you track, the more accurate this gets.
          </p>
        </div>

        {/* ── Summary card: income ── */}
        <div style={{
          background: T.white,
          border: `1px solid var(--border)`,
          borderRadius: 16, padding: '20px 24px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 12,
          ...fade(0.08),
        }}>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 600, color: T.text3, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Monthly income
            </p>
          </div>
          <span style={{ fontSize: 22, fontWeight: 600, color: T.text1, fontFamily: 'var(--font-display)' }}>
            {fmt(income, currency)}
          </span>
        </div>

        {/* ── Plan card ── */}
        <div style={{
          background: T.white,
          border: `1px solid var(--border)`,
          borderRadius: 20,
          overflow: 'hidden',
          marginBottom: 12,
          ...fade(0.13),
        }}>
          <div style={{ padding: '12px 24px 10px', background: T.sectionBg, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ margin: 0, fontSize: 10.5, fontWeight: 600, color: T.text3, textTransform: 'uppercase', letterSpacing: '1px' }}>
              What you told us
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
            sublabel={fixedMonthly !== null ? 'Based on your inputs' : undefined}
            amount={fixedMonthly}
            currency={currency}
          />
          <PlanRow
            icon="🛒"
            label="Spending"
            sublabel={spendingTotal !== null ? 'Based on your inputs' : undefined}
            amount={spendingTotal}
            currency={currency}
          />

          {/* Saving capacity row */}
          <div style={{
            padding: '16px 24px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: T.sectionBg,
          }}>
            <div>
              <p style={{ margin: '0 0 3px', fontSize: 13, fontWeight: 600, color: T.text2 }}>
                Estimated saving capacity
              </p>
              <span style={{
                fontSize: 10, fontWeight: 600, color: T.brandDark,
                background: T.brand, borderRadius: 99, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>
                Estimate
              </span>
            </div>
            <span style={{ fontSize: 16, fontWeight: 600, color: T.text1, fontFamily: 'var(--font-display)' }}>
              {fmt(monthlySavingCapacity > 0 ? monthlySavingCapacity : 0, currency)}/mo
            </span>
          </div>
        </div>

        {/* ── Timeline card ── */}
        {goalTotal > 0 && (
          <div style={{
            background: T.white,
            border: `1px solid var(--border)`,
            borderRadius: 20,
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
            marginBottom: 12,
            ...fade(0.18),
          }}>
            {/* Header row: always shows ESTIMATE badge */}
            <div style={{
              padding: '12px 24px 10px', background: T.sectionBg,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <p style={{ margin: 0, fontSize: 10.5, fontWeight: 600, color: T.text3, textTransform: 'uppercase', letterSpacing: '1px' }}>
                Your goal timeline
              </p>
              <span style={{
                fontSize: 10, fontWeight: 600, color: T.brandDark,
                background: T.brand, borderRadius: 99, padding: '3px 8px', textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>
                Estimate
              </span>
            </div>

            <div style={{ padding: '20px 24px' }}>
              {timeToGoalMonths !== null ? (
                <>
                  <p style={{
                    margin: '0 0 8px',
                    fontSize: 22, fontWeight: 600, color: T.text1,
                    fontFamily: 'var(--font-display)', letterSpacing: '-0.3px',
                  }}>
                    {formatMonths(timeToGoalMonths)}
                  </p>
                  {hasExpenseData ? (
                    <p style={{ margin: '0 0 10px', fontSize: 13.5, color: T.text2, lineHeight: 1.65 }}>
                      Based on what you have told us, you have roughly{' '}
                      <strong style={{ color: T.text1 }}>{fmt(monthlySavingCapacity, currency)}/month</strong>{' '}
                      available after costs. At that rate, your {goalCount === 1 ? 'goal' : `${goalCount} goals`} could take {formatMonths(timeToGoalMonths)}.
                    </p>
                  ) : (
                    <p style={{ margin: '0 0 10px', fontSize: 13.5, color: T.text2, lineHeight: 1.65 }}>
                      We have used the 50/30/20 rule to estimate roughly{' '}
                      <strong style={{ color: T.text1 }}>{fmt(estimatedCapacity, currency)}/month</strong>{' '}
                      available for saving. At that rate, your {goalCount === 1 ? 'goal' : `${goalCount} goals`} could take {formatMonths(timeToGoalMonths)}.
                    </p>
                  )}
                  <p style={{ margin: 0, fontSize: 12, color: T.text3, lineHeight: 1.55 }}>
                    This is a starting estimate — it will get more accurate as you track real spending.
                  </p>
                </>
              ) : (
                <p style={{ margin: 0, fontSize: 13.5, color: T.text2, lineHeight: 1.65 }}>
                  Based on what you have shared, there is limited room for saving right now. That is okay — tracking real spending often reveals more room than expected. We will help you find it.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── CTA ── */}
        <div style={{ marginTop: 24, ...fade(0.25) }}>
          <button
            onClick={() => router.push('/app')}
            style={{
              width: '100%', height: 56, borderRadius: 16,
              background: T.brandDark, border: 'none', color: '#fff',
              fontSize: 16, fontWeight: 600,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}
          >
            Let's start <ArrowRight size={18} />
          </button>
          <p style={{
            textAlign: 'center', marginTop: 14,
            fontSize: 12.5, color: T.text3, lineHeight: 1.5,
          }}>
            This is your starting point — it gets sharper as you track.
          </p>
        </div>

      </div>
    </div>
  )
}
