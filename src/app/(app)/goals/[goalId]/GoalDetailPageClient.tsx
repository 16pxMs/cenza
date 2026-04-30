'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { useToast } from '@/lib/context/ToastContext'
import { AppSubpageLayout } from '@/components/layout/AppSubpageLayout/AppSubpageLayout'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { Input } from '@/components/ui/Input/Input'
import { MoneyInput } from '@/components/ui/MoneyInput/MoneyInput'
import { PrimaryBtn, SecondaryBtn, TertiaryBtn } from '@/components/ui/Button/Button'
import { IconBack } from '@/components/ui/Icons'
import { GOAL_META } from '@/constants/goals'
import { fmt } from '@/lib/finance'
import { getGoalMonthlySavingSuggestion, getGoalPaceStatus } from '@/lib/goals/deadlines'
import type { GoalId } from '@/types/database'
import { goalMilestoneTip } from '@/lib/goals/milestones'
import type { GoalMilestoneData, GoalsPageGoalData } from '@/lib/loaders/goals'
import { addGoalContribution } from '../../app/actions'
import { archiveGoal, removeGoal, saveGoalTarget } from '../actions'
import { GoalOptionsMenu } from './GoalOptionsMenu'

const T = {
  pageBg: '#F8F9FA',
  white: '#FFFFFF',
  text1: '#101828',
  text2: '#475467',
  text3: '#667085',
  textMuted: '#98A2B3',
  brandDark: '#5C3489',
}

function goalDisplayLabel(id: string, destination: string | null | undefined): string {
  if (id === 'travel' && destination) return `Travel to ${destination}`
  if (id === 'other' && destination) return destination
  return GOAL_META[id as GoalId]?.label ?? id
}

