// src/app/(app)/log/new/NewExpenseClient.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/context/UserContext'
import { getCurrentCycleId } from '@/lib/supabase/cycles-db'

// ─── Type system ──────────────────────────────────────────────
// 'goal' included so URL param cast is safe — goal items navigate here from the log hub.
// 'goal' does NOT appear in TypeChips (goal contributions don't need type selection).
export type ExpenseType = 'variable' | 'fixed' | 'subscription' | 'debt' | 'goal'

export const TYPE_LABELS: Record<ExpenseType, string> = {
  variable:     'Everyday',
  fixed:        'Fixed',
  subscription: 'Subscription',
  debt:         'Debt',
  goal:         'Goal',
}

export const TYPE_SUBLABELS: Record<ExpenseType, string> = {
  variable:     'Anything once',
  fixed:        'Same every month',
  subscription: 'Recurring service',
  debt:         'Loan / repayment',
  goal:         'Savings contribution',
}

// ─── Dictionary ───────────────────────────────────────────────
interface DictEntry {
  groupType: ExpenseType
  label:     string
  key:       string | null
}

// ─── Step type ────────────────────────────────────────────────
type Step = 'name' | 'amount'

export function NewExpenseClient() {
  const router       = useRouter()
  const params       = useSearchParams()
  const supabase     = createClient()
  const { user, profile } = useUser()

  // URL params — present for known items, absent for free-text
  const paramKey      = params.get('key')
  const paramLabel    = params.get('label')
  const paramType     = params.get('type') as ExpenseType | null
  const paramAmount   = params.get('amount')   // pre-fill for known items
  const isOther       = params.get('isOther') === 'true'

  // For known items, skip 'name' step — start at 'amount'
  const [step, setStep] = useState<Step>(isOther ? 'name' : 'amount')

  // Form state
  const [name,         setName]         = useState(paramLabel ?? '')
  const [selectedType, setSelectedType] = useState<ExpenseType | null>(paramType)
  const [amount,       setAmount]       = useState(paramAmount ?? '')
  const [note,         setNote]         = useState('')
  const [saving,       setSaving]       = useState(false)

  // Dictionary state (free-text only)
  const [dictionary,   setDictionary]   = useState<Record<string, DictEntry>>({})
  const [dictMatch,    setDictMatch]    = useState<DictEntry | null>(null)
  const [typeOverride, setTypeOverride] = useState(false)

  const currency = profile?.currency ?? 'USD'

  // Update vs add-another mode
  const [mode,       setMode]       = useState<'add' | 'update'>('add')
  const [priorEntry, setPriorEntry] = useState<{ id: string; amount: number } | null | undefined>(undefined)
  // undefined = still loading, null = none found, object = found

  // Load dictionary for free-text flow
  useEffect(() => {
    if (!isOther || !user) return
    ;(supabase.from('item_dictionary') as any)
      .select('name_normalized, label, group_type, category_key')
      .eq('user_id', user.id)
      .then(({ data }: any) => {
        if (!data) return
        const dict: Record<string, DictEntry> = {}
        for (const row of data) {
          dict[row.name_normalized] = {
            groupType: row.group_type as ExpenseType,
            label:     row.label,
            key:       row.category_key,
          }
        }
        setDictionary(dict)
      })
  }, [isOther, user, supabase])

  // Dictionary lookup as user types
  useEffect(() => {
    if (!isOther || typeOverride) { setDictMatch(null); return }
    const normalized = name.trim().toLowerCase()
    const match = normalized ? (dictionary[normalized] ?? null) : null
    setDictMatch(match)
    if (match && !typeOverride) setSelectedType(match.groupType)
  }, [name, dictionary, isOther, typeOverride])

  // Fetch prior entry for known items (to offer update vs add-another)
  useEffect(() => {
    if (isOther || !paramKey || !user) { setPriorEntry(null); return }
    ;(supabase.from('transactions') as any)
      .select('id, amount')
      .eq('user_id', user.id)
      .eq('category_key', paramKey)
      .eq('month', new Date().toISOString().slice(0, 7))
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }: any) => setPriorEntry(data ?? null))
  }, [isOther, paramKey, user, supabase])

  const handleBack = () => {
    if (step === 'amount' && isOther) { setStep('name'); return }
    router.push('/log')
  }

  const handleNameContinue = () => {
    if (!name.trim() || !selectedType) return
    setStep('amount')
  }

  const parsedAmount = parseFloat(amount.replace(/,/g, '')) || 0

  const currentMonth = new Date().toISOString().slice(0, 7)

  const handleSave = useCallback(async () => {
    if (!user || parsedAmount <= 0) return

    const resolvedType  = selectedType ?? paramType ?? 'variable'
    const resolvedKey   = paramKey ?? name.trim().toLowerCase().replace(/\s+/g, '_')
    const resolvedLabel = name.trim() || paramLabel || resolvedKey

    setSaving(true)

    try {
      // 0. If updating an existing entry, delete it first
      if (mode === 'update' && priorEntry) {
        const { error: deleteError } = await (supabase.from('transactions') as any)
          .delete()
          .eq('id', priorEntry.id)

        if (deleteError) throw new Error('Failed to delete prior entry')
      }

      const cycleId = await getCurrentCycleId(supabase as any, user.id, profile as any)

      // 1. Write the transaction
      await (supabase.from('transactions') as any).insert({
        user_id:        user.id,
        date:           new Date().toISOString().slice(0, 10),
        month:          currentMonth,
        cycle_id:       cycleId,
        category_type:  resolvedType,
        category_key:   resolvedKey,
        category_label: resolvedLabel,
        amount:         parsedAmount,
        note:           note.trim() || null,
      })

      // 2. If free-text: upsert dictionary
      if (isOther) {
        const normalized = resolvedLabel.trim().toLowerCase()
        const { data: existing } = await (supabase.from('item_dictionary') as any)
          .select('usage_count')
          .eq('user_id', user.id)
          .eq('name_normalized', normalized)
          .maybeSingle()

        await (supabase.from('item_dictionary') as any).upsert({
          user_id:         user.id,
          name_normalized: normalized,
          label:           resolvedLabel,
          group_type:      resolvedType,
          category_key:    resolvedKey,
          usage_count:     (existing?.usage_count ?? 0) + 1,
        }, { onConflict: 'user_id,name_normalized' })
      }

      // 3. If subscription: upsert subscriptions table
      // status: 'yes_known' matches the SubscriptionStatus enum in src/types/database.ts
      if (resolvedType === 'subscription') {
        await (supabase.from('subscriptions') as any).upsert({
          user_id:     user.id,
          key:         resolvedKey,
          label:       resolvedLabel,
          amount:      parsedAmount,
          needs_check: true,
          status:      'yes_known',
        }, { onConflict: 'user_id,key' })
      }

      router.replace('/log')
    } finally {
      setSaving(false)
    }
  }, [user, profile, parsedAmount, selectedType, paramType, paramKey, paramLabel, name, note, isOther, supabase, currentMonth, router, mode, priorEntry])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--page-bg)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 20px 8px',
      }}>
        <button
          onClick={handleBack}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 4, color: 'var(--text-2)',
            display: 'flex', alignItems: 'center',
          }}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)' }}>
            {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-1)' }}>
            Add an expense
          </h1>
        </div>
      </div>

      <div style={{ flex: 1, padding: '20px 20px 40px', maxWidth: 480, width: '100%', margin: '0 auto' }}>
        {step === 'name'   && <NameStep   {...{ name, setName, selectedType, setSelectedType, dictMatch, typeOverride, setTypeOverride, onContinue: handleNameContinue }} />}
        {step === 'amount' && <AmountStep {...{ name: name || paramLabel || '', selectedType, paramType, amount, setAmount, note, setNote, currency, saving, parsedAmount, onSave: handleSave, onTypeChange: () => isOther ? setStep('name') : null, mode, setMode, priorEntry: priorEntry ?? null }} />}
      </div>
    </div>
  )
}

