'use client'

import Link from 'next/link'
import { AppSubpageLayout } from '@/components/layout/AppSubpageLayout/AppSubpageLayout'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { IconBack } from '@/components/ui/Icons'
import { GOAL_META } from '@/constants/goals'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { fmt } from '@/lib/finance'
import {
  groupContributionsByMonth,
  totalContributions,
  type GoalContributionItem,
} from '@/lib/goals/contributions'
import type { GoalsPageGoalData } from '@/lib/loaders/goals'
import type { GoalId } from '@/types/database'

const T = {
  pageBg: '#F8F9FA',
  white: '#FFFFFF',
}

function goalDisplayLabel(id: string, destination: string | null | undefined): string {
  if (id === 'travel' && destination) return `Travel to ${destination}`
  if (id === 'other' && destination) return destination
  return GOAL_META[id as GoalId]?.label ?? id
}

function formatRowDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface ContributionsPageClientProps {
  currency: string
  goal: GoalsPageGoalData
  contributions: GoalContributionItem[]
}

export default function ContributionsPageClient({ currency, goal, contributions }: ContributionsPageClientProps) {
  const { isDesktop } = useBreakpoint()
  const label = goalDisplayLabel(goal.id, goal.destination)
  const total = totalContributions(contributions)
  const groups = groupContributionsByMonth(contributions)

  const content = (
    <AppSubpageLayout maxWidth={600}>
      <Link
        href={`/goals/${goal.id}`}
        aria-label="Back to goal"
        style={{
          width: 44,
          height: 44,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 'var(--space-lg)',
          color: 'var(--grey-900)',
          textDecoration: 'none',
          flexShrink: 0,
        }}
      >
        <IconBack size={20} />
      </Link>

      <section style={{
        background: T.white,
        border: 'var(--border-width) solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-lg)',
      }}>
        <h1 style={{
          margin: 0,
          fontSize: 'var(--text-xl)',
          fontWeight: 'var(--weight-semibold)',
          color: 'var(--text-1)',
        }}>
          Contributions
        </h1>
        <p style={{
          margin: '8px 0 0',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-3)',
          lineHeight: 1.5,
        }}>
          {label}
        </p>
        <div style={{
          marginTop: 'var(--space-md)',
          paddingTop: 'var(--space-md)',
          borderTop: 'var(--border-width) solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 'var(--space-md)',
        }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>
            Total contributed
          </span>
          <span style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 'var(--weight-semibold)',
            color: 'var(--text-1)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {fmt(total, currency)}
          </span>
        </div>
      </section>

      {groups.length === 0 ? (
        <section style={{
          marginTop: 'var(--space-lg)',
          background: T.white,
          border: 'var(--border-width) solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-lg)',
        }}>
          <p style={{
            margin: 0,
            fontSize: 'var(--text-base)',
            fontWeight: 'var(--weight-semibold)',
            color: 'var(--text-1)',
          }}>
            No contributions yet
          </p>
          <p style={{
            margin: '6px 0 0',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-3)',
            lineHeight: 1.5,
          }}>
            Add your first contribution from the goal page.
          </p>
        </section>
      ) : (
        <section style={{
          marginTop: 'var(--space-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-lg)',
        }}>
          {groups.map(group => (
            <div key={group.monthKey}>
              <p style={{
                margin: '0 0 var(--space-sm)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
              }}>
                {group.monthLabel}
              </p>
              <div style={{
                background: T.white,
                border: 'var(--border-width) solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
              }}>
                {group.items.map((item, index) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 'var(--space-md)',
                      padding: '12px var(--space-md)',
                      borderTop: index === 0 ? 'none' : 'var(--border-width) solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{
                        margin: 0,
                        fontSize: 'var(--text-base)',
                        fontWeight: 'var(--weight-semibold)',
                        color: 'var(--text-1)',
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {fmt(item.amount, currency)}
                      </p>
                      <p style={{
                        margin: '2px 0 0',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-3)',
                      }}>
                        {formatRowDate(item.date)}
                      </p>
                      {item.note ? (
                        <p style={{
                          margin: '4px 0 0',
                          fontSize: 'var(--text-sm)',
                          color: 'var(--text-2)',
                          lineHeight: 1.45,
                        }}>
                          {item.note}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </AppSubpageLayout>
  )

  return isDesktop ? (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <SideNav />
      <main style={{ flex: 1 }}>{content}</main>
    </div>
  ) : (
    <div style={{ minHeight: '100vh', background: T.pageBg, paddingBottom: 88 }}>
      <main>{content}</main>
      <BottomNav />
    </div>
  )
}
