// ─────────────────────────────────────────────────────────────
// /goals — Goal tracker
//
// Shows all user goals with:
//   1. Per-goal cards: saved vs target, progress bar, projected completion
//   2. Edit target / delete goal via sheet
//   3. Add new goal sheet
//   4. Confetti + celebration modal when a goal hits 100%
// ─────────────────────────────────────────────────────────────
'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { Input } from '@/components/ui/Input/Input'
import { PrimaryBtn } from '@/components/ui/Button/Button'
import { GOAL_META, GOAL_OPTIONS } from '@/constants/goals'
import { fmt } from '@/lib/finance'
import type { GoalId } from '@/types/database'

const T = {
  pageBg:       '#F8F9FA',
  white:        '#FFFFFF',
  border:       '#E4E7EC',
  borderStrong: '#D0D5DD',
  text1:        '#101828',
  text2:        '#475467',
  text3:        '#667085',
  textMuted:    '#98A2B3',
  brandDark:    '#5C3489',
}

// ─── Confetti ──────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = [
  '#5C3489', '#EADFF4', '#F4A01C', '#1A7A45',
  '#D93025', '#1E40AF', '#FDE68A', '#A7F3D0',
]

interface ConfettiPiece {
  id:       number
  left:     number
  delay:    number
  duration: number
  color:    string
  size:     number
  isCircle: boolean
}

