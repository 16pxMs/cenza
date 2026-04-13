'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PrimaryBtn, SecondaryBtn, TertiaryBtn } from '@/components/ui/Button/Button'
import { IconBack, IconCheck } from '@/components/ui/Icons'
import { useUser } from '@/lib/context/UserContext'
import { parseSmsImport, saveParsedSmsExpenses } from './actions'

type ImportCategoryType = 'everyday' | 'fixed' | 'debt'

interface EditableRow {
  id: string
  raw: string
  label: string
  categoryType: ImportCategoryType | null
  categoryKey: string
  amount: number
  currency: string
  date: string
  confidence: 'high' | 'medium' | 'low'
}

const T = {
  pageBg: 'var(--page-bg)',
  white: 'var(--white)',
  border: 'var(--border)',
  borderSubtle: 'var(--border-subtle)',
  text1: 'var(--text-1)',
  text2: 'var(--text-2)',
  text3: 'var(--text-3)',
  textMuted: 'var(--text-muted)',
  brand: 'var(--brand)',
  brandMid: 'var(--brand-mid)',
  brandDark: 'var(--brand-dark)',
  redDark: 'var(--red-dark)',
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function slugify(value: string) {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function categoryLabel(value: ImportCategoryType | null) {
  if (!value) return 'Not set'
  if (value === 'fixed') return 'Essentials'
  if (value === 'debt') return 'Debt'
  return 'Life'
}

function isGenericDebtLabel(label: string) {
  const l = normalize(label)
  return [
    'loan payment',
    'debt payment',
    'credit card payment',
    'repayment',
    'loan',
    'debt',
  ].includes(l)
}

function validateRow(row: EditableRow) {
  const errors: string[] = []

  if (!row.label.trim()) {
    errors.push('Name is required.')
  }
  if (!Number.isFinite(Number(row.amount)) || Number(row.amount) <= 0) {
    errors.push('Amount must be greater than zero.')
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
    errors.push('Date is invalid.')
  }
  if (!row.categoryType) {
    errors.push('Select a category.')
  }
  if (row.categoryType === 'debt' && isGenericDebtLabel(row.label)) {
    errors.push('Use a specific debt name (e.g. "KCB loan", "Visa card").')
  }
  return errors
}

function smsPlaceholderByCurrency(currency: string) {
  const c = (currency || 'USD').toUpperCase()

  if (c === 'KES') {
    return [
      'M-PESA: Confirmed. KES 2,100 paid to Naivas on 08/04/2026.',
      'Bank: Your account was debited KES 700 at Uber on Apr 8.',
    ].join('\n')
  }

  if (c === 'NGN') {
    return [
      'Bank alert: NGN 8,500 spent at Shoprite on 08/04/2026.',
      'Your account was debited NGN 3,200 via transfer to Bolt on Apr 8.',
    ].join('\n')
  }

  if (c === 'ZAR') {
    return [
      'Bank alert: ZAR 420 spent at Checkers on 08/04/2026.',
      'Your account was debited ZAR 160 at Uber on Apr 8.',
    ].join('\n')
  }

  if (c === 'UGX') {
    return [
      'Mobile money: UGX 25,000 paid to Carrefour on 08/04/2026.',
      'Bank: Your account was debited UGX 12,000 at Fuel Station on Apr 8.',
    ].join('\n')
  }

  if (c === 'TZS') {
    return [
      'Mobile money: TZS 18,000 paid to Vodacom on 08/04/2026.',
      'Bank: Your account was debited TZS 45,000 at Shoppers on Apr 8.',
    ].join('\n')
  }

  if (c === 'GHS') {
    return [
      'Bank alert: GHS 95 paid at Melcom on 08/04/2026.',
      'Your account was debited GHS 34 at Bolt on Apr 8.',
    ].join('\n')
  }

  if (c === 'GBP') {
    return [
      'Card spend: GBP 24.50 at Tesco on 08/04/2026.',
      'Your account was debited GBP 13.20 at Uber on Apr 8.',
    ].join('\n')
  }

  if (c === 'EUR') {
    return [
      'Card spend: EUR 18.40 at Carrefour on 08/04/2026.',
      'Your account was debited EUR 11.00 at Bolt on Apr 8.',
    ].join('\n')
  }

  return [
    `${c} 75.00 spent at Grocery Store on 08/04/2026.`,
    `Your account was debited ${c} 28.00 at Uber on Apr 8.`,
  ].join('\n')
}

export function SmsImportClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { profile } = useUser()
  const returnTo = searchParams.get('returnTo') || '/log'

  const [rawText, setRawText] = useState('')
  const [rows, setRows] = useState<EditableRow[]>([])
  const [parseMeta, setParseMeta] = useState<{ scanned: number; skippedCredits: number }>({ scanned: 0, skippedCredits: 0 })
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [rowErrors, setRowErrors] = useState<Record<string, string[]>>({})
  const [expandedRaw, setExpandedRaw] = useState<Record<string, boolean>>({})

  const selectedCount = rows.length
  const savedRows = rows
  const hasClientValidationErrors = useMemo(
    () => rows.some((row) => validateRow(row).length > 0),
    [rows]
  )
  const smsPlaceholder = useMemo(
    () => smsPlaceholderByCurrency(profile?.currency || 'USD'),
    [profile?.currency]
  )

  const updateRow = (id: string, patch: Partial<EditableRow>) => {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== id) return row
        const next = { ...row, ...patch }
        if (patch.label != null && patch.categoryKey == null) {
          next.categoryKey = slugify(next.label) || next.categoryKey
        }
        return next
      })
    )
    setRowErrors((current) => {
      const existing = { ...current }
      if (!existing[id]) return existing
      delete existing[id]
      return existing
    })
  }

  const handleParse = async () => {
    setParsing(true)
    setError(null)
    try {
      const result = await parseSmsImport(rawText)
      setRows(
        result.rows.map((row) => ({
          ...row,
          categoryType: row.confidence === 'high' ? row.categoryType : null,
        }))
      )
      setParseMeta({ scanned: result.scanned, skippedCredits: result.skippedCredits })
      setRowErrors({})
      if (result.rows.length === 0) {
        setError('No expense rows found. Paste a few bank debit messages and try again.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not parse SMS messages right now.')
    } finally {
      setParsing(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const nextRowErrors: Record<string, string[]> = {}
      for (const row of rows) {
        const issues = validateRow(row)
        if (issues.length > 0) nextRowErrors[row.id] = issues
      }

      if (Object.keys(nextRowErrors).length > 0) {
        setRowErrors(nextRowErrors)
        setError('Review rows marked with issues before saving.')
        setSaving(false)
        return
      }

      const payload = rows.map((row) => ({
        id: row.id,
        label: row.label.trim(),
        categoryType: row.categoryType as ImportCategoryType,
        categoryKey: slugify(row.categoryKey || row.label) || `imported_${row.id}`,
        amount: Number(row.amount),
        date: row.date,
      }))

      const result = await saveParsedSmsExpenses(payload)
      if (result.blocked) {
        setRowErrors(result.rowErrors ?? {})
        if (result.duplicates > 0) {
          setError(`${result.duplicates} ${result.duplicates === 1 ? 'duplicate row was' : 'duplicate rows were'} already logged.`)
        } else {
          setError('Review rows marked with issues before saving.')
        }
        setSaving(false)
        return
      }
      setSavedCount(result.saved)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save imported expenses.')
    } finally {
      setSaving(false)
    }
  }

  if (savedCount > 0) {
    return (
      <div style={{ minHeight: '100vh', background: T.pageBg }}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px' }}>
          <div style={{
            background: T.white,
            border: `1px solid ${T.border}`,
            borderRadius: 20,
            padding: 20,
          }}>
            <p style={{ margin: '0 0 8px', fontSize: 30, color: T.text1, fontWeight: 700, letterSpacing: '-0.02em' }}>
              {savedCount} {savedCount === 1 ? 'expense added' : 'expenses added'}
            </p>
            <p style={{ margin: '0 0 16px', fontSize: 14, color: T.text2, lineHeight: 1.5 }}>
              Your expense log is up to date.
            </p>

            {savedRows.length > 0 && (
              <div
                style={{
                  marginBottom: 16,
                  borderTop: `1px solid ${T.borderSubtle}`,
                  borderBottom: `1px solid ${T.borderSubtle}`,
                }}
              >
                {savedRows.map((row, index) => (
                  <div
                    key={`saved-${row.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '12px 0',
                      borderBottom: index < savedRows.length - 1 ? `1px solid ${T.borderSubtle}` : 'none',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: T.text1, lineHeight: 1.3 }}>
                        {row.label}
                      </p>
                      <p style={{ margin: 0, fontSize: 12, color: T.text3, lineHeight: 1.4 }}>
                        {categoryLabel(row.categoryType)} · {new Date(`${row.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: T.text1, textAlign: 'right', minWidth: 0 }}>
                      {row.currency} {row.amount.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <PrimaryBtn size="lg" onClick={() => router.push('/app')}>
              Back to overview
            </PrimaryBtn>
            <SecondaryBtn size="lg" onClick={() => router.push('/log/new?returnTo=/app')} style={{ marginTop: 10 }}>
              Add another expense
            </SecondaryBtn>
          </div>
        </div>
      </div>
    )
  }

  const showReview = rows.length > 0

  return (
    <div style={{ minHeight: '100vh', background: T.pageBg }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px 120px' }}>
        <button
          onClick={() => router.push(returnTo)}
          style={{
            width: 44, height: 44, border: 'none', background: 'none', padding: 0, cursor: 'pointer',
            color: 'var(--grey-900)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <IconBack size={20} />
        </button>

        <p style={{ margin: '8px 0 2px', fontSize: 'var(--text-xs)', color: T.text3 }}>
          {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>
        <h1 style={{ margin: '0 0 16px', fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', color: T.text1, letterSpacing: '-0.02em' }}>
          Import from SMS
        </h1>

        <div style={{
          background: T.white,
          border: `1px solid ${T.border}`,
          borderRadius: 20,
          padding: 20,
        }}>
          {!showReview ? (
            <>
              <p style={{ margin: '0 0 6px', fontSize: 17, color: T.text1, fontWeight: 600 }}>
                Paste your bank messages
              </p>
              <p style={{ margin: '0 0 14px', fontSize: 14, color: T.text3, lineHeight: 1.5 }}>
                Open your SMS app, copy recent bank debit messages, then paste them below.
              </p>
              <textarea
                value={rawText}
                onChange={(event) => setRawText(event.target.value)}
                placeholder={smsPlaceholder}
                style={{
                  width: '100%',
                  minHeight: 200,
                  borderRadius: 12,
                  border: `1px solid ${T.border}`,
                  padding: 12,
                  fontSize: 14,
                  color: T.text1,
                  background: 'var(--white)',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
              {error && (
                <p style={{ margin: '10px 0 0', fontSize: 13, color: T.redDark, lineHeight: 1.45 }}>
                  {error}
                </p>
              )}
              <PrimaryBtn
                size="lg"
                onClick={handleParse}
                disabled={parsing || rawText.trim().length === 0}
                style={{ marginTop: 12 }}
              >
                {parsing ? 'Parsing…' : 'Find expenses'}
              </PrimaryBtn>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <p style={{ margin: '0 0 4px', fontSize: 17, color: T.text1, fontWeight: 600 }}>
                  Review your expenses
                </p>
                <p style={{ margin: 0, fontSize: 13, color: T.text3, lineHeight: 1.5 }}>
                  Confirm each one before saving.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {rows.map((row) => (
                  <div
                    key={row.id}
                    style={{
                      border: `1px solid ${T.borderSubtle}`,
                      borderRadius: 12,
                      padding: 12,
                      background: 'var(--white)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      {row.confidence === 'low' ? (
                        <p style={{ margin: 0, fontSize: 11, color: T.textMuted, lineHeight: 1.4 }}>
                          Needs review before save.
                        </p>
                      ) : (
                        <span />
                      )}
                      <button
                        type="button"
                        aria-label="Remove row"
                        onClick={() => {
                          setRows((current) => current.filter((r) => r.id !== row.id))
                          setRowErrors((current) => {
                            const next = { ...current }
                            delete next[row.id]
                            return next
                          })
                          setExpandedRaw((current) => {
                            const next = { ...current }
                            delete next[row.id]
                            return next
                          })
                        }}
                        style={{
                          width: 24,
                          height: 24,
                          border: 'none',
                          background: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          color: T.text3,
                          fontSize: 18,
                          lineHeight: 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        ×
                      </button>
                    </div>

                    <div style={{ display: 'grid', gap: 8 }}>
                      {(() => {
                        const issues = rowErrors[row.id] ?? validateRow(row)
                        const hasIssues = issues.length > 0
                        return (
                          <>
                            <input
                              value={row.label}
                              onChange={(event) => updateRow(row.id, { label: event.target.value })}
                              placeholder={row.categoryType === 'debt' ? 'Debt name (e.g. KCB loan)' : 'Expense name'}
                              style={{
                                width: '100%',
                                height: 42,
                                borderRadius: 10,
                                border: `1px solid ${hasIssues ? T.brandMid : T.border}`,
                                padding: '0 10px',
                                fontSize: 14,
                                color: T.text1,
                                background: 'var(--white)',
                                boxSizing: 'border-box',
                                fontFamily: 'inherit',
                              }}
                            />
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {([
                                { value: 'everyday', label: 'Life' },
                                { value: 'fixed', label: 'Essentials' },
                                { value: 'debt', label: 'Debt' },
                              ] as const).map((option) => {
                                const selected = row.categoryType === option.value
                                return (
                                  <button
                                    key={`${row.id}-${option.value}`}
                                    type="button"
                                    onClick={() => updateRow(row.id, { categoryType: option.value })}
                                    style={{
                                      height: 38,
                                      borderRadius: 999,
                                      border: `1px solid ${selected ? T.brandMid : T.border}`,
                                      background: selected ? T.brand : 'var(--grey-50)',
                                      color: selected ? T.brandDark : T.text2,
                                      padding: '0 12px',
                                      fontSize: 14,
                                      fontWeight: 500,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      whiteSpace: 'nowrap',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {selected && <IconCheck size={14} color={T.brandDark} />}
                                    <span>{option.label}</span>
                                  </button>
                                )
                              })}
                            </div>
                            {hasIssues && (
                              <div style={{ display: 'grid', gap: 4 }}>
                                {issues.map((issue, index) => (
                                  <p key={`${row.id}-issue-${index}`} style={{ margin: 0, fontSize: 11, color: T.redDark, lineHeight: 1.4 }}>
                                    {issue}
                                  </p>
                                ))}
                              </div>
                            )}
                          </>
                        )
                      })()}

                      <p style={{ margin: 0, fontSize: 13, color: T.text2, fontWeight: 600 }}>
                        {row.currency} {Number.isFinite(row.amount) ? row.amount.toLocaleString() : 0}
                        {' · '}
                        {new Date(`${row.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>

                      <div>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedRaw((current) => ({ ...current, [row.id]: !current[row.id] }))
                          }
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            color: T.brandDark,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                        >
                          {expandedRaw[row.id] ? 'Hide message' : 'View message'}
                        </button>
                        {expandedRaw[row.id] && (
                          <div
                            style={{
                              marginTop: 8,
                              borderRadius: 8,
                              border: `1px solid ${T.borderSubtle}`,
                              padding: '8px 10px',
                              background: 'var(--grey-50)',
                              minWidth: 0,
                            }}
                          >
                            <p style={{ margin: 0, fontSize: 11, color: T.textMuted, lineHeight: 1.45, wordBreak: 'break-word' }}>
                              {row.raw}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <p style={{ margin: '10px 0 0', fontSize: 13, color: T.redDark, lineHeight: 1.45 }}>
                  {error}
                </p>
              )}

              <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                <PrimaryBtn
                  size="lg"
                  onClick={handleSave}
                  disabled={saving || selectedCount === 0 || hasClientValidationErrors}
                >
                  {saving ? 'Saving…' : `Save ${selectedCount} ${selectedCount === 1 ? 'expense' : 'expenses'}`}
                </PrimaryBtn>
                <SecondaryBtn
                  size="lg"
                  onClick={() => {
                    setRows([])
                    setRowErrors({})
                    setError(null)
                  }}
                >
                  Paste again
                </SecondaryBtn>
              </div>
            </>
          )}
        </div>

        {!showReview && (
          <div style={{ marginTop: 8 }}>
            <TertiaryBtn size="md" onClick={() => router.push('/log/new?returnTo=/log')}>
              Enter manually instead
            </TertiaryBtn>
          </div>
        )}
      </div>
    </div>
  )
}
