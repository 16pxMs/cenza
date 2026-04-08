'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { PrimaryBtn } from '@/components/ui/Button/Button'
import type { PlanPageData } from '@/lib/loaders/plan'

const T = {
  pageBg: '#FAFAF8',
  white: '#FFFFFF',
  border: '#EDE8F5',
  sectionBg: '#F7F5FC',
  text1: '#1A1025',
  text2: '#4A3B66',
  text3: '#8B7BA8',
  brandDark: '#5C3489',
  brand: '#EADFF4',
}

function fmt(n: number, cur = 'KES') {
  if (!n) return `${cur} 0`
  return `${cur} ${n.toLocaleString()}`
}

function formatMonths(months: number): string {
  if (months < 12) return `about ${months} month${months === 1 ? '' : 's'}`
  const years = Math.floor(months / 12)
  const rem = months % 12
  if (rem === 0) return `about ${years} year${years === 1 ? '' : 's'}`
  return `about ${years} year${years === 1 ? '' : 's'} and ${rem} month${rem === 1 ? '' : 's'}`
}

function PlanRow({
  icon,
  label,
  sublabel,
  amount,
  currency,
}: {
  icon: string
  label: string
  sublabel?: string
  amount: number | null
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
        {isNotSet ? 'Not set yet' : fmt(amount, currency)}
      </span>
    </div>
  )
}

export default function PlanPageClient({ data }: { data: PlanPageData }) {
  const router = useRouter()
  const { isDesktop } = useBreakpoint()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 60)
    return () => clearTimeout(timer)
  }, [])

  const hasExpenseData = data.fixedMonthly !== null
  const estimatedCapacity = Math.round(data.income * 0.20)
  const monthlySavingCapacity = hasExpenseData
    ? data.income - (data.fixedMonthly ?? 0) - (data.spendingTotal ?? 0)
    : estimatedCapacity
  const timeToGoalMonths = data.goalTotal > 0 && monthlySavingCapacity > 0
    ? Math.ceil(data.goalTotal / monthlySavingCapacity)
    : null

  const fade = (delay: number): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(14px)',
    transition: `all 0.45s ease ${delay}s`,
  })

  const bleed = isDesktop ? 0 : -16
  const firstName = data.name ? data.name.split(' ')[0] : ''

  return (
    <div style={{
      minHeight: '100vh', background: T.pageBg,
      marginLeft: bleed, marginRight: bleed,
      paddingBottom: isDesktop ? 80 : 120,
    }}>
      <div style={{
        maxWidth: 520, margin: '0 auto',
        padding: isDesktop ? '60px var(--space-page-desktop) 0' : '40px var(--space-page-mobile) 0',
      }}>
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
            {fmt(data.income, data.currency)}
          </span>
        </div>

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
            sublabel={data.goalCount > 0 ? `${data.goalCount} ${data.goalCount === 1 ? 'goal' : 'goals'}` : undefined}
            amount={data.goalTotal > 0 ? data.goalTotal : null}
            currency={data.currency}
          />
          <PlanRow
            icon="🏠"
            label="Fixed costs"
            sublabel={data.fixedMonthly !== null ? 'Based on your inputs' : undefined}
            amount={data.fixedMonthly}
            currency={data.currency}
          />
          <PlanRow
            icon="🛒"
            label="Spending"
            sublabel={data.spendingTotal !== null ? 'Based on your inputs' : undefined}
            amount={data.spendingTotal}
            currency={data.currency}
          />

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
              {fmt(monthlySavingCapacity > 0 ? monthlySavingCapacity : 0, data.currency)}/mo
            </span>
          </div>
        </div>

        {data.goalTotal > 0 && (
          <div style={{
            background: T.white,
            border: `1px solid var(--border)`,
            borderRadius: 20,
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
            marginBottom: 12,
            ...fade(0.18),
          }}>
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
                      <strong style={{ color: T.text1 }}>{fmt(monthlySavingCapacity, data.currency)}/month</strong>{' '}
                      available after costs. At that rate, your {data.goalCount === 1 ? 'goal' : `${data.goalCount} goals`} could take {formatMonths(timeToGoalMonths)}.
                    </p>
                  ) : (
                    <p style={{ margin: '0 0 10px', fontSize: 13.5, color: T.text2, lineHeight: 1.65 }}>
                      We have used the 50/30/20 rule to estimate roughly{' '}
                      <strong style={{ color: T.text1 }}>{fmt(estimatedCapacity, data.currency)}/month</strong>{' '}
                      available for saving. At that rate, your {data.goalCount === 1 ? 'goal' : `${data.goalCount} goals`} could take {formatMonths(timeToGoalMonths)}.
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

        <div style={{ marginTop: 24, ...fade(0.25) }}>
          <PrimaryBtn
            size="lg"
            onClick={() => router.push('/app')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            Let's start <ArrowRight size={18} />
          </PrimaryBtn>
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
