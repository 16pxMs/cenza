'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PrimaryBtn, SecondaryBtn, TertiaryBtn } from '@/components/ui/Button/Button'
import { Input } from '@/components/ui/Input/Input'
import { MoneyInput } from '@/components/ui/MoneyInput/MoneyInput'
import { SingleSelectChip } from '@/components/ui/SingleSelectChip/SingleSelectChip'
import { IconBack } from '@/components/ui/Icons'
import { ExpenseAddedSuccess, type ExpenseAddedSuccessEntry } from '@/components/flows/log/ExpenseAddedSuccess'
import { recurringExpenseKey } from '@/lib/fixed-bills/canonical'
import { getCategoryLabel } from '@/lib/categories/config'
import { getGroupedCategoryOptions } from '@/lib/categories/options'
import { parseSmsImport, saveParsedSmsExpenses, loadActiveDebts, type ActiveDebtOption } from './actions'
import {
  buildNeedsCategoryMetaLabel,
  buildRowMetaLabel,
  formatImportedRowDateLabel,
  getInitialEditStepForRow,
  getNextEditableRowIndex,
  getPreviousStepForActiveRow,
  getSuggestedCategoryOptions,
  shouldShowRawMessageToggle,
} from './presentation'
import { createDebtWithOpeningBalance } from '@/app/(app)/history/debt/new/actions'
import {
  DUPLICATE_MESSAGE,
  getSmsImportReviewState,
  isBlockedIncomeRow,
} from './state'
import {
  getFrequentCategoryOptions,
  loadRecentCategoryKeys,
  recordRecentCategoryKey,
} from './recent-categories'
import styles from './SmsImportClient.module.css'

type ImportCategoryType = 'everyday' | 'fixed' | 'debt'
type EditStep = 'details' | 'category' | 'review'

interface EditableRow {
  id: string
  raw: string
  label: string
  categoryType: ImportCategoryType | null
  categoryKey: string
  amount: number
  currency: string
  date: string
  isImportedMessage: boolean
  confidence: 'high' | 'medium' | 'low'
  sourceHash: string
  blockedReason?: string | null
  repeatsMonthly: boolean
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
  if (value === 'fixed') return 'Fixed'
  if (value === 'debt') return 'Debt'
  return 'Spending'
}

const IMPORT_CATEGORY_GROUPS = getGroupedCategoryOptions(['everyday', 'fixed', 'debt'])

function toImportCategoryType(value: string | null | undefined): ImportCategoryType | null {
  if (value === 'everyday' || value === 'fixed' || value === 'debt') return value
  return null
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

  if (row.blockedReason) {
    return [row.blockedReason]
  }

  if (!row.label.trim()) {
    errors.push('Name is required.')
  }
  if (!Number.isFinite(Number(row.amount)) || Number(row.amount) <= 0) {
    errors.push('Amount must be greater than zero.')
  }
  if (row.isImportedMessage && !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 'var(--space-md)',
    }}>
      <span style={{ fontSize: 'var(--text-sm)', color: T.text3 }}>
        {label}
      </span>
      <span style={{
        fontSize: 'var(--text-base)',
        fontWeight: 'var(--weight-medium)',
        color: T.text1,
        textAlign: 'right',
      }}>
        {value}
      </span>
    </div>
  )
}

function getReviewCopy(rows: Pick<EditableRow, 'isImportedMessage'>[]) {
  const hasImportedMessages = rows.some((row) => row.isImportedMessage)

  return hasImportedMessages
    ? {
        title: 'Here’s what we found',
        body: 'Review the expenses from your messages.',
      }
    : {
        title: 'Review expense',
        body: 'Check the details before saving.',
      }
}

