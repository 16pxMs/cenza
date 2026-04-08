// src/app/(app)/log/new/NewExpenseClient.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/context/UserContext'
import { deriveCurrentCycleId } from '@/lib/supabase/cycles-db'
import { saveExpense } from './actions'

type CategoryType = 'everyday' | 'fixed' | 'debt' | 'goal'

const TYPE_OPTIONS: { label: string; value: CategoryType }[] = [
  { label: 'Daily',     value: 'everyday' },
  { label: 'Fixed',     value: 'fixed' },
  { label: 'Debt',      value: 'debt' },
]

// ─── Dictionary ───────────────────────────────────────────────
interface DictEntry {
  categoryType: CategoryType
  label: string
  key: string | null
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
  const paramAmount   = params.get('amount')
  const isOther       = params.get('isOther') === 'true'

  // For known items, skip 'name' step — start at 'amount'
  const [step, setStep] = useState<'name' | 'amount'>('name')

  // Form state
  const [name,         setName]         = useState(paramLabel ?? '')
  const [selectedType, setSelectedType] = useState<CategoryType | null>(null)
  const [amount,       setAmount]       = useState(paramAmount ?? '')
  const [note,         setNote]         = useState('')
  const [saving,       setSaving]       = useState(false)
  const [saveError,    setSaveError]    = useState<string | null>(null)



  const [dictionary, setDictionary] = useState<Record<string, DictEntry>>({})
  const [dictMatch,    setDictMatch]    = useState<DictEntry | null>(null)
  const [typeOverride, setTypeOverride] = useState(false)

  const currency = profile?.currency || 'USD'

  // Current pay cycle
  const [cycleId, setCycleId] = useState<string | null>(null)

  // Update vs add-another mode
  const [mode,       setMode]       = useState<'add' | 'update'>('add')
  const [priorEntry, setPriorEntry] = useState<{ id: string; amount: number } | null | undefined>(undefined)
  // undefined = still loading, null = none found, object = found

  // Load dictionary for free-text flow
  useEffect(() => {
    if (!isOther || !user?.id) return
    ;(supabase.from('item_dictionary') as any)
      .select('name_normalized, label, category_type, category_key')
      .eq('user_id', user.id)
      .then(({ data }: any) => {
        if (!data) return
        const dict: Record<string, DictEntry> = {}
        for (const row of data) {
          dict[row.name_normalized] = {
            categoryType: row.category_type as CategoryType,
            label: row.label,
            key: row.category_key,
          }
        }
        setDictionary(dict)
      })
  }, [isOther, user, supabase])

  // Dictionary lookup as user types
  useEffect(() => {
  if (!isOther) return

  const normalized = name.trim().toLowerCase()
  const match = normalized ? (dictionary[normalized] ?? null) : null

  setDictMatch(match)

  if (!typeOverride && match) {
    setSelectedType(match.categoryType)
  }
  }, [name, dictionary, isOther, typeOverride])

  // Load current cycle ID once user and profile are available
  useEffect(() => {
    if (!user || !profile) return
    setCycleId(deriveCurrentCycleId(profile as any))
  }, [user, profile])

