'use client'
// EditSpendingBudgetSheet — compatibility wrapper around SpendingBudgetEditor
// The main app now uses the page-first route at /income/budget for setup.
// Keep the editor reusable, and treat this Sheet wrapper as secondary.
import { useState, useEffect, useRef } from 'react'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { PrimaryBtn, SecondaryBtn } from '@/components/ui/Button/Button'

const T = {
  white:     'var(--white)',
  border:    'var(--border)',
  subtle:    'var(--border-subtle)',
  text1:     'var(--text-1)',
  text2:     'var(--text-2)',
  text3:     'var(--text-3)',
  textMuted: 'var(--text-muted)',
  brandDark: 'var(--brand-dark)',
  brand:     'var(--brand)',
  pageBg:    'var(--page-bg)',
}

// Common spending categories with emoji
const SUGGESTIONS = [
  { key: 'groceries',     label: 'Groceries',      emoji: '🛒' },
  { key: 'transport',     label: 'Transport',       emoji: '🚌' },
  { key: 'eating_out',    label: 'Eating out',      emoji: '🍽️' },
  { key: 'airtime',       label: 'Airtime & data',  emoji: '📱' },
  { key: 'entertainment', label: 'Entertainment',   emoji: '🎬' },
  { key: 'personal_care', label: 'Personal care',   emoji: '💄' },
  { key: 'household',     label: 'Household',       emoji: '🏠' },
  { key: 'clothing',      label: 'Clothing',        emoji: '👕' },
  { key: 'health',        label: 'Health',          emoji: '💊' },
  { key: 'savings',       label: 'Savings',         emoji: '💰' },
  { key: 'education',     label: 'Education',       emoji: '📚' },
  { key: 'family',        label: 'Family support',  emoji: '🤲' },
]

export interface BudgetCategory {
  key:    string
  label:  string
  budget: number
}

interface Row extends BudgetCategory {
  _id:     number
  _amount: string
  emoji?:  string
}

interface Props {
  open:              boolean
  onClose:           () => void
  onSave:            (categories: BudgetCategory[]) => void
  initialCategories: BudgetCategory[]
  currency:          string
  isDesktop?:        boolean
  saving?:           boolean
  spendingHistory?:  Record<string, number>
}

interface EditorProps {
  initialCategories: BudgetCategory[]
  currency: string
  onSave: (categories: BudgetCategory[]) => void
  saving?: boolean
  spendingHistory?: Record<string, number>
}

function stripCommas(s: string) { return s.replace(/,/g, '') }
function withCommas(s: string) {
  const clean = stripCommas(s).replace(/[^\d.]/g, '')
  const [int, dec] = clean.split('.')
  const formatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return dec !== undefined ? `${formatted}.${dec}` : formatted
}

let _uid = 0
const nextId = () => ++_uid

export function EditSpendingBudgetSheet({
  open, onClose, onSave, initialCategories, currency, isDesktop, saving, spendingHistory = {},
}: Props) {
  return (
    <Sheet open={open} onClose={onClose} title="Spending budget" isDesktop={isDesktop}>
      <SpendingBudgetEditor
        initialCategories={initialCategories}
        currency={currency}
        onSave={onSave}
        saving={saving}
        spendingHistory={spendingHistory}
      />
    </Sheet>
  )
}

