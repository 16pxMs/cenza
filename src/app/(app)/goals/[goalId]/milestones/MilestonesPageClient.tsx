'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AppSubpageLayout } from '@/components/layout/AppSubpageLayout/AppSubpageLayout'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { Input } from '@/components/ui/Input/Input'
import { MoneyInput } from '@/components/ui/MoneyInput/MoneyInput'
import { PrimaryBtn, SecondaryBtn, TertiaryBtn } from '@/components/ui/Button/Button'
import { IconBack } from '@/components/ui/Icons'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { useToast } from '@/lib/context/ToastContext'
import { fmt } from '@/lib/finance'
import type { GoalMilestoneData, GoalsPageGoalData } from '@/lib/loaders/goals'
import type { GoalMilestoneInput } from '@/lib/goals/milestones'
import { saveGoalMilestones } from '../../actions'

const T = {
  pageBg: '#F8F9FA',
  white: '#FFFFFF',
  text1: '#101828',
  text2: '#475467',
  text3: '#667085',
}

function createEmptyMilestone(): GoalMilestoneInput {
  return { name: '', amount: null, targetDate: null }
}

function toEditableMilestone(milestone: GoalMilestoneData): GoalMilestoneInput {
  return { name: milestone.name, amount: milestone.amount, targetDate: milestone.targetDate }
}

interface MilestonesPageClientProps {
  currency: string
  goal: GoalsPageGoalData
}

export default function MilestonesPageClient({ currency, goal }: MilestonesPageClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { isDesktop } = useBreakpoint()
  const [rows, setRows] = useState<GoalMilestoneInput[]>(
    goal.milestones.length > 0 ? goal.milestones.map(toEditableMilestone) : [createEmptyMilestone()]
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const updateRow = (index: number, patch: Partial<GoalMilestoneInput>) => {
    setError(null)
    setRows(current => current.map((row, currentIndex) => (
      currentIndex === index
        ? {
            name: patch.name ?? row.name,
            amount: patch.amount !== undefined ? patch.amount : row.amount,
            targetDate: patch.targetDate !== undefined ? patch.targetDate : row.targetDate,
          }
        : row
    )))
  }

  const removeRow = (index: number) => {
    setError(null)
    setRows(current => {
      const next = current.filter((_, currentIndex) => currentIndex !== index)
      return next.length > 0 ? next : [createEmptyMilestone()]
    })
  }

  const handleSave = () => {
    setError(null)
    startTransition(async () => {
      try {
        await saveGoalMilestones(goal.id, rows, goal.target, goal.targetDate)

        toast('Milestones updated')
        router.push(`/goals/${goal.id}`)
        router.refresh()
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Failed to update milestones')
      }
    })
  }

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
        <h1 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-1)' }}>
          Milestones
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: 'var(--text-sm)', lineHeight: 1.55, color: 'var(--text-3)' }}>
          Break your goal into smaller checkpoints.
        </p>
        {goal.target != null ? (
          <p style={{ margin: '12px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>
            Goal target: {fmt(goal.target, currency)}
          </p>
        ) : null}
      </section>

      <section style={{
        marginTop: 'var(--space-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-md)',
      }}>
        {rows.map((row, index) => (
          <div
            key={index}
            style={{
              background: T.white,
              border: 'var(--border-width) solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-lg)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-2)' }}>
                Milestone {index + 1}
              </div>
              {rows.length > 1 ? (
                <TertiaryBtn size="sm" onClick={() => removeRow(index)} disabled={isPending}>
                  Remove
                </TertiaryBtn>
              ) : null}
            </div>

            <Input
              label="Milestone name"
              value={row.name}
              onChange={(value) => updateRow(index, { name: value })}
              placeholder="e.g. First 50k"
            />
            <div style={{ height: 12 }} />
            <MoneyInput
              label="Target amount"
              value={row.amount != null ? String(row.amount) : ''}
              onChange={(value) => updateRow(index, { amount: value.trim() ? Number(value) : null })}
              currency={currency}
              placeholder="e.g. 50,000"
            />
            <div style={{ height: 12 }} />
            <Input
              label="Target date"
              value={row.targetDate ?? ''}
              onChange={(value) => updateRow(index, { targetDate: value.trim() || null })}
              placeholder="Optional"
              type="date"
            />
          </div>
        ))}
      </section>

      {error ? (
        <p style={{ margin: 'var(--space-lg) 0 0', fontSize: 'var(--text-sm)', lineHeight: 1.5, color: 'var(--red-dark)' }}>
          {error}
        </p>
      ) : null}

      <div style={{ marginTop: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SecondaryBtn size="lg" onClick={() => setRows(current => [...current, createEmptyMilestone()])} disabled={isPending}>
          Add milestone
        </SecondaryBtn>
        <PrimaryBtn size="lg" onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving…' : 'Save changes'}
        </PrimaryBtn>
      </div>
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
