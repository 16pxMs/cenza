'use client'
// ─────────────────────────────────────────────────────────────
// EditFixedExpensesSheet — compatibility wrapper around FixedExpensesEditor
//
// The main app now uses the page-first route at /income/fixed for setup.
// Keep the editor reusable, and treat this Sheet wrapper as secondary.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { PrimaryBtn, TertiaryBtn } from '@/components/ui/Button/Button'
import {
  canonicalizeFixedBillKey,
  isKnownFixedBillKey,
  slugifyBillLabel,
} from '@/lib/fixed-bills/canonical'

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
  priority?:  'core' | 'flex'
}

interface Row extends FixedEntry {
  _id:     number
  _amount: string  // formatted display value
}

interface EditDraft {
  _id: number | null
  label: string
  amount: string
  priority: 'core' | 'flex'
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

function normalizePriority(value: unknown): 'core' | 'flex' {
  return value === 'core' ? 'core' : 'flex'
}

function priorityLabel(value: unknown) {
  return normalizePriority(value) === 'core' ? 'Required' : 'Flexible'
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
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)

  useEffect(() => {
    setRows(
      initialEntries
        .filter(e => e.monthly > 0)
        .map(e => ({
          ...e,
          priority: e.priority === 'flex' ? 'flex' : 'core',
          _id: nextId(),
          _amount: fmt(e.monthly),
        }))
    )
    setEditDraft(null)
  }, [initialEntries])

  const openEdit = (row: Row) => {
    setEditDraft({
      _id: row._id,
      label: EXPENSE_LABELS[row.key] ?? row.label,
      amount: row._amount,
      priority: normalizePriority(row.priority),
    })
  }

  const openNew = () => {
    setEditDraft({
      _id: null,
      label: '',
      amount: '',
      priority: 'flex',
    })
  }

  const closeEdit = () => {
    setEditDraft(null)
  }

  const saveDraft = () => {
    if (!editDraft) return
    const amount = parseFloat(stripCommas(editDraft.amount))
    const existing = editDraft._id == null ? null : rows.find(row => row._id === editDraft._id) ?? null
    const trimmed = (editDraft.label.trim() || existing?.label || '').trim()
    if (!trimmed || !amount || amount <= 0) return

    const slug = slugifyBillLabel(trimmed)
    const key = existing
      ? existing.key
      : isKnownFixedBillKey(trimmed)
        ? canonicalizeFixedBillKey(trimmed)
        : `${slug || 'item'}_${Date.now()}`

    const nextRow: Row = {
      _id:        existing?._id ?? nextId(),
      key,
      label:      trimmed,
      monthly:    amount,
      confidence: existing?.confidence ?? 'known',
      priority:   normalizePriority(editDraft.priority),
      _amount:    fmt(amount),
    }

    setRows(prev => existing
      ? prev.map(row => row._id === existing._id ? nextRow : row)
      : [...prev, nextRow]
    )
    setEditDraft(null)
  }

  const handleSave = () => {
    const entries: FixedEntry[] = rows
      .map(r => ({
        key:        r.key,
        label:      EXPENSE_LABELS[r.key] ?? r.label,
        monthly:    parseFloat(stripCommas(r._amount)) || 0,
        confidence: r.confidence,
        priority:   normalizePriority(r.priority),
      }))
      .filter(e => e.monthly > 0)
    onSave(entries)
  }

  const total = rows.reduce((s, r) => s + (parseFloat(stripCommas(r._amount)) || 0), 0)
  const draftAmount = editDraft ? parseFloat(stripCommas(editDraft.amount)) || 0 : 0
  const canSaveDraft = Boolean(editDraft && editDraft.label.trim() && draftAmount > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Rows */}
      {rows.length === 0 && (
        <p style={{ fontSize: 14, color: T.textMuted, textAlign: 'center', padding: '24px 0' }}>
          No fixed expenses. Add one below.
        </p>
      )}