export function SmsImportClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo') || '/log'

  const [rawText, setRawText] = useState('')
  const [rows, setRows] = useState<EditableRow[]>([])
  const [parseMeta, setParseMeta] = useState<{ scanned: number; skippedCredits: number }>({ scanned: 0, skippedCredits: 0 })
  const [monthlyReminderKeys, setMonthlyReminderKeys] = useState<string[]>([])
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [rowErrors, setRowErrors] = useState<Record<string, string[]>>({})
  const [rowWarnings, setRowWarnings] = useState<Record<string, string[]>>({})
  const [expandedRaw, setExpandedRaw] = useState<Record<string, boolean>>({})
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editStep, setEditStep] = useState<EditStep | null>(null)
  const [recentCategoryKeys, setRecentCategoryKeys] = useState<string[]>([])
  const [frozenRecentKeys, setFrozenRecentKeys] = useState<string[]>([])
  const [categoryFilter, setCategoryFilter] = useState<ImportCategoryType>('everyday')
  const [categoryQuery, setCategoryQuery] = useState('')

  useEffect(() => {
    setRecentCategoryKeys(loadRecentCategoryKeys())
  }, [])
  const [editDraft, setEditDraft] = useState<{
    label: string
    amount: string
    date: string
    categoryType: ImportCategoryType | null
    categoryKey: string | null
    repeatsMonthly: boolean
    debtId: string | null
  } | null>(null)
  const [editDeleteConfirmOpen, setEditDeleteConfirmOpen] = useState(false)
  const [editErrors, setEditErrors] = useState<{
    label?: string
    amount?: string
    date?: string
    category?: string
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

  const savedRows = rows
  const monthlyReminderKeySet = useMemo(
    () => new Set(monthlyReminderKeys),
    [monthlyReminderKeys]
  )
  const editingRow = editingRowId ? rows.find((row) => row.id === editingRowId) ?? null : null
  const editedPreviewRow = useMemo(() => {
    if (!editingRow || !editDraft) return null

    const selectedDebt = editDraft.debtId
      ? activeDebts.find((debt) => debt.id === editDraft.debtId) ?? null
      : null

    return {
      ...editingRow,
      label: editDraft.label.trim() || editingRow.label,
      amount: Number(editDraft.amount),
      date: editDraft.date.trim(),
      categoryType: editDraft.categoryType,
      categoryKey: editDraft.categoryKey ?? editingRow.categoryKey,
      repeatsMonthly:
        editDraft.categoryType === 'everyday' || editDraft.categoryType === 'fixed'
          ? editDraft.repeatsMonthly
          : false,
      debtId: editDraft.categoryType === 'debt' ? editDraft.debtId : null,
      debtName: editDraft.categoryType === 'debt' ? selectedDebt?.name ?? null : null,
    } satisfies EditableRow
  }, [activeDebts, editDraft, editingRow])
  const smsPlaceholder = [
    'M-PESA: Confirmed. KES 2,100 paid to Naivas',
    'food 500',
    'groceries 2500',
  ].join('\n')
  const hasWarnings = Object.keys(rowWarnings).length > 0
  const reviewState = useMemo(
    () =>
      getSmsImportReviewState({
        rows,
        rowErrors,
        getClientIssues: validateRow,
      }),
    [rowErrors, rows]
  )
  const {
    savableRows,
    validSavableRows,
    hasHardBlockedRows,
    hasDuplicateBlockedRows,
    hasSavableClientValidationErrors,
  } = reviewState
  const reviewCopy = useMemo(() => getReviewCopy(rows), [rows])
  const editableRowIndices = useMemo(
    () => rows.reduce<number[]>((indices, row, index) => {
      if (!isBlockedIncomeRow(row)) indices.push(index)
      return indices
    }, []),
    [rows]
  )
  const currentEditingRowIndex = useMemo(
    () => editingRowId ? rows.findIndex((row) => row.id === editingRowId) : -1,
    [editingRowId, rows]
  )
  const currentEditableQueueIndex = useMemo(
    () => editableRowIndices.findIndex((index) => index === currentEditingRowIndex),
    [currentEditingRowIndex, editableRowIndices]
  )
  const nextEditableRowIndex = useMemo(
    () => currentEditingRowIndex >= 0
      ? getNextEditableRowIndex(currentEditingRowIndex, rows, (row) => !isBlockedIncomeRow(row))
      : -1,
    [currentEditingRowIndex, rows]
  )
  const nextEditableRow = nextEditableRowIndex >= 0 ? rows[nextEditableRowIndex] : null
  const suggestedCategoryOptions = useMemo(
    () => editDraft ? getSuggestedCategoryOptions(editDraft.label, IMPORT_CATEGORY_GROUPS) : [],
    [editDraft]
  )
  const frequentCategoryOptions = useMemo(() => {
    if (!editDraft) return []
    const exclude = new Set(suggestedCategoryOptions.map((option) => option.key))
    return getFrequentCategoryOptions(frozenRecentKeys, IMPORT_CATEGORY_GROUPS, exclude)
  }, [editDraft, frozenRecentKeys, suggestedCategoryOptions])
  const filteredCategoryGroup = useMemo(() => {
    return IMPORT_CATEGORY_GROUPS.find((group) => group.type === categoryFilter) ?? null
  }, [categoryFilter])
  const allCategoryOptions = useMemo(() => {
    return IMPORT_CATEGORY_GROUPS.flatMap((group) => group.options)
  }, [])
  const trimmedCategoryQuery = categoryQuery.trim().toLowerCase()
  const isSearchingCategories = trimmedCategoryQuery.length > 0
  const categorySearchResults = useMemo(() => {
    if (!isSearchingCategories) return []
    return allCategoryOptions.filter((option) =>
      option.label.toLowerCase().includes(trimmedCategoryQuery),
    )
  }, [allCategoryOptions, isSearchingCategories, trimmedCategoryQuery])
  const tabCategoryOptions = useMemo(() => {
    if (!filteredCategoryGroup) return []
    const exclude = new Set<string>([
      ...suggestedCategoryOptions.map((option) => option.key),
      ...frequentCategoryOptions.map((option) => option.key),
    ])
    return filteredCategoryGroup.options.filter((option) => !exclude.has(option.key))
  }, [filteredCategoryGroup, suggestedCategoryOptions, frequentCategoryOptions])

  const hasExistingMonthlyReminder = (
    input: Pick<EditableRow, 'label' | 'categoryKey' | 'categoryType'>
  ) => {
    if (input.categoryType !== 'everyday' && input.categoryType !== 'fixed') return false
    const canonicalKey = recurringExpenseKey(input.categoryType, slugify(input.categoryKey || input.label))
    return monthlyReminderKeySet.has(canonicalKey)
  }

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
        return { ...row, ...patch }
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
    if (isBlockedIncomeRow(row)) return

    setEditingRowId(row.id)
    setEditStep(getInitialEditStepForRow(row))
    setFrozenRecentKeys(loadRecentCategoryKeys())
    setEditDraft({
      label: row.label,
      amount: String(row.amount),
      date: row.date,
      categoryType: row.categoryType,
      categoryKey: row.categoryKey,
      repeatsMonthly: row.repeatsMonthly,
      debtId: row.debtId,
    })
    setEditErrors({})
    setShowCreateDebt(false)
    if (row.categoryType === 'debt') {
      ensureDebtsLoaded()
    }
  }

  const openEditRowAtIndex = (index: number) => {
    const row = rows[index]
    if (!row || isBlockedIncomeRow(row)) return
    openEditRow(row)
  }

  const closeEditRow = () => {
    setEditingRowId(null)
    setEditStep(null)
    setEditDraft(null)
    setEditDeleteConfirmOpen(false)
    setEditErrors({})
    setShowCreateDebt(false)
    setCreateDebtError(null)
  }

  const returnToInputScreen = () => {
    setRows([])
    setMonthlyReminderKeys([])
    setRowErrors({})
    setRowWarnings({})
    setExpandedRaw({})
    setError(null)
  }

  const goBackWithinEditFlow = () => {
    if (!editingRow || !editStep) return

    const previousStep = getPreviousStepForActiveRow({
      currentStep: editStep,
      isImportedMessage: editingRow.isImportedMessage,
    })

    if (previousStep) {
      setEditStep(previousStep)
      return
    }

    closeEditRow()
  }

  const collectEditErrors = (scope: 'details' | 'category' | 'all') => {
    if (!editDraft) return {}
    const nextErrors: { label?: string; amount?: string; date?: string; category?: string; debtId?: string } = {}
    const trimmedLabel = editDraft.label.trim()
    const amount = Number(editDraft.amount)
    const date = editDraft.date.trim()
    const nextCategoryType = editDraft.categoryType
    const nextCategoryKey = editDraft.categoryKey

    if (scope === 'details' || scope === 'all') {
      if (!trimmedLabel) nextErrors.label = 'Name is required.'
      if (!Number.isFinite(amount) || amount <= 0) nextErrors.amount = 'Amount must be greater than zero.'
      if (editingRow?.isImportedMessage && !/^\d{4}-\d{2}-\d{2}$/.test(date)) nextErrors.date = 'Enter a valid date.'
    }

    if (scope === 'category' || scope === 'all') {
      if (!nextCategoryType || !nextCategoryKey) nextErrors.category = 'Choose a category'
      if (nextCategoryType === 'debt' && !editDraft.debtId) {
        nextErrors.debtId = 'Select which debt this payment is for.'
      }
    }

    return nextErrors
  }

  const goToEditCategory = () => {
    const nextErrors = collectEditErrors('details')
    if (Object.keys(nextErrors).length > 0) {
      setEditErrors(nextErrors)
      return
    }
    setEditErrors({})
    setCategoryFilter('everyday')
    setCategoryQuery('')
    setEditStep('category')
  }

  const selectImportCategory = (option: { key: string; type: string }) => {
    const nextType = toImportCategoryType(option.type)
    if (!nextType) return
    setEditDraft((current) => {
      if (!current) return current
      const next = {
        ...current,
        categoryType: nextType,
        categoryKey: option.key,
      }
      if (nextType !== 'everyday' && nextType !== 'fixed') {
        next.repeatsMonthly = false
      }
      if (nextType !== 'debt') {
        next.debtId = null
      }
      return next
    })
    setEditErrors((current) => ({
      ...current,
      category: undefined,
      debtId: undefined,
    }))
    setRecentCategoryKeys(recordRecentCategoryKey(option.key))
    if (nextType === 'debt') ensureDebtsLoaded()
  }

  const goToEditReview = () => {
    const nextErrors = collectEditErrors('category')
    if (Object.keys(nextErrors).length > 0) {
      setEditErrors(nextErrors)
      return
    }
    setEditErrors({})
    setEditStep('review')
  }

  const applyEditRow = () => {
    if (!editingRowId || !editDraft) return

    const nextErrors = collectEditErrors('all')
    if (Object.keys(nextErrors).length > 0) {
      setEditErrors(nextErrors)
      return
    }

    const existingRow = rows.find((row) => row.id === editingRowId) ?? null
    const nextCategoryType = editDraft.categoryType
    const nextCategoryKey = editDraft.categoryKey
    const trimmedLabel = editDraft.label.trim()
    const amount = Number(editDraft.amount)
    const date = editDraft.date.trim()
    const selectedDebt = nextCategoryType === 'debt' && editDraft.debtId
      ? activeDebts.find((d) => d.id === editDraft.debtId) ?? null
      : null

    updateRow(editingRowId, {
      label: trimmedLabel,
      amount,
      date,
      categoryType: nextCategoryType,
      categoryKey: nextCategoryKey ?? existingRow?.categoryKey ?? '',
      repeatsMonthly:
        nextCategoryType === 'everyday' || nextCategoryType === 'fixed'
          ? editDraft.repeatsMonthly
          : false,
      debtId: selectedDebt ? selectedDebt.id : null,
      debtName: selectedDebt ? selectedDebt.name : null,
    })
    return true
  }

  const saveEditRow = () => {
    if (!applyEditRow()) return
    closeEditRow()
  }

  const deleteEditingRow = () => {
    if (!editingRowId) return
    applyRowsChange((current) => current.filter((row) => row.id !== editingRowId))
    closeEditRow()
  }

  const handleReviewRowPrimaryAction = () => {
    if (!applyEditRow()) return

    if (nextEditableRow) {
      openEditRowAtIndex(nextEditableRowIndex)
      return
    }

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
      const nextRows = data.rows.map((row) => ({
        ...row,
        categoryType: row.blockedReason
          ? row.categoryType
          : row.confidence === 'high'
            ? row.categoryType
            : null,
        repeatsMonthly: false,
        debtId: null,
        debtName: null,
      }))
      const nextBlockedRowErrors = Object.fromEntries(
        nextRows
          .filter((row) => row.blockedReason)
          .map((row) => [row.id, [row.blockedReason as string]])
      )
      setMonthlyReminderKeys(data.monthlyReminderKeys ?? [])
      setRows(nextRows)
      setParseMeta({ scanned: data.scanned, skippedCredits: data.skippedCredits })
      setRowErrors(nextBlockedRowErrors)
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
        if (isBlockedIncomeRow(row)) {
          nextRowErrors[row.id] = [row.blockedReason as string]
          continue
        }
        const issues = validateRow(row)
        if (issues.length > 0) nextRowErrors[row.id] = issues
      }

      const blockingErrors = Object.entries(nextRowErrors).filter(([rowId]) => {
        const row = rows.find((item) => item.id === rowId)
        return row ? !isBlockedIncomeRow(row) : true
      })

      if (blockingErrors.length > 0) {
        setRowErrors(nextRowErrors)
        setRowWarnings({})
        setError('Review rows marked with issues before saving.')
        setSaving(false)
        logClientSaveTiming('pre-submit-validation', performance.now() - preSubmitStartedAt, {
          rows: rows.length,
          blocked: true,
        })
        return
      }

      const payload = rows
        .filter((row) => !isBlockedIncomeRow(row))
        .map((row) => ({
        id: row.id,
        label: row.label.trim(),
        categoryType: row.categoryType as ImportCategoryType,
        categoryKey: row.categoryKey,
        amount: Number(row.amount),
        date: row.date,
        sourceHash: row.sourceHash,
        blockedReason: row.blockedReason ?? null,
        repeatsMonthly:
          (row.categoryType === 'everyday' || row.categoryType === 'fixed') && !hasExistingMonthlyReminder(row)
            ? row.repeatsMonthly
            : false,
        debtId: row.categoryType === 'debt' ? row.debtId : null,
      }))
      setRowErrors(nextRowErrors)
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
        if (hasHardErrors) {
          setError('Remove duplicate messages to continue.')
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
    const savedDateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const successEntries: ExpenseAddedSuccessEntry[] = savedRows.map((row) => ({
      id: row.id,
      name: row.label,
      amountLabel: `${row.currency} ${row.amount.toLocaleString()}`,
      metaLabel: `${getCategoryLabel(row.categoryKey, categoryLabel(row.categoryType))} · ${savedDateLabel(row.date)}`,
      hasMonthlyReminder: row.repeatsMonthly,
    }))

    return (
      <div style={{ minHeight: '100vh', background: T.pageBg }}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px' }}>
          <ExpenseAddedSuccess
            entries={successEntries}
            onBack={() => { router.refresh(); router.push('/app') }}
            onAddAnother={() => router.push('/log/new?returnTo=/app')}
          />
        </div>

      </div>
    )
  }

  const showReview = rows.length > 0
  const showingEditFlow = !!(editingRow && editDraft && editStep)
  const topBackAction = () => {
    if (!showingEditFlow) {
      if (showReview) {
        returnToInputScreen()
        return
      }
      router.push(returnTo)
      return
    }
    goBackWithinEditFlow()
  }

  return (
    <div style={{ minHeight: '100vh', background: T.pageBg }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px 120px' }}>
        <button
          onClick={topBackAction}
          style={{
            width: 44, height: 44, border: 'none', background: 'none', padding: 0, cursor: 'pointer',
            color: 'var(--grey-900)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <IconBack size={20} />
        </button>

        {!showingEditFlow ? (
          <>
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
                className={styles.focusRing}
                style={{
                  width: '100%',
                  minHeight: 200,
                  borderRadius: 12,
                  border: `var(--border-width) solid ${T.border}`,
                  padding: 12,
                  fontSize: 14,
                  color: T.text1,
                  background: 'var(--white)',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  outline: 'none',
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
                      {reviewCopy.title}
                    </p>
                    <p style={{ margin: 0, fontSize: 13, color: T.text3, lineHeight: 1.5 }}>
                      {reviewCopy.body}
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
                  const isBlocked = isBlockedIncomeRow(row)
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
                        disabled={isBlocked}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          display: 'block',
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          textAlign: 'left',
                          cursor: isBlocked ? 'default' : 'pointer',
                          opacity: isBlocked ? 0.9 : 1,
                        }}
                      >
                        <p style={{ margin: '0 0 4px', fontSize: 15, color: T.text1, fontWeight: 600, lineHeight: 1.3 }}>
                          {row.label}
                        </p>
                        <p style={{ margin: 0, fontSize: 12, color: needsCategory ? T.amberDark : T.text3, lineHeight: 1.45 }}>
                          {needsCategory
                            ? buildNeedsCategoryMetaLabel(row)
                            : buildRowMetaLabel(row)}
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

                      {shouldShowRawMessageToggle(row) && (
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
                      )}
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

              {hasDuplicateBlockedRows && !error && (
                <p style={{ margin: '10px 0 0', fontSize: 12, color: T.text2, lineHeight: 1.5 }}>
                  Remove duplicate messages to continue.
                </p>
              )}

              <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                {validSavableRows.length === 0 ? (
                  <PrimaryBtn
                    size="lg"
                    onClick={() => {
                      setRows([])
                      setMonthlyReminderKeys([])
                      setRowErrors({})
                      setRowWarnings({})
                      setError(null)
                    }}
                  >
                    Paste again
                  </PrimaryBtn>
                ) : hasWarnings && !hasHardBlockedRows ? (
                  <PrimaryBtn
                    size="lg"
                    onClick={() => handleSave(true)}
                    disabled={saving || validSavableRows.length === 0 || hasSavableClientValidationErrors}
                  >
                    {saving ? 'Saving…' : 'Save anyway'}
                  </PrimaryBtn>
                ) : (
                  <PrimaryBtn
                    size="lg"
                    onClick={() => handleSave(false)}
                    disabled={saving || validSavableRows.length === 0 || hasSavableClientValidationErrors || hasHardBlockedRows}
                  >
                    {saving ? 'Saving…' : hasHardBlockedRows
                      ? 'Remove blocked messages to continue'
                      : `Save ${validSavableRows.length} ${validSavableRows.length === 1 ? 'expense' : 'expenses'}`}
                  </PrimaryBtn>
                )}
                {validSavableRows.length > 0 ? (
                  <SecondaryBtn
                    size="lg"
                    onClick={() => {
                      setRows([])
                      setMonthlyReminderKeys([])
                      setRowErrors({})
                      setRowWarnings({})
                      setError(null)
                    }}
                  >
                    Paste again
                  </SecondaryBtn>
                ) : null}
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
          </>
        ) : (
          <>
            <div style={{ marginBottom: 'var(--space-md)' }}>
              {editStep !== 'category' && (
                <p style={{
                  margin: '0 0 var(--space-2xs)',
                  fontSize: 'var(--text-xs)',
                  color: T.text3,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  fontWeight: 'var(--weight-semibold)',
                }}>
                  {editStep === 'details' ? 'Edit row' : 'Review row'}
                </p>
              )}
              {currentEditableQueueIndex >= 0 && editableRowIndices.length > 0 ? (
                <p style={{
                  margin: 0,
                  fontSize: 'var(--text-sm)',
                  color: T.textMuted,
                  lineHeight: 1.4,
                }}>
                  Entry {currentEditableQueueIndex + 1} of {editableRowIndices.length}
                </p>
              ) : null}
            </div>

          <div style={{
            background: T.white,
            border: `var(--border-width) solid ${T.border}`,
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-lg)',
            display: 'grid',
            gap: 'var(--space-lg)',
          }}>
            <div>
              <h1 style={{
                margin: 0,
                fontSize: 'var(--text-xl)',
                fontWeight: 'var(--weight-bold)',
                color: T.text1,
                letterSpacing: '-0.02em',
              }}>
                {editDraft.label.trim() || editingRow.label}
              </h1>
              <p style={{
                margin: 'var(--space-xs) 0 0',
                fontSize: 'var(--text-sm)',
                color: T.text3,
                lineHeight: 1.5,
              }}>
                {editDraft.categoryKey ? (
                  buildRowMetaLabel({
                    amount: Number(editDraft.amount),
                    currency: editingRow.currency,
                    categoryKey: editDraft.categoryKey,
                    categoryType: editDraft.categoryType,
                    date: editDraft.date,
                    isImportedMessage: editingRow.isImportedMessage,
                    debtId: editDraft.debtId,
                    debtName: editedPreviewRow?.debtName ?? null,
                  })
                ) : (
                  <>
                    {`${editingRow.currency} ${Number.isFinite(Number(editDraft.amount)) ? Number(editDraft.amount).toLocaleString() : 0}`}
                    <span aria-hidden="true">{' · '}</span>
                    <span style={{ color: T.amberDark, fontWeight: 'var(--weight-medium)' }}>
                      Category not set
                    </span>
                  </>
                )}
              </p>
            </div>

            {editStep === 'category' && (
              <div style={{
                paddingTop: 'var(--space-md)',
                borderTop: `var(--border-width) solid ${T.borderSubtle}`,
              }}>
                <h2 style={{
                  margin: 0,
                  fontSize: 'var(--text-lg)',
                  fontWeight: 'var(--weight-semibold)',
                  color: T.text1,
                  letterSpacing: '-0.01em',
                }}>
                  Pick a category
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: T.text3, lineHeight: 1.5 }}>
                  Tap one to apply.
                </p>
              </div>
            )}

            {editStep === 'details' && (
              <div style={{
                display: 'grid',
                gap: 0,
                paddingTop: 'var(--space-md)',
                borderTop: `var(--border-width) solid ${T.borderSubtle}`,
              }}>
                <Input
                  label="Name"
                  value={editDraft.label}
                  onChange={(value) => {
                    setEditDraft((current) => current ? { ...current, label: value } : current)
                    setEditErrors((current) => ({ ...current, label: undefined }))
                  }}
                  autoFocus
                  error={editErrors.label}
                />

                <MoneyInput
                  label="Amount"
                  value={editDraft.amount}
                  onChange={(value) => {
                    setEditDraft((current) => current ? { ...current, amount: value } : current)
                    setEditErrors((current) => ({ ...current, amount: undefined }))
                  }}
                  currency={editingRow.currency || 'KES'}
                  autoFocus={false}
                  error={editErrors.amount}
                />

                {editingRow.isImportedMessage ? (
                  <Input
                    label="Date"
                    type="date"
                    value={editDraft.date}
                    onChange={(value) => {
                      setEditDraft((current) => current ? { ...current, date: value } : current)
                      setEditErrors((current) => ({ ...current, date: undefined }))
                    }}
                    autoFocus={false}
                    error={editErrors.date}
                  />
                ) : null}

                {(editDraft.categoryType === 'everyday' || editDraft.categoryType === 'fixed') && (
                  <div style={{ marginBottom: 'var(--space-md)' }}>
                    <p style={{
                      margin: '0 0 var(--space-2xs)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 'var(--weight-medium)',
                      color: T.text2,
                    }}>
                      Reminder
                    </p>
                    <label style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 'var(--space-sm)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 'var(--weight-medium)',
                      color: T.text1,
                      cursor: 'pointer',
                    }}>
                      <input
                        type="checkbox"
                        checked={editDraft.repeatsMonthly}
                        onChange={(event) => {
                          setEditDraft((current) => current ? {
                            ...current,
                            repeatsMonthly: event.target.checked,
                          } : current)
                        }}
                        style={{ width: 18, height: 18, marginTop: 2, accentColor: T.brandDark }}
                      />
                      <span>
                        <span style={{ display: 'block', color: T.text1 }}>
                          Remind me about this every month
                        </span>
                        <span style={{
                          display: 'block',
                          marginTop: 'var(--space-2xs)',
                          fontSize: 'var(--text-xs)',
                          fontWeight: 'var(--weight-regular)',
                          color: T.text3,
                          lineHeight: 1.4,
                        }}>
                          We’ll remind you before it’s due
                        </span>
                      </span>
                    </label>
                  </div>
                )}

                <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
                  <PrimaryBtn size="lg" onClick={goToEditCategory}>
                    Continue
                  </PrimaryBtn>
                </div>
              </div>
            )}

            {editStep === 'category' && (
              <div style={{ display: 'grid', gap: 'var(--space-lg)' }}>
                {!isSearchingCategories && suggestedCategoryOptions.length > 0 ? (
                  <div style={{ display: 'grid', gap: 'var(--space-xs)' }}>
                    <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: T.text1 }}>
                      Suggested
                    </p>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                      {suggestedCategoryOptions.map((option) => (
                        <SingleSelectChip
                          key={`suggested-${option.key}`}
                          label={option.label}
                          selected={editDraft.categoryKey === option.key}
                          onClick={() => selectImportCategory(option)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {!isSearchingCategories && frequentCategoryOptions.length > 0 ? (
                  <div style={{ display: 'grid', gap: 'var(--space-xs)' }}>
                    <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: T.text2 }}>
                      Frequent
                    </p>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                      {frequentCategoryOptions.map((option) => (
                        <SingleSelectChip
                          key={`frequent-${option.key}`}
                          label={option.label}
                          selected={editDraft.categoryKey === option.key}
                          onClick={() => selectImportCategory(option)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                <input
                  type="search"
                  value={categoryQuery}
                  onChange={(event) => setCategoryQuery(event.target.value)}
                  placeholder="Search categories"
                  aria-label="Search categories"
                  className={styles.focusRing}
                  style={{
                    width: '100%',
                    height: 40,
                    borderRadius: 10,
                    border: `var(--border-width) solid ${T.border}`,
                    background: T.white,
                    padding: '0 14px',
                    fontSize: 'var(--text-sm)',
                    color: T.text1,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />

                {isSearchingCategories ? (
                  categorySearchResults.length > 0 ? (
                    <div style={{
                      display: 'flex',
                      gap: 'var(--space-sm)',
                      flexWrap: 'wrap',
                      maxHeight: 200,
                      overflowY: 'auto',
                    }}>
                      {categorySearchResults.map((option) => (
                        <SingleSelectChip
                          key={`search-${option.key}`}
                          label={option.label}
                          selected={editDraft.categoryKey === option.key}
                          onClick={() => selectImportCategory(option)}
                        />
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: T.text3, lineHeight: 1.5 }}>
                      No matches.
                    </p>
                  )
                ) : (
                  <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
                    <div
                      role="tablist"
                      aria-label="Category groups"
                      style={{
                        display: 'flex',
                        padding: 3,
                        borderRadius: 10,
                        background: 'var(--grey-100)',
                        width: '100%',
                      }}
                    >
                      {IMPORT_CATEGORY_GROUPS.map((group) => {
                        const groupType = toImportCategoryType(group.type)
                        if (!groupType) return null
                        const active = categoryFilter === groupType
                        return (
                          <button
                            key={`filter-${groupType}`}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => setCategoryFilter(groupType)}
                            style={{
                              flex: 1,
                              height: 30,
                              borderRadius: 8,
                              border: 'none',
                              background: active ? T.white : 'transparent',
                              color: active ? T.text1 : T.text2,
                              fontSize: 'var(--text-sm)',
                              fontWeight: active ? 'var(--weight-semibold)' : 'var(--weight-medium)',
                              cursor: 'pointer',
                              boxShadow: active ? '0 1px 2px rgba(16, 24, 40, 0.08)' : 'none',
                              transition: 'background 140ms ease, color 140ms ease, box-shadow 140ms ease',
                            }}
                          >
                            {group.label}
                          </button>
                        )
                      })}
                    </div>

                    {tabCategoryOptions.length > 0 ? (
                      <div style={{
                        display: 'flex',
                        gap: 'var(--space-sm)',
                        flexWrap: 'wrap',
                        maxHeight: 200,
                        overflowY: 'auto',
                      }}>
                        {tabCategoryOptions.map((option) => (
                          <SingleSelectChip
                            key={`filtered-${option.key}`}
                            label={option.label}
                            selected={editDraft.categoryKey === option.key}
                            onClick={() => selectImportCategory(option)}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}

                <div>
                  {editErrors.category && (
                    <p style={{ margin: 'var(--space-xs) 0 0', fontSize: 12, color: T.amberDark, lineHeight: 1.4 }}>
                      {editErrors.category}
                    </p>
                  )}
                </div>

                {editDraft.categoryType === 'debt' && (
                  <div>
                    <p style={{ margin: '0 0 6px', fontSize: 12.5, fontWeight: 600, color: T.text2, letterSpacing: '0.2px' }}>
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

                        <MoneyInput
                          label="Total owed"
                          value={createDebtDraft.totalOwed}
                          onChange={(value) => {
                            setCreateDebtDraft((current) => ({ ...current, totalOwed: value }))
                            setCreateDebtError(null)
                          }}
                          currency={editingRow.currency || 'KES'}
                        />

                        <div>
                          <p style={{ margin: '0 0 6px', fontSize: 12.5, fontWeight: 600, color: T.text2, letterSpacing: '0.2px' }}>
                            Direction
                          </p>
                          <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                            {([
                              { value: 'owed_by_me', label: 'I owe this' },
                              { value: 'owed_to_me', label: 'Owed to me' },
                            ] as const).map((option) => (
                              <SingleSelectChip
                                key={option.value}
                                label={option.label}
                                selected={createDebtDraft.direction === option.value}
                                onClick={() => setCreateDebtDraft((current) => ({ ...current, direction: option.value }))}
                              />
                            ))}
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
                          <PrimaryBtn size="md" onClick={handleCreateDebt} disabled={creatingDebt}>
                            {creatingDebt ? 'Creating…' : 'Create'}
                          </PrimaryBtn>
                          <SecondaryBtn size="md" onClick={closeCreateDebtForm} disabled={creatingDebt}>
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
                          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: T.brandDark }}>
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
                                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: selected ? T.brandDark : T.text1 }}>
                                    {debt.name}
                                  </span>
                                  <span style={{ fontSize: 'var(--text-xs)', color: selected ? T.brandDark : T.text3, whiteSpace: 'nowrap' }}>
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

                <div style={{
                  display: 'grid',
                  gap: 'var(--space-sm)',
                  position: 'sticky',
                  bottom: 0,
                  background: T.white,
                  paddingTop: 'var(--space-sm)',
                }}>
                  <PrimaryBtn
                    size="lg"
                    onClick={goToEditReview}
                    disabled={!editDraft.categoryKey}
                  >
                    Continue
                  </PrimaryBtn>
                </div>
              </div>
            )}

            {editStep === 'review' && editedPreviewRow && (
              <div style={{ display: 'grid', gap: 'var(--space-lg)' }}>
                <div style={{
                  background: 'var(--grey-50)',
                  border: `1px solid ${T.borderSubtle}`,
                  borderRadius: 16,
                  padding: 'var(--space-md)',
                  display: 'grid',
                  gap: 'var(--space-sm)',
                }}>
                  <SummaryRow label="Name" value={editedPreviewRow.label} />
                  <SummaryRow label="Amount" value={`${editedPreviewRow.currency} ${Number.isFinite(editedPreviewRow.amount) ? editedPreviewRow.amount.toLocaleString() : 0}`} />
                  <SummaryRow label="Category" value={getCategoryLabel(editedPreviewRow.categoryKey, categoryLabel(editedPreviewRow.categoryType))} />
                  {editedPreviewRow.isImportedMessage ? (
                    <SummaryRow label="Date" value={formatImportedRowDateLabel(editedPreviewRow.date)} />
                  ) : null}
                  {editedPreviewRow.categoryType === 'debt' ? (
                    <SummaryRow label="Debt" value={editedPreviewRow.debtName ?? 'Select a debt'} />
                  ) : null}
                </div>

                {(() => {
                  const hardErrors = validateRow(editedPreviewRow)
                  return hardErrors.length > 0 ? (
                    <div style={{ display: 'grid', gap: 4 }}>
                      {hardErrors.map((issue, index) => (
                        <p key={`review-issue-${index}`} style={{ margin: 0, fontSize: 12, color: T.redDark, lineHeight: 1.45 }}>
                          {issue}
                        </p>
                      ))}
                    </div>
                  ) : null
                })()}

                {editDeleteConfirmOpen ? (
                  <div style={{
                    border: `1px solid ${T.border}`,
                    borderRadius: 16,
                    padding: 'var(--space-md)',
                    display: 'grid',
                    gap: 'var(--space-sm)',
                    background: 'var(--grey-50)',
                  }}>
                    <p style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: T.text1 }}>
                      Delete this row?
                    </p>
                    <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: T.text2, lineHeight: 1.5 }}>
                      This will remove it from the import list.
                    </p>
                    <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
                      <SecondaryBtn size="lg" onClick={() => setEditDeleteConfirmOpen(false)}>
                        Cancel
                      </SecondaryBtn>
                      <PrimaryBtn size="lg" onClick={deleteEditingRow} style={{ background: T.redDark, color: T.white }}>
                        Delete
                      </PrimaryBtn>
                    </div>
                  </div>
                ) : null}

                <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
                  <PrimaryBtn size="lg" onClick={handleReviewRowPrimaryAction}>
                    {nextEditableRow ? 'Next entry' : 'Done'}
                  </PrimaryBtn>
                </div>
              </div>
            )}
          </div>
          {editStep === 'category' && !editingRow.isImportedMessage ? (
            <div style={{ marginTop: 'var(--space-md)', display: 'flex', justifyContent: 'center' }}>
              <TertiaryBtn size="md" onClick={() => setEditStep('details')}>
                Edit details
              </TertiaryBtn>
            </div>
          ) : null}

          {editStep === 'review' ? (
            <div style={{
              marginTop: 'var(--space-md)',
              display: 'grid',
              justifyItems: 'center',
              gap: 'var(--space-sm)',
            }}>
              {!editingRow.isImportedMessage ? (
                <TertiaryBtn size="md" onClick={() => setEditStep('details')}>
                  Edit details
                </TertiaryBtn>
              ) : null}
              <TertiaryBtn size="md" onClick={() => setEditDeleteConfirmOpen(true)} style={{ color: T.redDark }}>
                Remove row
              </TertiaryBtn>
            </div>
          ) : null}
          </>
        )}
      </div>
    </div>
  )
}
