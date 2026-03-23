# Expense Logging Page Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the modal-based expense logging flow with a dedicated page flow that embeds type selection into the category step, backed by a label→type learning system.

**Architecture:** A new `/log/new` page handles all expense entry as a focused multi-step page flow (Name+Type → Amount → Save). The existing `/log` hub page navigates to `/log/new` instead of opening a bottom sheet. The `item_dictionary` table stores the label→type mapping and pre-fills type on future entries.

**Tech Stack:** Next.js App Router, TypeScript, Supabase client, existing design tokens

---

## Design Decisions (locked)

- **Type labels (user language):** `variable` → "Everyday", `fixed` → "Fixed", `subscription` → "Subscription", `debt` → "Debt"
- **Free-text flow steps:** `name` (name input + type chips combined) → `amount` → save
- **Known-item flow steps:** `amount` (type shown as pre-filled pill, tappable) → save
- **No auto-detection:** type is always user-selected; dictionary only pre-fills, never silently assigns
- **Learning:** on save, upsert `item_dictionary` with `name_normalized → group_type`
- **Subscription save side-effect:** also insert into `subscriptions` table with `needs_check: true`
- **Debt keywords removed:** user explicitly selects "Debt" from type chips
- **Back navigation:** browser back or explicit back button navigates between steps within the page; from step 1, back returns to `/log`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/app/(app)/log/new/page.tsx` | **Create** | Server wrapper — `force-dynamic`, renders `NewExpenseClient` |
| `src/app/(app)/log/new/NewExpenseClient.tsx` | **Create** | All multi-step logic: name, type chips, amount, save, dictionary lookup |
| `src/app/(app)/log/page.tsx` | **Modify** | Remove sheet state/handlers, replace `openSheet()` with `router.push('/log/new?...')` |
| `src/components/flows/log/AddExpenseSheet.tsx` | **Keep (unused)** | Leave in place — do not delete until new flow is confirmed stable |

---

## Task 1 — Create `/log/new/page.tsx` (server wrapper)

**Files:**
- Create: `src/app/(app)/log/new/page.tsx`

- [ ] **Step 1: Create the file**

```tsx
// src/app/(app)/log/new/page.tsx
// NOTE: No 'use client' here — this is a server component wrapping a Suspense boundary.
// NewExpenseClient carries 'use client' and calls useSearchParams() safely inside Suspense.
export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { NewExpenseClient } from './NewExpenseClient'