export function SpendingBudgetEditor({
  initialCategories,
  currency,
  onSave,
  saving,
  spendingHistory = {},
}: EditorProps) {
  const [rows,       setRows]       = useState<Row[]>([])
  const [addLabel,   setAddLabel]   = useState('')
  const [addAmount,  setAddAmount]  = useState('')
  const [showCustom, setShowCustom] = useState(false)

  const inputRefs = useRef<Map<number, HTMLInputElement>>(new Map())

  useEffect(() => {
    setRows(
      initialCategories
        .filter(c => c.budget > 0)
        .map(c => ({
          ...c,
          _id:     nextId(),
          _amount: c.budget.toLocaleString(),
          emoji:   SUGGESTIONS.find(s => s.key === c.key)?.emoji,
        }))
    )
    setShowCustom(false)
    setAddLabel('')
    setAddAmount('')
  }, [initialCategories])

  // Suggestions not yet added
  const usedKeys    = new Set(rows.map(r => r.key))
  const suggestions = SUGGESTIONS.filter(s => !usedKeys.has(s.key))

  const addSuggestion = (s: typeof SUGGESTIONS[number]) => {
    const id = nextId()
    const hist = spendingHistory[s.key]
    const prefill = hist ? Math.round(hist).toLocaleString() : ''
    setRows(prev => [...prev, { _id: id, key: s.key, label: s.label, budget: hist ?? 0, _amount: prefill, emoji: s.emoji }])
    setTimeout(() => inputRefs.current.get(id)?.focus(), 60)
  }

  const updateAmount = (id: number, raw: string) => {
    setRows(prev => prev.map(r => r._id === id ? { ...r, _amount: withCommas(raw) } : r))
  }

  const removeRow = (id: number) => {
    setRows(prev => prev.filter(r => r._id !== id))
  }

  const addCustom = () => {
    const amount = parseFloat(stripCommas(addAmount))
    if (!addLabel.trim() || !amount || amount <= 0) return
    const key = addLabel.trim().toLowerCase().replace(/\s+/g, '_') + '_' + Date.now()
    setRows(prev => [...prev, {
      _id: nextId(), key, label: addLabel.trim(), budget: amount,
      _amount: amount.toLocaleString(),
    }])
    setAddLabel('')
    setAddAmount('')
    setShowCustom(false)
  }

  const closeCustom = () => {
    setShowCustom(false)
    setAddLabel('')
    setAddAmount('')
  }

  const handleSave = () => {
    const categories: BudgetCategory[] = rows
      .map(r => ({ key: r.key, label: r.label, budget: parseFloat(stripCommas(r._amount)) || 0 }))
      .filter(c => c.budget > 0)
    onSave(categories)
  }

  const total = rows.reduce((s, r) => s + (parseFloat(stripCommas(r._amount)) || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

        {/* ── Added categories ── */}
        {rows.length > 0 && (
          <div style={{ marginBottom: 4 }}>
            {rows.map((row, i) => (
              <div key={row._id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '11px 0',
                borderBottom: `1px solid var(--border-subtle)`,
              }}>
                {/* Emoji or letter avatar */}
                <div style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  background: 'var(--brand)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: row.emoji ? 16 : 13, fontWeight: 700,
                  color: row.emoji ? 'inherit' : 'var(--brand-dark)',
                }}>
                  {row.emoji ?? row.label.charAt(0).toUpperCase()}
                </div>

                <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: T.text1 }}>{row.label}</span>

                {/* Amount input */}
                <div style={{
                  display: 'flex', alignItems: 'center',
                  background: 'var(--grey-50)', border: `1px solid var(--border)`,
                  borderRadius: 10, padding: '0 10px', height: 38, width: 120,
                }}>
                  <span style={{ fontSize: 11, color: T.textMuted, marginRight: 4, flexShrink: 0 }}>{currency}</span>
                  <input
                    ref={el => { if (el) inputRefs.current.set(row._id, el); else inputRefs.current.delete(row._id) }}
                    type="text"
                    inputMode="decimal"
                    value={row._amount}
                    placeholder="0"
                    onChange={e => updateAmount(row._id, e.target.value)}
                    style={{
                      flex: 1, border: 'none', background: 'transparent',
                      fontSize: 14, fontWeight: 600, color: T.text1, outline: 'none',
                      textAlign: 'right', minWidth: 0,
                    }}
                  />
                </div>

                <button
                  onClick={() => removeRow(row._id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '4px 2px', color: T.textMuted, flexShrink: 0,
                    fontSize: 15, lineHeight: 1, display: 'flex', alignItems: 'center',
                  }}
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>
            ))}

            {/* Total */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 0 4px',
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Total</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: T.text1 }}>
                {currency} {total.toLocaleString()}
                <span style={{ fontSize: 12, fontWeight: 400, color: T.textMuted }}>/mo</span>
              </span>
            </div>
          </div>
        )}

        {/* ── Quick add suggestions ── */}
        {suggestions.length > 0 && (
          <div style={{ marginTop: rows.length > 0 ? 20 : 0 }}>
            <p style={{
              margin: '0 0 10px', fontSize: 11, fontWeight: 600,
              color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.6px',
            }}>
              {rows.length === 0 ? 'Choose categories to budget' : 'Add more'}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {suggestions.map(s => {
                const hist = spendingHistory[s.key]
                return (
                  <button
                    key={s.key}
                    onClick={() => addSuggestion(s)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      height: hist ? 44 : 36, padding: hist ? '0 12px' : '0 12px',
                      borderRadius: 10,
                      background: 'var(--grey-50)', border: `1px solid var(--border)`,
                      cursor: 'pointer', flexShrink: 0,
                      flexDirection: 'column', justifyContent: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14 }}>{s.emoji}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: T.text2 }}>{s.label}</span>
                    </div>
                    {hist && (
                      <span style={{ fontSize: 10, fontWeight: 500, color: T.textMuted }}>
                        {currency} {Math.round(hist).toLocaleString()} last month
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Custom category ── */}
        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => setShowCustom(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 0', fontSize: 14, color: T.brandDark, fontWeight: 500,
            }}
          >
            <span style={{ fontSize: 17, lineHeight: 1 }}>+</span>
            Custom category
          </button>
        </div>

        {/* ── Save ── */}
        <button
          onClick={handleSave}
          disabled={saving || rows.length === 0}
          style={{
            marginTop: 28, width: '100%', height: 52, borderRadius: 14,
            background: T.brandDark, border: 'none',
            fontSize: 15, fontWeight: 600, color: '#fff',
            cursor: (saving || rows.length === 0) ? 'not-allowed' : 'pointer',
            opacity: (saving || rows.length === 0) ? 0.45 : 1,
          }}
        >
          {saving ? 'Saving…' : rows.length === 0 ? 'Add a category to save' : `Save — ${currency} ${total.toLocaleString()}/mo`}
        </button>

        <Sheet open={showCustom} onClose={closeCustom} title="Custom category">
          <p style={{ margin: '0 0 16px', fontSize: 14, color: T.text3, lineHeight: 1.6 }}>
            Use this when the spending bucket you need is not in the suggestions. The amount is the monthly budget for that category.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="text"
              placeholder="Category name"
              value={addLabel}
              onChange={e => setAddLabel(e.target.value)}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && addLabel.trim() && parseFloat(stripCommas(addAmount))) addCustom() }}
              style={{
                width: '100%', height: 44, borderRadius: 10,
                border: `1px solid var(--border)`, background: T.white,
                padding: '0 12px', fontSize: 14, color: T.text1, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <div style={{
              display: 'flex', alignItems: 'center',
              background: T.white, border: `1px solid var(--border)`,
              borderRadius: 10, padding: '0 10px', height: 44,
              boxSizing: 'border-box',
            }}>
              <span style={{ fontSize: 11, color: T.textMuted, marginRight: 6 }}>{currency}</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={addAmount}
                onChange={e => setAddAmount(withCommas(e.target.value))}
                onKeyDown={e => { if (e.key === 'Enter' && addLabel.trim() && parseFloat(stripCommas(addAmount))) addCustom() }}
                style={{
                  flex: 1, border: 'none', background: 'transparent',
                  fontSize: 14, fontWeight: 600, color: T.text1, outline: 'none',
                  textAlign: 'right', minWidth: 0,
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <SecondaryBtn
              size="md"
              onClick={closeCustom}
              style={{
                flex: 1, height: 40, borderRadius: 10,
                borderColor: 'var(--border)',
                color: T.text3,
              }}
            >
              Cancel
            </SecondaryBtn>
            <PrimaryBtn
              size="md"
              onClick={addCustom}
              disabled={!addLabel.trim() || !parseFloat(stripCommas(addAmount))}
              style={{
                flex: 1,
                background: T.brandDark,
                color: 'var(--text-inverse)',
                opacity: (!addLabel.trim() || !parseFloat(stripCommas(addAmount))) ? 0.45 : 1,
              }}
            >
              Add
            </PrimaryBtn>
          </div>
        </Sheet>

    </div>
  )
}
