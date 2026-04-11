'use client'
export const dynamic = 'force-dynamic'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/lib/context/ToastContext'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { SecondaryBtn, TertiaryBtn } from '@/components/ui/Button/Button'
import { IconBack, IconMore } from '@/components/ui/Icons'
import { fmt, formatDate } from '@/lib/finance'
import type { CategoryType } from '@/types/database'
import type { HistoryLedgerPageData, LedgerTransaction } from '@/lib/loaders/history-ledger'
import { deleteHistoryEntry, refundHistoryCategory, updateHistoryEntry } from './actions'

const T = {
  brand: 'var(--brand)',
  brandDark: 'var(--brand-dark)',
  white: 'var(--white)',
  border: 'var(--border)',
  borderSubtle: 'var(--border-subtle)',
  borderStrong: 'var(--border-strong)',
  text1: 'var(--text-1)',
  text2: 'var(--text-2)',
  text3: 'var(--text-3)',
  textMuted: 'var(--text-muted)',
  textInverse: 'var(--text-inverse)',
  greenLight: 'var(--green-light)',
  greenBorder: 'var(--green-border)',
  greenDark: 'var(--green-dark)',
  red: 'var(--red)',
  redDark: 'var(--red-dark)',
  amber: 'var(--amber)',
  grey100: 'var(--grey-100)',
}

const EDIT_TYPE_OPTIONS: Array<{ value: Extract<CategoryType, 'everyday' | 'fixed' | 'debt'>; label: string; helper: string }> = [
  { value: 'everyday', label: 'Life', helper: 'Day-to-day and personal spending.' },
  { value: 'fixed', label: 'Essentials', helper: 'Home and must-pay monthly costs.' },
  { value: 'debt', label: 'Debt', helper: 'Money you borrowed and are paying back.' },
]

interface CategoryLedgerPageClientProps {
  data: HistoryLedgerPageData
  categoryKey: string
  categoryLabel: string
  planned: number
  categoryType: CategoryType
  returnTo: string
}

