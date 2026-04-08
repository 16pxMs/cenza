'use client'
// ─────────────────────────────────────────────────────────────
// EditFixedExpensesSheet — compatibility wrapper around FixedExpensesEditor
//
// The main app now uses the page-first route at /income/fixed for setup.
// Keep the editor reusable, and treat this Sheet wrapper as secondary.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { PrimaryBtn, SecondaryBtn } from '@/components/ui/Button/Button'

const T = {
  white:     '#FFFFFF',
  border:    '#EDE8F5',
  text1:     '#1A1025',
  text2:     '#4A3B66',
  text3:     '#8B7BA8',
  textMuted: '#B8AECE',
  brandDark: '#5C3489',
  pageBg:    '#FAFAF8',
  red:       '#DC2626',
}

const EXPENSE_ICONS: Record<string, string> = {
  rent: '🏠', electricity: '⚡', water: '💧', gas: '🔥',
  internet: '📡', phone: '📱', houseKeeping: '🧹',
  blackTax: '🤲', schoolFees: '🎓', childcare: '👶',
}
const EXPENSE_LABELS: Record<string, string> = {
  rent: 'Rent', electricity: 'Electricity', water: 'Water', gas: 'Cooking fuel',
  internet: 'Internet', phone: 'Phone', houseKeeping: 'Housekeeping',
  blackTax: 'Black tax', schoolFees: 'School fees', childcare: 'Childcare',
}

export interface FixedEntry {
  key:        string
  label:      string
  monthly:    number
  confidence: string
}

interface Row extends FixedEntry {
  _id:     number
  _amount: string  // formatted display value
}

interface Props {
  open:            boolean
  onClose:         () => void
  onSave:          (entries: FixedEntry[]) => void
  initialEntries:  FixedEntry[]
  currency:        string
  isDesktop?:      boolean
  saving?:         boolean
}

interface EditorProps {
  initialEntries: FixedEntry[]
  currency: string
  onSave: (entries: FixedEntry[]) => void
  saving?: boolean
}

function fmt(n: number) {
  return n.toLocaleString()
}

function stripCommas(s: string) {
  return s.replace(/,/g, '')
}

function withCommas(s: string) {
  const clean = stripCommas(s).replace(/[^\d.]/g, '')
  const [int, dec] = clean.split('.')
  const formatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return dec !== undefined ? `${formatted}.${dec}` : formatted
}

let _id = 0
const nextId = () => ++_id

export function EditFixedExpensesSheet({
  open, onClose, onSave, initialEntries, currency, isDesktop, saving,
}: Props) {
  return (
    <Sheet open={open} onClose={onClose} title="Fixed expenses" isDesktop={isDesktop}>
      <FixedExpensesEditor
        initialEntries={initialEntries}
        currency={currency}
        onSave={onSave}
        saving={saving}
      />
    </Sheet>
  )
}

