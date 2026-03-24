'use client'
export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// /log/first — First-time expense logger
//
// A full-page guided flow for users with no transactions yet.
// Step 1: Category grid
// Step 2: "Every month?" (Rent / School fees only)
// Step 3: Amount + note + save
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/context/UserContext'
import { getCurrentCycleId } from '@/lib/supabase/cycles-db'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { IconBack } from '@/components/ui/Icons'

const T = {
  brandDark: '#5C3489',
  pageBg:    '#F8F9FA',
  white:     '#FFFFFF',
  border:    '#E4E7EC',
  text1:     '#101828',
  text2:     '#475467',
  text3:     '#667085',
  textMuted: '#98A2B3',
}

const CATEGORIES = [
  { icon: '🏠', label: 'Rent',           categoryKey: 'rent',       groupType: 'fixed',    askFrequency: true  },
  { icon: '🛒', label: 'Groceries',      categoryKey: null,         groupType: 'variable', askFrequency: false },
  { icon: '🚌', label: 'Transport',      categoryKey: null,         groupType: 'variable', askFrequency: false },
  { icon: '🍽️', label: 'Eating out',    categoryKey: null,         groupType: 'variable', askFrequency: false },
  { icon: '📱', label: 'Airtime / Data', categoryKey: null,         groupType: 'variable', askFrequency: false },
  { icon: '💡', label: 'Utilities',      categoryKey: null,         groupType: 'fixed',    askFrequency: false },
  { icon: '🎬', label: 'Entertainment',  categoryKey: null,         groupType: 'variable',      askFrequency: false },
  { icon: '🏫', label: 'School fees',    categoryKey: 'schoolFees', groupType: 'fixed',         askFrequency: true  },
  { icon: '🔁', label: 'Subscription',   categoryKey: null,         groupType: 'subscription',  askFrequency: false },
  { icon: '🏥', label: 'Medical',        categoryKey: null,         groupType: 'variable',      askFrequency: false },
]

type Category = typeof CATEGORIES[0]
type Step = 'pick' | 'frequency' | 'amount' | 'skip' | 'done'