export default function NewExpensePage() {
  return (
    <Suspense>
      <NewExpenseClient />
    </Suspense>
  )
}
```

- [ ] **Step 2: Verify the route resolves**

Navigate to `/log/new` in the browser — should show a blank page without errors (component doesn't exist yet, that's fine).

---

## Task 2 — Build `NewExpenseClient` — skeleton + URL param reading

**Files:**
- Create: `src/app/(app)/log/new/NewExpenseClient.tsx`

- [ ] **Step 1: Create the skeleton with param reading and step routing**

```tsx
// src/app/(app)/log/new/NewExpenseClient.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/context/UserContext'

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

  const handleBack = () => {
    if (step === 'amount' && isOther) { setStep('name'); return }
    router.push('/log')
  }

  const handleNameContinue = () => {
    if (!name.trim() || !selectedType) return
    setStep('amount')
  }

  const parsedAmount = parseFloat(amount.replace(/,/g, '')) || 0

  // TODO: handleSave — added in Task 3
  const handleSave = async () => {}

  const currentMonth = new Date().toISOString().slice(0, 7)

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
        {step === 'amount' && <AmountStep {...{ name: name || paramLabel || '', selectedType, paramType, amount, setAmount, note, setNote, currency, saving, parsedAmount, onSave: handleSave, onTypeChange: () => isOther ? setStep('name') : null }} />}
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
function AmountStep({ name, selectedType, paramType, amount, setAmount, note, setNote, currency, saving, parsedAmount, onSave, onTypeChange }: {
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
              cursor: onTypeChange ? 'pointer' : 'default',
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
```

- [ ] **Step 2: Verify page renders**

Navigate to `/log/new?isOther=true` — should show name input + 4 type chips.
Navigate to `/log/new?label=Rent&type=fixed` — should show amount input with "Rent" + "Fixed" pill.

---

## Task 3 — Implement `handleSave` in `NewExpenseClient`

**Files:**
- Modify: `src/app/(app)/log/new/NewExpenseClient.tsx`

Replace the stub `handleSave` with the full implementation.

- [ ] **Step 1: Replace the stub with the real save handler**

Replace:
```tsx
const handleSave = async () => {}
```

With:

```tsx
const handleSave = useCallback(async () => {
  if (!user || parsedAmount <= 0) return

  const resolvedType  = selectedType ?? paramType ?? 'variable'
  const resolvedKey   = paramKey ?? name.trim().toLowerCase().replace(/\s+/g, '_')
  const resolvedLabel = name.trim() || paramLabel || resolvedKey

  setSaving(true)

  try {
    // 1. Write the transaction
    await (supabase.from('transactions') as any).insert({
      user_id:        user.id,
      date:           new Date().toISOString().slice(0, 10),
      month:          currentMonth,
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
}, [user, parsedAmount, selectedType, paramType, paramKey, paramLabel, name, note, isOther, supabase, currentMonth, router])
```

- [ ] **Step 2: Test save for free-text expense**

Log a free-text expense (type "Coffee", select "Everyday", enter amount). Verify:
- Transaction row in Supabase with correct `category_type = 'variable'`
- `item_dictionary` row with `name_normalized = 'coffee'`, `group_type = 'variable'`
- Redirects to `/log`

- [ ] **Step 3: Test save for subscription**

Log "Netflix", select "Subscription", enter amount. Verify:
- Transaction row with `category_type = 'subscription'`
- `item_dictionary` row with `group_type = 'subscription'`
- `subscriptions` table has a row for "Netflix"

- [ ] **Step 4: Test dictionary pre-fill on second log**

Log "Coffee" again. Verify:
- "Everyday" chip is pre-selected on arrival
- "Remembered from last time" hint is shown

---

## Task 4 — Update `/log/page.tsx` — replace sheet with page navigation

**Files:**
- Modify: `src/app/(app)/log/page.tsx`

The log hub page currently calls `openSheet(item)` to open the `AddExpenseSheet` modal. We replace all those calls with `router.push('/log/new?...')`.

- [ ] **Step 1: Add `useRouter` import if not already present**

Verify `useRouter` is imported from `next/navigation`.

- [ ] **Step 2: Remove sheet-related state**

Remove these state declarations:
```tsx
const [sheetOpen, setSheetOpen] = useState(false)
const [sheetItem, setSheetItem] = useState<SheetItem | null>(null)
const [dictionary, setDictionary] = useState<Record<string, DictionaryEntry>>({})
```

- [ ] **Step 3: Replace `openSheet()` with a navigation helper**

Remove the `openSheet` function and add:

```tsx
const logItem = useCallback((item: SubItem) => {
  const params = new URLSearchParams({
    key:    item.key,
    label:  item.label,
    type:   item.groupType,
    ...(item.amount ? { amount: String(item.amount) } : {}),
  })
  router.push(`/log/new?${params.toString()}`)
}, [router])

const logOther = useCallback(() => {
  router.push('/log/new?isOther=true')
}, [router])
```

- [ ] **Step 4: Replace all `openSheet(item)` calls with `logItem(item)`**

In the sections render, wherever `onClick={() => openSheet(item)}` appears, replace with `onClick={() => logItem(item)}`.

- [ ] **Step 5: Replace "Add an expense" / "Something else" button handlers**

Find the "Add an expense" CTA and the "Something else" button. Replace their `onClick` with `logOther`.

- [ ] **Step 6: Remove `handleSave` from log/page.tsx**

The save logic is now in `NewExpenseClient`. Remove `handleSave` from `log/page.tsx`.

- [ ] **Step 7: Update the `?open=true` useEffect**

The existing `log/page.tsx` has a `useEffect` that detects `?open=true` in the URL (from the overview's "Log expense" CTA after income check-in) and calls `openSheet(...)`. After removing `openSheet`, update this effect to call `logOther()`:

```tsx
useEffect(() => {
  if (searchParams.get('open') === 'true') logOther()
}, [logOther, searchParams])
```

- [ ] **Step 8: Update the delete-flow "wrong amount" action**

Inside the `pendingDelete` Sheet (the 3-step correction modal that remains in `log/page.tsx`), there is a "I logged the wrong amount" option that currently calls `openSheet(item)`. Replace it with `logItem(pendingDelete)`:

```tsx
// Before:
action: () => { ...; openSheet({ key: item.key, ... }) }

// After:
action: () => { setPendingDelete(null); logItem(pendingDelete) }
```

- [ ] **Step 9: Remove `AddExpenseSheet` from the JSX**

Remove the `<AddExpenseSheet ... />` component from the render output. Leave the import in place for now (marked TODO: remove after confirming new flow).

- [ ] **Step 10: Verify hub page renders without errors**

Navigate to `/log`. Should show sections with items. Tapping an item should navigate to `/log/new?key=...&type=...&label=...`. Navigating to `/log?open=true` should redirect immediately to `/log/new?isOther=true`.

---

## Task 5 — Handle prior entry (update vs add another)

When a user taps a known item that was already logged this month, they should be able to update the entry or add another. This was previously handled in `AddExpenseSheet`. Move it to `NewExpenseClient`.

**Files:**
- Modify: `src/app/(app)/log/new/NewExpenseClient.tsx`

- [ ] **Step 1: Add prior entry fetch on mount (known items only)**

Inside `NewExpenseClient`, add:

```tsx
const [priorEntry, setPriorEntry] = useState<{ id: string; amount: number } | null | undefined>(undefined)
// undefined = loading, null = none found, { id, amount } = found

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
```

- [ ] **Step 2: Add mode chips to AmountStep when priorEntry exists**

Add `mode: 'add' | 'update'` and `priorEntry` props to `AmountStep`. When `priorEntry` is non-null, show two chips before the amount input:

```tsx
{priorEntry && (
  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
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
```

- [ ] **Step 3: Update handleSave for update mode**

In `handleSave`, add logic for `mode === 'update'`:

```tsx
if (mode === 'update' && priorEntry) {
  // Delete old entry, insert new
  await (supabase.from('transactions') as any)
    .delete()
    .eq('id', priorEntry.id)
}
// Then insert new transaction (existing insert logic)
```

- [ ] **Step 4: Verify update flow**

Tap a known item that has been logged this month. Verify "Update entry" and "Add another" chips appear. Update amount — verify old transaction deleted, new one inserted.

---

## Task 6 — Debt flow (known debt items)

The log page has a "Debts" section built from existing debt transactions. When a user taps a debt item, it should navigate to the amount page.

**Files:**
- Modify: `src/app/(app)/log/page.tsx` (minor)

- [ ] **Step 1: Verify debt items have correct params**

When `logItem(item)` is called for a debt item (`item.groupType === 'debt'`), the params will include `type=debt`. This is correct — no special handling needed.

- [ ] **Step 2: Verify NewExpenseClient shows correct type pill for debt**

Navigate to `/log/new?key=helb_loan&label=HELB+Loan&type=debt`. Verify "Debt" pill is shown in muted style on the amount screen.

---

## Task 7 — Goals flow

Goal contributions navigate to the amount page with goal context.

**Files:**
- Modify: `src/app/(app)/log/page.tsx`

- [ ] **Step 1: Update logItem for goal items**

Goal items have `groupType === 'goal'`. Ensure the `amount` param is passed when a goal target amount exists, and `type=goal` is in the URL.

- [ ] **Step 2: Verify goal save writes correct category_type**

The `handleSave` in `NewExpenseClient` uses `resolvedType` from URL param. For goals, this will be `'goal'`. Verify transaction is written with `category_type = 'goal'`.

Note: Goal contributions previously called `handleContribGoal` in `app/page.tsx`. The overview page goal contribution flow remains separate (it uses a sheet from OverviewWithData). The `/log` page goal flow is for manual goal contributions from the log hub.

---

## Task 8 — Integration test: full flows

- [ ] **Test 1: Free-text, new label**
  1. Open `/log` → tap "Something else" (or "Add an expense" when no sections)
  2. Type "Dog food", see no pre-fill hint
  3. Select "Everyday"
  4. Tap Continue → amount screen
  5. Enter amount, save
  6. Verify: transaction with `category_type='variable'`, `item_dictionary` entry

- [ ] **Test 2: Free-text, known label**
  1. Open `/log` → tap "Add an expense"
  2. Type "Dog food" — see "Remembered from last time", "Everyday" pre-selected
  3. Tap Continue immediately (type already set)
  4. Save — verify correct type written

- [ ] **Test 3: Known fixed item**
  1. Open `/log` → tap "Rent" under Fixed spending
  2. Amount screen with "Fixed" pill shown
  3. Enter amount → save
  4. Verify: transaction with `category_type='fixed'`

- [ ] **Test 4: Subscription new label**
  1. Open `/log` → tap "Add an expense"
  2. Type "Spotify", select "Subscription"
  3. Continue → amount → save
  4. Verify: `transactions` row with `category_type='subscription'`
  5. Verify: `subscriptions` table has "Spotify" row

- [ ] **Test 5: Type override**
  1. Log "Netflix" as Subscription (Test 4 above)
  2. Log "Netflix" again — "Subscription" pre-selected, "Remembered" hint shown
  3. Tap "Change" → type chips available → select "Everyday"
  4. Save — verify `item_dictionary` updated to `group_type='variable'`

- [ ] **Step 6: Commit**

```bash
git add src/app/(app)/log/new/ src/app/(app)/log/page.tsx
git commit -m "feat: replace expense sheet with page-based log flow and type learning system"
```

---

## Notes / Out of Scope for This Plan

- **`AddExpenseSheet.tsx`**: left in place, not deleted. Can be removed in a follow-up once the new flow is stable.
- **First-time flow (`/log/first`)**: untouched — it already has a good page-based flow.
- **Overview goal contributions** (`handleContribGoal` in `app/page.tsx`): untouched — they use a separate sheet from OverviewWithData.
- **Debt keywords**: removed from the new flow. Users select "Debt" type explicitly.
- **`priorEntry` delete flow** (wrong amount / refund): not in this plan. The 3-step delete modal in `/log/page.tsx` remains for corrections after the fact.
- **`isMonthlyFixed` → `fixed_expenses` promotion (intentionally dropped):** The old `AddExpenseSheet` Q1/Q2 flow would ask "Do you pay this most months?" and write to the `fixed_expenses` table when confirmed. The new flow does not replicate this. Users who select "Fixed" type via free-text get a `category_type='fixed'` transaction, but no `fixed_expenses` table entry. Promoting a free-text item to a planned fixed expense is a planning action, not a logging action, and should be handled by the plan setup flows — not silently triggered during logging.