export function FixedExpensesEditor({
  initialEntries,
  currency,
  onSave,
  saving,
}: EditorProps) {
  const [rows, setRows]           = useState<Row[]>([])
  const [addLabel, setAddLabel]   = useState('')
  const [addAmount, setAddAmount] = useState('')
  const [showAdd, setShowAdd]     = useState(false)

  useEffect(() => {
    setRows(
      initialEntries
        .filter(e => e.monthly > 0)
        .map(e => ({ ...e, _id: nextId(), _amount: fmt(e.monthly) }))
    )
    setShowAdd(false)
    setAddLabel('')
    setAddAmount('')
  }, [initialEntries])

  const updateAmount = (_id: number, raw: string) => {
    const val = withCommas(raw)
    setRows(prev => prev.map(r => r._id === _id ? { ...r, _amount: val } : r))
  }

  const removeRow = (_id: number) => {
    setRows(prev => prev.filter(r => r._id !== _id))
  }

  const addRow = () => {
    const amount = parseFloat(stripCommas(addAmount))
    if (!addLabel.trim() || !amount || amount <= 0) return
    const key = addLabel.trim().toLowerCase().replace(/\s+/g, '_') + '_' + Date.now()
    setRows(prev => [...prev, {
      _id:        nextId(),
      key,
      label:      addLabel.trim(),
      monthly:    amount,
      confidence: 'known',
      _amount:    fmt(amount),
    }])
    setAddLabel('')
    setAddAmount('')
    setShowAdd(false)
  }

  const closeAdd = () => {
    setShowAdd(false)
    setAddLabel('')
    setAddAmount('')
  }

  const handleSave = () => {
    const entries: FixedEntry[] = rows
      .map(r => ({
        key:        r.key,
        label:      EXPENSE_LABELS[r.key] ?? r.label,
        monthly:    parseFloat(stripCommas(r._amount)) || 0,
        confidence: r.confidence,
      }))
      .filter(e => e.monthly > 0)
    onSave(entries)
  }

  const total = rows.reduce((s, r) => s + (parseFloat(stripCommas(r._amount)) || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Rows */}
      {rows.length === 0 && !showAdd && (
        <p style={{ fontSize: 14, color: T.textMuted, textAlign: 'center', padding: '24px 0' }}>
          No fixed expenses. Add one below.
        </p>
      )}

      {rows.map((row) => (
        <div key={row._id} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 0',
          borderBottom: `1px solid ${T.border}`,
        }}>
          <span style={{ fontSize: 20, width: 28, textAlign: 'center', flexShrink: 0 }}>
            {EXPENSE_ICONS[row.key] ?? '📋'}
          </span>
          <span style={{ flex: 1, fontSize: 14, color: T.text2 }}>
            {EXPENSE_LABELS[row.key] ?? row.label}
          </span>
          <div style={{
            display: 'flex', alignItems: 'center',
            background: T.pageBg, border: `1px solid ${T.border}`,
            borderRadius: 10, padding: '0 10px', height: 38, width: 110,
          }}>
            <span style={{ fontSize: 11, color: T.textMuted, marginRight: 4, flexShrink: 0 }}>{currency}</span>
            <input
              type="text"
              inputMode="decimal"
              value={row._amount}
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
              padding: 4, color: T.textMuted, flexShrink: 0,
              fontSize: 16, lineHeight: 1,
            }}
            aria-label="Remove"
          >
            ✕
          </button>
        </div>
      ))}

      {/* Add row */}
      {!showAdd && (
        <button
          onClick={() => setShowAdd(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '14px 0', background: 'none', border: 'none',
            cursor: 'pointer', fontSize: 14, color: T.brandDark, fontWeight: 500,
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
          Add expense
        </button>
      )}

      {/* Total */}
      {rows.length > 0 && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 0 4px',
          borderTop: `1px solid ${T.border}`,
          marginTop: 4,
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '0.7px' }}>Total</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: T.text1 }}>
            {currency} {total.toLocaleString()}<span style={{ fontSize: 12, fontWeight: 400, color: T.text3 }}>/mo</span>
          </span>
        </div>
      )}

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          marginTop: 24, width: '100%', height: 52, borderRadius: 14,
          background: T.brandDark, border: 'none',
          fontSize: 15, fontWeight: 600, color: '#fff',
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? 'Saving…' : 'Save changes'}
      </button>

      <Sheet open={showAdd} onClose={closeAdd} title="Custom fixed expense">
        <p style={{ margin: '0 0 16px', fontSize: 14, color: T.text3, lineHeight: 1.6 }}>
          Use this for recurring costs that are not already listed, like gym membership, parking, or maintenance.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="text"
            placeholder="Expense name"
            value={addLabel}
            onChange={e => setAddLabel(e.target.value)}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter' && addLabel.trim() && parseFloat(stripCommas(addAmount))) addRow() }}
            style={{
              width: '100%', height: 44, borderRadius: 10,
              border: `1px solid ${T.border}`, background: T.white,
              padding: '0 12px', fontSize: 14, color: T.text1, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div style={{
            display: 'flex', alignItems: 'center',
            background: T.white, border: `1px solid ${T.border}`,
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
              onKeyDown={e => { if (e.key === 'Enter' && addLabel.trim() && parseFloat(stripCommas(addAmount))) addRow() }}
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
            onClick={closeAdd}
            style={{
              flex: 1,
              borderColor: T.border,
              color: T.text3,
            }}
          >
            Cancel
          </SecondaryBtn>
          <PrimaryBtn
            size="md"
            onClick={addRow}
            disabled={!addLabel.trim() || !parseFloat(stripCommas(addAmount))}
            style={{
              flex: 1,
              background: T.brandDark,
              color: 'var(--text-inverse)',
              opacity: (!addLabel.trim() || !parseFloat(stripCommas(addAmount))) ? 0.5 : 1,
            }}
          >
            Add
          </PrimaryBtn>
        </div>
      </Sheet>
    </div>
  )
}
