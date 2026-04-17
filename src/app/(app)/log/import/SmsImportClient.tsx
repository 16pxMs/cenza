'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PrimaryBtn, SecondaryBtn, TertiaryBtn } from '@/components/ui/Button/Button'
import { IconBack, IconCheck } from '@/components/ui/Icons'
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
  sourceHash: string
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
  redLight: 'var(--red-light)',
  redBorder: 'var(--red-border)',
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
  return 'Spending'
}

const CATEGORY_HELPER: Record<ImportCategoryType, string> = {
  everyday: 'For everyday spending like food, transport, or going out',
  fixed: 'For fixed costs like rent, bills, or subscriptions',
  debt: 'Money you owe and are paying back',
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

const DUPLICATE_MESSAGE = 'This message was already added'

function recomputeRowState(
  nextRows: EditableRow[],
  prevRowErrors: Record<string, string[]>,
  prevRowWarnings: Record<string, string[]>
): { nextRowErrors: Record<string, string[]>; nextRowWarnings: Record<string, string[]> } {
  // Count in-batch occurrences of each sourceHash so we can tell whether a row
  // is still a duplicate of something currently in the list.
  const hashCounts = new Map<string, number>()
  for (const row of nextRows) {
    if (!row.sourceHash) continue
    hashCounts.set(row.sourceHash, (hashCounts.get(row.sourceHash) ?? 0) + 1)
  }

  const nextRowErrors: Record<string, string[]> = {}
  for (const row of nextRows) {
    const prev = prevRowErrors[row.id]
    if (!prev || prev.length === 0) continue
    // Drop the duplicate message if the row is no longer duplicated in-batch.
    // Cross-batch duplicates (sms_import_lines) will be re-flagged by the
    // server on the next save attempt — client state is display only.
    const filtered = prev.filter((message) => {
      if (message !== DUPLICATE_MESSAGE) return true
      const count = row.sourceHash ? hashCounts.get(row.sourceHash) ?? 0 : 0
      return count > 1
    })
    if (filtered.length > 0) nextRowErrors[row.id] = filtered
  }

  const existingIds = new Set(nextRows.map((row) => row.id))
  const nextRowWarnings: Record<string, string[]> = {}
  for (const id of Object.keys(prevRowWarnings)) {
    if (!existingIds.has(id)) continue
    const warnings = prevRowWarnings[id]
    if (warnings && warnings.length > 0) nextRowWarnings[id] = warnings
  }

  return { nextRowErrors, nextRowWarnings }
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
    errors.push('Select category.')
  }
  if (row.categoryType === 'debt' && isGenericDebtLabel(row.label)) {
    errors.push('Use a specific debt name (e.g. "KCB loan", "Visa card").')
  }
  return errors
}