      {rows.map((row) => (
        <button
          key={row._id}
          type="button"
          onClick={() => openEdit(row)}
          style={{
            width: '100%',
            display: 'grid',
            gap: 2,
            padding: '12px 0',
            border: 'none',
            borderBottom: `1px solid ${T.border}`,
            background: 'transparent',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 20, width: 28, textAlign: 'center', flexShrink: 0 }}>
              {EXPENSE_ICONS[row.key] ?? '📋'}
            </span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, color: T.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {EXPENSE_LABELS[row.key] ?? row.label}
            </span>
            <span style={{ fontSize: 15, fontWeight: 700, color: T.text1, flexShrink: 0 }}>
              {currency} {row._amount}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 40, fontSize: 12, color: T.text3, lineHeight: 1.4 }}>
            <span>{priorityLabel(row.priority)}</span>
          </div>
        </button>
      ))}

      {/* Add row */}
      <button
        onClick={openNew}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '14px 0', background: 'none', border: 'none',
          borderBottom: `1px solid ${T.border}`,
          cursor: 'pointer', fontSize: 14, color: T.brandDark, fontWeight: 600,
        }}
      >
        <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
        Add expense
      </button>

      {/* Total */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 0 4px',
        marginTop: 4,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '0.7px' }}>Total</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: T.text1 }}>
          {currency} {total.toLocaleString()} <span style={{ fontSize: 12, fontWeight: 400, color: T.text3 }}>/ month</span>
        </span>
      </div>

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
        {saving ? 'Saving…' : 'Save'}
      </button>

      <Sheet open={!!editDraft} onClose={closeEdit} title={editDraft?._id == null ? 'Add fixed cost' : 'Edit fixed cost'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {editDraft?._id == null && (
            <input
              type="text"
              placeholder="Expense name"
              value={editDraft?.label ?? ''}
              onChange={e => setEditDraft(prev => prev ? { ...prev, label: e.target.value } : prev)}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && canSaveDraft) saveDraft() }}
              style={{
                width: '100%', height: 44, borderRadius: 10,
                border: `1px solid ${T.border}`, background: T.white,
                padding: '0 12px', fontSize: 14, color: T.text1, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          )}
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
              value={editDraft?.amount ?? ''}
              onChange={e => setEditDraft(prev => prev ? { ...prev, amount: withCommas(e.target.value) } : prev)}
              onKeyDown={e => { if (e.key === 'Enter' && canSaveDraft) saveDraft() }}
              style={{
                flex: 1, border: 'none', background: 'transparent',
                fontSize: 14, fontWeight: 600, color: T.text1, outline: 'none',
                textAlign: 'right', minWidth: 0,
              }}
            />
          </div>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.text3 }}>Type</span>
            <select
              value={editDraft?.priority ?? 'flex'}
              onChange={(e) => setEditDraft(prev => prev ? { ...prev, priority: normalizePriority(e.target.value) } : prev)}
              style={{
                width: '100%',
                height: 44,
                borderRadius: 10,
                border: `1px solid ${T.border}`,
                background: T.white,
                padding: '0 12px',
                fontSize: 14,
                color: T.text1,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            >
              <option value="core">Required</option>
              <option value="flex">Flexible</option>
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {editDraft?._id != null && (
            <TertiaryBtn
              size="md"
              onClick={() => {
                const id = editDraft._id
                setRows(prev => prev.filter(r => r._id !== id))
                setEditDraft(null)
              }}
              style={{ flex: 1, color: T.red }}
            >
              Remove
            </TertiaryBtn>
          )}
          <PrimaryBtn
            size="md"
            onClick={saveDraft}
            disabled={!canSaveDraft}
            style={{
              flex: 1,
              background: T.brandDark,
              color: 'var(--text-inverse)',
              opacity: canSaveDraft ? 1 : 0.5,
            }}
          >
            Done
          </PrimaryBtn>
        </div>
      </Sheet>
    </div>
  )
}