// ─── NameStep ─────────────────────────────────────────────────
function NameStep({ name, setName, selectedType, setSelectedType, dictMatch, typeOverride, setTypeOverride, onContinue }: {
  name: string
  setName: (v: string) => void
  selectedType: ExpenseType | null
  setSelectedType: (t: ExpenseType) => void
  dictMatch: { groupType: ExpenseType; label: string } | null
  typeOverride: boolean
  setTypeOverride: (v: boolean) => void
  onContinue: () => void
}) {
  const canContinue = name.trim().length > 0 && selectedType !== null

  return (
    <div>
      <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65 }}>
        What was this for?
      </p>

      {/* Name input */}
      <input
        autoFocus
        type="text"
        placeholder="e.g. Netflix, Rent, Groceries"
        value={name}
        onChange={e => { setName(e.target.value); setTypeOverride(false) }}
        style={{
          width: '100%', height: 52, borderRadius: 'var(--radius-md)',
          border: `1.5px solid ${name ? 'var(--brand-dark)' : 'var(--border)'}`,
          padding: '0 16px', fontSize: 16, color: 'var(--text-1)',
          background: 'var(--white)', outline: 'none',
          boxSizing: 'border-box', fontFamily: 'inherit',
          transition: 'border-color 0.15s',
          marginBottom: 8,
        }}
      />

      {/* Dictionary match hint */}
      {dictMatch && !typeOverride && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            Remembered from last time
          </span>
          <button
            onClick={() => { setTypeOverride(true); setSelectedType(selectedType!) }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: 'var(--brand-dark)', fontWeight: 500, padding: 0,
            }}
          >
            Change
          </button>
        </div>
      )}
      {(!dictMatch || typeOverride) && name.trim() && (
        <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--text-muted)' }}>
          We'll remember this for next time.
        </p>
      )}

      {/* Type chips — 2×2 grid */}
      <TypeChips selected={selectedType} onSelect={setSelectedType} />

      {/* Continue */}
      <button
        onClick={onContinue}
        disabled={!canContinue}
        style={{
          width: '100%', height: 52, borderRadius: 14, marginTop: 24,
          background: canContinue ? 'var(--brand-dark)' : 'var(--border)',
          border: 'none',
          color: canContinue ? '#fff' : 'var(--text-muted)',
          fontSize: 15, fontWeight: 600,
          cursor: canContinue ? 'pointer' : 'not-allowed',
          transition: 'background 0.15s',
        }}
      >
        Continue
      </button>
    </div>
  )
}

