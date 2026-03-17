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
  border:       '#EDE8F5',
  borderStrong: '#D5CDED',
  text1:        '#1A1025',
  text2:        '#4A3B66',
  text3:        '#8B7BA8',
  textMuted:    '#B8AECE',
}


export interface SheetItem {
  key:       string
  label:     string
  groupType: string
  isOther:   boolean
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
  count?:    number  // times this item has been logged (for confidence)
}

interface Props {
  open:        boolean
  onClose:     () => void
  item:        SheetItem | null
  priorEntry:  PriorEntry | null | undefined
  dictionary?: Record<string, DictionaryEntry>  // normalized name → entry
  currency:    string
  isDesktop?:  boolean
  onSave:      (data: ExpenseSaveData) => Promise<void>
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

const GROUP_LABEL: Record<string, string> = {
  fixed:    'Monthly bill',
  variable: 'Day-to-day spending',
}

export function AddExpenseSheet({ open, onClose, item, priorEntry, dictionary, currency, isDesktop, onSave }: Props) {
  const [otherName, setOtherName]           = useState('')
  const [otherFrequency, setOtherFrequency] = useState<'recurring' | 'oneoff' | null>(null)
  const [otherType, setOtherType]           = useState<'bill' | 'everyday' | null>(null)
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

  // Auto-fill amount with prior entry when in update mode
  useEffect(() => {
    if (priorEntry && mode === 'update' && amount === '') {
      setAmount(String(priorEntry.amount))
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

  const title = isDebtFlow ? 'Add a debt' : item?.isOther ? 'Something else' : (item?.label ?? 'Add a payment')

  return (
    <Sheet open={open} onClose={onClose} title={title} isDesktop={isDesktop}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ══ OTHER FLOW ══════════════════════════════════════ */}
        {item?.isOther && (
          <>
            {/* Name input */}
            <div>
              <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 500, color: T.text2, fontFamily: 'var(--font-sans)' }}>
                {isDebtFlow ? 'What\'s this debt?' : 'What\'s this payment for?'}
              </p>
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
                  More like a bill or day-to-day spending?
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Chip label="Monthly bill" active={otherType === 'bill'}     onClick={() => { setOtherType('bill');     setTimeout(() => amountRef.current?.focus(), 50) }} />
                  <Chip label="Day-to-day"   active={otherType === 'everyday'} onClick={() => { setOtherType('everyday'); setTimeout(() => amountRef.current?.focus(), 50) }} />
                </div>
              </div>
            )}
          </>
        )}

        {/* ══ KNOWN ITEM — mode chips ═════════════════════════ */}
        {hasPrior && priorEntry && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ alignSelf: 'flex-start', background: '#F2F2F0', borderRadius: 8, padding: '7px 11px' }}>
              <span style={{ fontSize: 13, color: '#6B6B6B', fontFamily: 'var(--font-sans)' }}>
                Last entry:{' '}
                <span style={{ fontWeight: 600, color: '#1A1A1A' }}>
                  {currency} {Number(priorEntry.amount).toLocaleString()}
                </span>
                {' '}· {formatDate(priorEntry.date)}
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
              borderTop: (item?.isOther || hasPrior) ? `1px solid ${T.border}` : 'none',
              borderBottom: `1.5px solid ${T.border}`,
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
