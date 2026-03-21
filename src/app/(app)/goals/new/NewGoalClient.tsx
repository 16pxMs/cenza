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

const TIMELINE_OPTIONS = [
  { months: 6,  label: '6 months' },
  { months: 12, label: '1 year'   },
  { months: 24, label: '2 years'  },
  { months: 36, label: '3 years'  },
]

function feasibility(pct: number): { label: string; color: string; bg: string } {
  if (pct === 0)  return { label: '',                color: T.textMuted, bg: '#F1F3F5' }
  if (pct <= 15)  return { label: 'Very achievable', color: '#1A7A45',   bg: '#F0FDF4' }
  if (pct <= 30)  return { label: 'Achievable',      color: '#1A7A45',   bg: '#F0FDF4' }
  if (pct <= 45)  return { label: 'Ambitious',       color: '#D97706',   bg: '#FFFBEB' }
  return                  { label: 'Stretch goal',   color: '#D93025',   bg: '#FEF2F2' }
}

function NewGoalInner() {
  const router        = useRouter()
  const supabase      = createClient()
  const { user, profile: ctxProfile } = useUser()
  const { isDesktop } = useBreakpoint()
  const searchParams  = useSearchParams()
  const { toast }     = useToast()

  const typeParam    = searchParams.get('type') as GoalId | null
  const excludeParam = (searchParams.get('exclude') ?? '').split(',').filter(Boolean)
  const fromParam    = searchParams.get('from')

  const [loading, setLoading]               = useState(true)
  const [currency, setCurrency]             = useState('')
  const [totalIncome, setTotalIncome]       = useState(0)
  const [fixedMonthly, setFixedMonthly]     = useState(0)
  const [existingGoals, setExistingGoals]   = useState<GoalId[]>([])
  const [alreadySaved, setAlreadySaved]     = useState(0)

  type Step = 'pick' | 'name' | 'destination' | 'target'
  const initialStep: Step = typeParam
    ? typeParam === 'other' ? 'name' : typeParam === 'travel' ? 'destination' : 'target'
    : 'pick'

  const [step, setStep]                     = useState<Step>(initialStep)
  const [selectedGoal, setSelectedGoal]     = useState<GoalId | null>(typeParam)
  const [customName, setCustomName]         = useState('')
  const [destination, setDestination]       = useState('')
  const [targetAmount, setTargetAmount]     = useState('')
  const [selectedMonths, setSelectedMonths] = useState(12)
  const [saving, setSaving]                 = useState(false)

  const currentMonth = new Date().toISOString().slice(0, 7)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const fetchSaved = typeParam
        ? (supabase.from('transactions') as any)
            .select('amount')
            .eq('user_id', user.id)
            .eq('category_type', 'goal')
            .eq('category_key', typeParam)
        : Promise.resolve({ data: [] })

      const [incomeRes, expensesRes, savedRes] = await Promise.all([
        (supabase.from('income_entries') as any).select('total').eq('user_id', user.id).eq('month', currentMonth).maybeSingle(),
        (supabase.from('fixed_expenses') as any).select('total_monthly').eq('user_id', user.id).eq('month', currentMonth).maybeSingle(),
        fetchSaved,
      ])

      setCurrency(ctxProfile?.currency ?? '')
      setExistingGoals(ctxProfile?.goals ?? [])
      setTotalIncome(Number(incomeRes.data?.total ?? 0))
      setFixedMonthly(Number(expensesRes.data?.total_monthly ?? 0))
      setAlreadySaved((savedRes.data ?? []).reduce((s: number, t: any) => s + Number(t.amount), 0))
      setLoading(false)
    })()
  }, [user, ctxProfile])

  const target          = parseFloat(targetAmount) || 0
  const remaining       = Math.max(0, target - alreadySaved)
  const monthlyRequired = selectedMonths > 0 && remaining > 0 ? Math.ceil(remaining / selectedMonths) : 0
  const incomePercent   = totalIncome > 0 && monthlyRequired > 0 ? (monthlyRequired / totalIncome) * 100 : 0
  const signal          = feasibility(incomePercent)

  const availableGoals = GOAL_OPTIONS.filter(g =>
    !existingGoals.includes(g.id) && !excludeParam.includes(g.id)
  )

  const benchmarkTip = (() => {
    if (!selectedGoal) return null
    if (selectedGoal === 'emergency' && fixedMonthly > 0) {
      const min = fixedMonthly * 3
      const max = fixedMonthly * 6
      return `A healthy emergency fund covers 3 to 6 months of expenses. Based on your fixed costs, that's ${fmt(min, currency)} to ${fmt(max, currency)}.`
    }
    if (selectedGoal === 'home')      return 'A home deposit is usually 10 to 20% of the property value. Start with a number that feels real, not perfect.'
    if (selectedGoal === 'travel')    return destination.trim()
      ? `Even a rough number works for ${destination.trim()}. You can always adjust as the trip gets closer.`
      : 'Even a rough number helps. You can always adjust as the trip gets closer.'
    if (selectedGoal === 'education') return 'Start with the first year or semester fee — that makes the goal feel closer and more actionable.'
    if (selectedGoal === 'car')       return 'Consider the full cost: purchase price, insurance, and initial running costs.'
    return null
  })()

  const goBack = () => {
    if (step === 'target' && selectedGoal === 'other')  { setStep('name'); return }
    if (step === 'target' && selectedGoal === 'travel') { setStep('destination'); return }
    if (step === 'target' || step === 'name' || step === 'destination') {
      setStep('pick'); setSelectedGoal(null); setTargetAmount(''); setDestination(''); return
    }
    router.push(fromParam === 'overview' ? '/app' : '/goals')
  }

  const selectGoal = (id: GoalId) => {
    setSelectedGoal(id)
    setTargetAmount('')
    setDestination('')
    if (id === 'other')  { setStep('name');        return }
    if (id === 'travel') { setStep('destination'); return }
    setStep('target')
  }

  const handleSave = async (withTarget = true) => {
    if (!selectedGoal) return
    if (withTarget && target <= 0) return
    setSaving(true)
    if (!user) return

    const userId = user.id
    const isReAdding = !existingGoals.includes(selectedGoal)
    const newGoals   = isReAdding ? [...existingGoals, selectedGoal] : existingGoals

    const customLabel = selectedGoal === 'other' && customName.trim()
      ? customName.trim()
      : selectedGoal === 'travel' && destination.trim()
      ? destination.trim()
      : null

    const upsertPayload: Record<string, unknown> = {
      user_id: userId,
      goal_id: selectedGoal,
      destination: customLabel,
      added_at: new Date().toISOString(),
    }
    if (withTarget && target > 0) upsertPayload.amount = target

    const ops: Promise<unknown>[] = [
      (supabase.from('user_profiles') as any).update({ goals: newGoals }).eq('id', userId),
      (supabase.from('goal_targets') as any).upsert(upsertPayload, { onConflict: 'user_id,goal_id' }),
    ]

    if (isReAdding) {
      ops.push(
        (supabase.from('transactions') as any).delete()
          .eq('user_id', userId)
          .eq('month', currentMonth)
          .eq('category_key', selectedGoal)
      )
    }

    await Promise.all(ops)
    toast('Goal added')
    router.push('/goals')
  }

  const meta = selectedGoal ? GOAL_META[selectedGoal] : null

  const header = (
    <div style={{ padding: isDesktop ? '32px 32px 20px' : '20px 16px 16px' }}>
      <button
        onClick={goBack}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 12px', display: 'flex', alignItems: 'center' }}
      >
        <IconBack size={18} color={T.text3} />
      </button>
      <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {step === 'pick' ? 'New goal' : step === 'name' ? 'Name your goal' : step === 'destination' ? 'Where to?' : 'Set a target'}
      </p>
      <h1 style={{ fontSize: isDesktop ? 26 : 22, color: T.text1, margin: 0 }}>
        {step === 'pick'
          ? 'What are you saving for?'
          : step === 'name'
          ? 'What would you call this goal?'
          : step === 'destination'
          ? (destination.trim() ? `Travel to ${destination.trim()}` : 'Where to?')
          : meta
            ? `${meta.icon}  ${customName.trim() || (selectedGoal === 'travel' && destination.trim() ? `Travel to ${destination.trim()}` : meta.label)}`
            : 'Set a target'}
      </h1>
    </div>
  )

  const step1 = (
    <div style={{ padding: isDesktop ? '0 32px' : '0 16px' }}>
      {availableGoals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: T.text3, fontSize: 14 }}>
          You've added all available goal types.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {availableGoals.map(g => (
            <button
              key={g.id}
              onClick={() => selectGoal(g.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '16px', borderRadius: 14,
                border: `1px solid var(--border)`,
                background: T.white,
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{
                width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                background: g.light,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22,
              }}>
                {g.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: T.text1, marginBottom: 2 }}>{g.label}</div>
                <div style={{ fontSize: 13, color: T.text3, lineHeight: 1.4 }}>{g.description}</div>
              </div>
              <div style={{ color: T.textMuted, fontSize: 18, flexShrink: 0 }}>›</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )

  const stepDestination = (
    <div style={{ padding: isDesktop ? '0 32px' : '0 16px' }}>
      <p style={{ margin: '0 0 20px', fontSize: 14, color: T.text3, lineHeight: 1.5 }}>
        Where do you want to go? Even a rough idea helps make the goal feel real.
      </p>
      <input
        autoFocus
        type="text"
        value={destination}
        onChange={e => setDestination(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && destination.trim()) setStep('target') }}
        placeholder="e.g. Zanzibar, Amsterdam, Japan"
        style={{
          width: '100%', height: 52, borderRadius: 12,
          border: destination.trim() ? `2px solid var(--border-focus)` : `1px solid var(--border)`,
          padding: '0 16px', fontSize: 16, color: T.text1,
          background: T.white, outline: 'none', boxSizing: 'border-box',
          transition: 'border-color 0.15s',
        }}
      />
      <div style={{ height: 16 }} />
      <button
        onClick={() => setStep('target')}
        disabled={destination.trim().length === 0}
        style={{
          width: '100%', height: 52, borderRadius: 14,
          background: destination.trim() ? T.brandDark : T.border,
          border: 'none', color: destination.trim() ? '#fff' : T.textMuted,
          fontSize: 15, fontWeight: 600,
          cursor: destination.trim() ? 'pointer' : 'not-allowed', transition: 'background 0.15s',
        }}
      >
        Continue
      </button>
      <button
        onClick={() => setStep('target')}
        style={{
          marginTop: 10, width: '100%', padding: '12px',
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 13, color: T.textMuted, fontStyle: 'italic',
        }}
      >
        Skip for now
      </button>
    </div>
  )

  const step2 = (
    <div style={{ padding: isDesktop ? '0 32px' : '0 16px' }}>
      <p style={{ margin: '0 0 20px', fontSize: 14, color: T.text3, lineHeight: 1.5 }}>
        Give it a name that means something to you — you can always change it later.
      </p>
      <Input
        label="Goal name"
        value={customName}
        onChange={val => setCustomName(val)}
        placeholder="e.g. New laptop, Wedding fund, Gap year"
      />
      <div style={{ height: 16 }} />
      <button
        onClick={() => setStep('target')}
        disabled={customName.trim().length === 0}
        style={{
          width: '100%', height: 52, borderRadius: 14,
          background: customName.trim() ? T.brandDark : T.border,
          border: 'none', color: customName.trim() ? '#fff' : T.textMuted,
          fontSize: 15, fontWeight: 600,
          cursor: customName.trim() ? 'pointer' : 'not-allowed',
          transition: 'background 0.15s',
        }}
      >
        Continue
      </button>
    </div>
  )

  const emergencySuggestions = selectedGoal === 'emergency' && fixedMonthly > 0
    ? [
        { label: '3 months', amount: Math.round(fixedMonthly * 3) },
        { label: '6 months', amount: Math.round(fixedMonthly * 6) },
      ]
    : []

  const step3 = (
    <div style={{ padding: isDesktop ? '0 32px' : '0 16px' }}>
      {selectedGoal === 'emergency' && (
        <div style={{
          marginBottom: 24, padding: '16px',
          background: '#F5F0FA', border: '1px solid #E4D9F4', borderRadius: 16,
        }}>
          <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: T.brandDark }}>
            What is an emergency fund?
          </p>
          <p style={{ margin: 0, fontSize: 13, color: T.text2, lineHeight: 1.65 }}>
            It's money set aside only for genuine emergencies — job loss, a medical bill, an unexpected repair.
            It sits completely separately from your savings and is never touched for planned purchases.
          </p>
        </div>
      )}

      {emergencySuggestions.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: T.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Suggested targets
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            {emergencySuggestions.map(s => {
              const active = parseFloat(targetAmount) === s.amount
              return (
                <button
                  key={s.label}
                  onClick={() => setTargetAmount(String(s.amount))}
                  style={{
                    flex: 1, padding: '12px 10px', borderRadius: 14,
                    border: active ? `1.5px solid ${T.brandDark}` : '1px solid var(--border)',
                    background: active ? '#F0E9FA' : T.white,
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.brandDark, marginBottom: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.text1 }}>{fmt(s.amount, currency)}</div>
                  <div style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>of fixed expenses</div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <Input
        label="Target amount"
        value={targetAmount}
        onChange={val => setTargetAmount(val)}
        prefix={currency}
        placeholder="e.g. 500,000"
        type="number"
      />

      {alreadySaved > 0 && (
        <div style={{
          marginTop: 10, padding: '10px 14px', borderRadius: 10,
          background: '#F0FDF4', border: '1px solid #BBF7D0',
          fontSize: 13, color: '#1A7A45',
        }}>
          You've already saved {fmt(alreadySaved, currency)} toward this goal.
        </div>
      )}

      {benchmarkTip && selectedGoal !== 'emergency' && (
        <p style={{ margin: '10px 0 0', fontSize: 13, color: T.text3, lineHeight: 1.6, fontStyle: 'italic' }}>
          {benchmarkTip}
        </p>
      )}

      {target > 0 && (
        <div style={{ marginTop: 24 }}>
          <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: T.text2 }}>
            How fast do you want to get there?
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {TIMELINE_OPTIONS.map(opt => {
              const active = selectedMonths === opt.months
              return (
                <button
                  key={opt.months}
                  onClick={() => setSelectedMonths(opt.months)}
                  style={{
                    flex: 1, padding: '9px 0', borderRadius: 99,
                    border: active ? `2px solid var(--border-focus)` : `1px solid var(--border-strong)`,
                    background: active ? T.brandDark : T.white,
                    color: active ? '#fff' : T.text2,
                    fontSize: 12, fontWeight: active ? 600 : 400,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>

          {monthlyRequired > 0 && (
            <div style={{
              padding: '16px', borderRadius: 14,
              background: signal.bg, border: `1px solid ${signal.color}22`,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 22, fontWeight: 600, color: T.text1 }}>{fmt(monthlyRequired, currency)}</span>
                <span style={{ fontSize: 13, color: T.text3 }}>/ month</span>
              </div>
              {totalIncome > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: T.text3 }}>
                    That's {incomePercent.toFixed(0)}% of your income
                  </span>
                  {signal.label && (
                    <span style={{
                      fontSize: 12, fontWeight: 600, color: signal.color,
                      background: `${signal.color}18`, borderRadius: 20, padding: '2px 10px',
                    }}>
                      {signal.label}
                    </span>
                  )}
                </div>
              ) : (
                <span style={{ fontSize: 13, color: T.text3 }}>
                  To reach your target in {selectedMonths < 12 ? `${selectedMonths} months` : selectedMonths === 12 ? '1 year' : `${selectedMonths / 12} years`}
                </span>
              )}
              {incomePercent > 45 && totalIncome > 0 && (
                <p style={{ margin: '10px 0 0', fontSize: 12.5, color: T.text2, lineHeight: 1.5, paddingTop: 10, borderTop: `1px solid var(--border-subtle)` }}>
                  That's a significant portion of your income. Consider a longer timeline. Even small, consistent amounts add up.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 28 }}>
        <button
          onClick={() => handleSave()}
          disabled={target <= 0 || saving}
          style={{
            width: '100%', height: 56, borderRadius: 16,
            background: target > 0 ? T.brandDark : T.border,
            border: 'none', color: target > 0 ? '#fff' : T.textMuted,
            fontSize: 16, fontWeight: 600, letterSpacing: -0.1,
            cursor: target > 0 ? 'pointer' : 'not-allowed', transition: 'background 0.15s',
          }}
        >
          {saving ? 'Saving…' : 'Add to my plan'}
        </button>
        <button
          onClick={() => handleSave(false)}
          disabled={saving}
          style={{
            marginTop: 12, width: '100%', padding: '12px',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 14, color: T.textMuted,
          }}
        >
          I'll set a target later
        </button>
      </div>
    </div>
  )

  const content = (
    <div style={{ paddingBottom: isDesktop ? 60 : 100 }}>
      {header}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: T.textMuted, fontSize: 14 }}>Loading…</div>
      ) : step === 'pick' ? step1 : step === 'destination' ? stepDestination : step === 'name' ? step2 : step3}
    </div>
  )

  return isDesktop ? (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <SideNav />
      <main style={{ flex: 1, maxWidth: 600, margin: '0 auto' }}>{content}</main>
    </div>
  ) : (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', paddingBottom: 88 }}>
      <main>{content}</main>
      <BottomNav />
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
