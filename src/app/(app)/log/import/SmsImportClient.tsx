'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { PrimaryBtn, SecondaryBtn, TertiaryBtn } from '@/components/ui/Button/Button'
import { Input } from '@/components/ui/Input/Input'
import { IconBack, IconChevronX } from '@/components/ui/Icons'
import { canonicalizeFixedBillKey } from '@/lib/fixed-bills/canonical'
import { parseSmsImport, saveParsedSmsExpenses, loadActiveDebts, type ActiveDebtOption } from './actions'
import { createDebtWithOpeningBalance } from '@/app/(app)/history/debt/new/actions'
import { saveRecurringSetup } from '@/app/(app)/log/new/actions'

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
  trackAsEssential: boolean
  trackedMonthlyAmount: number | null
  debtId: string | null
  debtName: string | null
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
  amberLight: 'var(--amber-light)',
  amberBorder: 'var(--amber-border)',
  amberDark: 'var(--amber-dark)',
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
    errors.push('Choose a category')
  }
  if (row.categoryType === 'debt' && isGenericDebtLabel(row.label)) {
    errors.push('Use a specific debt name (e.g. "KCB loan", "Visa card").')
  }
  if (row.categoryType === 'debt' && !row.debtId) {
    errors.push('Select which debt this payment is for.')
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
  const [trackedFixedKeys, setTrackedFixedKeys] = useState<string[]>([])
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [savedWithOverride, setSavedWithOverride] = useState(false)
  const [recurringPromptDismissed, setRecurringPromptDismissed] = useState(false)
  const [recurringSetupOpen, setRecurringSetupOpen] = useState(false)
  const [recurringDueDay, setRecurringDueDay] = useState('')
  const [recurringSaving, setRecurringSaving] = useState(false)
  const [recurringError, setRecurringError] = useState<string | null>(null)
  const [recurringSaved, setRecurringSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rowErrors, setRowErrors] = useState<Record<string, string[]>>({})
  const [rowWarnings, setRowWarnings] = useState<Record<string, string[]>>({})
  const [expandedRaw, setExpandedRaw] = useState<Record<string, boolean>>({})
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<{
    label: string
    amount: string
    categoryType: ImportCategoryType | null
    trackAsEssential: boolean
    trackedMonthlyAmount: string
    debtId: string | null
  } | null>(null)
  const [editDeleteConfirmOpen, setEditDeleteConfirmOpen] = useState(false)
  const [editErrors, setEditErrors] = useState<{
    label?: string
    amount?: string
    category?: string
    trackedMonthlyAmount?: string
    debtId?: string
  }>({})
  const [activeDebts, setActiveDebts] = useState<ActiveDebtOption[]>([])
  const [debtsLoaded, setDebtsLoaded] = useState(false)
  const [showCreateDebt, setShowCreateDebt] = useState(false)
  const [createDebtDraft, setCreateDebtDraft] = useState({
    name: '',
    direction: 'owed_by_me' as 'owed_by_me' | 'owed_to_me',
    totalOwed: '',
  })
  const [creatingDebt, setCreatingDebt] = useState(false)
  const [createDebtError, setCreateDebtError] = useState<string | null>(null)

  const selectedCount = rows.length
  const savedRows = rows
  const hasClientValidationErrors = useMemo(
    () => rows.some((row) => validateRow(row).length > 0),
    [rows]
  )
  const editingRow = editingRowId ? rows.find((row) => row.id === editingRowId) ?? null : null
  const smsPlaceholder = [
    'M-PESA: Confirmed. KES 2,100 paid to Naivas',
    'food 500',
    'groceries 2500',
  ].join('\n')
  const hasWarnings = Object.keys(rowWarnings).length > 0
  const hasHardBlockedRows = Object.keys(rowErrors).length > 0

  const isRowAlreadyTracked = (
    input: Pick<EditableRow, 'label' | 'categoryKey' | 'categoryType'>
  ) => {
    if (input.categoryType !== 'fixed') return false
    const canonicalKey = canonicalizeFixedBillKey(slugify(input.categoryKey || input.label))
    return trackedFixedKeys.includes(canonicalKey)
  }

  const recurringCandidate =
    savedRows.length === 1 &&
    savedRows[0] &&
    savedRows[0].categoryType !== 'debt' &&
    !isRowAlreadyTracked(savedRows[0])
      ? savedRows[0]
      : null
  const alreadyTrackedRecurringItem =
    savedRows.length === 1 &&
    savedRows[0] &&
    savedRows[0].categoryType === 'fixed' &&
    isRowAlreadyTracked(savedRows[0])
      ? savedRows[0]
      : null
  const recurringDueDayNumber = Number(recurringDueDay)
  const hasValidRecurringDueDay =
    Number.isInteger(recurringDueDayNumber) &&
    recurringDueDayNumber >= 1 &&
    recurringDueDayNumber <= 28

  useEffect(() => {
    setRecurringPromptDismissed(false)
    setRecurringSetupOpen(false)
    setRecurringDueDay('')
    setRecurringSaving(false)
    setRecurringError(null)
    setRecurringSaved(false)
  }, [savedCount, recurringCandidate?.id])

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

  const ensureDebtsLoaded = async () => {
    if (debtsLoaded) return
    const result = await loadActiveDebts()
    if (result.ok) {
      setActiveDebts(result.data)
    }
    setDebtsLoaded(true)
  }

  const openCreateDebtForm = (prefillName: string) => {
    setCreateDebtDraft({
      name: prefillName,
      direction: 'owed_by_me',
      totalOwed: editDraft?.amount ?? '',
    })
    setCreateDebtError(null)
    setShowCreateDebt(true)
  }

  const closeCreateDebtForm = () => {
    setShowCreateDebt(false)
    setCreateDebtError(null)
  }

  const handleCreateDebt = async () => {
    const name = createDebtDraft.name.trim()
    if (!name) {
      setCreateDebtError('Name is required.')
      return
    }

    const repaymentAmount = Number(editDraft?.amount ?? 0)
    if (!Number.isFinite(repaymentAmount) || repaymentAmount <= 0) {
      setCreateDebtError('The row amount must be greater than zero.')
      return
    }

    const totalOwed = Number(createDebtDraft.totalOwed)
    if (!Number.isFinite(totalOwed) || totalOwed <= 0) {
      setCreateDebtError('Total owed must be greater than zero.')
      return
    }
    if (totalOwed < repaymentAmount) {
      setCreateDebtError('Total owed must be at least the payment amount.')
      return
    }

    setCreatingDebt(true)
    setCreateDebtError(null)
    try {
      const debtId = await createDebtWithOpeningBalance({
        name,
        direction: createDebtDraft.direction,
        openingAmount: totalOwed,
      })

      const newDebt: ActiveDebtOption = {
        id: debtId,
        name,
        currency: '',
        currentBalance: totalOwed,
        direction: createDebtDraft.direction,
      }
      setActiveDebts((current) => [newDebt, ...current])
      setEditDraft((current) => current ? { ...current, debtId } : current)
      setEditErrors((current) => ({ ...current, debtId: undefined }))
      setShowCreateDebt(false)
    } catch (err) {
      setCreateDebtError(err instanceof Error ? err.message : 'Failed to create debt.')
    } finally {
      setCreatingDebt(false)
    }
  }

  const openEditRow = (row: EditableRow) => {
    setEditingRowId(row.id)
    setEditDraft({
      label: row.label,
      amount: String(row.amount),
      categoryType: row.categoryType,
      trackAsEssential: row.trackAsEssential,
      trackedMonthlyAmount:
        row.trackAsEssential && row.trackedMonthlyAmount != null
          ? String(row.trackedMonthlyAmount)
          : '',
      debtId: row.debtId,
    })
    setEditErrors({})
    setShowCreateDebt(false)
    if (row.categoryType === 'debt') {
      ensureDebtsLoaded()
    }
  }

  const closeEditRow = () => {
    setEditingRowId(null)
    setEditDraft(null)
    setEditDeleteConfirmOpen(false)
    setEditErrors({})
  }

  const saveEditRow = () => {
    if (!editingRowId || !editDraft) return

    const nextErrors: { label?: string; amount?: string; category?: string; trackedMonthlyAmount?: string; debtId?: string } = {}
    const trimmedLabel = editDraft.label.trim()
    const amount = Number(editDraft.amount)
    const nextCategoryType = editDraft.categoryType
    const existingRow = rows.find((row) => row.id === editingRowId) ?? null

    if (!trimmedLabel) nextErrors.label = 'Name is required.'
    if (!Number.isFinite(amount) || amount <= 0) nextErrors.amount = 'Amount must be greater than zero.'
    if (!nextCategoryType) nextErrors.category = 'Choose a category'
    if (nextCategoryType === 'debt' && !editDraft.debtId) {
      nextErrors.debtId = 'Select which debt this payment is for.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setEditErrors(nextErrors)
      return
    }

    const selectedDebt = nextCategoryType === 'debt' && editDraft.debtId
      ? activeDebts.find((d) => d.id === editDraft.debtId) ?? null
      : null

    updateRow(editingRowId, {
      label: trimmedLabel,
      amount,
      categoryType: nextCategoryType,
      categoryKey: slugify(trimmedLabel),
      trackAsEssential:
        nextCategoryType === 'fixed'
          ? (existingRow?.trackAsEssential ?? false)
          : false,
      trackedMonthlyAmount:
        nextCategoryType === 'fixed'
          ? (existingRow?.trackedMonthlyAmount ?? null)
          : null,
      debtId: selectedDebt ? selectedDebt.id : null,
      debtName: selectedDebt ? selectedDebt.name : null,
    })
    closeEditRow()
  }

  const deleteEditingRow = () => {
    if (!editingRowId) return
    applyRowsChange((current) => current.filter((row) => row.id !== editingRowId))
    closeEditRow()
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
      setTrackedFixedKeys(data.trackedFixedKeys ?? [])
      setRows(
        data.rows.map((row) => ({
          ...row,
          categoryType: row.confidence === 'high' ? row.categoryType : null,
          trackAsEssential: false,
          trackedMonthlyAmount: null,
          debtId: null,
          debtName: null,
        }))
      )
      setParseMeta({ scanned: data.scanned, skippedCredits: data.skippedCredits })
      setRowErrors({})
      setRowWarnings({})
      setSavedWithOverride(false)
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
    const saveStartedAt = performance.now()
    const logClientSaveTiming = (step: string, elapsedMs: number, extra?: Record<string, unknown>) => {
      const detail = extra ? ` ${JSON.stringify(extra)}` : ''
      console.info(`[sms-import] client-save ${step}=${elapsedMs.toFixed(1)}ms${detail}`)
    }

    setSaving(true)
    setError(null)
    try {
      const preSubmitStartedAt = performance.now()
      const nextRowErrors: Record<string, string[]> = {}
      for (const row of rows) {
        const issues = validateRow(row)
        if (issues.length > 0) nextRowErrors[row.id] = issues
      }

      if (Object.keys(nextRowErrors).length > 0) {
        setRowErrors(nextRowErrors)
        setRowWarnings({})
        setError('Review rows marked with issues before saving.')
        setSavedWithOverride(false)
        setSaving(false)
        logClientSaveTiming('pre-submit-validation', performance.now() - preSubmitStartedAt, {
          rows: rows.length,
          blocked: true,
        })
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
        trackAsEssential:
          row.categoryType === 'fixed' && !isRowAlreadyTracked(row) ? row.trackAsEssential : false,
        trackedMonthlyAmount:
          row.categoryType === 'fixed' && !isRowAlreadyTracked(row) && row.trackAsEssential
            ? Number(row.trackedMonthlyAmount ?? row.amount)
            : null,
        debtId: row.categoryType === 'debt' ? row.debtId : null,
      }))
      logClientSaveTiming('pre-submit-processing', performance.now() - preSubmitStartedAt, {
        rows: payload.length,
        confirmOverride,
      })

      const serverStartedAt = performance.now()
      const result = await saveParsedSmsExpenses(payload, { confirmOverride })
      logClientSaveTiming('server-action', performance.now() - serverStartedAt, {
        rows: payload.length,
        confirmOverride,
      })
      if (!result.ok) {
        setError(
          result.error.kind === 'unauthorized'
            ? result.error.message
            : "We couldn't save right now. Please try again in a moment."
        )
        setSaving(false)
        logClientSaveTiming('post-save-work', performance.now() - saveStartedAt, {
          outcome: 'server-error',
        })
        return
      }
      const data = result.data
      if (data.blocked) {
        const hasHardErrors = Object.keys(data.rowErrors ?? {}).length > 0
        setRowErrors(data.rowErrors ?? {})
        setRowWarnings(data.rowWarnings ?? {})
        setSavedWithOverride(false)
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
        logClientSaveTiming('post-save-work', performance.now() - saveStartedAt, {
          outcome: 'blocked',
          duplicates: data.duplicates,
        })
        return
      }
      setSavedCount(data.saved)
      setSavedWithOverride(data.overridden === true)
      setRowWarnings({})
      logClientSaveTiming('post-save-work', performance.now() - saveStartedAt, {
        outcome: data.overridden ? 'overridden' : 'success',
        saved: data.saved,
        duplicates: data.duplicates,
      })
    } catch {
      setError("We couldn't save right now. Please try again in a moment.")
      logClientSaveTiming('post-save-work', performance.now() - saveStartedAt, {
        outcome: 'exception',
      })
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
              {savedWithOverride ? 'Saved anyway.' : 'Your expense log is up to date.'}
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

            {recurringSaved ? (
              <p style={{ margin: '0 0 var(--space-lg)', fontSize: 'var(--text-sm)', color: T.text3, lineHeight: 1.5 }}>
                Saved as monthly
              </p>
            ) : alreadyTrackedRecurringItem ? (
              <p style={{ margin: '0 0 var(--space-lg)', fontSize: 'var(--text-sm)', color: T.text3, lineHeight: 1.5 }}>
                Already set as monthly
              </p>
            ) : recurringCandidate && !recurringPromptDismissed ? (
              <div
                style={{
                  marginBottom: 16,
                  padding: 16,
                  borderRadius: 16,
                  background: 'var(--grey-50)',
                }}
              >
                <p style={{ margin: '0 0 4px', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: T.text1, lineHeight: 1.35 }}>
                  Does this repeat each month?
                </p>
                <p style={{ margin: '0 0 12px', fontSize: 'var(--text-sm)', color: T.text2, lineHeight: 1.5 }}>
                  We’ll keep it on your list each month.
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                  <TertiaryBtn
                    size="md"
                    onClick={() => {
                      setRecurringError(null)
                      setRecurringSetupOpen(true)
                    }}
                    style={{ color: T.text1, fontWeight: 'var(--weight-medium)', paddingInline: 0 }}
                  >
                    Make it monthly
                  </TertiaryBtn>
                  <TertiaryBtn
                    size="md"
                    onClick={() => setRecurringPromptDismissed(true)}
                    style={{ color: T.text3 }}
                  >
                    Not now
                  </TertiaryBtn>
                </div>
              </div>
            ) : null}

            <PrimaryBtn size="lg" onClick={() => router.push('/app')}>
              Back to overview
            </PrimaryBtn>
            <SecondaryBtn size="lg" onClick={() => router.push('/log/new?returnTo=/app')} style={{ marginTop: 10 }}>
              Add another expense
            </SecondaryBtn>
          </div>
        </div>

        {recurringSetupOpen && recurringCandidate && (
          <Sheet
            open={true}
            onClose={() => {
              if (recurringSaving) return
              setRecurringSetupOpen(false)
            }}
            title="Make it monthly"
          >
            <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: T.text2, lineHeight: 1.5 }}>
                We’ll keep it on your list each month.
              </p>

              <label style={{ display: 'grid', gap: 'var(--space-xs)' }}>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: T.text1 }}>
                  Due day
                </span>
                <span style={{ fontSize: 'var(--text-sm)', color: T.text3, lineHeight: 1.5 }}>
                  Day of the month this is usually due
                </span>
                <select
                  value={recurringDueDay}
                  onChange={(event) => {
                    setRecurringDueDay(event.target.value)
                    setRecurringError(null)
                  }}
                  style={{
                    width: '100%',
                    height: 48,
                    borderRadius: 'var(--radius-sm)',
                    border: `var(--border-width) solid ${T.border}`,
                    padding: '0 var(--space-md)',
                    fontSize: 'var(--text-base)',
                    color: T.text1,
                    background: T.white,
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                >
                  <option value="">Choose a day</option>
                  {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>

              {recurringError && (
                <p style={{
                  margin: 0,
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: T.redLight,
                  border: `var(--border-width) solid ${T.redBorder}`,
                  fontSize: 'var(--text-sm)',
                  color: T.redDark,
                  lineHeight: 1.5,
                }}>
                  {recurringError}
                </p>
              )}

              <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
                <PrimaryBtn
                  size="lg"
                  onClick={async () => {
                    if (!hasValidRecurringDueDay) {
                      setRecurringError('Choose a due day to continue.')
                      return
                    }
                    setRecurringSaving(true)
                    setRecurringError(null)
                    try {
                      const result = await saveRecurringSetup({
                        label: recurringCandidate.label,
                        amount: recurringCandidate.amount,
                        dueDay: recurringDueDayNumber,
                        priority: 'flex',
                      })

                      if (!result.ok) {
                        throw new Error(result.error.message)
                      }

                      setRecurringSaving(false)
                      setRecurringSaved(true)
                      setRecurringPromptDismissed(true)
                      setRecurringSetupOpen(false)
                      setTrackedFixedKeys((current) => {
                        const nextKey = canonicalizeFixedBillKey(slugify(recurringCandidate.categoryKey || recurringCandidate.label))
                        return current.includes(nextKey) ? current : [...current, nextKey]
                      })
                    } catch (caught) {
                      setRecurringSaving(false)
                      setRecurringError(caught instanceof Error ? caught.message : 'Failed to save recurring setup.')
                    }
                  }}
                  disabled={recurringSaving || !hasValidRecurringDueDay}
                >
                  {recurringSaving ? 'Saving…' : 'Save'}
                </PrimaryBtn>
                <SecondaryBtn
                  size="lg"
                  onClick={() => {
                    setRecurringError(null)
                    setRecurringSetupOpen(false)
                  }}
                  style={{ borderColor: T.border, color: T.text1 }}
                  disabled={recurringSaving}
                >
                  Cancel
                </SecondaryBtn>
              </div>
            </div>
          </Sheet>
        )}
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
                  const serverErrors = rowErrors[row.id] ?? []
                  const clientIssues = validateRow(row)
                  const hasHardError = serverErrors.length > 0 || clientIssues.some((i) => i !== 'Choose a category')
                  const needsCategory = !row.categoryType && !hasHardError
                  const cardBorder = hasHardError ? T.redBorder : needsCategory ? T.amberBorder : T.borderSubtle
                  const cardBg = hasHardError ? T.redLight : needsCategory ? T.amberLight : 'var(--white)'

                  return (
                  <div
                    key={row.id}
                    style={{
                      border: `1px solid ${cardBorder}`,
                      borderRadius: 12,
                      padding: 12,
                      background: cardBg,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => openEditRow(row)}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          display: 'block',
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <p style={{ margin: '0 0 4px', fontSize: 15, color: T.text1, fontWeight: 600, lineHeight: 1.3 }}>
                          {row.label}
                        </p>
                        <p style={{ margin: 0, fontSize: 12, color: needsCategory ? T.amberDark : T.text3, lineHeight: 1.45 }}>
                          {needsCategory ? 'Choose a category' : categoryLabel(row.categoryType)}
                          {row.categoryType === 'debt' && row.debtName ? ` · ${row.debtName}` : ''}
                          {row.categoryType === 'debt' && !row.debtId ? ' · Select a debt' : ''}
                          {' · '}
                          {new Date(`${row.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                        <p style={{ margin: '8px 0 0', fontSize: 14, color: T.text1, fontWeight: 600 }}>
                          {row.currency} {Number.isFinite(row.amount) ? row.amount.toLocaleString() : 0}
                        </p>
                      </button>
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

                    <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                      {(() => {
                        const hardErrors = (serverErrors.length > 0 ? serverErrors : clientIssues).filter((i) => i !== 'Choose a category')
                        const warnings = rowWarnings[row.id] ?? []
                        return (
                          <>
                            {hardErrors.length > 0 && (
                              <div style={{ display: 'grid', gap: 4 }}>
                                {hardErrors.map((issue, index) => (
                                  <p key={`${row.id}-issue-${index}`} style={{ margin: 0, fontSize: 11, color: T.redDark, lineHeight: 1.4 }}>
                                    {issue}
                                  </p>
                                ))}
                              </div>
                            )}
                            {hardErrors.length === 0 && warnings.length > 0 && (
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
                    setTrackedFixedKeys([])
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

        {editingRow && editDraft && (
          <Sheet
            open={true}
            onClose={closeEditRow}
            title=""
            hideHeader={true}
            bodyPadding="none"
            variant="bottom"
          >
            {(() => {
              return (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '80vh',
              minHeight: 'min(560px, 80vh)',
              background: T.pageBg,
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 'var(--space-md)',
                padding: 'var(--space-md) var(--space-page-mobile)',
                borderBottom: `var(--border-width) solid ${T.borderSubtle}`,
              }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    margin: 0,
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-lg)',
                    fontWeight: 'var(--weight-bold)',
                    color: T.text1,
                    lineHeight: 1.2,
                    letterSpacing: '-0.01em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {editDraft.label.trim() || editingRow.label}
                  </p>
                  <p style={{
                    margin: 'var(--space-2xs) 0 0',
                    fontSize: 'var(--text-base)',
                    fontWeight: 'var(--weight-medium)',
                    color: T.text2,
                    lineHeight: 1.3,
                  }}>
                    {editingRow.currency} {(Number(editDraft.amount) || 0).toLocaleString()}
                  </p>
                  <p style={{
                    margin: 'var(--space-xs) 0 0',
                    fontSize: 'var(--text-sm)',
                    color: T.textMuted,
                    lineHeight: 1.4,
                  }}>
                    {editDraft.categoryType ? categoryLabel(editDraft.categoryType) : 'Choose a category'}
                    {' · '}
                    {new Date(`${editingRow.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeEditRow}
                  aria-label="Close edit modal"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--radius-full)',
                    border: 'none',
                    background: 'var(--grey-50)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <IconChevronX size={14} color="var(--text-3)" />
                </button>
              </div>

              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: 'var(--space-md) var(--space-page-mobile) var(--space-md)',
              }}>
                <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
                  <div>
                    <p style={{
                      margin: '0 0 var(--space-sm)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 'var(--weight-semibold)',
                      color: T.textMuted,
                      textTransform: 'uppercase',
                      letterSpacing: '0.07em',
                    }}>
                      This payment
                    </p>

                    <Input
                      label="Name"
                      value={editDraft.label}
                      onChange={(value) => {
                        setEditDraft((current) => current ? { ...current, label: value } : current)
                        setEditErrors((current) => ({
                          ...current,
                          label: undefined,
                        }))
                      }}
                      autoFocus
                      error={editErrors.label}
                    />

                    <Input
                      label="Amount"
                      type="number"
                      value={editDraft.amount}
                      onChange={(value) => {
                        setEditDraft((current) => current ? { ...current, amount: value } : current)
                        setEditErrors((current) => ({
                          ...current,
                          amount: undefined,
                        }))
                      }}
                      autoFocus={false}
                      error={editErrors.amount}
                    />

                    <div>
                      <p style={{
                        margin: '0 0 6px',
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: T.text2,
                        letterSpacing: '0.2px',
                      }}>
                        Category
                      </p>
                      <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                        {([
                          { value: 'everyday', label: 'Spending' },
                          { value: 'fixed', label: 'Essentials' },
                          { value: 'debt', label: 'Debt' },
                        ] as const).map((option) => {
                          const selected = editDraft.categoryType === option.value
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                setEditDraft((current) => {
                                  if (!current) return current
                                  const next = { ...current, categoryType: option.value }
                                  if (option.value !== 'fixed') {
                                    next.trackAsEssential = false
                                    next.trackedMonthlyAmount = ''
                                  }
                                  if (option.value !== 'debt') {
                                    next.debtId = null
                                  }
                                  return next
                                })
                                setEditErrors((current) => ({
                                  ...current,
                                  category: undefined,
                                  debtId: undefined,
                                }))
                                if (option.value === 'debt') {
                                  ensureDebtsLoaded()
                                }
                              }}
                              style={{
                                height: 'var(--button-height-md)',
                                padding: '0 var(--space-md)',
                                borderRadius: 'var(--radius-full)',
                                border: selected
                                  ? `var(--border-width) solid var(--brand-mid)`
                                  : `var(--border-width) solid var(--grey-300)`,
                                background: selected ? 'var(--brand-mid)' : 'var(--grey-100)',
                                color: selected ? T.brandDark : T.text2,
                                fontSize: 'var(--text-sm)',
                                fontWeight: 'var(--weight-medium)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {option.label}
                            </button>
                          )
                        })}
                      </div>
                      {editErrors.category && (
                        <p style={{ margin: 'var(--space-xs) 0 0', fontSize: 12, color: T.amberDark, lineHeight: 1.4 }}>
                          {editErrors.category}
                        </p>
                      )}
                      {editDraft.categoryType && (
                        <p style={{ margin: 'var(--space-xs) 0 0', fontSize: 12, color: T.text3, lineHeight: 1.5 }}>
                          {CATEGORY_HELPER[editDraft.categoryType]}
                        </p>
                      )}
                    </div>

                    {editDraft.categoryType === 'debt' && (
                      <div style={{ marginTop: 'var(--space-md)' }}>
                        <p style={{
                          margin: '0 0 6px',
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: T.text2,
                          letterSpacing: '0.2px',
                        }}>
                          Link to debt
                        </p>

                        {showCreateDebt ? (
                          <div style={{
                            border: `var(--border-width) solid ${T.border}`,
                            borderRadius: 'var(--radius-md)',
                            padding: '12px',
                            background: 'var(--grey-50)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 'var(--space-sm)',
                          }}>
                            <Input
                              label="Debt name"
                              value={createDebtDraft.name}
                              onChange={(value) => {
                                setCreateDebtDraft((current) => ({ ...current, name: value }))
                                setCreateDebtError(null)
                              }}
                              autoFocus
                            />

                            <Input
                              label="Total owed"
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.01"
                              value={createDebtDraft.totalOwed}
                              onChange={(value) => {
                                setCreateDebtDraft((current) => ({ ...current, totalOwed: value }))
                                setCreateDebtError(null)
                              }}
                            />

                            <div>
                              <p style={{
                                margin: '0 0 6px',
                                fontSize: 12.5,
                                fontWeight: 600,
                                color: T.text2,
                                letterSpacing: '0.2px',
                              }}>
                                Direction
                              </p>
                              <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                                {([
                                  { value: 'owed_by_me', label: 'I owe this' },
                                  { value: 'owed_to_me', label: 'Owed to me' },
                                ] as const).map((option) => {
                                  const selected = createDebtDraft.direction === option.value
                                  return (
                                    <button
                                      key={option.value}
                                      type="button"
                                      onClick={() =>
                                        setCreateDebtDraft((current) => ({ ...current, direction: option.value }))
                                      }
                                      style={{
                                        height: 'var(--button-height-md)',
                                        padding: '0 var(--space-md)',
                                        borderRadius: 'var(--radius-full)',
                                        border: selected
                                          ? `var(--border-width) solid var(--brand-mid)`
                                          : `var(--border-width) solid var(--grey-300)`,
                                        background: selected ? 'var(--brand-mid)' : 'var(--white)',
                                        color: selected ? T.brandDark : T.text2,
                                        fontSize: 'var(--text-sm)',
                                        fontWeight: 'var(--weight-medium)',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {option.label}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>

                            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: T.text3, lineHeight: 1.5 }}>
                              You&apos;re recording a payment of {editDraft.amount ? Number(editDraft.amount).toLocaleString() : '0'} for this debt.
                            </p>

                            {createDebtError && (
                              <p style={{ margin: 0, fontSize: 12, color: T.redDark, lineHeight: 1.4 }}>
                                {createDebtError}
                              </p>
                            )}

                            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                              <PrimaryBtn
                                size="md"
                                onClick={handleCreateDebt}
                                disabled={creatingDebt}
                              >
                                {creatingDebt ? 'Creating…' : 'Create'}
                              </PrimaryBtn>
                              <SecondaryBtn
                                size="md"
                                onClick={closeCreateDebtForm}
                                disabled={creatingDebt}
                              >
                                Cancel
                              </SecondaryBtn>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => openCreateDebtForm(editDraft.label)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-xs)',
                                padding: '10px 12px',
                                borderRadius: 'var(--radius-md)',
                                border: `var(--border-width) dashed var(--grey-300)`,
                                background: 'var(--white)',
                                cursor: 'pointer',
                                textAlign: 'left',
                                width: '100%',
                                marginBottom: activeDebts.length > 0 ? 'var(--space-xs)' : 0,
                              }}
                            >
                              <span style={{
                                fontSize: 'var(--text-sm)',
                                fontWeight: 'var(--weight-medium)',
                                color: T.brandDark,
                              }}>
                                + Create new debt
                              </span>
                            </button>

                            {!debtsLoaded ? (
                              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: T.text3, lineHeight: 1.5 }}>
                                Loading debts…
                              </p>
                            ) : activeDebts.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                                {activeDebts.map((debt) => {
                                  const selected = editDraft.debtId === debt.id
                                  return (
                                    <button
                                      key={debt.id}
                                      type="button"
                                      onClick={() => {
                                        setEditDraft((current) =>
                                          current ? { ...current, debtId: selected ? null : debt.id } : current
                                        )
                                        setEditErrors((current) => ({ ...current, debtId: undefined }))
                                      }}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 'var(--space-sm)',
                                        padding: '10px 12px',
                                        borderRadius: 'var(--radius-md)',
                                        border: selected
                                          ? `var(--border-width) solid var(--brand-mid)`
                                          : `var(--border-width) solid var(--grey-300)`,
                                        background: selected ? 'var(--brand-mid)' : 'var(--white)',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                      }}
                                    >
                                      <span style={{
                                        fontSize: 'var(--text-sm)',
                                        fontWeight: 'var(--weight-medium)',
                                        color: selected ? T.brandDark : T.text1,
                                      }}>
                                        {debt.name}
                                      </span>
                                      <span style={{
                                        fontSize: 'var(--text-xs)',
                                        color: selected ? T.brandDark : T.text3,
                                        whiteSpace: 'nowrap',
                                      }}>
                                        {debt.currency} {debt.currentBalance.toLocaleString()}
                                      </span>
                                    </button>
                                  )
                                })}
                              </div>
                            ) : null}
                          </>
                        )}

                        {editErrors.debtId && (
                          <p style={{ margin: 'var(--space-xs) 0 0', fontSize: 12, color: T.amberDark, lineHeight: 1.4 }}>
                            {editErrors.debtId}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                </div>
              </div>

              <div style={{
                padding: 'var(--space-md) var(--space-page-mobile) calc(var(--space-md) + env(safe-area-inset-bottom, 0px))',
                borderTop: `var(--border-width) solid ${T.borderSubtle}`,
                background: T.pageBg,
              }}>
                <PrimaryBtn size="lg" onClick={saveEditRow}>
                  Save changes
                </PrimaryBtn>
                <SecondaryBtn
                  size="lg"
                  onClick={() => setEditDeleteConfirmOpen(true)}
                  style={{
                    marginTop: 'var(--space-sm)',
                    borderColor: T.border,
                    color: T.redDark,
                  }}
                >
                  Delete entry
                </SecondaryBtn>
              </div>

              {editDeleteConfirmOpen && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(16, 24, 40, 0.32)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 'var(--space-md)',
                }}>
                  <div style={{
                    width: '100%',
                    maxWidth: 360,
                    background: T.white,
                    borderRadius: 'var(--radius-lg)',
                    border: `var(--border-width) solid ${T.border}`,
                    padding: 'var(--space-lg)',
                  }}>
                    <p style={{
                      margin: 0,
                      fontFamily: 'var(--font-display)',
                      fontSize: 'var(--text-lg)',
                      fontWeight: 'var(--weight-semibold)',
                      color: T.text1,
                      letterSpacing: '-0.01em',
                    }}>
                      Delete this entry?
                    </p>
                    <p style={{
                      margin: 'var(--space-sm) 0 0',
                      fontSize: 'var(--text-sm)',
                      color: T.text2,
                      lineHeight: 1.5,
                    }}>
                      This will remove it from your log.
                    </p>
                    <div style={{
                      display: 'grid',
                      gap: 'var(--space-sm)',
                      marginTop: 'var(--space-lg)',
                    }}>
                      <SecondaryBtn
                        size="lg"
                        onClick={() => setEditDeleteConfirmOpen(false)}
                      >
                        Cancel
                      </SecondaryBtn>
                      <PrimaryBtn
                        size="lg"
                        onClick={deleteEditingRow}
                        style={{
                          background: T.redDark,
                          color: T.white,
                        }}
                      >
                        Delete
                      </PrimaryBtn>
                    </div>
                  </div>
                </div>
              )}
            </div>
              )
            })()}
          </Sheet>
        )}

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
