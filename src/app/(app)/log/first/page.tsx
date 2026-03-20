// ─────────────────────────────────────────────────────────────
// /log/first — First-time expense logger
//
// A full-page guided flow for users with no transactions yet.
// Step 1: Category grid
// Step 2: "Every month?" (Rent / School fees only)
// Step 3: Amount + note + save
// ─────────────────────────────────────────────────────────────
'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
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
  { icon: '🎬', label: 'Entertainment',  categoryKey: null,         groupType: 'variable', askFrequency: false },
  { icon: '🏫', label: 'School fees',    categoryKey: 'schoolFees', groupType: 'fixed',    askFrequency: true  },
  { icon: '🏥', label: 'Medical',        categoryKey: null,         groupType: 'variable', askFrequency: false },
]

type Category = typeof CATEGORIES[0]
type Step = 'pick' | 'frequency' | 'amount'

export default function FirstLogPage() {
  const router        = useRouter()
  const supabase      = createClient()
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

  const currentMonth = new Date().toISOString().slice(0, 7)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      ;(supabase.from('user_profiles') as any)
        .select('currency').eq('id', user.id).single()
        .then(({ data }: any) => setCurrency(data?.currency ?? 'KES'))
    })
  }, [])

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
    setIsSomethingElse(false)
    if (cat.askFrequency) {
      setStep('frequency')
    } else {
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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    await (supabase.from('transactions') as any).insert({
      user_id:        user.id,
      date:           new Date().toISOString().slice(0, 10),
      month:          currentMonth,
      category_type:  resolvedGroupType,
      category_key:   finalKey,
      category_label: finalLabel,
      amount:         amountNum,
      note:           note.trim() || null,
    })

    // If confirmed monthly fixed, write to fixed_expenses
    if (isMonthlyFixed) {
      const { data: existing } = await (supabase.from('fixed_expenses') as any)
        .select('total_monthly, entries').eq('user_id', user.id).eq('month', currentMonth).maybeSingle()

      const existingEntries: any[] = existing?.entries ?? []
      if (!existingEntries.some((e: any) => e.key === finalKey)) {
        const newEntries = [...existingEntries, { key: finalKey, label: finalLabel, monthly: amountNum, confidence: 'known' }]
        await (supabase.from('fixed_expenses') as any).upsert({
          user_id:       user.id,
          month:         currentMonth,
          total_monthly: newEntries.reduce((s: number, e: any) => s + (e.monthly ?? 0), 0),
          entries:       newEntries,
        }, { onConflict: 'user_id,month' })
      }
    }

    router.replace('/log')
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
    </div>
  )

  // ── Step: frequency ───────────────────────────────────────
  const stepFrequency = selected && (
    <div style={{ padding: isDesktop ? '0 32px' : '0 16px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 24, padding: '14px',
        background: T.white, border: `1px solid var(--border)`, borderRadius: 14,
      }}>
        <span style={{ fontSize: 28 }}>{selected.icon}</span>
        <span style={{ fontSize: 16, fontWeight: 600, color: T.text1 }}>{selected.label}</span>
      </div>

      <p style={{ margin: '0 0 20px', fontSize: 15, color: T.text2, lineHeight: 1.6 }}>
        Do you pay {selected.label.toLowerCase()} every month?
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          onClick={() => confirmFrequency(true)}
          style={{
            height: 52, borderRadius: 14,
            background: T.brandDark, border: 'none',
            color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Yes, every month
        </button>
        <button
          onClick={() => confirmFrequency(false)}
          style={{
            height: 52, borderRadius: 14,
            background: T.white, border: `1px solid var(--border)`,
            color: T.text2, fontSize: 15, fontWeight: 500, cursor: 'pointer',
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
            placeholder="e.g. Netflix, Dog food, Haircut"
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
          marginBottom: 20, padding: '12px 14px',
          background: T.white, border: `1px solid var(--border)`, borderRadius: 12,
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
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '20px 0 24px',
        borderTop: `1px solid var(--border)`,
        borderBottom: `1px solid var(--border)`,
        marginBottom: 20,
      }}>
        <span style={{ fontSize: 13, color: T.text3, marginBottom: 6 }}>{currency}</span>
        <input
          ref={amountRef}
          type="text"
          inputMode="decimal"
          value={displayAmount}
          onChange={handleAmountChange}
          placeholder="0"
          onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
          style={{
            fontSize: 56, fontWeight: 600, textAlign: 'center',
            background: 'none', border: 'none', outline: 'none', width: '100%',
            color: amount ? T.text1 : T.textMuted, letterSpacing: -1, lineHeight: 1, padding: 0,
          }}
        />
      </div>

      {/* Note */}
      <input
        type="text"
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Add a note (optional)"
        style={{
          height: 46, borderRadius: 12, border: `1px solid var(--border)`,
          padding: '0 14px', fontSize: 14, color: T.text1,
          background: T.white, outline: 'none', width: '100%',
          boxSizing: 'border-box', marginBottom: 20,
        }}
      />

      <button
        onClick={handleSave}
        disabled={!canSave || saving}
        style={{
          width: '100%', height: 52, borderRadius: 14,
          background: canSave ? T.brandDark : T.border,
          border: 'none',
          color: canSave ? '#fff' : T.textMuted,
          fontSize: 15, fontWeight: 600,
          cursor: canSave ? 'pointer' : 'not-allowed',
          transition: 'background 0.15s',
        }}
      >
        {saving ? 'Saving…' : amountNum > 0 ? `Log ${currency} ${displayAmount}` : 'Enter an amount'}
      </button>
    </div>
  )

  const heading =
    step === 'pick'      ? 'What did you spend on?' :
    step === 'frequency' ? (selected?.label ?? '') :
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
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--page-bg)' }}>
        <SideNav />
        <main style={{ flex: 1, maxWidth: 600 }}>{content}</main>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', paddingBottom: 72 }}>
      <main>{content}</main>
      <BottomNav />
    </div>
  )
}
