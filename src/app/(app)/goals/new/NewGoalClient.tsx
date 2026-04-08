'use client'

import { useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/lib/context/ToastContext'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { SetupFlowPage } from '@/components/layout/SetupFlowPage/SetupFlowPage'
import { Input } from '@/components/ui/Input/Input'
import { GOAL_META, GOAL_OPTIONS } from '@/constants/goals'
import { fmt } from '@/lib/finance'
import type { GoalId } from '@/types/database'
import type { NewGoalPageData } from '@/lib/loaders/new-goal'
import { saveNewGoal } from './actions'

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

interface NewGoalClientProps {
  data: NewGoalPageData
  initialGoalType: GoalId | null
  excludeGoalIds: GoalId[]
  from: string | null
}

function feasibility(pct: number): { label: string; color: string; bg: string } {
  if (pct === 0) return { label: '', color: T.textMuted, bg: '#F1F3F5' }
  if (pct <= 15) return { label: 'Very achievable', color: '#1A7A45', bg: '#F0FDF4' }
  if (pct <= 30) return { label: 'Achievable', color: '#1A7A45', bg: '#F0FDF4' }
  if (pct <= 45) return { label: 'Ambitious', color: '#D97706', bg: '#FFFBEB' }
  return { label: 'Stretch goal', color: '#D93025', bg: '#FEF2F2' }
}

function NewGoalInner({ data, initialGoalType, excludeGoalIds, from }: NewGoalClientProps) {
  const router = useRouter()
  const { isDesktop } = useBreakpoint()
  const { toast } = useToast()

  type Step = 'pick' | 'name' | 'destination' | 'target'
  const initialStep: Step = initialGoalType
    ? initialGoalType === 'other'
      ? 'name'
      : initialGoalType === 'travel'
        ? 'destination'
        : 'target'
    : 'pick'

  const [step, setStep] = useState<Step>(initialStep)
  const [selectedGoal, setSelectedGoal] = useState<GoalId | null>(initialGoalType)
  const [customName, setCustomName] = useState('')
  const [destination, setDestination] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [selectedMonths, setSelectedMonths] = useState(12)
  const [saving, setSaving] = useState(false)

  const target = parseFloat(targetAmount) || 0
  const remaining = Math.max(0, target - data.alreadySaved)
  const monthlyRequired = selectedMonths > 0 && remaining > 0 ? Math.ceil(remaining / selectedMonths) : 0
  const incomePercent = data.totalIncome > 0 && monthlyRequired > 0 ? (monthlyRequired / data.totalIncome) * 100 : 0
  const signal = feasibility(incomePercent)

  const availableGoals = GOAL_OPTIONS.filter(goal =>
    !data.existingGoals.includes(goal.id) && !excludeGoalIds.includes(goal.id)
  )

  const benchmarkTip = (() => {
    if (!selectedGoal) return null
    if (selectedGoal === 'emergency' && data.fixedMonthly > 0) {
      const min = data.fixedMonthly * 3
      const max = data.fixedMonthly * 6
      return `A healthy emergency fund covers 3 to 6 months of expenses. Based on your fixed costs, that's ${fmt(min, data.currency)} to ${fmt(max, data.currency)}.`
    }
    if (selectedGoal === 'home') return 'A home deposit is usually 10 to 20% of the property value. Start with a number that feels real, not perfect.'
    if (selectedGoal === 'travel') {
      return destination.trim()
        ? `Even a rough number works for ${destination.trim()}. You can always adjust as the trip gets closer.`
        : 'Even a rough number helps. You can always adjust as the trip gets closer.'
    }
    if (selectedGoal === 'education') return 'Start with the first year or semester fee — that makes the goal feel closer and more actionable.'
    if (selectedGoal === 'car') return 'Consider the full cost: purchase price, insurance, and initial running costs.'
    return null
  })()

  const goBack = () => {
    if (step === 'target' && selectedGoal === 'other') {
      setStep('name')
      return
    }

    if (step === 'target' && selectedGoal === 'travel') {
      setStep('destination')
      return
    }

    if (step === 'target' || step === 'name' || step === 'destination') {
      setStep('pick')
      setSelectedGoal(null)
      setTargetAmount('')
      setDestination('')
      return
    }

    router.push(from === 'overview' ? '/app' : '/goals')
  }

  const selectGoal = (goalId: GoalId) => {
    setSelectedGoal(goalId)
    setTargetAmount('')
    setDestination('')

    if (goalId === 'other') {
      setStep('name')
      return
    }

    if (goalId === 'travel') {
      setStep('destination')
      return
    }

    setStep('target')
  }

  const handleSave = async (withTarget = true) => {
    if (!selectedGoal) return
    if (withTarget && target <= 0) return

    setSaving(true)

    const customLabel = selectedGoal === 'other' && customName.trim()
      ? customName.trim()
      : selectedGoal === 'travel' && destination.trim()
        ? destination.trim()
        : null

    try {
      await saveNewGoal({
        goalId: selectedGoal,
        targetAmount: withTarget && target > 0 ? target : null,
        destination: customLabel,
      })

      toast('Goal added')
      router.push(from === 'overview' ? '/app' : '/goals')
    } catch {
      setSaving(false)
      toast('Failed to save goal. Please try again.')
    }
  }

  const pageKey =
    step === 'pick'
      ? 'goal_pick'
      : step === 'name'
        ? 'goal_name'
        : step === 'destination'
          ? 'goal_destination'
          : 'goal_target'

  const step1 = (
    <div>
      {availableGoals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: T.text3, fontSize: 14 }}>
          You've added all available goal types.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {availableGoals.map(goal => (
            <button
              key={goal.id}
              onClick={() => selectGoal(goal.id)}
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
                background: goal.light,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22,
              }}>
                {goal.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: T.text1, marginBottom: 2 }}>{goal.label}</div>
                <div style={{ fontSize: 13, color: T.text3, lineHeight: 1.4 }}>{goal.description}</div>
              </div>
              <div style={{ color: T.textMuted, fontSize: 18, flexShrink: 0 }}>›</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )

  const stepDestination = (
    <div>
      <p style={{ margin: '0 0 20px', fontSize: 14, color: T.text3, lineHeight: 1.5 }}>
        Where do you want to go? Even a rough idea helps make the goal feel real.
      </p>
      <input
        autoFocus
        type="text"
        value={destination}
        onChange={event => setDestination(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter' && destination.trim()) setStep('target') }}
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
    <div>
      <p style={{ margin: '0 0 20px', fontSize: 14, color: T.text3, lineHeight: 1.5 }}>
        Give it a name that means something to you — you can always change it later.
      </p>
      <Input
        label="Goal name"
        value={customName}
        onChange={value => setCustomName(value)}
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

  const emergencySuggestions = selectedGoal === 'emergency' && data.fixedMonthly > 0
    ? [
        { label: '3 months', amount: Math.round(data.fixedMonthly * 3) },
        { label: '6 months', amount: Math.round(data.fixedMonthly * 6) },
      ]
    : []

  const step3 = (
    <div>
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
            {emergencySuggestions.map(suggestion => {
              const active = parseFloat(targetAmount) === suggestion.amount
              return (
                <button
                  key={suggestion.label}
                  onClick={() => setTargetAmount(String(suggestion.amount))}
                  style={{
                    flex: 1, padding: '12px 10px', borderRadius: 14,
                    border: active ? `1.5px solid ${T.brandDark}` : '1px solid var(--border)',
                    background: active ? '#F0E9FA' : T.white,
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.brandDark, marginBottom: 2 }}>{suggestion.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.text1 }}>{fmt(suggestion.amount, data.currency)}</div>
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
        onChange={value => setTargetAmount(value)}
        prefix={data.currency}
        placeholder="e.g. 500,000"
        type="number"
      />

      {data.alreadySaved > 0 && (
        <div style={{
          marginTop: 10, padding: '10px 14px', borderRadius: 10,
          background: '#F0FDF4', border: '1px solid #BBF7D0',
          fontSize: 13, color: '#1A7A45',
        }}>
          You've already saved {fmt(data.alreadySaved, data.currency)} toward this goal.
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
            {TIMELINE_OPTIONS.map(option => {
              const active = selectedMonths === option.months
              return (
                <button
                  key={option.months}
                  onClick={() => setSelectedMonths(option.months)}
                  style={{
                    flex: 1, padding: '9px 0', borderRadius: 99,
                    border: active ? `2px solid var(--border-focus)` : `1px solid var(--border-strong)`,
                    background: active ? T.brandDark : T.white,
                    color: active ? '#fff' : T.text2,
                    fontSize: 12, fontWeight: active ? 600 : 400,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {option.label}
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
                <span style={{ fontSize: 22, fontWeight: 600, color: T.text1 }}>{fmt(monthlyRequired, data.currency)}</span>
                <span style={{ fontSize: 13, color: T.text3 }}>/ month</span>
              </div>
              {data.totalIncome > 0 ? (
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
              {incomePercent > 45 && data.totalIncome > 0 && (
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

  return (
    <SetupFlowPage
      pageKey={pageKey}
      onBack={goBack}
      isDesktop={isDesktop}
      isSaving={saving}
    >
      {step === 'pick' ? step1 : step === 'destination' ? stepDestination : step === 'name' ? step2 : step3}
    </SetupFlowPage>
  )
}

export default function NewGoalClient(props: NewGoalClientProps) {
  return (
    <Suspense>
      <NewGoalInner {...props} />
    </Suspense>
  )
}