export default function CategoryLedgerPageClient({
  data,
  categoryKey,
  categoryLabel,
  planned,
  categoryType,
  returnTo,
}: CategoryLedgerPageClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { isDesktop } = useBreakpoint()

  const [editId, setEditId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editLabel, setEditLabel] = useState('')
  const [editCategoryType, setEditCategoryType] = useState<Extract<CategoryType, 'everyday' | 'fixed' | 'debt'>>('everyday')
  const [editIsSmsMeta, setEditIsSmsMeta] = useState(false)
  const [focusedField, setFocusedField] = useState<'label' | 'amount' | 'date' | 'note' | null>(null)
  const [saving, setSaving] = useState(false)
  const [activeEntry, setActiveEntry] = useState<LedgerTransaction | null>(null)
  const [entrySheetStep, setEntrySheetStep] = useState<'menu' | 'confirm' | 'refund'>('menu')
  const [deleting, setDeleting] = useState(false)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundNote, setRefundNote] = useState('')
  const [savingRefund, setSavingRefund] = useState(false)

  const labelRef = useRef<HTMLInputElement>(null)
  const refundRef = useRef<HTMLInputElement>(null)

  const openEdit = (txn: LedgerTransaction) => {
    setEditId(txn.id)
    setEditAmount(String(txn.amount))
    setEditDate(txn.date)
    setEditNote(txn.note ?? '')
    setEditLabel(getEntryTitle(txn))
    setEditCategoryType((txn.categoryType === 'everyday' || txn.categoryType === 'fixed' || txn.categoryType === 'debt') ? txn.categoryType : 'everyday')
    setEditIsSmsMeta((txn.note ?? '').trim().toLowerCase() === 'imported from sms')
    setFocusedField('label')
    setTimeout(() => labelRef.current?.focus(), 80)
  }

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }
    router.push(returnTo)
  }

  const refreshPage = () => {
    router.refresh()
  }

  const handleSave = async () => {
    const amount = parseFloat(editAmount) || 0
    if (!editId || amount <= 0) return

    setSaving(true)
    try {
      await updateHistoryEntry({
        id: editId,
        amount,
        date: editDate,
        note: editNote,
        label: editLabel,
        categoryKey: editLabel.trim().toLowerCase().replace(/\s+/g, '_'),
        categoryType: editCategoryType,
        currentCategoryKey: categoryKey,
      })
      toast('Entry updated')
      setEditId(null)
      setFocusedField(null)
      refreshPage()
    } catch {
      toast('Could not update entry')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!activeEntry) return

    setDeleting(true)
    try {
      await deleteHistoryEntry(activeEntry.id, categoryKey)
      toast('Entry deleted')
      setActiveEntry(null)
      refreshPage()
    } catch {
      toast('Could not delete entry')
    } finally {
      setDeleting(false)
    }
  }

  const handleRefund = async () => {
    const amount = parseFloat(refundAmount) || 0
    if (!activeEntry || amount <= 0) return

    setSavingRefund(true)
    try {
      await refundHistoryCategory({
        categoryType,
        categoryKey,
        categoryLabel: getEntryTitle(activeEntry),
        amount,
        note: refundNote,
      })
      toast(categoryType === 'debt' ? 'Payback recorded' : 'Refund recorded')
      setActiveEntry(null)
      setRefundAmount('')
      setRefundNote('')
      refreshPage()
    } catch {
      toast('Could not record refund')
    } finally {
      setSavingRefund(false)
    }
  }

  const overBudget = planned > 0 && data.totalSpent > planned
  const pct = planned > 0 ? Math.min(100, (data.totalSpent / planned) * 100) : 0
  const barColor = overBudget
    ? T.red
    : categoryType === 'fixed'
      ? 'var(--green)'
      : categoryType === 'goal'
        ? T.brandDark
        : pct > 75 ? T.amber : 'var(--green)'
  const spendCount = data.txns.filter(txn => txn.amount > 0).length
  const pad = isDesktop ? '0 32px' : '0 16px'
  const normalizedCategoryLabel = categoryLabel.trim().toLowerCase()

  const openEntryMenu = (txn: LedgerTransaction) => {
    setActiveEntry(txn)
    setEntrySheetStep('menu')
    setRefundAmount('')
    setRefundNote('')
  }

  const dateGroups = data.txns.reduce<Record<string, LedgerTransaction[]>>((acc, txn) => {
    if (!acc[txn.date]) acc[txn.date] = []
    acc[txn.date].push(txn)
    return acc
  }, {})
  const sortedDates = Object.keys(dateGroups).sort((a, b) => b.localeCompare(a))
  const getEntryTitle = (txn: LedgerTransaction) => {
    const label = txn.categoryLabel?.trim()
    if (label) return label
    if (txn.amount < 0) return categoryType === 'debt' ? 'Debt payback' : 'Refund'
    return categoryType === 'debt' ? 'Debt payment' : categoryLabel
  }

  const content = (
    <div style={{ paddingBottom: isDesktop ? 80 : 100 }}>
      <div style={{ padding: isDesktop ? '32px 32px 18px' : '18px 16px 18px' }}>
        <button
          onClick={goBack}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            width: 44,
            height: 44,
            padding: 0,
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconBack size={18} color="var(--grey-900)" />
        </button>
        <p style={{ margin: '0 0 8px', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {data.monthLabel}
        </p>
        <h1 style={{ margin: 0, fontSize: isDesktop ? 'var(--text-2xl)' : 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', lineHeight: 1.08, letterSpacing: '-0.035em', color: T.text1 }}>
          {categoryLabel}
        </h1>
      </div>

      <div style={{ padding: pad, marginBottom: 28 }}>
        <div style={{
          background: T.white,
          borderRadius: 22,
          border: `1px solid ${T.border}`,
          overflow: 'hidden',
        }}>
          <div style={{ padding: '24px 20px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 }}>
              <div>
                <p style={{ margin: '0 0 6px', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Spent
                </p>
                <p style={{ margin: 0, fontSize: 'var(--text-3xl)', fontWeight: 'var(--weight-bold)', color: overBudget ? T.red : T.text1, lineHeight: 1, letterSpacing: '-0.04em' }}>
                  {fmt(data.totalSpent, data.currency)}
                </p>
              </div>
              {planned > 0 && (
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: '0 0 6px', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    Budget
                  </p>
                  <p style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 'var(--weight-semibold)', color: T.text3 }}>
                    {fmt(planned, data.currency)}
                  </p>
                </div>
              )}
            </div>

            {planned > 0 && (
              <div style={{ height: 5, background: T.grey100, borderRadius: 99, overflow: 'hidden', marginBottom: 14 }}>
                <div style={{
                  height: '100%',
                  borderRadius: 99,
                  width: `${pct}%`,
                  background: barColor,
                  transition: 'width 0.4s ease',
                }} />
              </div>
            )}

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: T.text3, lineHeight: 1.45 }}>
                {overBudget
                  ? `${fmt(data.totalSpent - planned, data.currency)} over budget`
                  : planned > 0 && pct === 100
                    ? `Exactly on budget · ${spendCount} ${spendCount === 1 ? 'entry' : 'entries'}`
                    : planned > 0
                      ? `${fmt(planned - data.totalSpent, data.currency)} remaining · ${spendCount} ${spendCount === 1 ? 'entry' : 'entries'}`
                      : `${spendCount} ${spendCount === 1 ? 'entry' : 'entries'} this month`}
              </p>

            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: pad }}>
        {data.txns.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '48px 24px',
            background: T.white,
            border: '1px solid var(--border)',
            borderRadius: 16,
          }}>
            <div style={{ fontSize: 'var(--text-sm)', color: T.textMuted }}>
              No entries logged yet this month.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {sortedDates.map(date => (
              <div key={date}>
                <div style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--weight-semibold)',
                  color: T.textMuted,
                  marginBottom: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                }}>
                  {formatDate(date)}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {dateGroups[date].map(txn => {
                    const isEditing = editId === txn.id
                    const isRefund = txn.amount < 0
                    const hasNote = !!(txn.note && txn.note !== 'Refund')
                    const entryTitle = getEntryTitle(txn)
                    const showEntryTitle = entryTitle.trim().toLowerCase() !== normalizedCategoryLabel
                    const entryDateLabel = formatDate(txn.date)
                    const fallbackDetail = `No description · ${entryDateLabel}`

                    return (
                      <div
                        key={txn.id}
                        style={{
                          background: isRefund ? T.greenLight : T.white,
                          border: isRefund ? `1px solid ${T.greenBorder}` : '1px solid var(--border)',
                          borderRadius: 16,
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{ padding: '18px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: isRefund ? T.greenDark : T.text1, marginBottom: hasNote ? 4 : 0, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                              {isRefund ? `−${fmt(Math.abs(txn.amount), data.currency)}` : fmt(txn.amount, data.currency)}
                            </div>
                            {showEntryTitle && (
                              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: isRefund ? T.greenDark : T.text2, lineHeight: 1.35, marginBottom: hasNote ? 2 : 0 }}>
                                {entryTitle}
                              </div>
                            )}
                            {isRefund && !hasNote && (
                              <span style={{
                                fontSize: 'var(--text-xs)',
                                fontWeight: 'var(--weight-semibold)',
                                color: T.greenDark,
                                background: 'var(--green-border)',
                                borderRadius: 4,
                                padding: '2px 6px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                display: 'inline-block',
                              }}>
                                Refund
                              </span>
                            )}
                            {hasNote ? (
                              <div style={{ fontSize: 'var(--text-sm)', color: isRefund ? T.greenDark : T.text3, lineHeight: 1.45 }}>
                                {txn.note}
                              </div>
                            ) : showEntryTitle ? null : (
                              <div style={{ fontSize: 'var(--text-sm)', color: isRefund ? T.greenDark : T.text3, lineHeight: 1.45 }}>
                                {fallbackDetail}
                              </div>
                            )}
                          </div>

                          {!isRefund && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                              {isEditing ? (
                                <TertiaryBtn
                                  size="sm"
                                  onClick={() => {
                                    setEditId(null)
                                    setFocusedField(null)
                                  }}
                                  style={{
                                    padding: 0,
                                    lineHeight: 1,
                                  }}
                                >
                                  Cancel
                                </TertiaryBtn>
                              ) : (
                                <button
                                  onClick={() => openEntryMenu(txn)}
                                  style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 999,
                                    border: `1px solid ${T.border}`,
                                    background: T.grey100,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: T.text2,
                                    cursor: 'pointer',
                                    flexShrink: 0,
                                  }}
                                  aria-label="More actions"
                                >
                                  <IconMore size={18} color="var(--text-2)" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {isEditing && (
                          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--grey-25)' }}>
                            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                              Name
                            </div>
                            <input
                              ref={labelRef}
                              type="text"
                              value={editLabel}
                              onChange={event => setEditLabel(event.target.value)}
                              onFocus={() => setFocusedField('label')}
                              onBlur={() => setFocusedField((current) => (current === 'label' ? null : current))}
                              placeholder="Expense name"
                              style={{
                                height: 40,
                                borderRadius: 10,
                                border: `2px solid ${focusedField === 'label' ? 'var(--border-focus)' : 'var(--border)'}`,
                                padding: '0 12px',
                                fontSize: 'var(--text-sm)',
                                color: T.text1,
                                background: T.white,
                                outline: 'none',
                                width: '100%',
                                boxSizing: 'border-box',
                              }}
                            />
                            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>
                              Amount
                            </div>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={(() => {
                                if (!editAmount) return ''
                                const parts = editAmount.split('.')
                                parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                                return parts.join('.')
                              })()}
                              onChange={event => {
                                const value = event.target.value.replace(/,/g, '').replace(/[^0-9.]/g, '')
                                const parts = value.split('.')
                                if (parts.length > 2 || (parts[1] && parts[1].length > 2)) return
                                setEditAmount(value)
                              }}
                              onFocus={() => setFocusedField('amount')}
                              onBlur={() => setFocusedField((current) => (current === 'amount' ? null : current))}
                              onKeyDown={event => { if (event.key === 'Enter') handleSave() }}
                              style={{
                                height: 44,
                                borderRadius: 10,
                                border: `2px solid ${focusedField === 'amount' ? 'var(--border-focus)' : 'var(--border)'}`,
                                padding: '0 12px',
                                fontSize: 'var(--text-md)',
                                fontWeight: 'var(--weight-semibold)',
                                color: T.text1,
                                background: T.white,
                                outline: 'none',
                                width: '100%',
                                boxSizing: 'border-box',
                              }}
                            />
                            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>
                              Count this as
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {EDIT_TYPE_OPTIONS.map((option) => {
                                const active = editCategoryType === option.value
                                return (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setEditCategoryType(option.value)}
                                    style={{
                                      height: 36,
                                      borderRadius: 999,
                                      border: `1px solid ${active ? 'var(--brand-mid)' : 'var(--border)'}`,
                                      background: active ? 'var(--brand)' : T.white,
                                      color: active ? T.brandDark : T.text1,
                                      padding: '0 16px',
                                      fontSize: 'var(--text-sm)',
                                      fontWeight: 'var(--weight-semibold)',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {option.label}
                                  </button>
                                )
                              })}
                            </div>
                            <div style={{ fontSize: 'var(--text-xs)', color: T.text3, lineHeight: 1.45 }}>
                              {EDIT_TYPE_OPTIONS.find((option) => option.value === editCategoryType)?.helper}
                            </div>
                            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>
                              Date
                            </div>
                            <input
                              type="date"
                              value={editDate}
                              onChange={event => setEditDate(event.target.value)}
                              onFocus={() => setFocusedField('date')}
                              onBlur={() => setFocusedField((current) => (current === 'date' ? null : current))}
                              style={{
                                height: 40,
                                borderRadius: 10,
                                border: `2px solid ${focusedField === 'date' ? 'var(--border-focus)' : 'var(--border)'}`,
                                padding: '0 12px',
                                fontSize: 'var(--text-sm)',
                                color: T.text1,
                                background: T.white,
                                outline: 'none',
                                width: '100%',
                                boxSizing: 'border-box',
                              }}
                            />
                            {editIsSmsMeta ? (
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span
                                  style={{
                                    height: 28,
                                    borderRadius: 999,
                                    border: `1px solid ${T.border}`,
                                    background: 'var(--grey-100)',
                                    color: T.text3,
                                    padding: '0 10px',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  Imported from SMS
                                </span>
                              </div>
                            ) : (
                              <>
                                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>
                                  Note
                                </div>
                                <input
                                  type="text"
                                  value={editNote}
                                  onChange={event => setEditNote(event.target.value)}
                                  onFocus={() => setFocusedField('note')}
                                  onBlur={() => setFocusedField((current) => (current === 'note' ? null : current))}
                                  placeholder="Note (optional)"
                                  style={{
                                    height: 40,
                                    borderRadius: 10,
                                    border: `2px solid ${focusedField === 'note' ? 'var(--border-focus)' : 'var(--border)'}`,
                                    padding: '0 12px',
                                    fontSize: 'var(--text-sm)',
                                    color: T.text1,
                                    background: T.white,
                                    outline: 'none',
                                    width: '100%',
                                    boxSizing: 'border-box',
                                  }}
                                />
                              </>
                            )}
                            <button
                              onClick={handleSave}
                              disabled={saving || parseFloat(editAmount) <= 0 || !editDate || editLabel.trim().length === 0}
                              style={{
                                height: 'var(--button-height-md)',
                                borderRadius: 10,
                                background: saving ? T.border : T.brandDark,
                                border: 'none',
                                color: T.textInverse,
                                fontSize: 'var(--text-sm)',
                                fontWeight: 'var(--weight-semibold)',
                                cursor: 'pointer',
                              }}
                            >
                              {saving ? 'Saving…' : 'Save changes'}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {activeEntry && (
        <Sheet
          open={true}
          onClose={() => setActiveEntry(null)}
          title={
            entrySheetStep === 'menu'
              ? 'Actions'
              : entrySheetStep === 'refund'
                ? categoryType === 'debt' ? 'Record payback' : 'Record refund'
                : 'Are you sure?'
          }
        >
          {entrySheetStep === 'menu' && (
            <div>
              <p style={{ fontSize: 'var(--text-base)', color: T.text3, margin: '0 0 20px', lineHeight: 1.55 }}>
                {getEntryTitle(activeEntry)} · {fmt(activeEntry.amount, data.currency)} · {formatDate(activeEntry.date)}
              </p>
              <div style={{
                background: T.white,
                border: '1px solid var(--border)',
                borderRadius: 18,
                overflow: 'hidden',
              }}>
                {[
                  {
                    label: 'Edit entry',
                    sub: 'Change label, amount, date, or note',
                    action: () => { setActiveEntry(null); openEdit(activeEntry) },
                  },
                  {
                    label: categoryType === 'debt' ? 'Paid back' : 'Refund',
                    sub: categoryType === 'debt' ? 'Log money returned for this debt' : 'Log money returned for this entry',
                    action: () => { setEntrySheetStep('refund'); setTimeout(() => refundRef.current?.focus(), 80) },
                  },
                  {
                    label: "Didn't happen",
                    sub: 'Remove this expense',
                    action: () => setEntrySheetStep('confirm'),
                  },
                ].map((option, index, options) => (
                  <button
                    key={option.label}
                    onClick={option.action}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '14px 16px',
                      background: T.white,
                      border: 'none',
                      borderBottom: index < options.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      cursor: 'pointer',
                    }}
                    >
                      <div>
                      <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: T.text1 }}>{option.label}</div>
                      <div style={{ fontSize: 'var(--text-sm)', color: T.text3, marginTop: 3 }}>{option.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {entrySheetStep === 'refund' && (
            <div>
              <p style={{ fontSize: 'var(--text-base)', color: T.text3, margin: '0 0 20px', lineHeight: 1.55 }}>
                {getEntryTitle(activeEntry)} · {fmt(activeEntry.amount, data.currency)} · {formatDate(activeEntry.date)}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input
                  ref={refundRef}
                  type="text"
                  inputMode="decimal"
                  value={(() => {
                    if (!refundAmount) return ''
                    const parts = refundAmount.split('.')
                    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                    return parts.join('.')
                  })()}
                  onChange={event => {
                    const value = event.target.value.replace(/,/g, '').replace(/[^0-9.]/g, '')
                    const parts = value.split('.')
                    if (parts.length > 2 || (parts[1] && parts[1].length > 2)) return
                    setRefundAmount(value)
                  }}
                  onKeyDown={event => { if (event.key === 'Enter') handleRefund() }}
                  placeholder={categoryType === 'debt' ? 'Amount paid back' : 'Refund amount'}
                  style={{
                    width: '100%',
                    height: 44,
                    borderRadius: 10,
                    border: '1px solid var(--border-strong)',
                    padding: '0 12px',
                    fontSize: 'var(--text-md)',
                    fontWeight: 'var(--weight-semibold)',
                    color: T.text1,
                    background: T.white,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <input
                  type="text"
                  value={refundNote}
                  onChange={event => setRefundNote(event.target.value)}
                  placeholder="Note (optional)"
                  style={{
                    width: '100%',
                    height: 40,
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    padding: '0 12px',
                    fontSize: 'var(--text-sm)',
                    color: T.text1,
                    background: T.white,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  onClick={handleRefund}
                  disabled={savingRefund || parseFloat(refundAmount) <= 0}
                  style={{
                    height: 'var(--button-height-md)',
                    borderRadius: 14,
                    background: parseFloat(refundAmount) > 0 ? T.brandDark : T.border,
                    border: 'none',
                    fontSize: 'var(--text-base)',
                    fontWeight: 'var(--weight-semibold)',
                    color: parseFloat(refundAmount) > 0 ? T.textInverse : T.textMuted,
                    cursor: 'pointer',
                  }}
                >
                  {savingRefund ? 'Saving…' : categoryType === 'debt' ? 'Save payback' : 'Save refund'}
                </button>
                <TertiaryBtn
                  size="md"
                  onClick={() => setEntrySheetStep('menu')}
                  style={{ padding: '12px' }}
                >
                  Go back
                </TertiaryBtn>
              </div>
            </div>
          )}

          {entrySheetStep === 'confirm' && (
            <div>
              <p style={{ fontSize: 'var(--text-base)', color: T.text2, margin: '0 0 24px', lineHeight: 1.55 }}>
                This will permanently remove the <strong>{fmt(activeEntry.amount, data.currency)}</strong> entry
                from <strong>{formatDate(activeEntry.date)}</strong>.
              </p>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: 14,
                  background: T.redDark,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 'var(--text-base)',
                  fontWeight: 'var(--weight-semibold)',
                  color: T.textInverse,
                  opacity: deleting ? 0.6 : 1,
                }}
              >
                {deleting ? 'Removing…' : 'Yes, remove it'}
              </button>
              <TertiaryBtn
                size="md"
                onClick={() => setEntrySheetStep('menu')}
                style={{
                  marginTop: 10,
                  padding: '12px',
                }}
              >
                Go back
              </TertiaryBtn>
            </div>
          )}
        </Sheet>
      )}
    </div>
  )

  return isDesktop ? (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <SideNav />
      <main style={{ flex: 1, maxWidth: 640, margin: '0 auto' }}>{content}</main>
    </div>
  ) : (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <main>{content}</main>
    </div>
  )
}
