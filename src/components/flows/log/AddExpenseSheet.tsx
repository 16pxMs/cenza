// ─────────────────────────────────────────────────────────────
// AddExpenseSheet — Amount entry using native device keyboard
//
// Known item (fixed/goal/debt) with prior entry this month:
//   Mode chips (Update / Add another) → amount
//
// Known item, no prior:
//   Straight to amount
//
// "Something else" — new item:
//   Q: "What's this payment for?" (name)
//   Dictionary lookup: if name matches a saved item → skip
//     questions, show "We know this one" badge
//   Otherwise:
//   Q: "Do you pay this most months?" (Most months / One-off)
//   Q (if recurring): "More like a bill or day-to-day?"
//   → category resolved automatically
//   → amount
// ─────────────────────────────────────────────────────────────
'use client'
import { useState, useEffect, useRef } from 'react'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { formatDate, getConfidenceLevel, CONFIDENCE_LABEL, CONFIDENCE_COLOR } from '@/lib/finance'

const T = {
  brand:        '#EADFF4',
  brandDark:    '#5C3489',
  white:        '#FFFFFF',
  border:       '#E4E7EC',
  borderStrong: '#D0D5DD',
  text1:        '#101828',
  text2:        '#475467',
  text3:        '#667085',
  textMuted:    '#98A2B3',
}


export interface SheetItem {
  key:           string
  label:         string
  groupType:     string
  isOther:       boolean
  plannedAmount?: number  // monthly planned amount (e.g. from fixed_expenses) — used as default
}

export interface ExpenseSaveData {
  key:             string
  label:           string
  groupType:       string
  amount:          number
  note:            string
  replaceExisting: boolean
}

export interface PriorEntry {
  amount: number
  date:   string
}

export interface DictionaryEntry {
  groupType: string  // 'fixed' | 'variable'
  label:     string
  key?:      string  // category_key stored in transactions
  count?:    number  // times this item has been logged (for confidence)
}

export interface QuickItem {
  key:           string
  label:         string
  groupType:     string
  source:        'logged' | 'planned' | 'history'
  loggedAmount?: number
  plannedAmount?: number
}

interface Props {
  open:               boolean
  onClose:            () => void
  item:               SheetItem | null
  priorEntry:         PriorEntry | null | undefined
  dictionary?:        Record<string, DictionaryEntry>  // normalized name → entry
  quickItems?:        QuickItem[]
  onSelectQuickItem?: (item: SheetItem) => void
  currency:           string
  isDesktop?:         boolean
  onSave:             (data: ExpenseSaveData) => Promise<void>
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '10px 0', borderRadius: 99,
        border: `1.5px solid ${active ? T.brandDark : T.borderStrong}`,
        background: active ? T.brandDark : T.white,
        color: active ? T.white : T.text2,
        fontSize: 13, fontWeight: active ? 600 : 400,
        cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )
}

function QuickChip({ item, currency, onClick }: { item: QuickItem; currency: string; onClick: () => void }) {
  const s = item.source === 'logged'
    ? { bg: T.brandDark, color: '#fff',  border: '1.5px solid rgba(255,255,255,0.2)', shadow: '0 1px 4px rgba(92,52,137,0.25)' }
    : item.source === 'planned'
    ? { bg: T.white,     color: T.text2, border: `1.5px solid ${T.borderStrong}`,     shadow: 'none' }
    : { bg: T.white,     color: T.text3, border: `1.5px solid ${T.border}`,           shadow: 'none' }

  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 14px', borderRadius: 99,
        background: s.bg, border: s.border, color: s.color, boxShadow: s.shadow,
        fontSize: 13, fontWeight: item.source === 'logged' ? 600 : 400,
        cursor: 'pointer', fontFamily: 'var(--font-sans)',
        display: 'inline-flex', alignItems: 'center', gap: 5,
        whiteSpace: 'nowrap',
      }}
    >
      {item.label}
      {item.source === 'logged' && item.loggedAmount != null && (
        <span style={{ opacity: 0.75, fontSize: 12 }}>
          · {currency} {Number(item.loggedAmount).toLocaleString()}
        </span>
      )}
    </button>
  )
}