// ─── AmountStep ───────────────────────────────────────────────
function AmountStep({ name, selectedType, paramType, amount, setAmount, note, setNote, currency, saving, parsedAmount, onSave, onTypeChange, mode, setMode, priorEntry }: {
  name: string
  selectedType: ExpenseType | null
  paramType: ExpenseType | null
  amount: string
  setAmount: (v: string) => void
  note: string
  setNote: (v: string) => void
  currency: string
  saving: boolean
  parsedAmount: number
  onSave: () => void
  onTypeChange: () => void
  mode:       'add' | 'update'
  setMode:    (m: 'add' | 'update') => void
  priorEntry: { id: string; amount: number } | null
}) {
  const resolvedType = selectedType ?? paramType

  const displayAmount = (() => {
    if (!amount) return ''
    const raw = amount.replace(/,/g, '')
    const parts = raw.split('.')
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return parts.join('.')
  })()

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '')
    if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return
    setAmount(raw)
  }

  return (
    <div>
      {/* Update vs add another chips — only shown when a prior entry exists */}
      {priorEntry && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['update', 'add'] as const).map(m => (
            <button
              key={m}
              onClick={() => {
                setMode(m)
                if (m === 'update') setAmount(String(priorEntry.amount))
              }}
              style={{
                flex: 1, height: 40, borderRadius: 99,
                border: mode === m ? `2px solid var(--brand-dark)` : '1px solid var(--border)',
                background: mode === m ? 'var(--brand-dark)' : 'var(--white)',
                color: mode === m ? '#fff' : 'var(--text-2)',
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {m === 'update' ? 'Update entry' : 'Add another'}
            </button>
          ))}
        </div>
      )}

      {/* Expense name + type pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        {name && (
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1)' }}>
            {name}
          </span>
        )}
        {resolvedType && (
          <button
            onClick={onTypeChange}
            style={{
              background: 'color-mix(in srgb, var(--brand-dark) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--brand-dark) 20%, transparent)',
              borderRadius: 99, padding: '3px 10px',
              fontSize: 11, fontWeight: 600, color: 'var(--brand-dark)',
              cursor: 'pointer',
            }}
          >
            {TYPE_LABELS[resolvedType]}
          </button>
        )}
      </div>

      {/* Amount input */}
      <div style={{
        display: 'flex', alignItems: 'center',
        border: `1.5px solid ${amount ? 'var(--brand-dark)' : 'var(--border)'}`,
        borderRadius: 12, background: 'var(--white)',
        overflow: 'hidden', marginBottom: 16,
        transition: 'border-color 0.15s',
      }}>
        <span style={{
          padding: '0 14px', fontSize: 14, fontWeight: 600,
          color: 'var(--text-3)', borderRight: '1px solid var(--border)',
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {currency}
        </span>
        <input
          autoFocus
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={displayAmount}
          onChange={handleAmountChange}
          style={{
            flex: 1, height: 52, border: 'none', outline: 'none',
            padding: '0 14px', fontSize: 22, fontWeight: 600,
            color: 'var(--text-1)', background: 'transparent', fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Note */}
      <input
        type="text"
        placeholder="Add a note (optional)"
        value={note}
        onChange={e => setNote(e.target.value)}
        style={{
          width: '100%', height: 44, borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          padding: '0 14px', fontSize: 14, color: 'var(--text-1)',
          background: 'var(--white)', outline: 'none',
          boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 24,
        }}
      />

      {/* Save */}
      <button
        onClick={onSave}
        disabled={parsedAmount <= 0 || saving}
        style={{
          width: '100%', height: 52, borderRadius: 14,
          background: parsedAmount > 0 ? 'var(--brand-dark)' : 'var(--border)',
          border: 'none',
          color: parsedAmount > 0 ? '#fff' : 'var(--text-muted)',
          fontSize: 15, fontWeight: 600,
          cursor: parsedAmount > 0 ? 'pointer' : 'not-allowed',
          transition: 'background 0.15s',
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}

// ─── TypeChips ────────────────────────────────────────────────
// 'goal' intentionally excluded — goal contributions don't need type selection
const TYPES: ExpenseType[] = ['variable', 'fixed', 'subscription', 'debt']

function TypeChips({ selected, onSelect }: {
  selected: ExpenseType | null
  onSelect: (t: ExpenseType) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {TYPES.map(t => {
        const active = selected === t
        return (
          <button
            key={t}
            onClick={() => onSelect(t)}
            style={{
              height: 64, borderRadius: 12, textAlign: 'left',
              padding: '0 14px',
              border: active ? `2px solid var(--brand-dark)` : '1px solid var(--border)',
              background: active ? 'var(--brand-dark)' : 'var(--white)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <p style={{
              margin: 0, fontSize: 13, fontWeight: 600,
              color: active ? '#fff' : 'var(--text-1)',
            }}>
              {TYPE_LABELS[t]}
            </p>
            <p style={{
              margin: '2px 0 0', fontSize: 11,
              color: active ? 'rgba(255,255,255,0.75)' : 'var(--text-3)',
            }}>
              {TYPE_SUBLABELS[t]}
            </p>
          </button>
        )
      })}
    </div>
  )
}