export function SmsImportClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo') || '/log'

  const [rawText, setRawText] = useState('')
  const [rows, setRows] = useState<EditableRow[]>([])
  const [parseMeta, setParseMeta] = useState<{ scanned: number; skippedCredits: number }>({ scanned: 0, skippedCredits: 0 })
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [rowErrors, setRowErrors] = useState<Record<string, string[]>>({})
  const [rowWarnings, setRowWarnings] = useState<Record<string, string[]>>({})
  const [expandedRaw, setExpandedRaw] = useState<Record<string, boolean>>({})

  const selectedCount = rows.length
  const savedRows = rows
  const hasClientValidationErrors = useMemo(
    () => rows.some((row) => validateRow(row).length > 0),
    [rows]
  )
  const smsPlaceholder = [
    'M-PESA: Confirmed. KES 2,100 paid to Naivas',
    'food 500',
    'groceries 2500',
  ].join('\n')
  const hasWarnings = Object.keys(rowWarnings).length > 0
  const hasHardBlockedRows = Object.keys(rowErrors).length > 0

  const applyRowsChange = (
    mutator: (current: EditableRow[]) => EditableRow[]
  ) => {
    setRows((current) => {
      const nextRows = mutator(current)
      const { nextRowErrors, nextRowWarnings } = recomputeRowState(nextRows, rowErrors, rowWarnings)
      setRowErrors(nextRowErrors)
      setRowWarnings(nextRowWarnings)
      return nextRows
    })
  }

  const updateRow = (id: string, patch: Partial<EditableRow>) => {
    applyRowsChange((current) =>
      current.map((row) => {
        if (row.id !== id) return row
        const next = { ...row, ...patch }
        if (patch.label != null && patch.categoryKey == null) {
          next.categoryKey = slugify(next.label) || next.categoryKey
        }
        return next
      })
    )
  }

  const handleParse = async () => {
    setParsing(true)
    setError(null)
    try {
      const result = await parseSmsImport(rawText)
      if (!result.ok) {
        setError(
          result.error.kind === 'unauthorized'
            ? result.error.message
            : "We couldn't read those messages right now. Please try again in a moment."
        )
        return
      }
      const data = result.data
      setRows(
        data.rows.map((row) => ({
          ...row,
          categoryType: row.confidence === 'high' ? row.categoryType : null,
        }))
      )
      setParseMeta({ scanned: data.scanned, skippedCredits: data.skippedCredits })
      setRowErrors({})
      setRowWarnings({})
      if (data.rows.length === 0) {
        setError("Each line needs a name and an amount. Try 'food 500' or 'groceries 2500'.")
      }
    } catch {
      setError("We couldn't read those messages right now. Please try again in a moment.")
    } finally {
      setParsing(false)
    }
  }

  const handleSave = async (confirmOverride = false) => {
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
        setRowWarnings({})
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
        sourceHash: row.sourceHash,
      }))

      const result = await saveParsedSmsExpenses(payload, { confirmOverride })
      if (!result.ok) {
        setError(
          result.error.kind === 'unauthorized'
            ? result.error.message
            : "We couldn't save right now. Please try again in a moment."
        )
        setSaving(false)
        return
      }
      const data = result.data
      if (data.blocked) {
        const hasHardErrors = Object.keys(data.rowErrors ?? {}).length > 0
        setRowErrors(data.rowErrors ?? {})
        setRowWarnings(data.rowWarnings ?? {})
        if (hasHardErrors) {
          setError('Some messages were already added. Remove them to continue.')
        } else if (data.duplicates > 0) {
          setError(
            data.duplicates === 1
              ? 'One row looks similar to something you already logged.'
              : `${data.duplicates} rows look similar to something you already logged.`
          )
        } else {
          setError('Review rows marked with issues before saving.')
        }
        setSaving(false)
        return
      }
      setSavedCount(data.saved)
    } catch {
      setError("We couldn't save right now. Please try again in a moment.")
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
          Add your expenses
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
                Paste your messages
              </p>
              <p style={{ margin: '0 0 14px', fontSize: 14, color: T.text3, lineHeight: 1.5 }}>
                Paste bank messages or simple entries like &lsquo;food 500&rsquo;.
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
              <p style={{ margin: '6px 0 0', fontSize: 12, color: T.textMuted, lineHeight: 1.5 }}>
                We only use what you paste here
              </p>
              <PrimaryBtn
                size="lg"
                onClick={handleParse}
                disabled={parsing || rawText.trim().length === 0}
                style={{ marginTop: 12 }}
              >
                {parsing ? 'Reading…' : 'See my expenses'}
              </PrimaryBtn>
            </>
          ) : (
            <>
              {(() => {
                const needsAttentionCount = rows.reduce((count, row) => {
                  const issues = rowErrors[row.id] ?? validateRow(row)
                  return count + (issues.length > 0 ? 1 : 0)
                }, 0)
                return (
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ margin: '0 0 4px', fontSize: 17, color: T.text1, fontWeight: 600 }}>
                      Here&rsquo;s what we found
                    </p>
                    <p style={{ margin: 0, fontSize: 13, color: T.text3, lineHeight: 1.5 }}>
                      Review and save your expenses.
                    </p>
                    {needsAttentionCount > 0 && (
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: T.textMuted, lineHeight: 1.5 }}>
                        Some entries need a category.
                      </p>
                    )}
                  </div>
                )
              })()}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {rows.map((row) => {
                  const rowIssues = rowErrors[row.id] ?? validateRow(row)
                  const rowIsHardBlocked = rowIssues.length > 0
                  return (
                  <div
                    key={row.id}
                    style={{
                      border: `1px solid ${rowIsHardBlocked ? T.redBorder : T.borderSubtle}`,
                      borderRadius: 12,
                      padding: 12,
                      background: rowIsHardBlocked ? T.redLight : 'var(--white)',
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
                      <p style={{ margin: 0, fontSize: 13, color: T.text1, fontWeight: 600 }}>
                        {row.currency} {Number.isFinite(row.amount) ? row.amount.toLocaleString() : 0}
                        <span style={{ color: T.text3, fontWeight: 500 }}>
                          {' · '}
                          {new Date(`${row.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </p>
                      <button
                        type="button"
                        aria-label="Remove row"
                        onClick={() => {
                          applyRowsChange((current) => current.filter((r) => r.id !== row.id))
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
                        const warnings = rowWarnings[row.id] ?? []
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
                                { value: 'everyday', label: 'Spending' },
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
                            {row.categoryType && (
                              <p style={{ margin: 0, fontSize: 12, color: T.text3, lineHeight: 1.5 }}>
                                {CATEGORY_HELPER[row.categoryType]}
                              </p>
                            )}
                            {hasIssues && (
                              <div style={{ display: 'grid', gap: 4 }}>
                                {issues.map((issue, index) => (
                                  <p key={`${row.id}-issue-${index}`} style={{ margin: 0, fontSize: 11, color: T.redDark, lineHeight: 1.4 }}>
                                    {issue}
                                  </p>
                                ))}
                              </div>
                            )}
                            {!hasIssues && warnings.length > 0 && (
                              <div style={{ display: 'grid', gap: 4 }}>
                                {warnings.map((warning, index) => (
                                  <p key={`${row.id}-warning-${index}`} style={{ margin: 0, fontSize: 11, color: T.text2, lineHeight: 1.4 }}>
                                    {warning}
                                  </p>
                                ))}
                              </div>
                            )}
                          </>
                        )
                      })()}

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
                  )
                })}
              </div>

              {error && (
                <p style={{ margin: '10px 0 0', fontSize: 13, color: T.redDark, lineHeight: 1.45 }}>
                  {error}
                </p>
              )}

              {hasHardBlockedRows && !error && (
                <p style={{ margin: '10px 0 0', fontSize: 12, color: T.text2, lineHeight: 1.5 }}>
                  Remove the ones already added to continue
                </p>
              )}

              <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                {hasWarnings && !hasHardBlockedRows ? (
                  <PrimaryBtn
                    size="lg"
                    onClick={() => handleSave(true)}
                    disabled={saving || selectedCount === 0 || hasClientValidationErrors}
                  >
                    {saving ? 'Saving…' : 'Save anyway'}
                  </PrimaryBtn>
                ) : (
                  <PrimaryBtn
                    size="lg"
                    onClick={() => handleSave(false)}
                    disabled={saving || selectedCount === 0 || hasClientValidationErrors || hasHardBlockedRows}
                  >
                    {saving ? 'Saving…' : `Save ${selectedCount} ${selectedCount === 1 ? 'expense' : 'expenses'}`}
                  </PrimaryBtn>
                )}
                <SecondaryBtn
                  size="lg"
                  onClick={() => {
                    setRows([])
                    setRowErrors({})
                    setRowWarnings({})
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
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
            <TertiaryBtn
              size="md"
              onClick={() => router.push(`/log/new?isOther=true&returnTo=${encodeURIComponent(returnTo)}`)}
            >
              Add manually
            </TertiaryBtn>
          </div>
        )}
      </div>
    </div>
  )
}