function formatMilestoneDate(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTimelineDate(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`)
  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

interface GoalDetailPageClientProps {
  currency: string
  goal: GoalsPageGoalData
}

export default function GoalDetailPageClient({ currency, goal }: GoalDetailPageClientProps) {
  const router = useRouter()
  const { isDesktop } = useBreakpoint()
  const { toast } = useToast()
  const meta = GOAL_META[goal.id]
  const label = goalDisplayLabel(goal.id, goal.destination)

  const [contributionAmount, setContributionAmount] = useState('')
  const [contributionNote, setContributionNote] = useState('')
  const [contributionSaving, setContributionSaving] = useState(false)
  const [contributionOpen, setContributionOpen] = useState(false)
  const [editGoalRequestKey, setEditGoalRequestKey] = useState(0)
  const [deleteGoalId, setDeleteGoalId] = useState<GoalId | null>(null)
  const [deleteStep, setDeleteStep] = useState<'reason' | 'done' | 'used' | 'leaving'>('reason')

  const percentComplete = goal.target && goal.target > 0
    ? Math.min(100, Math.round((goal.totalSaved / goal.target) * 100))
    : 0
  const amountRemaining = goal.target != null
    ? Math.max(goal.target - goal.totalSaved, 0)
    : null
  const completedMilestoneCount = goal.milestones.filter(milestone => goal.totalSaved >= milestone.amount).length
  const contributionAmountValue = parseFloat(contributionAmount)
  const canAddContribution = Number.isFinite(contributionAmountValue) && contributionAmountValue > 0
  const monthlySavingHint = getGoalMonthlySavingSuggestion(goal.totalSaved, goal.target, goal.targetDate)
  const paceStatus = getGoalPaceStatus({
    totalSaved: goal.totalSaved,
    targetAmount: goal.target,
    targetDate: goal.targetDate,
    addedAt: goal.addedAt,
  })

  const summaryRows = useMemo(() => ([
    { label: 'Saved', value: fmt(goal.totalSaved, currency) },
    { label: 'Target', value: goal.target != null ? fmt(goal.target, currency) : 'No target set' },
    { label: 'Complete', value: goal.target != null ? `${percentComplete}%` : '—' },
    { label: 'Remaining', value: amountRemaining != null ? fmt(amountRemaining, currency) : '—' },
  ]), [amountRemaining, currency, goal.target, goal.totalSaved, percentComplete])

  const handleAddContribution = async () => {
    const amount = parseFloat(contributionAmount)
    if (!Number.isFinite(amount) || amount <= 0) return

    setContributionSaving(true)
    try {
      await addGoalContribution({
        goalId: goal.id,
        goalLabel: label,
        amount,
        note: contributionNote,
      })
      toast('Contribution added')
      setContributionAmount('')
      setContributionNote('')
      setContributionOpen(false)
      router.refresh()
    } catch {
      toast('Failed to add contribution')
    } finally {
      setContributionSaving(false)
    }
  }

  const handleArchiveGoal = async () => {
    if (!deleteGoalId) return
    try {
      await archiveGoal(deleteGoalId)
      toast('Goal archived')
      router.push('/goals')
      router.refresh()
    } catch {
      toast('Failed to archive goal')
    }
  }

  const handleRemoveGoal = async () => {
    if (!deleteGoalId) return
    try {
      await removeGoal(deleteGoalId)
      toast('Goal removed')
      router.push('/goals')
      router.refresh()
    } catch {
      toast('Failed to remove goal')
    }
  }

  const content = (
    <AppSubpageLayout maxWidth={600}>
      <Link
        href="/goals"
        aria-label="Back to Goals"
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
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 'var(--space-md)',
        }}>
          <h1 style={{
            margin: 0,
            fontSize: 'var(--text-xl)',
            fontWeight: 'var(--weight-semibold)',
            color: 'var(--text-1)',
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            minWidth: 0,
          }}>
            {label}
          </h1>
          <GoalOptionsMenu
            goalName={label}
            currency={currency}
            currentTarget={goal.target}
            currentTargetDate={goal.targetDate}
            editGoalRequestKey={editGoalRequestKey}
            focusTargetDateOnOpen={editGoalRequestKey > 0}
            onSaveGoal={async (input) => {
              await saveGoalTarget(goal.id, input)
              toast('Target updated')
              router.refresh()
            }}
            onEditMilestones={() => {
              router.push(`/goals/${goal.id}/milestones`)
            }}
            onRemoveGoal={() => {
              setDeleteGoalId(goal.id)
              setDeleteStep('reason')
            }}
          />
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-xs)',
          flexWrap: 'wrap',
          marginTop: 'var(--space-xs)',
        }}>
          <span style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-2)',
            lineHeight: 1.4,
            fontWeight: 'var(--weight-medium)',
          }}>
            Goal progress
          </span>
          {goal.target != null ? (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: 24,
              padding: '0 10px',
              borderRadius: 999,
              background: percentComplete >= 100 ? meta.light : 'var(--grey-100)',
              color: percentComplete >= 100 ? meta.dark : 'var(--text-3)',
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-semibold)',
              letterSpacing: '0.02em',
            }}>
              {percentComplete >= 100 ? 'Done' : `${percentComplete}% complete`}
            </span>
          ) : null}
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-lg)',
          marginTop: 'var(--space-lg)',
        }}>
          <div>
            <p style={{
              margin: '0 0 var(--space-xs)',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              fontWeight: 'var(--weight-semibold)',
            }}>
              Saved so far
            </p>
            <p style={{
              margin: 0,
              fontSize: 'var(--text-2xl)',
              lineHeight: 1,
              letterSpacing: '-0.02em',
              color: 'var(--text-1)',
              fontWeight: 'var(--weight-medium)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {fmt(goal.totalSaved, currency)}
            </p>
          </div>

          {goal.target != null ? (
            <>
              <div style={{ height: 6, background: 'var(--progress-track)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{
                  width: `${percentComplete}%`,
                  height: '100%',
                  borderRadius: 999,
                  background: percentComplete >= 100 ? meta.dark : 'var(--brand-dark)',
                  transition: 'width 0.2s ease',
                  minWidth: percentComplete > 0 ? 4 : 0,
                }} />
              </div>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-sm)',
              }}>
                {summaryRows.map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-md)' }}>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>{row.label}</span>
                    <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: 'var(--space-md)',
              paddingTop: 'var(--space-sm)',
              borderTop: 'var(--border-width) solid var(--border-subtle)',
            }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>Target</span>
              <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', color: 'var(--text-1)' }}>
                No target set
              </span>
            </div>
          )}

          {goal.targetDate ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              paddingTop: 'var(--space-md)',
              borderTop: 'var(--border-width) solid var(--border-subtle)',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-md)',
                flexWrap: 'wrap',
              }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>Goal timeline</span>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-1)', fontWeight: 'var(--weight-medium)', textAlign: 'right' }}>
                  {formatTimelineDate(goal.targetDate)}{paceStatus ? ` · ${paceStatus === 'ahead' ? 'Ahead' : paceStatus === 'behind' ? 'Behind' : 'On track'}` : ''}
                </span>
              </div>
              {monthlySavingHint != null && goal.target != null && goal.totalSaved < goal.target ? (
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)', lineHeight: 1.55 }}>
                  Save about <span style={{ color: 'var(--text-1)', fontWeight: 'var(--weight-medium)' }}>{fmt(monthlySavingHint, currency)}/month</span> to reach this on time.
                </div>
              ) : null}
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>
                Target date: <span style={{ color: 'var(--text-1)', fontWeight: 'var(--weight-medium)' }}>{formatMilestoneDate(goal.targetDate)}</span>
              </div>
            </div>
          ) : goal.target != null ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-md)',
              paddingTop: 'var(--space-md)',
              borderTop: 'var(--border-width) solid var(--border-subtle)',
            }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>Goal timeline</span>
              <button
                type="button"
                onClick={() => setEditGoalRequestKey(key => key + 1)}
                style={{
                  border: 'none',
                  background: 'none',
                  padding: 0,
                  color: 'var(--brand-dark)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--weight-medium)',
                  cursor: 'pointer',
                }}
              >
                Set target date
              </button>
            </div>
          ) : null}

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            paddingTop: 'var(--space-md)',
            marginTop: 'var(--space-md)',
            borderTop: 'var(--border-width) solid var(--border-subtle)',
          }}>
            <span style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              fontWeight: 'var(--weight-semibold)',
            }}>
              Goal tip
            </span>
            <p style={{
              margin: 0,
              fontSize: 'var(--text-sm)',
              color: 'var(--text-3)',
              lineHeight: 1.55,
            }}>
              {goalMilestoneTip(goal.id, goal.destination)}
            </p>
          </div>
        </div>
      </section>

      <section style={{
        marginTop: 'var(--space-lg)',
        background: T.white,
        border: 'var(--border-width) solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-lg)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-1)' }}>
              Actions
            </div>
            <div style={{ marginTop: 4, fontSize: 'var(--text-sm)', color: 'var(--text-3)', lineHeight: 1.55 }}>
              Keep this goal moving with a contribution, or update its milestones.
            </div>
          </div>
          <PrimaryBtn size="lg" onClick={() => setContributionOpen(true)}>
            Add contribution
          </PrimaryBtn>
          <SecondaryBtn size="lg" onClick={() => router.push(`/goals/${goal.id}/milestones`)}>
            Manage milestones
          </SecondaryBtn>
          <SecondaryBtn size="lg" onClick={() => router.push(`/goals/${goal.id}/contributions`)}>
            View contributions
          </SecondaryBtn>
        </div>
      </section>

      {goal.milestones.length > 0 ? (
        <section style={{
          marginTop: 'var(--space-lg)',
          background: T.white,
          border: 'var(--border-width) solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-lg)',
        }}>
          <div style={{ marginBottom: 'var(--space-md)' }}>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-1)' }}>
              Milestones
            </div>
            <div style={{ marginTop: 4, fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>
              {completedMilestoneCount} of {goal.milestones.length} complete
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {goal.milestones.map((milestone) => (
              <MilestoneRow
                key={milestone.id}
                currency={currency}
                milestone={milestone}
                done={goal.totalSaved >= milestone.amount}
              />
            ))}
          </div>
        </section>
      ) : null}
    </AppSubpageLayout>
  )

  return (
    <>
      {isDesktop ? (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <SideNav />
          <main style={{ flex: 1 }}>{content}</main>
        </div>
      ) : (
        <div style={{ minHeight: '100vh', background: T.pageBg, paddingBottom: 88 }}>
          <main>{content}</main>
          <BottomNav />
        </div>
      )}

      {deleteGoalId && (
        <Sheet
          open={true}
          onClose={() => setDeleteGoalId(null)}
          title={deleteStep === 'reason' ? 'What happened?' : ''}
        >
          {deleteStep === 'reason' && (
            <div>
              <p style={{ fontSize: 14, color: T.text2, margin: '0 0 20px', lineHeight: 1.6 }}>
                You're removing <strong>{label}</strong>. Help us understand why. We'll handle it the right way.
              </p>
              <div style={{
                background: T.white,
                border: '1px solid var(--border)',
                borderRadius: 18,
                overflow: 'hidden',
              }}>
                {[
                  { label: 'Reached this goal', sub: 'Celebrate and keep the history', step: 'done' as const },
                  { label: 'Used the money', sub: 'Acknowledge it and archive', step: 'used' as const },
                  { label: 'Changed my mind', sub: 'Remove it cleanly', step: 'leaving' as const },
                ].map((option, index, options) => (
                  <button
                    key={option.step}
                    onClick={() => setDeleteStep(option.step)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '14px 16px',
                      background: T.white,
                      border: 'none',
                      borderBottom: index < options.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: T.text1 }}>{option.label}</div>
                      <div style={{ fontSize: 12, color: T.text3, marginTop: 3 }}>{option.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {deleteStep === 'done' && (
            <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
              <div style={{ fontSize: 56, marginBottom: 12, lineHeight: 1 }}>🏆</div>
              <div style={{ fontSize: 21, fontWeight: 600, color: T.text1, marginBottom: 8 }}>
                You actually did it.
              </div>
              <div style={{
                display: 'inline-block',
                margin: '0 0 16px',
                background: meta.light,
                border: `1px solid ${meta.border}`,
                borderRadius: 10,
                padding: '6px 18px',
                fontSize: 15,
                fontWeight: 600,
                color: meta.dark,
              }}>
                {label} ✓
              </div>
              <p style={{ fontSize: 14, color: T.text2, lineHeight: 1.6, margin: '0 0 24px' }}>
                We'll keep your savings history so you can look back on this.
                Genuinely well done.
              </p>
              <button
                onClick={handleArchiveGoal}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: 14,
                  background: meta.dark,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 15,
                  fontWeight: 600,
                  color: '#fff',
                }}
              >
                Archive this goal 🎉
              </button>
            </div>
          )}

          {deleteStep === 'used' && (() => {
            const isEmergency = goal.id === 'emergency'
            return (
              <div style={{ padding: '4px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12, lineHeight: 1 }}>💛</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: T.text1, marginBottom: 10 }}>
                  Life happens.
                </div>
                <p style={{ fontSize: 14, color: T.text2, lineHeight: 1.6, margin: '0 0 16px' }}>
                  You saved for <strong>{label}</strong> and you needed to use it. That's exactly what savings are for.
                </p>
                {isEmergency && (
                  <div style={{
                    background: '#FFFBEA',
                    border: '1px solid #FDE68A',
                    borderRadius: 12,
                    padding: '12px 14px',
                    marginBottom: 16,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#92400E', marginBottom: 4 }}>
                      Consider restarting
                    </div>
                    <div style={{ fontSize: 13, color: '#92400E', lineHeight: 1.5 }}>
                      Emergency funds are worth rebuilding. When you're ready, add it back and start fresh.
                    </div>
                  </div>
                )}
                <p style={{ fontSize: 13, color: T.text3, margin: '0 0 20px' }}>
                  We'll archive the goal and keep your history.
                </p>
                <button
                  onClick={handleArchiveGoal}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: 14,
                    background: T.brandDark,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 15,
                    fontWeight: 600,
                    color: '#fff',
                  }}
                >
                  Archive this goal
                </button>
              </div>
            )
          })()}

          {deleteStep === 'leaving' && (
            <div style={{ padding: '4px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12, lineHeight: 1 }}>👋</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: T.text1, marginBottom: 10 }}>
                No worries.
              </div>
              <p style={{ fontSize: 14, color: T.text2, lineHeight: 1.6, margin: '0 0 24px' }}>
                Goals change. We'll remove <strong>{label}</strong> and clear the target you set.
                Any transactions you logged will still show in history.
              </p>
              <button
                onClick={handleRemoveGoal}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: 14,
                  background: '#D93025',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 15,
                  fontWeight: 600,
                  color: '#fff',
                }}
              >
                Yes, remove it
              </button>
              <TertiaryBtn
                size="md"
                onClick={() => setDeleteStep('reason')}
                style={{
                  marginTop: 10,
                  padding: '12px',
                }}
              >
                Go back
              </TertiaryBtn>
            </div>
          )}
        </Sheet>
      )}

      <Sheet
        open={contributionOpen}
        onClose={() => {
          if (contributionSaving) return
          setContributionOpen(false)
        }}
        title="Add contribution"
      >
        <MoneyInput
          label="Contribution amount"
          value={contributionAmount}
          onChange={value => setContributionAmount(value)}
          currency={currency}
          placeholder="e.g. 5,000"
        />
        <div style={{ height: 12 }} />
        <Input
          label="Note"
          value={contributionNote}
          onChange={value => setContributionNote(value)}
          placeholder="Optional"
        />
        <div style={{ height: 16 }} />
        <PrimaryBtn
          size="lg"
          onClick={handleAddContribution}
          disabled={contributionSaving || !canAddContribution}
          style={{ width: '100%' }}
        >
          {contributionSaving ? 'Adding…' : canAddContribution ? 'Add contribution' : 'Enter amount'}
        </PrimaryBtn>
      </Sheet>
    </>
  )
}

function MilestoneRow({
  currency,
  milestone,
  done,
}: {
  currency: string
  milestone: GoalMilestoneData
  done: boolean
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 'var(--space-md)',
      padding: '12px 14px',
      borderRadius: 'var(--radius-md)',
      border: 'var(--border-width) solid var(--border-subtle)',
      background: done ? 'var(--brand)' : 'var(--white)',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', color: 'var(--text-1)' }}>
          {milestone.name}
        </div>
        <div style={{ marginTop: 2, fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>
          {fmt(milestone.amount, currency)}
        </div>
        {milestone.targetDate ? (
          <div style={{ marginTop: 2, fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>
            Target: {formatMilestoneDate(milestone.targetDate)}
          </div>
        ) : null}
      </div>
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 24,
        padding: '0 10px',
        borderRadius: 999,
        background: done ? 'color-mix(in srgb, var(--brand-mid) 16%, transparent)' : 'var(--grey-100)',
        color: done ? 'var(--brand-dark)' : 'var(--text-3)',
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--weight-semibold)',
        flexShrink: 0,
      }}>
        {done ? 'Done' : 'Upcoming'}
      </span>
    </div>
  )
}