const GROUP_LABEL: Record<string, string> = {
  fixed:    'Monthly bill',
  variable: 'Day-to-day spending',
  debt:     'Debt repayment',
}

export function AddExpenseSheet({ open, onClose, item, priorEntry, dictionary, quickItems, onSelectQuickItem, currency, isDesktop, onSave }: Props) {
  const [otherName, setOtherName]           = useState('')
  const [otherFrequency, setOtherFrequency] = useState<'recurring' | 'oneoff' | null>(null)
  const [otherType, setOtherType]           = useState<'bill' | 'everyday' | 'debt' | null>(null)
  const [dictMatch, setDictMatch]           = useState<DictionaryEntry | null>(null)
  const [overrideDict, setOverrideDict]     = useState(false)
  const [amount, setAmount]                 = useState('')
  const [note, setNote]                     = useState('')
  const [saving, setSaving]                 = useState(false)
  const [saved, setSaved]                   = useState(false)
  const [mode, setMode]                     = useState<'update' | 'add'>('update')

  const amountRef = useRef<HTMLInputElement>(null)
  const nameRef   = useRef<HTMLInputElement>(null)

  // Reset on open
  useEffect(() => {
    if (!open) return
    setOtherName('')
    setOtherFrequency(null)
    setOtherType(null)
    setDictMatch(null)
    setOverrideDict(false)
    setAmount('')
    setNote('')
    setSaved(false)
    setMode(item?.groupType === 'goal' ? 'add' : 'update')
  }, [open, item])

  // Dictionary lookup as user types
  useEffect(() => {
    if (!item?.isOther || !dictionary || overrideDict) {
      setDictMatch(null)
      return
    }
    const normalized = otherName.trim().toLowerCase()
    setDictMatch(normalized ? (dictionary[normalized] ?? null) : null)
  }, [otherName, dictionary, item?.isOther, overrideDict])

  // Auto-focus amount when dictionary match found
  useEffect(() => {
    if (dictMatch && !overrideDict) {
      setTimeout(() => amountRef.current?.focus(), 50)
    }
  }, [dictMatch, overrideDict])

  // Auto-focus for non-other flows — wait for prior check to resolve
  useEffect(() => {
    if (!open) return
    if (item?.isOther) { setTimeout(() => nameRef.current?.focus(), 320); return }
    if (priorEntry !== undefined) { setTimeout(() => amountRef.current?.focus(), 50) }
  }, [open, priorEntry]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill amount once priorEntry resolves:
  //   - prior transaction exists + update mode → fill with prior amount
  //   - no prior transaction + planned amount set → fill with planned amount
  useEffect(() => {
    if (priorEntry === undefined) return  // still loading
    if (priorEntry && mode === 'update' && amount === '') {
      setAmount(String(priorEntry.amount))
    } else if (!priorEntry && item?.plannedAmount && amount === '') {
      setAmount(String(item.plannedAmount))
    }
  }, [priorEntry]) // eslint-disable-line react-hooks/exhaustive-deps

  // For all non-other items, the page always fetches prior entry.
  // undefined = still loading, null = checked/none, object = found.
  const waitingForPrior = !item?.isOther && priorEntry === undefined
  const hasPrior        = !item?.isOther && !!priorEntry

  // Debt items opened via "Add a debt" button — skip categorisation questions
  const isDebtFlow = item?.isOther && item?.groupType === 'debt'

  // Resolved group type for Other items
  const otherGroupType = isDebtFlow
    ? 'debt'
    : dictMatch && !overrideDict
      ? dictMatch.groupType
      : otherFrequency === 'recurring' && otherType === 'bill'
        ? 'fixed'
        : otherFrequency === 'recurring' && otherType === 'debt'
          ? 'debt'
          : 'variable'

  // Questions answered?
  const otherQuestionsReady = isDebtFlow
    ? otherName.trim().length > 0
    : (!!dictMatch && !overrideDict) ||
      otherFrequency === 'oneoff' ||
      (otherFrequency === 'recurring' && otherType !== null)

  const amountNum = parseFloat(amount) || 0
  const canSave   = item?.isOther
    ? amountNum > 0 && otherName.trim().length > 0 && otherQuestionsReady
    : amountNum > 0

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9.]/g, '')
    const parts = val.split('.')
    if (parts.length > 2) return
    if (parts[1] && parts[1].length > 2) return
    setAmount(val)
  }

  // Format raw amount string for display (e.g. "1234.5" → "1,234.5")
  const displayAmount = (() => {
    if (!amount) return ''
    const parts = amount.split('.')
    const int = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return parts.length > 1 ? `${int}.${parts[1]}` : int
  })()

  const handleSave = async () => {
    if (!canSave || !item) return
    setSaving(true)
    try {
      const finalLabel = item.isOther ? otherName.trim() : item.label
      const finalKey   = item.isOther
        ? `custom_${finalLabel.toLowerCase().replace(/\s+/g, '_').slice(0, 40)}`
        : item.key
      const finalGroup = item.isOther ? otherGroupType : item.groupType

      await onSave({
        key:             finalKey,
        label:           finalLabel,
        groupType:       finalGroup,
        amount:          amountNum,
        note,
        replaceExisting: hasPrior && mode === 'update',
      })
      setSaving(false)
      setSaved(true)
      setTimeout(() => { setSaved(false); onClose() }, 700)
    } catch {
      setSaving(false)
    }
  }

  const title = isDebtFlow ? 'Add a debt' : item?.isOther ? 'What did you spend on?' : (item?.label ?? 'Log a payment')

  return (
    <Sheet open={open} onClose={onClose} title={title} isDesktop={isDesktop}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ══ OTHER FLOW ══════════════════════════════════════ */}
        {item?.isOther && (
          <>
            {/* Quick-tap chips — shown when no name typed, non-debt */}
            {!isDebtFlow && quickItems && quickItems.length > 0 && otherName.trim().length === 0 && (
              <div>
                <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: T.textMuted, fontFamily: 'var(--font-sans)' }}>
                  Recent
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {quickItems.map(qi => (
                    <QuickChip
                      key={qi.key}
                      item={qi}
                      currency={currency}
                      onClick={() => onSelectQuickItem?.({ key: qi.key, label: qi.label, groupType: qi.groupType, isOther: false, plannedAmount: qi.plannedAmount })}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Name input */}
            <div>
              {isDebtFlow && (
                <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 500, color: T.text2, fontFamily: 'var(--font-sans)' }}>
                  What&apos;s this debt?
                </p>
              )}
              <input
                ref={nameRef}
                type="text"
                value={otherName}
                onChange={e => setOtherName(e.target.value)}
                placeholder={isDebtFlow ? 'e.g. Car loan, Credit card, HELB' : 'e.g. Netflix, Dog food, Haircut'}
                onKeyDown={e => { if (e.key === 'Enter' && otherName.trim()) e.currentTarget.blur() }}
                style={{
                  height: 46, borderRadius: 12, border: `1.5px solid ${T.border}`,
                  padding: '0 14px', fontSize: 14, color: T.text1, background: T.white,
                  fontFamily: 'var(--font-sans)', outline: 'none', width: '100%', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Dictionary match — skip questions */}
            {dictMatch && !overrideDict && otherName.trim().length > 0 && (() => {
              const level = getConfidenceLevel(dictMatch.count ?? 1)
              return (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#F2F2F0', borderRadius: 10, padding: '10px 14px',
              }}>
                <div>
                  <p style={{ margin: 0, fontSize: 12, color: CONFIDENCE_COLOR[level], fontFamily: 'var(--font-sans)' }}>
                    {CONFIDENCE_LABEL[level]}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 600, color: T.text1, fontFamily: 'var(--font-sans)' }}>
                    {GROUP_LABEL[dictMatch.groupType] ?? dictMatch.groupType}
                  </p>
                </div>
                <button
                  onClick={() => { setOverrideDict(true); setDictMatch(null) }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, color: T.text3, fontFamily: 'var(--font-sans)',
                    padding: '4px 6px',
                  }}
                >
                  That's wrong
                </button>
              </div>
              )
            })()}

            {/* Q1 — shown when no dict match and name is typed (not for debts) */}
            {!isDebtFlow && !dictMatch && otherName.trim().length > 0 && (
              <div>
                <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 500, color: T.text2, fontFamily: 'var(--font-sans)' }}>
                  Do you pay this most months?
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Chip label="Most months" active={otherFrequency === 'recurring'} onClick={() => { setOtherFrequency('recurring'); setOtherType(null) }} />
                  <Chip label="One-off"     active={otherFrequency === 'oneoff'}    onClick={() => { setOtherFrequency('oneoff'); setOtherType(null); setTimeout(() => amountRef.current?.focus(), 50) }} />
                </div>
              </div>
            )}

            {/* Q2 — shown only when "Most months" and no dict match (not for debts) */}
            {!isDebtFlow && !dictMatch && otherFrequency === 'recurring' && (
              <div>
                <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 500, color: T.text2, fontFamily: 'var(--font-sans)' }}>
                  What kind of payment is this?
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Chip label="Monthly bill"    active={otherType === 'bill'}     onClick={() => { setOtherType('bill');     setTimeout(() => amountRef.current?.focus(), 50) }} />
                  <Chip label="Debt repayment"  active={otherType === 'debt'}     onClick={() => { setOtherType('debt');     setTimeout(() => amountRef.current?.focus(), 50) }} />
                  <Chip label="Day-to-day"      active={otherType === 'everyday'} onClick={() => { setOtherType('everyday'); setTimeout(() => amountRef.current?.focus(), 50) }} />
                </div>
              </div>
            )}
          </>
        )}

        {/* ══ KNOWN ITEM — mode chips ═════════════════════════ */}
        {hasPrior && priorEntry && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: '#F2F2F0', borderRadius: 8, padding: '7px 11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#6B6B6B', fontFamily: 'var(--font-sans)' }}>
                Last entry:{' '}
                <span style={{ fontWeight: 600, color: '#1A1A1A' }}>
                  {currency} {Number(priorEntry.amount).toLocaleString()}
                </span>
              </span>
              <span style={{ fontSize: 13, color: '#6B6B6B', fontFamily: 'var(--font-sans)' }}>
                {formatDate(priorEntry.date)}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Chip label="Update entry" active={mode === 'update'} onClick={() => setMode('update')} />
              <Chip label="Add another"  active={mode === 'add'}    onClick={() => setMode('add')} />
            </div>
          </div>
        )}

        {/* ══ AMOUNT + NOTE + SAVE ════════════════════════════ */}
        {!waitingForPrior && (item?.isOther ? otherQuestionsReady : true) && (
          <>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '12px 0 8px',
              marginBottom: 24,
              borderTop: (item?.isOther || hasPrior) ? `1px solid ${T.border}` : 'none',
            }}>
              <span style={{ fontSize: 12.5, color: T.text3, fontFamily: 'var(--font-sans)', marginBottom: 4 }}>
                {currency}
              </span>
              <input
                ref={amountRef}
                type="text"
                inputMode="decimal"
                value={displayAmount}
                onChange={handleAmountChange}
                placeholder="0"
                onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
                style={{
                  fontSize: 52, fontWeight: 700, textAlign: 'center',
                  background: 'none', border: 'none', outline: 'none', width: '100%',
                  color: amount ? T.text1 : T.textMuted,
                  fontFamily: 'var(--font-sans)', letterSpacing: -1, lineHeight: 1, padding: 0,
                }}
              />
            </div>

            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add a note (optional)"
              style={{
                height: 46, borderRadius: 12, border: `1.5px solid ${T.border}`,
                padding: '0 14px', fontSize: 14, color: T.text1, background: T.white,
                fontFamily: 'var(--font-sans)', outline: 'none', width: '100%', boxSizing: 'border-box',
              }}
            />

            <button
              onClick={handleSave}
              disabled={!canSave || saving}
              style={{
                height: 52, borderRadius: 14,
                background: saved ? '#15803D' : canSave ? T.brandDark : T.border,
                border: 'none',
                color: canSave || saved ? '#fff' : T.textMuted,
                fontSize: 15, fontWeight: 600,
                cursor: canSave ? 'pointer' : 'not-allowed',
                fontFamily: 'var(--font-sans)', width: '100%', transition: 'background 0.2s',
              }}
            >
              {saved ? 'Saved' : saving ? 'Saving...' : amountNum > 0 ? `Log ${currency} ${displayAmount}` : 'Enter an amount'}
            </button>
          </>
        )}

      </div>
    </Sheet>
  )
}