export default function FirstLogPage() {
  const router        = useRouter()
  const supabase      = createClient()
  const { user, profile: ctxProfile } = useUser()
  const { isDesktop } = useBreakpoint()
  const amountRef     = useRef<HTMLInputElement>(null)
  const nameRef       = useRef<HTMLInputElement>(null)

  const [step, setStep]               = useState<Step>('pick')
  const [selected, setSelected]       = useState<Category | null>(null)
  const [isMonthlyFixed, setIsMonthlyFixed] = useState(false)
  const [resolvedGroupType, setResolvedGroupType] = useState('variable')
  const [amount, setAmount]           = useState('')
  const [note, setNote]               = useState('')
  const [saving, setSaving]           = useState(false)
  const [currency, setCurrency]       = useState('KES')
  const [customLabel, setCustomLabel] = useState('')
  const [isSomethingElse, setIsSomethingElse] = useState(false)
  const [isSubscription,  setIsSubscription]  = useState(false)

  const [skipCount, setSkipCount] = useState(0)
  const searchParams = useSearchParams()

  useEffect(() => {
    setSkipCount(parseInt(localStorage.getItem('cenza_skip_count') ?? '0', 10))
  }, [])

  // Pre-select a category from ?category= param (e.g. tapped from OverviewLocked)
  useEffect(() => {
    const cat = searchParams.get('category')
    if (!cat) return
    const match = CATEGORIES.find(c => c.label === cat)
    if (match) selectCategory(match)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dismiss = () => {
    const current = parseInt(localStorage.getItem('cenza_skip_count') ?? '0', 10)
    localStorage.setItem('cenza_skip_count', String(current + 1))
    router.replace('/app')
  }

  const currentMonth = new Date().toISOString().slice(0, 7)

  useEffect(() => {
    if (ctxProfile) {
      setCurrency(ctxProfile.currency ?? 'KES')
    }
  }, [ctxProfile])

  // Auto-focus amount when reaching that step
  useEffect(() => {
    if (step === 'amount') {
      setTimeout(() => amountRef.current?.focus(), 150)
    }
    if (step === 'pick' && isSomethingElse) {
      setTimeout(() => nameRef.current?.focus(), 150)
    }
  }, [step, isSomethingElse])

  const selectCategory = (cat: Category) => {
    setSelected(cat)
    setIsSubscription(false)
    if (cat.groupType === 'subscription') {
      // Subscription path: ask for name + amount, then write to subscriptions table
      setIsSomethingElse(true)
      setIsSubscription(true)
      setResolvedGroupType('subscription')
      setStep('amount')
    } else if (cat.askFrequency) {
      setIsSomethingElse(false)
      setStep('frequency')
    } else {
      setIsSomethingElse(false)
      setResolvedGroupType(cat.groupType)
      setStep('amount')
    }
  }

  const confirmFrequency = (monthly: boolean) => {
    setIsMonthlyFixed(monthly)
    setResolvedGroupType(monthly ? 'fixed' : 'variable')
    setStep('amount')
  }

  const handleBack = () => {
    if (step === 'amount') {
      if (selected?.askFrequency) { setStep('frequency'); return }
      setStep('pick')
      return
    }
    if (step === 'frequency') { setStep('pick'); return }
    router.back()
  }

  const amountNum = parseFloat(amount.replace(/,/g, '')) || 0

  const displayAmount = (() => {
    if (!amount) return ''
    const clean = amount.replace(/,/g, '')
    const parts  = clean.split('.')
    const int    = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return parts.length > 1 ? `${int}.${parts[1]}` : int
  })()

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9.]/g, '')
    const parts = val.split('.')
    if (parts.length > 2) return
    if (parts[1] && parts[1].length > 2) return
    setAmount(val)
  }

  const finalLabel = isSomethingElse
    ? customLabel.trim()
    : selected?.label ?? ''

  const finalKey = selected?.categoryKey
    ?? `custom_${finalLabel.toLowerCase().replace(/\s+/g, '_').slice(0, 40)}`

  const canSave = amountNum > 0 && finalLabel.length > 0

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    if (!user || !ctxProfile) { setSaving(false); return }

    const cycleId = await getCurrentCycleId(supabase as any, user.id, ctxProfile as any)

    await (supabase.from('transactions') as any).insert({
      user_id:        user.id,
      date:           new Date().toISOString().slice(0, 10),
      cycle_id:       cycleId,
      category_type:  resolvedGroupType,
      category_key:   finalKey,
      category_label: finalLabel,
      amount:         amountNum,
      note:           note.trim() || null,
    })

    // If subscription, write to subscriptions table so it enters the monthly check-in cycle
    if (isSubscription) {
      await (supabase.from('subscriptions') as any).insert({
        user_id:    user.id,
        key:        finalKey,
        label:      finalLabel,
        amount:     amountNum,
        needs_check: true,
      })
    }

    // If confirmed monthly fixed, write to fixed_expenses
    if (isMonthlyFixed) {
      const { data: existing } = await (supabase.from('fixed_expenses') as any)
        .select('total_monthly, entries').eq('user_id', user.id).eq('cycle_id', cycleId).maybeSingle()

      const existingEntries: any[] = existing?.entries ?? []
      if (!existingEntries.some((e: any) => e.key === finalKey)) {
        const newEntries = [...existingEntries, { key: finalKey, label: finalLabel, monthly: amountNum, confidence: 'known' }]
        await (supabase.from('fixed_expenses') as any).upsert({
          user_id:       user.id,
          cycle_id:      cycleId,
          total_monthly: newEntries.reduce((s: number, e: any) => s + (e.monthly ?? 0), 0),
          entries:       newEntries,
        }, { onConflict: 'user_id,cycle_id' })
      }
    }

    setStep('done')
    setTimeout(() => router.replace('/app'), 2200)
  }

  // ── Step: pick ────────────────────────────────────────────
  const stepPick = (
    <div style={{ padding: isDesktop ? '0 32px' : '0 16px' }}>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: T.text2 }}>
        Tap what fits, or use Something else.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat.label}
            onClick={() => selectCategory(cat)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px', borderRadius: 14,
              border: `1px solid var(--border)`,
              background: T.white, cursor: 'pointer', textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 22 }}>{cat.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: T.text1 }}>{cat.label}</span>
          </button>
        ))}

        {/* Something else — full width */}
        <button
          onClick={() => { setIsSomethingElse(true); setSelected(null); setResolvedGroupType('variable'); setStep('amount') }}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '14px', borderRadius: 14,
            border: `1px dashed var(--border-strong)`,
            background: 'transparent', cursor: 'pointer', textAlign: 'left',
            gridColumn: '1 / -1',
          }}
        >
          <span style={{ fontSize: 22 }}>✏️</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: T.text3 }}>Something else</span>
        </button>
      </div>

      {/* Skip — opens value interstitial, not an immediate exit */}
      <button
        onClick={() => skipCount >= 1 ? dismiss() : setStep('skip')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '24px 0 0',
          fontSize: 14,
          color: T.textMuted,
          fontFamily: 'inherit',
          display: 'block',
          width: '100%',
          textAlign: 'center',
        }}
      >
        Nothing to log right now
      </button>
    </div>
  )

  // ── Step: frequency ───────────────────────────────────────
  const stepFrequency = selected && (
    <div style={{ padding: isDesktop ? '0 32px' : '0 16px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 32, padding: '16px',
        background: T.white, border: `1px solid var(--border)`, borderRadius: 16,
      }}>
        <span style={{ fontSize: 30 }}>{selected.icon}</span>
        <span style={{ fontSize: 16, fontWeight: 600, color: T.text1 }}>{selected.label}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          onClick={() => confirmFrequency(true)}
          style={{
            height: 56, borderRadius: 16,
            background: T.brandDark, border: 'none',
            color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer',
            letterSpacing: -0.1,
          }}
        >
          Yes, every month
        </button>
        <button
          onClick={() => confirmFrequency(false)}
          style={{
            height: 56, borderRadius: 16,
            background: 'transparent', border: '1.5px solid #C9AEE8',
            color: T.brandDark, fontSize: 16, fontWeight: 600, cursor: 'pointer',
            letterSpacing: -0.1,
          }}
        >
          Just this once
        </button>
      </div>
    </div>
  )

  // ── Step: amount ──────────────────────────────────────────
  const stepAmount = (
    <div style={{ padding: isDesktop ? '0 32px' : '0 16px' }}>

      {/* Something else — name input */}
      {isSomethingElse && (
        <div style={{ marginBottom: 20 }}>
          <input
            ref={nameRef}
            type="text"
            value={customLabel}
            onChange={e => setCustomLabel(e.target.value)}
            placeholder={isSubscription ? 'e.g. Netflix, Spotify, Gym' : 'e.g. Dog food, Haircut, Fuel'}
            style={{
              width: '100%', height: 48, borderRadius: 12,
              border: `1px solid var(--border)`, padding: '0 14px',
              fontSize: 15, color: T.text1, background: T.white,
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
      )}

      {/* Selected category label */}
      {!isSomethingElse && selected && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          marginBottom: 20, padding: '14px 16px',
          background: T.white, border: `1px solid var(--border)`, borderRadius: 16,
        }}>
          <span style={{ fontSize: 22 }}>{selected.icon}</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: T.text1 }}>{selected.label}</span>
          {isMonthlyFixed && (
            <span style={{
              marginLeft: 'auto', fontSize: 11, fontWeight: 600,
              color: '#1A7A45', background: '#F0FDF4',
              border: '1px solid #BBF7D0', borderRadius: 99, padding: '2px 10px',
            }}>
              Monthly
            </span>
          )}
        </div>
      )}

      {/* Amount */}
      <div
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '20px 0 24px',
          borderTop: `1px solid var(--border)`,
          borderBottom: `1px solid var(--border)`,
          marginBottom: 20,
          cursor: 'text',
        }}
        onClick={() => amountRef.current?.focus()}
      >
        <span style={{ fontSize: 13, color: T.text3, marginBottom: 6 }}>{currency}</span>
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
          {/* Visual display — decoupled from input so cursor doesn't appear next to 0 */}
          <span style={{
            fontSize: displayAmount.length <= 5 ? 64 : displayAmount.length <= 8 ? 52 : displayAmount.length <= 11 ? 38 : 28,
            fontWeight: 300, lineHeight: 1.1, letterSpacing: -1,
            color: displayAmount ? T.text1 : T.textMuted,
            userSelect: 'none', pointerEvents: 'none',
          }}>
            {displayAmount || '0'}
          </span>
          {/* Hidden input — captures keyboard, no visible cursor */}
          <input
            ref={amountRef}
            type="text"
            inputMode="decimal"
            value={displayAmount}
            onChange={handleAmountChange}
            onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
            style={{
              position: 'absolute', inset: 0,
              opacity: 0, fontSize: 16,
              border: 'none', outline: 'none',
              background: 'transparent', caretColor: 'transparent',
            }}
          />
        </div>
      </div>

      {/* Note */}
      <input
        type="text"
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Add a note (optional)"
        style={{
          height: 48, borderRadius: 14, border: `1px solid var(--border)`,
          padding: '0 14px', fontSize: 14, color: T.text1,
          background: T.white, outline: 'none', width: '100%',
          boxSizing: 'border-box', marginBottom: 20,
        }}
      />

      <button
        onClick={handleSave}
        disabled={!canSave || saving}
        style={{
          width: '100%', height: 56, borderRadius: 16,
          background: canSave ? T.brandDark : T.border,
          border: 'none',
          color: canSave ? '#fff' : T.textMuted,
          fontSize: 16, fontWeight: 600,
          cursor: canSave ? 'pointer' : 'not-allowed',
          transition: 'background 0.15s',
          letterSpacing: -0.1,
        }}
      >
        {saving ? 'Saving…' : amountNum > 0 ? `Save ${currency} ${displayAmount}` : 'Enter an amount'}
      </button>
    </div>
  )

  // ── Step: skip interstitial ───────────────────────────────
  if (step === 'skip') {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--page-bg)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '0 var(--page-padding-mobile, 16px)',
      }}>
        <div style={{ maxWidth: 480, width: '100%' }}>
          <p style={{ margin: '0 0 var(--space-sm)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--brand-dark)', letterSpacing: '0.01em' }}>
            Here's what you're missing
          </p>
          <h2 style={{ margin: '0 0 var(--space-xl)', fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.3px' }}>
            One expense unlocks all of this.
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', marginBottom: 'var(--space-xxl)' }}>
            {[
              { icon: '📊', label: 'Spending overview', desc: 'See exactly where your money goes each month.' },
              { icon: '🎯', label: 'Goal tracking',     desc: 'Watch your savings goals grow in real time.'  },
              { icon: '📋', label: 'Budget awareness',  desc: 'Know when you\'re about to overspend — before you do.' },
            ].map(({ icon, label, desc }) => (
              <div key={label} style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-start' }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(92,52,137,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                }}>
                  {icon}
                </div>
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-1)' }}>{label}</p>
                  <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-2)', lineHeight: 1.6 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setStep('pick')}
            style={{
              width: '100%', height: 56, borderRadius: 'var(--radius-lg)',
              background: 'var(--brand-dark)', border: 'none',
              color: 'var(--text-inverse)', fontSize: 'var(--text-base)',
              fontWeight: 'var(--weight-semibold)', cursor: 'pointer', letterSpacing: '-0.1px',
              marginBottom: 'var(--space-md)',
            }}
          >
            Let me log something
          </button>
          <button
            onClick={dismiss}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              width: '100%', fontSize: 'var(--text-sm)',
              color: 'var(--text-muted)', fontFamily: 'inherit', padding: 0,
            }}
          >
            Got it, I'll log later
          </button>
        </div>
      </div>
    )
  }

  // ── Step: done (Day 1 celebration) ────────────────────────
  if (step === 'done') {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--page-bg)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        padding: '0 var(--page-padding-mobile, 16px)',
        textAlign: 'center',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(92,52,137,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36, marginBottom: 'var(--space-lg)',
        }}>
          🔥
        </div>
        <p style={{
          margin: '0 0 var(--space-xs)',
          fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)',
          color: 'var(--brand-dark)', letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          Day 1
        </p>
        <h2 style={{ margin: '0 0 var(--space-sm)', fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.3px' }}>
          You logged your first expense.
        </h2>
        <p style={{ margin: 0, fontSize: 'var(--text-base)', color: 'var(--text-2)', lineHeight: 1.65, maxWidth: 300 }}>
          Come back tomorrow to keep the streak going.
        </p>
      </div>
    )
  }

  const heading =
    step === 'pick'      ? 'What did you spend on?' :
    step === 'frequency' ? `Do you pay ${selected?.label.toLowerCase()} every month?` :
                           'How much?'

  const content = (
    <div style={{ paddingBottom: isDesktop ? 80 : 120 }}>
      {/* Header */}
      <div style={{ padding: isDesktop ? '32px 32px 24px' : '20px 16px 20px' }}>
        <button
          onClick={handleBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 12px', display: 'flex', alignItems: 'center' }}
        >
          <IconBack size={18} color={T.text3} />
        </button>
        <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>
        <h1 style={{ fontSize: isDesktop ? 28 : 24, fontWeight: 600, color: T.text1, margin: 0 }}>
          {heading}
        </h1>
      </div>

      {step === 'pick'      && stepPick}
      {step === 'frequency' && stepFrequency}
      {step === 'amount'    && stepAmount}
    </div>
  )

  if (isDesktop) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <SideNav />
        <main style={{ flex: 1, maxWidth: 600, margin: '0 auto' }}>{content}</main>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <main>{content}</main>
    </div>
  )
}
