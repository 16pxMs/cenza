'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PrimaryBtn, SecondaryBtn, TertiaryBtn } from '@/components/ui/Button/Button'
import { IconBack } from '@/components/ui/Icons'
import { useUser } from '@/lib/context/UserContext'
import { parseSmsImport, saveParsedSmsExpenses } from './actions'

type ImportCategoryType = 'everyday' | 'fixed' | 'debt'

interface EditableRow {
  id: string
  raw: string
  label: string
  categoryType: ImportCategoryType
  categoryKey: string
  amount: number
  currency: string
  date: string
  include: boolean
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

function categoryLabel(value: ImportCategoryType) {
  if (value === 'fixed') return 'Essentials'
  if (value === 'debt') return 'Debt'
  return 'Life'
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

  const selectedCount = useMemo(() => rows.filter((row) => row.include).length, [rows])

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
  }

  const handleParse = async () => {
    setParsing(true)
    setError(null)
    try {
      const result = await parseSmsImport(rawText)
      setRows(result.rows)
      setParseMeta({ scanned: result.scanned, skippedCredits: result.skippedCredits })
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
      const payload = rows.map((row) => ({
        id: row.id,
        label: row.label.trim() || 'Unknown item',
        categoryType: row.categoryType,
        categoryKey: slugify(row.categoryKey || row.label) || `imported_${row.id}`,
        amount: Number(row.amount),
        date: row.date,
        include: row.include,
      }))

      const result = await saveParsedSmsExpenses(payload)
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
          <button
            onClick={() => router.push(returnTo)}
            style={{
              width: 44, height: 44, border: 'none', background: 'none', padding: 0, cursor: 'pointer',
              color: 'var(--grey-900)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <IconBack size={20} />
          </button>

          <div style={{
            marginTop: 8,
            background: T.white,
            border: `1px solid ${T.border}`,
            borderRadius: 20,
            padding: 20,
          }}>
            <p style={{ margin: '0 0 8px', fontSize: 13, color: T.textMuted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Imported
            </p>
            <p style={{ margin: '0 0 8px', fontSize: 30, color: T.text1, fontWeight: 700, letterSpacing: '-0.02em' }}>
              {savedCount} {savedCount === 1 ? 'expense added' : 'expenses added'}
            </p>
            <p style={{ margin: '0 0 16px', fontSize: 14, color: T.text2, lineHeight: 1.5 }}>
              Your SMS import is complete and your expense log is updated.
            </p>

            <PrimaryBtn size="lg" onClick={() => router.push('/log')}>
              View expense log
            </PrimaryBtn>
            <SecondaryBtn size="lg" onClick={() => router.push('/log/new?returnTo=/log')} style={{ marginTop: 10 }}>
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
                placeholder={'M-PESA: Confirmed. KES 2,100 paid to Naivas on 08/04/2026.\nBank: Your account was debited KES 700 at Uber on Apr 8.'}
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
                <p style={{ margin: 0, fontSize: 17, color: T.text1, fontWeight: 600 }}>
                  We found {rows.length} {rows.length === 1 ? 'expense' : 'expenses'}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: T.text3, lineHeight: 1.45 }}>
                  Scanned {parseMeta.scanned} lines{parseMeta.skippedCredits > 0 ? ` · skipped ${parseMeta.skippedCredits} credits` : ''}.
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
                      background: row.include ? 'var(--white)' : 'var(--grey-50)',
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={row.include}
                        onChange={(event) => updateRow(row.id, { include: event.target.checked })}
                      />
                      <span style={{ fontSize: 13, color: T.text3 }}>
                        Include this expense
                      </span>
                      <span style={{
                        marginLeft: 'auto',
                        fontSize: 11,
                        color: row.confidence === 'low' ? T.textMuted : 'var(--brand-dark)',
                        background: row.confidence === 'low' ? 'var(--grey-100)' : T.brand,
                        borderRadius: 999,
                        padding: '2px 8px',
                        textTransform: 'capitalize',
                        fontWeight: 600,
                      }}>
                        {row.confidence}
                      </span>
                    </label>

                    <div style={{ display: 'grid', gap: 8 }}>
                      <input
                        value={row.label}
                        onChange={(event) => updateRow(row.id, { label: event.target.value })}
                        placeholder="Expense name"
                        style={{
                          width: '100%',
                          height: 42,
                          borderRadius: 10,
                          border: `1px solid ${T.border}`,
                          padding: '0 10px',
                          fontSize: 14,
                          color: T.text1,
                          boxSizing: 'border-box',
                          fontFamily: 'inherit',
                        }}
                      />

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <input
                          value={Number.isFinite(row.amount) ? String(row.amount) : ''}
                          inputMode="decimal"
                          onChange={(event) => {
                            const value = event.target.value.replace(/,/g, '')
                            if (value !== '' && !/^\d*\.?\d*$/.test(value)) return
                            updateRow(row.id, { amount: Number(value || 0) })
                          }}
                          placeholder="Amount"
                          style={{
                            height: 42,
                            borderRadius: 10,
                            border: `1px solid ${T.border}`,
                            padding: '0 10px',
                            fontSize: 14,
                            color: T.text1,
                            boxSizing: 'border-box',
                            fontFamily: 'inherit',
                          }}
                        />
                        <input
                          type="date"
                          value={row.date}
                          onChange={(event) => updateRow(row.id, { date: event.target.value })}
                          style={{
                            height: 42,
                            borderRadius: 10,
                            border: `1px solid ${T.border}`,
                            padding: '0 10px',
                            fontSize: 14,
                            color: T.text1,
                            boxSizing: 'border-box',
                            fontFamily: 'inherit',
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {(['everyday', 'fixed', 'debt'] as ImportCategoryType[]).map((type) => {
                          const isSelected = row.categoryType === type
                          return (
                            <button
                              key={type}
                              onClick={() => updateRow(row.id, { categoryType: type })}
                              style={{
                                height: 34,
                                borderRadius: 999,
                                border: isSelected ? `1px solid ${T.brandMid}` : `1px solid ${T.border}`,
                                background: isSelected ? T.brand : 'var(--grey-50)',
                                color: isSelected ? T.brandDark : T.text2,
                                padding: '0 12px',
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              {categoryLabel(type)}
                            </button>
                          )
                        })}
                      </div>

                      <p style={{ margin: '2px 0 0', fontSize: 11, color: T.textMuted, lineHeight: 1.4 }}>
                        {row.raw}
                      </p>
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
                  disabled={saving || selectedCount === 0}
                >
                  {saving ? 'Saving…' : `Save ${selectedCount} ${selectedCount === 1 ? 'expense' : 'expenses'}`}
                </PrimaryBtn>
                <SecondaryBtn
                  size="lg"
                  onClick={() => {
                    setRows([])
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
            <TertiaryBtn size="md" onClick={() => router.push('/log/new?returnTo=/log')} style={{ color: T.text3 }}>
              Enter manually instead
            </TertiaryBtn>
          </div>
        )}
      </div>
    </div>
  )
}