  // Fetch prior entry for known items (to offer update vs add-another)
  useEffect(() => {
    if (isOther || !paramKey || !user || !cycleId) { setPriorEntry(null); return }
    ;(supabase.from('transactions') as any)
      .select('id, amount')
      .eq('user_id', user.id)
      .eq('category_key', paramKey)
      .eq('cycle_id', cycleId)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }: any) => setPriorEntry(data ?? null))
  }, [isOther, paramKey, user, cycleId, supabase])

  const handleBack = () => {
    if (step === 'amount' && isOther) { setStep('name'); return }
    router.push('/log')
  }

  const handleNameContinue = () => {
    if (!name.trim() || !selectedType) return
    setStep('amount')
  }

  const parsedAmount = parseFloat(amount.replace(/,/g, '')) || 0

  const handleSave = useCallback(async () => {
    if (!user || parsedAmount <= 0) return

    if (!cycleId) {
      setSaveError('Could not determine cycle.')
      setSaving(false)
      return
    }

    if (!selectedType) {
      setSaveError('Type must be selected')
      setSaving(false)
      return
    }

    if (!(['everyday', 'fixed', 'debt', 'goal'] as const).includes(selectedType)) {
      setSaveError('Invalid category_type')
      setSaving(false)
      return
    }

    const resolvedKey   = paramKey ?? name.trim().toLowerCase().replace(/\s+/g, '_')
    const resolvedLabel = name.trim() || paramLabel || resolvedKey

    setSaving(true)
    setSaveError(null)

    try {
      await saveExpense({
        mode,
        priorEntryId: priorEntry?.id ?? null,
        categoryType: selectedType,
        categoryKey: resolvedKey,
        categoryLabel: resolvedLabel,
        amount: parsedAmount,
        note: note.trim() || null,
        rememberItem: isOther,
      })

      setSaving(false)
      router.replace('/log')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message.replace(/^.*?: /, '') : 'Failed to save expense. Please try again.')
      setSaving(false)
    }
  }, [
    user,
    parsedAmount,
    selectedType,
    paramKey,
    paramLabel,
    name,
    note,
    isOther,
    router,
    mode,
    priorEntry,
    cycleId,
  ])

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

      <div style={{ flex: 1, padding: '20px 20px 40px', maxWidth:     480,    width: '100%', margin: '0 auto' }}>

        {step === 'name' && (
          <NameStep
            name={name}
            setName={setName}
            selectedType={selectedType}
            setSelectedType={setSelectedType}
            dictMatch={dictMatch}
            typeOverride={typeOverride}
            setTypeOverride={setTypeOverride}
            onContinue={handleNameContinue}
          />
        )}

        {step === 'amount' && (
          <AmountStep
            name={name}
            selectedType={selectedType}
            amount={amount}
            setAmount={setAmount}
            note={note}
            setNote={setNote}
            currency={currency}
            saving={saving}
            saveError={saveError}
            parsedAmount={parsedAmount}
            onSave={handleSave}
            onTypeChange={() => isOther ? setStep('name') : null}
            mode={mode}
            setMode={setMode}
            priorEntry={priorEntry ?? null}
          />
        )}


      </div>
    </div>
  )
}

// ─── NameStep ─────────────────────────────────────────────────
function suggestType(label: string): CategoryType | null {
  const l = label.toLowerCase()
  if (['rent', 'netflix', 'subscription', 'internet'].some(k => l.includes(k))) return 'fixed'
  if (['loan', 'debt', 'credit'].some(k => l.includes(k))) return 'debt'
  return 'everyday'
}

function NameStep(
  {
    name,
    setName,
    selectedType,
    setSelectedType,
    dictMatch,
    typeOverride,
    setTypeOverride,
    onContinue,
  }: {
    name: string
    setName: (v: string) => void
    selectedType: CategoryType | null
    setSelectedType: (t: CategoryType) => void
    dictMatch: DictEntry | null
    typeOverride: boolean
    setTypeOverride: (v: boolean) => void
    onContinue: () => void
  }
) {
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
        onChange={e => {
          const value = e.target.value
          setName(value)

          if (!typeOverride) {
            const suggestion = suggestType(value)
            if (suggestion) setSelectedType(suggestion)
          }

          setTypeOverride(false)
        }}
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
            onClick={() => {
              setTypeOverride(true)
              if (selectedType) setSelectedType(selectedType)
            }}
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
        <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text-muted)' }}>
          We'll remember this for next time.
        </p>
      )}

      {/* Type chips */}
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
function AmountStep({ name, selectedType, amount, setAmount, note, setNote, currency, saving, saveError, parsedAmount, onSave, onTypeChange, mode, setMode, priorEntry }: {
  name: string
  selectedType: CategoryType | null
  amount: string
  setAmount: (v: string) => void
  note: string
  setNote: (v: string) => void
  currency: string
  saving: boolean
  saveError: string | null
  parsedAmount: number
  onSave: () => void
  onTypeChange: () => void
  mode:       'add' | 'update'
  setMode:    (m: 'add' | 'update') => void
  priorEntry: { id: string; amount: number } | null
}) {
  const typeLabel = selectedType
    ? (TYPE_OPTIONS.find(o => o.value === selectedType)?.label ?? selectedType)
    : null

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
        {typeLabel && (
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
            {typeLabel}
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
          boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 16,
        }}
      />

      {/* Error */}
      {saveError && (
        <p style={{
          margin: '0 0 16px', padding: '10px 14px', borderRadius: 10,
          background: '#FEF2F2', border: '1px solid #FECACA',
          fontSize: 13, color: '#D93025', lineHeight: 1.5,
        }}>
          {saveError}
        </p>
      )}

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
function TypeChips({ selected, onSelect }: {
  selected: CategoryType | null
  onSelect: (t: CategoryType) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {TYPE_OPTIONS.map(option => (
        <button
          key={option.value}
          onClick={() => onSelect(option.value)}
          style={{
            padding: '8px 12px',
            borderRadius: 10,
            border: selected === option.value ? '2px solid #5C3489' : '1px solid #E4E7EC',
            background: selected === option.value ? '#F5F0FA' : '#FFFFFF',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
