'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { AppSubpageHeader } from '@/components/layout/AppSubpageHeader/AppSubpageHeader'
import { AppSubpageLayout } from '@/components/layout/AppSubpageLayout/AppSubpageLayout'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { PrimaryLink } from '@/components/ui/Button/Button'
import { GOAL_META } from '@/constants/goals'
import { fmt } from '@/lib/finance'
import type { GoalId } from '@/types/database'
import type { GoalsPageData, GoalsPageGoalData } from '@/lib/loaders/goals'

const T = {
  pageBg: '#F8F9FA',
  white: '#FFFFFF',
  text1: '#101828',
  text2: '#475467',
  text3: '#667085',
  textMuted: '#98A2B3',
  brandDark: '#5C3489',
}

const CONFETTI_COLORS = ['#5C3489', '#EADFF4', '#F4A01C', '#1A7A45', '#D93025', '#1E40AF', '#FDE68A', '#A7F3D0']

interface ConfettiPiece {
  id: number
  left: number
  delay: number
  duration: number
  color: string
  size: number
  isCircle: boolean
}

function Confetti({ onDone }: { onDone: () => void }) {
  const pieces = useMemo<ConfettiPiece[]>(() =>
    Array.from({ length: 70 }, (_, index) => ({
      id: index,
      left: Math.random() * 100,
      delay: Math.random() * 1.8,
      duration: 2.2 + Math.random() * 2,
      color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
      size: 6 + Math.random() * 7,
      isCircle: Math.random() > 0.4,
    })), [])

  useEffect(() => {
    const timer = setTimeout(onDone, 5000)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 300, overflow: 'hidden' }}>
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(108vh) rotate(560deg); opacity: 0; }
        }
      `}</style>
      {pieces.map(piece => (
        <div
          key={piece.id}
          style={{
            position: 'absolute',
            top: 0,
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.size,
            background: piece.color,
            borderRadius: piece.isCircle ? '50%' : 2,
            animation: `confettiFall ${piece.duration}s ${piece.delay}s ease-in forwards`,
          }}
        />
      ))}
    </div>
  )
}

function CelebrationContent({
  goalId,
  saved,
  currency,
  onClose,
}: { goalId: GoalId; saved: number; currency: string; onClose: () => void }) {
  const meta = GOAL_META[goalId]
  return (
    <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
      <div style={{ fontSize: 22, fontWeight: 600, color: '#101828', marginBottom: 8 }}>
        You reached your goal!
      </div>
      <div style={{ fontSize: 15, color: '#475467', marginBottom: 16 }}>{meta.label}</div>
      <div style={{
        display: 'inline-block',
        margin: '0 0 20px',
        background: meta.light,
        border: `1px solid ${meta.border}`,
        borderRadius: 12,
        padding: '8px 20px',
        fontSize: 20,
        fontWeight: 600,
        color: meta.dark,
      }}>
        {fmt(saved, currency)} saved
      </div>
      <p style={{ fontSize: 14, color: '#667085', lineHeight: 1.6, margin: '0 0 24px' }}>
        This is a big deal. You set a goal and you got there.{'\n'}Take a moment to celebrate this.
      </p>
      <button
        onClick={onClose}
        style={{
          width: '100%',
          padding: '14px',
          background: meta.dark,
          border: 'none',
          borderRadius: 14,
          fontSize: 15,
          fontWeight: 600,
          color: '#fff',
          cursor: 'pointer',
        }}
      >
        Thank you 🎉
      </button>
    </div>
  )
}

function projectedLabel(totalSaved: number, target: number | null, monthlyAvg: number): string | null {
  if (!target || target <= 0 || totalSaved >= target) return null
  if (monthlyAvg <= 0) return null
  const months = Math.ceil((target - totalSaved) / monthlyAvg)
  const date = new Date()
  date.setMonth(date.getMonth() + months)
  const label = date.toLocaleString('default', { month: 'short', year: 'numeric' })
  return `~${months} month${months === 1 ? '' : 's'} · ${label}`
}

function goalDisplayLabel(id: string, destination: string | null | undefined): string {
  if (id === 'travel' && destination) return `Travel to ${destination}`
  if (id === 'other' && destination) return destination
  return GOAL_META[id as GoalId]?.label ?? id
}

function GoalCard({ goal, currency, onTap }: { goal: GoalsPageGoalData; currency: string; onTap: () => void }) {
  const meta = GOAL_META[goal.id]
  const label = goalDisplayLabel(goal.id, goal.destination)
  const pct = goal.target ? Math.min(100, Math.round((goal.totalSaved / goal.target) * 100)) : 0
  const isDone = goal.target != null && goal.totalSaved >= goal.target
  const hasSaved = goal.totalSaved > 0
  const projected = projectedLabel(goal.totalSaved, goal.target, goal.monthlyAvg)

  return (
    <button
      onClick={onTap}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: T.white,
        border: `1px solid ${isDone ? meta.border : 'var(--border)'}`,
        borderRadius: 18,
        padding: '18px',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.text1, lineHeight: 1.3 }}>{label}</div>
          {!goal.target && (
            <div style={{ fontSize: 12, color: T.brandDark, fontWeight: 500, marginTop: 2 }}>Set a target →</div>
          )}
        </div>
        {goal.target != null && (isDone || pct > 0) && (
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            color: isDone ? meta.dark : T.text2,
            background: isDone ? meta.light : '#F1F3F5',
            border: `1px solid ${isDone ? meta.border : 'transparent'}`,
            borderRadius: 20,
            padding: '4px 10px',
            flexShrink: 0,
          }}>
            {isDone ? '✓ Done' : `${pct}%`}
          </div>
        )}
      </div>

      {goal.target != null && (
        <div style={{ height: 5, background: '#EBEBED', borderRadius: 99, overflow: 'hidden', marginBottom: 14 }}>
          {pct > 0 && (
            <div style={{
              height: '100%',
              borderRadius: 99,
              width: `${pct}%`,
              background: isDone ? meta.dark : T.brandDark,
              transition: 'width 0.5s ease',
              minWidth: 4,
            }} />
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {hasSaved ? (
          <>
            <div>
              <div style={{ fontSize: 19, fontWeight: 700, color: T.text1, letterSpacing: -0.3 }}>
                {fmt(goal.totalSaved, currency)}
              </div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>saved</div>
            </div>
            {goal.target != null && !isDone && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: T.text3 }}>
                  {fmt(goal.target - goal.totalSaved, currency)}
                </div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>to go</div>
              </div>
            )}
            {isDone && goal.target != null && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: meta.dark }}>{fmt(goal.target, currency)}</div>
                <div style={{ fontSize: 11, color: meta.dark, opacity: 0.75, marginTop: 1 }}>target reached</div>
              </div>
            )}
          </>
        ) : goal.target != null ? (
          <>
            <span style={{ fontSize: 13, color: T.textMuted }}>No contributions yet</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: T.text2 }}>
              {fmt(goal.target, currency)} target
            </span>
          </>
        ) : (
          <span style={{ fontSize: 13, color: T.textMuted }}>No target set</span>
        )}
      </div>

      {projected && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F0F0F0', fontSize: 12, color: T.text3 }}>
          On track for {projected}
        </div>
      )}
    </button>
  )
}

interface GoalsPageClientProps {
  data: GoalsPageData
}

export default function GoalsPageClient({ data }: GoalsPageClientProps) {
  const router = useRouter()
  const { isDesktop } = useBreakpoint()

  const [celebGoal, setCelebGoal] = useState<GoalId | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [celebSeen, setCelebSeen] = useState<Set<string>>(new Set())

  useEffect(() => {
    for (const goal of data.goalDataList) {
      if (goal.target && goal.totalSaved >= goal.target && !celebSeen.has(goal.id)) {
        setCelebGoal(goal.id)
        setShowConfetti(true)
        setCelebSeen(prev => new Set(prev).add(goal.id))
        break
      }
    }
  }, [celebSeen, data.goalDataList])

  const content = (
    <AppSubpageLayout maxWidth={600}>
      <AppSubpageHeader title="Goals" backHref="/menu" ariaLabel="Back to More" />

      {data.goals.length < 8 && (
        <PrimaryLink
          href={data.goals.length > 0 ? `/goals/new?exclude=${data.goals.join(',')}` : '/goals/new'}
          size="md"
          style={{ marginBottom: 'var(--space-lg)' }}
        >
          Add goal
        </PrimaryLink>
      )}

      {data.goals.length > 0 && (
        <div style={{ fontSize: 14, color: T.text3, marginBottom: 'var(--space-lg)' }}>
          {data.goals.length} goal{data.goals.length !== 1 ? 's' : ''} ·{' '}
          {data.totalSaved > 0
            ? `${fmt(data.totalSaved, data.currency)} saved`
            : data.totalTargets > 0
              ? `${fmt(data.totalTargets, data.currency)} in targets`
              : 'No targets set yet'}
        </div>
      )}

      {data.goalDataList.length === 0 ? (
        <div>
          <p style={{ margin: '0 0 var(--space-xs)', fontSize: 'var(--text-md)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
            Give your money a purpose.
          </p>
          <h2 style={{ margin: '0 0 var(--space-md)', fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.3px' }}>
            What are you saving towards?
          </h2>
          <p style={{ margin: '0 0 var(--space-xl)', fontSize: 'var(--text-base)', color: 'var(--text-2)', lineHeight: 1.65 }}>
            Goals let you set aside money for something specific — a holiday, emergency fund, school fees, or anything else.
            We track your progress every month.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 'var(--space-xxl)' }}>
            {[
              { label: 'Emergency fund' },
              { label: 'Holiday' },
              { label: 'House deposit' },
              { label: 'School fees' },
              { label: 'New car' },
            ].map(example => (
              <div
                key={example.label}
                style={{
                  padding: '6px 12px',
                  background: 'var(--brand)',
                  border: '1px solid var(--brand-mid)',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-2)',
                }}
              >
                <span>{example.label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          {data.goalDataList.map(goal => (
            <GoalCard key={goal.id} goal={goal} currency={data.currency} onTap={() => router.push(`/goals/${goal.id}`)} />
          ))}
        </div>
      )}
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
        <div style={{ minHeight: '100vh', background: 'var(--page-bg)', paddingBottom: 88 }}>
          <main>{content}</main>
          <BottomNav />
        </div>
      )}

      {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}

      {celebGoal && (
        <Sheet open={true} onClose={() => setCelebGoal(null)} title="">
          <CelebrationContent
            goalId={celebGoal}
            saved={data.savedByGoal[celebGoal] ?? 0}
            currency={data.currency}
            onClose={() => setCelebGoal(null)}
          />
        </Sheet>
      )}
    </>
  )
}
