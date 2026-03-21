'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/context/UserContext'
import { useToast } from '@/lib/context/ToastContext'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { Input } from '@/components/ui/Input/Input'
import { IconBack } from '@/components/ui/Icons'
import { GOAL_META, GOAL_OPTIONS } from '@/constants/goals'
import { fmt } from '@/lib/finance'
import type { GoalId } from '@/types/database'

const T = {
  pageBg: '#F8F9FA',
  white: '#FFFFFF',
  border: '#E4E7EC',
  borderStrong: '#D0D5DD',
  text1: '#101828',
  text2: '#475467',
  text3: '#667085',
  textMuted: '#98A2B3',
  brandDark: '#5C3489',
}

const TIMELINE_OPTIONS = [
  { months: 6, label: '6 months' },
  { months: 12, label: '1 year' },
  { months: 24, label: '2 years' },
  { months: 36, label: '3 years' },
]

function feasibility(pct: number) {
  if (pct === 0) return { label: '', color: T.textMuted, bg: '#F1F3F5' }
  if (pct <= 30) return { label: 'Achievable', color: '#1A7A45', bg: '#F0FDF4' }
  if (pct <= 45) return { label: 'Ambitious', color: '#D97706', bg: '#FFFBEB' }
  return { label: 'Stretch goal', color: '#D93025', bg: '#FEF2F2' }
}

function NewGoalInner() {
  const router = useRouter()
  const supabase = createClient()
  const { user, profile: ctxProfile } = useUser()
  const { isDesktop } = useBreakpoint()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const typeParam = searchParams.get('type') as GoalId | null

  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState('')
  const [existingGoals, setExistingGoals] = useState<GoalId[]>([])

  const [selectedGoal, setSelectedGoal] = useState<GoalId | null>(typeParam)
  const [targetAmount, setTargetAmount] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    setCurrency(ctxProfile?.currency ?? '')
    setExistingGoals(ctxProfile?.goals ?? [])
    setLoading(false)
  }, [user, ctxProfile])

  const target = parseFloat(targetAmount) || 0
  const signal = feasibility(target)

  const handleSave = async () => {
    if (!selectedGoal || target <= 0 || !user) return
    setSaving(true)

    await Promise.all([
      supabase.from('user_profiles').update({
        goals: [...existingGoals, selectedGoal],
      }).eq('id', user.id),

      supabase.from('goal_targets').upsert({
        user_id: user.id,
        goal_id: selectedGoal,
        amount: target,
      }),
    ])

    toast('Goal added')
    router.push('/goals')
  }

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>

  return (
    <div style={{ padding: 20 }}>
      <h1>Add goal</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {GOAL_OPTIONS.map(g => (
          <button
            key={g.id}
            onClick={() => setSelectedGoal(g.id)}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        <Input
          label="Target amount"
          value={targetAmount}
          onChange={setTargetAmount}
          prefix={currency}
        />
      </div>

      {target > 0 && (
        <div style={{ marginTop: 10 }}>
          {signal.label}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving || target <= 0}
        style={{ marginTop: 20 }}
      >
        {saving ? 'Saving…' : 'Add goal'}
      </button>
    </div>
  )
}

export default function NewGoalClient() {
  return (
    <Suspense>
      <NewGoalInner />
    </Suspense>
  )
}