function Confetti({ onDone }: { onDone: () => void }) {
  const pieces = useMemo<ConfettiPiece[]>(() =>
    Array.from({ length: 70 }, (_, i) => ({
      id:       i,
      left:     Math.random() * 100,
      delay:    Math.random() * 1.8,
      duration: 2.2 + Math.random() * 2,
      color:    CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size:     6 + Math.random() * 7,
      isCircle: Math.random() > 0.4,
    }))
  , [])

  useEffect(() => {
    const t = setTimeout(onDone, 5000)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 300, overflow: 'hidden' }}>
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-20px) rotate(0deg);   opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(108vh) rotate(560deg); opacity: 0; }
        }
      `}</style>
      {pieces.map(p => (
        <div
          key={p.id}
          style={{
            position:   'absolute',
            top:        0,
            left:       `${p.left}%`,
            width:      p.size,
            height:     p.size,
            background: p.color,
            borderRadius: p.isCircle ? '50%' : 2,
            animation:  `confettiFall ${p.duration}s ${p.delay}s ease-in forwards`,
          }}
        />
      ))}
    </div>
  )
}

// ─── Celebration sheet content ────────────────────────────────────────────────

function CelebrationContent({
  goalId, saved, currency, onClose,
}: { goalId: GoalId; saved: number; currency: string; onClose: () => void }) {
  const meta = GOAL_META[goalId]
  return (
    <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
      <div style={{ fontSize: 60, marginBottom: 16, lineHeight: 1 }}>{meta.icon}</div>
      <div style={{
        fontSize: 22, fontWeight: 700, color: '#101828',
        fontFamily: 'var(--font-sans)', marginBottom: 8,
      }}>
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
        fontWeight: 700,
        color: meta.dark,
        fontFamily: 'var(--font-sans)',
      }}>
        {fmt(saved, currency)} saved
      </div>
      <p style={{
        fontSize: 14, color: '#667085',
        lineHeight: 1.6, margin: '0 0 24px',
      }}>
        This is a big deal. You set a goal and you got there.{'\n'}Take a moment to celebrate this.
      </p>
      <button
        onClick={onClose}
        style={{
          width: '100%', padding: '14px',
          background: meta.dark, border: 'none', borderRadius: 14,
          fontSize: 15, fontWeight: 600, color: '#fff',
          cursor: 'pointer', fontFamily: 'var(--font-sans)',
        }}
      >
        Thank you 🎉
      </button>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function projectedLabel(totalSaved: number, target: number | null, monthlyAvg: number): string | null {
  if (!target || target <= 0 || totalSaved >= target) return null
  if (monthlyAvg <= 0) return null
  const months = Math.ceil((target - totalSaved) / monthlyAvg)
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  const label = d.toLocaleString('default', { month: 'short', year: 'numeric' })
  return `~${months} month${months === 1 ? '' : 's'} · ${label}`
}

// ─── Goal card ────────────────────────────────────────────────────────────────

interface GoalData {
  id:         GoalId
  target:     number | null
  totalSaved: number
  monthlyAvg: number
}

function GoalCard({ goal, currency, onTap }: { goal: GoalData; currency: string; onTap: () => void }) {
  const meta     = GOAL_META[goal.id]
  const pct      = goal.target ? Math.min(100, Math.round((goal.totalSaved / goal.target) * 100)) : 0
  const isDone   = goal.target != null && goal.totalSaved >= goal.target
  const projected = projectedLabel(goal.totalSaved, goal.target, goal.monthlyAvg)

  return (
    <button
      onClick={onTap}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        background: T.white,
        border: `1.5px solid ${isDone ? meta.border : T.border}`,
        borderRadius: 16, padding: 16,
        cursor: 'pointer', fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: meta.light,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
          }}>
            {meta.icon}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.text1, lineHeight: 1.3 }}>{meta.label}</div>
            {!goal.target && (
              <div style={{ fontSize: 12, color: T.brandDark, fontWeight: 500, marginTop: 2 }}>Set a target →</div>
            )}
          </div>
        </div>
        {goal.target != null && (
          <div style={{
            fontSize: 12, fontWeight: 600,
            color: isDone ? meta.dark : T.text2,
            background: isDone ? meta.light : '#F1F3F5',
            border: `1px solid ${isDone ? meta.border : T.border}`,
            borderRadius: 20, padding: '3px 10px',
          }}>
            {isDone ? '✓ Done' : `${pct}%`}
          </div>
        )}
      </div>

      {/* Progress bar */}
      {goal.target != null && (
        <div style={{ height: 6, background: '#EBEBF0', borderRadius: 99, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{
            height: '100%', borderRadius: 99,
            width: `${pct}%`,
            background: isDone ? meta.dark : T.brandDark,
            transition: 'width 0.5s ease',
          }} />
        </div>
      )}

      {/* Amounts row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 700, color: T.text1 }}>{fmt(goal.totalSaved, currency)}</div>
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 1 }}>saved</div>
        </div>
        {goal.target != null && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, color: T.text3 }}>{fmt(goal.target, currency)}</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 1 }}>target</div>
          </div>
        )}
      </div>

      {/* Projected completion */}
      {projected && (
        <div style={{
          marginTop: 12, paddingTop: 12,
          borderTop: `1px solid ${T.border}`,
          fontSize: 12, color: T.text3,
        }}>
          On track for {projected}
        </div>
      )}
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GoalsPage() {
  const router        = useRouter()
  const supabase      = createClient()
  const { isDesktop } = useBreakpoint()

  const [loading, setLoading]                 = useState(true)
  const [currency, setCurrency]               = useState('')
  const [goals, setGoals]                     = useState<GoalId[]>([])
  const [targets, setTargets]                 = useState<Record<string, number | null>>({})
  const [savedByGoal, setSavedByGoal]         = useState<Record<string, number>>({})
  const [monthlyAvg, setMonthlyAvg]           = useState<Record<string, number>>({})

  // Celebration
  const [celebGoal, setCelebGoal]             = useState<GoalId | null>(null)
  const [showConfetti, setShowConfetti]       = useState(false)
  const [celebSeen, setCelebSeen]             = useState<Set<string>>(new Set())

  // Edit target sheet
  const [editGoal, setEditGoal]               = useState<GoalId | null>(null)
  const [editAmount, setEditAmount]           = useState('')
  const [editSaving, setEditSaving]           = useState(false)

  // Delete / archive flow
  const [deleteGoal, setDeleteGoal]           = useState<GoalId | null>(null)
  const [deleteStep, setDeleteStep]           = useState<'reason' | 'done' | 'used' | 'leaving'>('reason')

  // ── Load ──────────────────────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [profileRes, targetsRes, txnsRes] = await Promise.all([
        (supabase.from('user_profiles') as any).select('goals, currency').eq('id', user.id).single(),
        (supabase.from('goal_targets') as any).select('goal_id, amount, added_at').eq('user_id', user.id),
        (supabase.from('transactions') as any)
          .select('category_key, amount, month, date')
          .eq('user_id', user.id)
          .eq('category_type', 'goal'),
      ])

      setCurrency(profileRes.data?.currency ?? '')
      setGoals(profileRes.data?.goals ?? [])

      const tMap: Record<string, number | null> = {}
      const addedAtMap: Record<string, string>  = {}
      for (const row of targetsRes.data ?? []) {
        tMap[row.goal_id]      = row.amount
        addedAtMap[row.goal_id] = row.added_at
      }
      setTargets(tMap)

      const savedMap: Record<string, number>                  = {}
      const monthBuckets: Record<string, Record<string, number>> = {}
      for (const t of txnsRes.data ?? []) {
        // Skip transactions from before the current goal instance was added
        const addedAt = addedAtMap[t.category_key]
        if (addedAt && t.date < addedAt.slice(0, 10)) continue
        savedMap[t.category_key] = (savedMap[t.category_key] ?? 0) + Number(t.amount)
        if (!monthBuckets[t.category_key]) monthBuckets[t.category_key] = {}
        monthBuckets[t.category_key][t.month] = (monthBuckets[t.category_key][t.month] ?? 0) + Number(t.amount)
      }
      setSavedByGoal(savedMap)

      const avgMap: Record<string, number> = {}
      for (const [key, months] of Object.entries(monthBuckets)) {
        const vals = Object.values(months)
        avgMap[key] = vals.reduce((s, v) => s + v, 0) / vals.length
      }
      setMonthlyAvg(avgMap)
      setLoading(false)
    })()
  }, [])

  // ── Auto-trigger celebration for completed goals ───────────────
  useEffect(() => {
    if (loading) return
    for (const id of goals) {
      const saved  = savedByGoal[id] ?? 0
      const target = targets[id] ?? null
      if (target && saved >= target && !celebSeen.has(id)) {
        setCelebGoal(id)
        setShowConfetti(true)
        setCelebSeen(prev => new Set(prev).add(id))
        break
      }
    }
  }, [loading, goals, savedByGoal, targets])

  // ── Edit target ───────────────────────────────────────────────
  const openEdit = (id: GoalId) => {
    setEditGoal(id)
    setEditAmount(targets[id] != null ? String(targets[id]) : '')
  }

  const saveTarget = useCallback(async () => {
    if (!editGoal) return
    setEditSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const amount = parseFloat(editAmount) || null
    await (supabase.from('goal_targets') as any).upsert(
      { user_id: user.id, goal_id: editGoal, amount },
      { onConflict: 'user_id,goal_id' }
    )
    setTargets(prev => ({ ...prev, [editGoal]: amount }))
    setEditGoal(null)
    setEditSaving(false)
  }, [editGoal, editAmount, supabase])

  // ── Delete / archive goal ─────────────────────────────────────
  const openDelete = () => {
    if (!editGoal) return
    const id = editGoal
    setEditGoal(null)
    setDeleteStep('reason')
    setDeleteGoal(id)
  }

  // Archive: remove from active goals, keep goal_targets for history,
  // but clear this month's transactions so re-adding starts fresh
  const archiveGoal = useCallback(async () => {
    if (!deleteGoal) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const currentMonth = new Date().toISOString().slice(0, 7)
    const newGoals = goals.filter(g => g !== deleteGoal)
    await Promise.all([
      (supabase.from('user_profiles') as any).update({ goals: newGoals }).eq('id', user.id),
      (supabase.from('transactions') as any).delete()
        .eq('user_id', user.id).eq('month', currentMonth).eq('category_key', deleteGoal),
    ])
    setGoals(newGoals)
    setSavedByGoal(prev => { const n = { ...prev }; delete n[deleteGoal]; return n })
    setDeleteGoal(null)
  }, [deleteGoal, goals, supabase])

  // Hard delete: remove from goals + wipe goal_targets + clear this month's transactions
  const hardDeleteGoal = useCallback(async () => {
    if (!deleteGoal) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const currentMonth = new Date().toISOString().slice(0, 7)
    const newGoals = goals.filter(g => g !== deleteGoal)
    await Promise.all([
      (supabase.from('user_profiles') as any).update({ goals: newGoals }).eq('id', user.id),
      (supabase.from('goal_targets') as any).delete().eq('user_id', user.id).eq('goal_id', deleteGoal),
      (supabase.from('transactions') as any).delete()
        .eq('user_id', user.id).eq('month', currentMonth).eq('category_key', deleteGoal),
    ])
    setGoals(newGoals)
    setTargets(prev => { const n = { ...prev }; delete n[deleteGoal]; return n })
    setSavedByGoal(prev => { const n = { ...prev }; delete n[deleteGoal]; return n })
    setDeleteGoal(null)
  }, [deleteGoal, goals, supabase])

  // ── Derived data ──────────────────────────────────────────────
  const goalDataList: GoalData[] = goals.map(id => ({
    id,
    target:     targets[id] ?? null,
    totalSaved: savedByGoal[id] ?? 0,
    monthlyAvg: monthlyAvg[id] ?? 0,
  }))

  const totalSaved = Object.values(savedByGoal).reduce((s, v) => s + v, 0)

  // ── Content ───────────────────────────────────────────────────
  const pad = isDesktop ? '40px 32px' : '24px 16px'

  const content = (
    <div style={{ padding: pad, maxWidth: 600 }}>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
          color: T.textMuted, textTransform: 'uppercase', marginBottom: 4,
        }}>
          Goals
        </div>
        <h1 style={{
          margin: 0, fontSize: 26, fontWeight: 700,
          color: T.text1, fontFamily: 'var(--font-sans)',
        }}>
          Your goals
        </h1>
        {goals.length > 0 && (
          <div style={{ marginTop: 6, fontSize: 14, color: T.text3 }}>
            {goals.length} goal{goals.length !== 1 ? 's' : ''} · {fmt(totalSaved, currency)} saved total
          </div>
        )}
      </div>

      {/* Goal cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: T.textMuted, fontSize: 14 }}>Loading…</div>
      ) : goalDataList.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 24px',
          background: T.white, border: `1.5px solid ${T.border}`,
          borderRadius: 16, marginBottom: 16,
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🎯</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.text1, marginBottom: 6 }}>No goals yet</div>
          <div style={{ fontSize: 14, color: T.text3, marginBottom: 24 }}>Add a goal to start tracking what you're saving towards.</div>
          <button
            onClick={() => router.push(`/goals/new`)}
            style={{
              width: '100%', height: 52, borderRadius: 14,
              background: T.brandDark, border: 'none', cursor: 'pointer',
              fontSize: 15, fontWeight: 700, color: '#fff',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Add a goal
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          {goalDataList.map(g => (
            <GoalCard key={g.id} goal={g} currency={currency} onTap={() => openEdit(g.id)} />
          ))}
        </div>
      )}

      {/* Add goal button — only shown when goals already exist */}
      {!loading && goalDataList.length > 0 && goals.length < 8 && (
        <button
          onClick={() => router.push(`/goals/new?exclude=${goals.join(',')}`)}
          style={{
            width: '100%', padding: '14px', borderRadius: 14,
            border: `1.5px dashed ${T.borderStrong}`,
            background: 'transparent', cursor: 'pointer',
            fontSize: 14, fontWeight: 600, color: T.brandDark,
            fontFamily: 'var(--font-sans)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Add a goal
        </button>
      )}
    </div>
  )

  // ── Layout ────────────────────────────────────────────────────
  return (
    <>
      {isDesktop ? (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--page-bg)' }}>
          <SideNav />
          <main style={{ flex: 1 }}>{content}</main>
        </div>
      ) : (
        <div style={{ minHeight: '100vh', background: 'var(--page-bg)', paddingBottom: 72 }}>
          <main>{content}</main>
          <BottomNav />
        </div>
      )}

      {/* Confetti */}
      {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}

      {/* Celebration modal */}
      {celebGoal && (
        <Sheet open={true} onClose={() => setCelebGoal(null)} title="">
          <CelebrationContent
            goalId={celebGoal}
            saved={savedByGoal[celebGoal] ?? 0}
            currency={currency}
            onClose={() => setCelebGoal(null)}
          />
        </Sheet>
      )}

      {/* Edit target sheet */}
      {editGoal && (
        <Sheet
          open={true}
          onClose={() => setEditGoal(null)}
          title={`${GOAL_META[editGoal].icon}  ${GOAL_META[editGoal].label}`}
        >
          <p style={{ fontSize: 13, color: T.text3, margin: '0 0 20px', lineHeight: 1.5 }}>
            {GOAL_META[editGoal].tip}
          </p>
          <Input
            label="Target amount"
            value={editAmount}
            onChange={val => setEditAmount(val)}
            prefix={currency}
            placeholder="e.g. 500,000"
            type="number"
          />
          <div style={{ height: 12 }} />
          <PrimaryBtn onClick={saveTarget} disabled={editSaving}>
            {editSaving ? 'Saving…' : 'Save target'}
          </PrimaryBtn>
          <button
            onClick={openDelete}
            style={{
              marginTop: 12, width: '100%', padding: '12px',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, color: T.textMuted, fontFamily: 'var(--font-sans)',
            }}
          >
            Remove this goal
          </button>
        </Sheet>
      )}

      {/* Delete — "What happened?" sheet */}
      {deleteGoal && (
        <Sheet
          open={true}
          onClose={() => setDeleteGoal(null)}
          title={deleteStep === 'reason' ? 'What happened?' : ''}
        >
          {deleteStep === 'reason' && (() => {
            const meta = GOAL_META[deleteGoal]
            return (
              <div>
                <p style={{ fontSize: 14, color: T.text2, margin: '0 0 20px', lineHeight: 1.6 }}>
                  You're removing <strong>{meta.label}</strong>. Help us understand why. We'll handle it the right way.
                </p>
                {[
                  { label: '🎉 I reached this goal', sub: 'Celebrate and keep the history', step: 'done' as const },
                  { label: '💸 I used the money on something else', sub: 'Acknowledge and archive', step: 'used' as const },
                  { label: '🔄 I changed my mind', sub: 'Remove it cleanly', step: 'leaving' as const },
                ].map(opt => (
                  <button
                    key={opt.step}
                    onClick={() => setDeleteStep(opt.step)}
                    style={{
                      width: '100%', textAlign: 'left', padding: '14px 16px',
                      background: T.white, border: `1.5px solid ${T.border}`,
                      borderRadius: 14, cursor: 'pointer',
                      fontFamily: 'var(--font-sans)', marginBottom: 10,
                      display: 'block',
                    }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 600, color: T.text1 }}>{opt.label}</div>
                    <div style={{ fontSize: 12, color: T.text3, marginTop: 3 }}>{opt.sub}</div>
                  </button>
                ))}
                <button
                  onClick={() => setDeleteGoal(null)}
                  style={{
                    marginTop: 4, width: '100%', padding: '12px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 14, color: T.textMuted, fontFamily: 'var(--font-sans)',
                  }}
                >
                  Cancel
                </button>
              </div>
            )
          })()}

          {deleteStep === 'done' && deleteGoal && (() => {
            const meta = GOAL_META[deleteGoal]
            return (
              <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
                <div style={{ fontSize: 56, marginBottom: 12, lineHeight: 1 }}>🏆</div>
                <div style={{ fontSize: 21, fontWeight: 700, color: T.text1, marginBottom: 8 }}>
                  You actually did it.
                </div>
                <div style={{
                  display: 'inline-block', margin: '0 0 16px',
                  background: meta.light, border: `1px solid ${meta.border}`,
                  borderRadius: 10, padding: '6px 18px',
                  fontSize: 15, fontWeight: 600, color: meta.dark,
                  fontFamily: 'var(--font-sans)',
                }}>
                  {meta.label} ✓
                </div>
                <p style={{ fontSize: 14, color: T.text2, lineHeight: 1.6, margin: '0 0 24px' }}>
                  We'll keep your savings history so you can look back on this.
                  Genuinely well done.
                </p>
                <button
                  onClick={archiveGoal}
                  style={{
                    width: '100%', padding: '14px', borderRadius: 14,
                    background: meta.dark, border: 'none', cursor: 'pointer',
                    fontSize: 15, fontWeight: 600, color: '#fff',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  Archive this goal 🎉
                </button>
              </div>
            )
          })()}

          {deleteStep === 'used' && deleteGoal && (() => {
            const meta = GOAL_META[deleteGoal]
            const isEmergency = deleteGoal === 'emergency_fund'
            return (
              <div style={{ padding: '4px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12, lineHeight: 1 }}>💛</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: T.text1, marginBottom: 10 }}>
                  Life happens.
                </div>
                <p style={{ fontSize: 14, color: T.text2, lineHeight: 1.6, margin: '0 0 16px' }}>
                  You saved for <strong>{meta.label}</strong> and you needed to use it. That's exactly what savings are for.
                </p>
                {isEmergency && (
                  <div style={{
                    background: '#FFFBEA', border: '1px solid #FDE68A',
                    borderRadius: 12, padding: '12px 14px', marginBottom: 16,
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
                  onClick={archiveGoal}
                  style={{
                    width: '100%', padding: '14px', borderRadius: 14,
                    background: T.brandDark, border: 'none', cursor: 'pointer',
                    fontSize: 15, fontWeight: 600, color: '#fff',
                    fontFamily: 'var(--font-sans)',
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
              <div style={{ fontSize: 20, fontWeight: 700, color: T.text1, marginBottom: 10 }}>
                No worries.
              </div>
              <p style={{ fontSize: 14, color: T.text2, lineHeight: 1.6, margin: '0 0 24px' }}>
                Goals change. We'll remove <strong>{GOAL_META[deleteGoal].label}</strong> and clear the target you set.
                Any transactions you logged will still show in history.
              </p>
              <button
                onClick={hardDeleteGoal}
                style={{
                  width: '100%', padding: '14px', borderRadius: 14,
                  background: '#D93025', border: 'none', cursor: 'pointer',
                  fontSize: 15, fontWeight: 600, color: '#fff',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Yes, remove it
              </button>
              <button
                onClick={() => setDeleteStep('reason')}
                style={{
                  marginTop: 10, width: '100%', padding: '12px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 14, color: T.text3, fontFamily: 'var(--font-sans)',
                }}
              >
                Go back
              </button>
            </div>
          )}
        </Sheet>
      )}

    </>
  )
}
