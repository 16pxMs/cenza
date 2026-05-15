'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PrimaryBtn, SecondaryBtn, TertiaryBtn } from '@/components/ui/Button/Button'
import { Input } from '@/components/ui/Input/Input'
import { MoneyInput } from '@/components/ui/MoneyInput/MoneyInput'
import { SingleSelectChip } from '@/components/ui/SingleSelectChip/SingleSelectChip'
import { IconBack, IconCheck } from '@/components/ui/Icons'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { ExpenseAddedSuccess, type ExpenseAddedSuccessEntry } from '@/components/flows/log/ExpenseAddedSuccess'
import { recurringExpenseKey } from '@/lib/fixed-bills/canonical'
import { getCategoryLabel } from '@/lib/categories/config'
import { getGroupedCategoryOptions } from '@/lib/categories/options'
import {
  createSmsCustomCategory,
  loadSmsCustomCategories,
  parseSmsImport,
  saveParsedSmsExpenses,
  loadActiveDebts,
  type ActiveDebtOption,
  type CustomCategoryOption,
  type ParseSmsImportData,
} from './actions'
import type { CsvImportMapping } from '@/lib/sms-import/parser'
import {
  buildNeedsCategoryMetaLabel,
  buildRowMetaLabel,
  formatImportedRowDateLabel,
  getInitialEditStepForRow,
  getNextEditableRowIndex,
  getPreviousStepForActiveRow,
  getQueueGuidanceCopy,
  getQueueSaveHelperCopy,
  getReviewRowActionLabel,
  getReviewRowPrimaryLabel,
  getReviewRowPrimaryOutcome,
  getSuggestedCategoryOptions,
  replaceEditedReviewRow,
  shouldShowReviewReminder,
  shouldSaveSingleCompletedReviewRow,
  shouldAutoOpenSingleEntryEditFlow,
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
type ImportMode = 'current' | 'past'
type PastInputMode = 'paste' | 'csv'
type CsvMappingField = 'date' | 'name' | 'amount' | 'category' | 'note'
type EditStep = 'details' | 'category' | 'review' | 'changeCategory'
type CategoryBrowserMode = 'select' | 'create'

interface EditableRow {
  id: string
  raw: string
  label: string
  categoryType: ImportCategoryType | null
  categoryKey: string
  customCategoryId: string | null
  amount: number
  currency: string
  date: string
  dateSource?: 'explicit' | 'default_month' | null
  isImportedMessage: boolean
  confidence: 'high' | 'medium' | 'low'
  sourceHash: string
  sourceType?: 'sms' | 'simple_text' | 'past_text' | 'pasted_table' | 'csv'
  sourceRowIndex?: number
  parseStatus?: 'clear' | 'partial' | 'ambiguous' | 'failed' | 'invalid'
  parseMessage?: string | null
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
  textInverse: 'var(--text-inverse)',
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
type ImportCategoryOption = (typeof IMPORT_CATEGORY_GROUPS)[number]['options'][number] & {
  customCategoryId?: string | null
  source?: 'canonical' | 'custom'
}

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

function validateRow(row: EditableRow, options: { requireCategory?: boolean } = {}) {
  // Past-import flows pass requireCategory=false so users can save partially
  // reconstructed history without being forced to categorize every row.
  // Current-mode SMS imports keep the strict default.
  const requireCategory = options.requireCategory !== false
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
  if (requireCategory && !row.categoryType) {
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

function SummaryRow({ label, value, divided = true }: { label: string; value: string; divided?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 'var(--space-md)',
      paddingBottom: divided ? 'var(--space-sm)' : 0,
      borderBottom: divided ? `1px solid ${T.borderSubtle}` : 'none',
    }}>
      <span style={{
        fontSize: 'var(--text-sm)',
        color: T.text3,
        lineHeight: 1.35,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 'var(--text-base)',
        fontWeight: 'var(--weight-semibold)',
        color: T.text1,
        textAlign: 'right',
        lineHeight: 1.35,
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

function getPastMonthGroupLabel(date: string) {
  const parsed = new Date(`${date}T12:00:00`)
  if (!date || Number.isNaN(parsed.getTime())) return 'Needs date'
  return parsed.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function getPastDateSourceLabel(row: Pick<EditableRow, 'date' | 'dateSource'>) {
  if (row.dateSource !== 'default_month') return null
  return `Added to ${getPastMonthGroupLabel(row.date)}`
}

function getSimilarEntryKey(label: string) {
  return normalize(label).replace(/[^a-z0-9]+/g, ' ').trim()
}

function getCurrentImportMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function importMonthToDefaultDate(month: string) {
  return /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : ''
}

function formatImportMonthLabel(month: string) {
  const parsed = new Date(`${month}-01T12:00:00`)
  if (!/^\d{4}-\d{2}$/.test(month) || Number.isNaN(parsed.getTime())) return month
  return parsed.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function getRecentImportMonths(count = 6) {
  const now = new Date()
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1, 12, 0, 0, 0)
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    return { value, label: index === 0 ? `Current month · ${formatImportMonthLabel(value)}` : formatImportMonthLabel(value) }
  })
}

function sortPastRowsForReview(rows: EditableRow[]) {
  return [...rows].sort((a, b) => {
    const aDate = /^\d{4}-\d{2}-\d{2}$/.test(a.date) ? a.date : '9999-12-31'
    const bDate = /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : '9999-12-31'
    if (aDate !== bDate) return aDate.localeCompare(bDate)
    return (a.sourceRowIndex ?? 0) - (b.sourceRowIndex ?? 0)
  })
}

export function SmsImportClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo') || '/log'
  const importMode: ImportMode = searchParams.get('mode') === 'past' ? 'past' : 'current'
  const isPastMode = importMode === 'past'
  const [defaultImportMonth, setDefaultImportMonth] = useState(getCurrentImportMonth)
  const [pastInputMode, setPastInputMode] = useState<PastInputMode>('paste')
  const [csvFileName, setCsvFileName] = useState('')
  const [csvText, setCsvText] = useState('')
  const [csvMappingRequired, setCsvMappingRequired] = useState<{ headers: string[]; missing: Array<'name' | 'amount'> } | null>(null)
  const [csvMapping, setCsvMapping] = useState<Record<CsvMappingField, string>>({
    date: '',
    name: '',
    amount: '',
    category: '',
    note: '',
  })

  const [rawText, setRawText] = useState('')
  const [rows, setRows] = useState<EditableRow[]>([])
  const [parseMeta, setParseMeta] = useState<{ scanned: number; skippedCredits: number }>({ scanned: 0, skippedCredits: 0 })
  const [monthlyReminderKeys, setMonthlyReminderKeys] = useState<string[]>([])
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [savedRowsSnapshot, setSavedRowsSnapshot] = useState<EditableRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rowErrors, setRowErrors] = useState<Record<string, string[]>>({})
  const [rowWarnings, setRowWarnings] = useState<Record<string, string[]>>({})
  const [expandedRaw, setExpandedRaw] = useState<Record<string, boolean>>({})
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editStep, setEditStep] = useState<EditStep | null>(null)
  const [editedRowIds, setEditedRowIds] = useState<string[]>([])
  const [editOpenedFromReviewList, setEditOpenedFromReviewList] = useState(false)
  const [detailsReturnStep, setDetailsReturnStep] = useState<EditStep | null>(null)
  const [recentCategoryKeys, setRecentCategoryKeys] = useState<string[]>([])
  const [frozenRecentKeys, setFrozenRecentKeys] = useState<string[]>([])
  const [categoryFilter, setCategoryFilter] = useState<ImportCategoryType>('everyday')
  const [categoryQuery, setCategoryQuery] = useState('')
  const [categoryBrowserOpen, setCategoryBrowserOpen] = useState(false)
  const [categoryBrowserMode, setCategoryBrowserMode] = useState<CategoryBrowserMode>('select')
  const [customCategories, setCustomCategories] = useState<CustomCategoryOption[]>([])
  const [customCategoriesLoaded, setCustomCategoriesLoaded] = useState(false)
  const [createCategoryLabel, setCreateCategoryLabel] = useState('')
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [createCategoryError, setCreateCategoryError] = useState<string | null>(null)
  const [categoryBrowserNotice, setCategoryBrowserNotice] = useState<string | null>(null)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [pickerDraftSelection, setPickerDraftSelection] = useState<{
    categoryType: ImportCategoryType | null
    categoryKey: string | null
    customCategoryId: string | null
  } | null>(null)
  const [selectedPastRowIds, setSelectedPastRowIds] = useState<string[]>([])
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false)
  const [addAnotherOpen, setAddAnotherOpen] = useState(false)
  const [addAnotherText, setAddAnotherText] = useState('')
  const [addAnotherParsing, setAddAnotherParsing] = useState(false)
  const [addAnotherError, setAddAnotherError] = useState<string | null>(null)

  useEffect(() => {
    setRecentCategoryKeys(loadRecentCategoryKeys())
  }, [])
  useEffect(() => {
    let cancelled = false
    loadSmsCustomCategories().then((result) => {
      if (cancelled) return
      if (result.ok) setCustomCategories(result.data)
      setCustomCategoriesLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [])
  const [editDraft, setEditDraft] = useState<{
    label: string
    amount: string
    date: string
    dateSource?: 'explicit' | 'default_month' | null
    categoryType: ImportCategoryType | null
    categoryKey: string | null
    customCategoryId: string | null
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
      dateSource: editDraft.dateSource,
      categoryType: editDraft.categoryType,
      categoryKey: editDraft.categoryKey ?? editingRow.categoryKey,
      customCategoryId: editDraft.customCategoryId,
      repeatsMonthly:
        editDraft.categoryType === 'everyday' || editDraft.categoryType === 'fixed'
          ? editDraft.repeatsMonthly
          : false,
      debtId: editDraft.categoryType === 'debt' ? editDraft.debtId : null,
      debtName: editDraft.categoryType === 'debt' ? selectedDebt?.name ?? null : null,
    } satisfies EditableRow
  }, [activeDebts, editDraft, editingRow])
  const smsPlaceholder = (isPastMode ? [
    'Jan 5 Uber 1200',
    'Feb 2 Rent 25000',
    '2026-03-12, Groceries, 3400',
    'Date | Name | Amount | Category',
    '2026-03-20 | Internet | 4500 | Internet',
  ] : [
    'M-PESA: Confirmed. KES 2,100 paid to Naivas',
    'food 500',
    'groceries 2500',
  ]).join('\n')
  const hasDuplicateWarnings = useMemo(
    () => Object.values(rowWarnings).some((warnings) => warnings.includes(DUPLICATE_MESSAGE)),
    [rowWarnings]
  )
  const parserReviewWarningCount = useMemo(
    () => Object.values(rowWarnings).filter((warnings) =>
      warnings.some((warning) => warning !== DUPLICATE_MESSAGE)
    ).length,
    [rowWarnings]
  )
  // Past imports are forgiving: missing category is allowed at save time.
  // Current-mode SMS imports keep strict category enforcement.
  const validateImportRow = useMemo(
    () => (row: EditableRow) => validateRow(row, { requireCategory: !isPastMode }),
    [isPastMode]
  )
  const reviewState = useMemo(
    () =>
      getSmsImportReviewState({
        rows,
        rowErrors,
        getClientIssues: validateImportRow,
      }),
    [rowErrors, rows, validateImportRow]
  )
  const {
    savableRows,
    validSavableRows,
    hasHardBlockedRows,
    hasDuplicateBlockedRows,
    hasSavableClientValidationErrors,
  } = reviewState
  const reviewCopy = useMemo(() => (
    isPastMode
      ? {
        title: 'Review past expenses',
        body: 'Check dates, amounts, and categories before saving.',
      }
      : getReviewCopy(rows)
  ), [isPastMode, rows])
  const recentImportMonths = useMemo(() => getRecentImportMonths(6), [])
  const defaultImportMonthLabel = formatImportMonthLabel(defaultImportMonth)
  const unresolvedCategoryCount = useMemo(
    () =>
      rows.reduce((count, row) => {
        const serverErrors = rowErrors[row.id] ?? []
        // Always check uncategorized against the strict ruleset so the meta
        // ("N uncategorized") still reflects reality, even in past mode where
        // the missing category is no longer treated as a hard error.
        const clientIssues = validateRow(row, { requireCategory: true })
        const hasHardError = serverErrors.length > 0 || clientIssues.some((issue) => issue !== 'Choose a category')
        const needsCategory = !row.categoryType && !hasHardError
        return count + (needsCategory ? 1 : 0)
      }, 0),
    [rowErrors, rows]
  )
  const firstUncategorizedCurrentRowIndex = useMemo(
    () =>
      isPastMode
        ? -1
        : rows.findIndex((row) => {
          if (isBlockedIncomeRow(row)) return false
          const serverErrors = rowErrors[row.id] ?? []
          const clientIssues = validateRow(row, { requireCategory: true })
          const hasHardError = serverErrors.length > 0 || clientIssues.some((issue) => issue !== 'Choose a category')
          return !hasHardError && !row.categoryType
        }),
    [isPastMode, rowErrors, rows]
  )
  const queueGuidance = useMemo(
    () => getQueueGuidanceCopy(unresolvedCategoryCount),
    [unresolvedCategoryCount]
  )
  const queueSaveHelper = useMemo(
    () => getQueueSaveHelperCopy(unresolvedCategoryCount, { isPastMode }),
    [unresolvedCategoryCount, isPastMode]
  )
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
  const selectedPastRows = useMemo(
    () => rows.filter((row) => selectedPastRowIds.includes(row.id)),
    [rows, selectedPastRowIds]
  )
  const editedPreviewRowIssues = editedPreviewRow ? validateImportRow(editedPreviewRow) : []
  const shouldSaveReviewRowImmediately = shouldSaveSingleCompletedReviewRow({
    totalRows: rows.length,
    editableRowCount: editableRowIndices.length,
    isCurrentRowEditable: !!editedPreviewRow && !isBlockedIncomeRow(editedPreviewRow),
    hasNextEditableRow: !!nextEditableRow,
    currentRowHasErrors: editedPreviewRowIssues.length > 0 || (editedPreviewRow ? (rowErrors[editedPreviewRow.id] ?? []).length > 0 : true),
    currentRowHasWarnings: editedPreviewRow ? (rowWarnings[editedPreviewRow.id] ?? []).includes(DUPLICATE_MESSAGE) : true,
  })
  const reviewRowPrimaryOutcome = getReviewRowPrimaryOutcome({
    hasNextEditableRow: !!nextEditableRow,
    savesImmediately: shouldSaveReviewRowImmediately,
  })
  const hasExistingMonthlyReminder = (
    input: Pick<EditableRow, 'label' | 'categoryKey' | 'categoryType'>
  ) => {
    if (input.categoryType !== 'everyday' && input.categoryType !== 'fixed') return false
    const canonicalKey = recurringExpenseKey(input.categoryType, slugify(input.categoryKey || input.label))
    return monthlyReminderKeySet.has(canonicalKey)
  }
  const showReviewReminder = useMemo(() => {
    if (!editedPreviewRow) return false
    return shouldShowReviewReminder({
      categoryType: editedPreviewRow.categoryType,
      hasExistingMonthlyReminder: hasExistingMonthlyReminder(editedPreviewRow),
    })
  }, [editedPreviewRow, monthlyReminderKeySet])
  const importCategoryGroups = useMemo(() => {
    return IMPORT_CATEGORY_GROUPS.map((group) => {
      const customOptions: ImportCategoryOption[] = customCategories
        .filter((category) => category.type === group.type)
        .map((category) => ({
          key: category.key,
          label: category.label,
          type: category.type,
          customCategoryId: category.customCategoryId,
          source: 'custom',
        }))
      return {
        ...group,
        options: [...group.options, ...customOptions],
      }
    })
  }, [customCategories])
  const suggestedCategoryOptions = useMemo(
    () => editDraft ? getSuggestedCategoryOptions(editDraft.label, IMPORT_CATEGORY_GROUPS) : [],
    [editDraft]
  )
  const frequentCategoryOptions = useMemo(() => {
    if (!editDraft) return []
    const exclude = new Set(suggestedCategoryOptions.map((option) => option.key))
    return getFrequentCategoryOptions(frozenRecentKeys, importCategoryGroups, exclude)
  }, [editDraft, frozenRecentKeys, importCategoryGroups, suggestedCategoryOptions])
  const filteredCategoryGroup = useMemo(() => {
    return importCategoryGroups.find((group) => group.type === categoryFilter) ?? null
  }, [categoryFilter, importCategoryGroups])
  const allCategoryOptions = useMemo<ImportCategoryOption[]>(() => {
    return importCategoryGroups.flatMap((group) => group.options as ImportCategoryOption[])
  }, [importCategoryGroups])
  const recentCustomCategoryOptions = useMemo<ImportCategoryOption[]>(() => {
    return [...customCategories]
      .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
      .slice(0, 10)
      .map((category) => ({
        key: category.key,
        label: category.label,
        type: category.type,
        customCategoryId: category.customCategoryId,
        source: 'custom',
      }))
  }, [customCategories])
  const trimmedCategoryQuery = categoryQuery.trim().toLowerCase()
  const isSearchingCategories = trimmedCategoryQuery.length > 0
  const categorySearchResults = useMemo(() => {
    if (!isSearchingCategories) return []
    return allCategoryOptions.filter((option) =>
      option.label.toLowerCase().includes(trimmedCategoryQuery),
    )
  }, [allCategoryOptions, isSearchingCategories, trimmedCategoryQuery])
  const normalizedCreateCategoryLabel = normalize(createCategoryLabel)
  const createCategoryMatches = useMemo<ImportCategoryOption[]>(() => {
    if (!normalizedCreateCategoryLabel) return recentCustomCategoryOptions

    return allCategoryOptions
      .filter((option) => {
        const normalizedOption = normalize(option.label)
        return (
          normalizedOption.includes(normalizedCreateCategoryLabel) ||
          normalizedCreateCategoryLabel.includes(normalizedOption)
        )
      })
      .slice(0, 10)
  }, [allCategoryOptions, normalizedCreateCategoryLabel, recentCustomCategoryOptions])
  const exactCreateCategoryMatch = useMemo(() => {
    if (!normalizedCreateCategoryLabel) return null
    return allCategoryOptions.find((option) => normalize(option.label) === normalizedCreateCategoryLabel) ?? null
  }, [allCategoryOptions, normalizedCreateCategoryLabel])
  const tabCategoryOptions = useMemo<ImportCategoryOption[]>(() => {
    if (!filteredCategoryGroup) return []
    const exclude = new Set<string>([
      ...suggestedCategoryOptions.map((option) => option.key),
      ...frequentCategoryOptions.map((option) => option.key),
    ])
    return (filteredCategoryGroup.options as ImportCategoryOption[]).filter((option) => !exclude.has(option.key))
  }, [filteredCategoryGroup, suggestedCategoryOptions, frequentCategoryOptions])
  const resolveImportCategoryLabel = (
    categoryKey: string,
    categoryType: ImportCategoryType | null,
    customCategoryId?: string | null
  ) => {
    const custom = customCategoryId
      ? customCategories.find((category) => category.customCategoryId === customCategoryId)
      : null
    if (custom) return custom.label
    const option = allCategoryOptions.find((candidate) =>
      candidate.key === categoryKey &&
      (!customCategoryId || candidate.customCategoryId === customCategoryId)
    )
    return option?.label ?? getCategoryLabel(categoryKey, categoryLabel(categoryType))
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

  const updateDefaultImportMonth = (month: string) => {
    setDefaultImportMonth(month)
    if (!isPastMode) return
    const inheritedDate = importMonthToDefaultDate(month)
    if (!inheritedDate) return
    applyRowsChange((current) =>
      sortPastRowsForReview(
        current.map((row) =>
          row.dateSource === 'default_month'
            ? { ...row, date: inheritedDate }
            : row
        )
      )
    )
  }

  const updateRow = (id: string, patch: Partial<EditableRow>) => {
    applyRowsChange((current) =>
      current.map((row) => {
        if (row.id !== id) return row
        return { ...row, ...patch }
      })
    )
  }

  const togglePastRowSelection = (id: string) => {
    setSelectedPastRowIds((current) =>
      current.includes(id)
        ? current.filter((rowId) => rowId !== id)
        : [...current, id]
    )
  }

  const removeRowsById = (ids: string[]) => {
    const idSet = new Set(ids)
    applyRowsChange((current) => current.filter((row) => !idSet.has(row.id)))
    setSelectedPastRowIds((current) => current.filter((id) => !idSet.has(id)))
    setExpandedRaw((current) => {
      const next = { ...current }
      for (const id of ids) delete next[id]
      return next
    })
  }

  const applyCategoryToRows = (
    rowIds: string[],
    option: { key: string; type: string; customCategoryId?: string | null }
  ) => {
    const nextType = toImportCategoryType(option.type)
    if (!nextType) return
    const idSet = new Set(rowIds)
    applyRowsChange((current) =>
      current.map((row) => {
        if (!idSet.has(row.id)) return row
        return {
          ...row,
          categoryType: nextType,
          categoryKey: option.key,
          customCategoryId: option.customCategoryId ?? null,
          repeatsMonthly: nextType === 'everyday' || nextType === 'fixed' ? row.repeatsMonthly : false,
          debtId: nextType === 'debt' ? row.debtId : null,
          debtName: nextType === 'debt' ? row.debtName : null,
        }
      })
    )
    setRecentCategoryKeys(recordRecentCategoryKey(option.key))
  }

  const applyCategoryToSimilarRows = (sourceRow: EditableRow) => {
    if (!sourceRow.categoryType || !sourceRow.categoryKey) return
    const similarKey = getSimilarEntryKey(sourceRow.label)
    if (!similarKey) return
    const matchingRowIds = rows
      .filter((row) =>
        row.id !== sourceRow.id &&
        !isBlockedIncomeRow(row) &&
        getSimilarEntryKey(row.label) === similarKey
      )
      .map((row) => row.id)
    if (matchingRowIds.length === 0) return
    applyCategoryToRows(matchingRowIds, {
      key: sourceRow.categoryKey,
      type: sourceRow.categoryType,
      customCategoryId: sourceRow.customCategoryId,
    })
  }

  const applyBulkCategory = (option: ImportCategoryOption) => {
    if (selectedPastRowIds.length === 0) return
    applyCategoryToRows(selectedPastRowIds, option)
    setSelectedPastRowIds([])
    closeBulkCategoryPicker()
  }

  const openBulkCategoryPicker = () => {
    if (selectedPastRowIds.length === 0) return
    setCategoryFilter('everyday')
    setCategoryQuery('')
    setCategoryBrowserMode('select')
    setCreateCategoryLabel('')
    setCreateCategoryError(null)
    setCategoryBrowserNotice(null)
    setBulkCategoryOpen(true)
  }

  const closeBulkCategoryPicker = () => {
    setBulkCategoryOpen(false)
    setCategoryQuery('')
    setCategoryBrowserMode('select')
    setCreateCategoryLabel('')
    setCreateCategoryError(null)
    setCategoryBrowserNotice(null)
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

  const beginEditRow = (row: EditableRow, fromReviewList: boolean, editableRowCount: number) => {
    if (isBlockedIncomeRow(row)) return

    const isSingleEntry = editableRowCount === 1
    setEditingRowId(row.id)
    setEditOpenedFromReviewList(fromReviewList)
    setDetailsReturnStep(null)
    setEditStep(getInitialEditStepForRow(row, { isSingleEntry }))
    setFrozenRecentKeys(loadRecentCategoryKeys())
    setEditDraft({
      label: row.label,
      amount: String(row.amount),
      date: row.date,
      dateSource: row.dateSource,
      categoryType: row.categoryType,
      categoryKey: row.categoryKey,
      customCategoryId: row.customCategoryId,
      repeatsMonthly: row.repeatsMonthly,
      debtId: row.debtId,
    })
    setEditErrors({})
    setShowCreateDebt(false)
    if (row.categoryType === 'debt') {
      ensureDebtsLoaded()
    }
  }

  const openEditRow = (row: EditableRow) => {
    beginEditRow(row, true, editableRowIndices.length)
  }

  const openEditRowAtIndex = (index: number) => {
    const row = rows[index]
    if (!row || isBlockedIncomeRow(row)) return
    openEditRow(row)
  }

  const guideCurrentRowsToCategoryCompletion = () => {
    if (firstUncategorizedCurrentRowIndex < 0) return
    const row = rows[firstUncategorizedCurrentRowIndex]
    if (!row) return
    beginEditRow(row, true, editableRowIndices.length)
    setEditStep('category')
    setDetailsReturnStep(null)
    setCategoryBrowserOpen(false)
    setError(null)
  }

  const closeEditRow = () => {
    setEditingRowId(null)
    setEditStep(null)
    setEditOpenedFromReviewList(false)
    setDetailsReturnStep(null)
    setEditDraft(null)
    setEditDeleteConfirmOpen(false)
    setEditErrors({})
    setShowCreateDebt(false)
    setCreateDebtError(null)
    setCategoryBrowserOpen(false)
    setPickerDraftSelection(null)
  }

  const resetEditDraftToRow = (row: EditableRow) => {
    setEditDraft({
      label: row.label,
      amount: String(row.amount),
      date: row.date,
      dateSource: row.dateSource,
      categoryType: row.categoryType,
      categoryKey: row.categoryKey,
      customCategoryId: row.customCategoryId,
      repeatsMonthly: row.repeatsMonthly,
      debtId: row.debtId,
    })
  }

  const clearImportReviewState = () => {
    setRows([])
    setMonthlyReminderKeys([])
    setRowErrors({})
    setRowWarnings({})
    setExpandedRaw({})
    setEditedRowIds([])
    setError(null)
    setSelectedPastRowIds([])
    setBulkCategoryOpen(false)
  }

  const resetImportSession = () => {
    setRawText('')
    setCsvFileName('')
    setCsvText('')
    setCsvMappingRequired(null)
    setCsvMapping({ date: '', name: '', amount: '', category: '', note: '' })
    setParseMeta({ scanned: 0, skippedCredits: 0 })
    clearImportReviewState()
    closeEditRow()
    setCancelConfirmOpen(false)
    setParsing(false)
    setSaving(false)
  }

  const shouldConfirmImportCancel = () => (
    rows.length > 1 &&
    (editedRowIds.length > 0 || rows.some((row) => row.categoryType || row.repeatsMonthly || row.debtId))
  )

  const requestCancelImport = () => {
    if (shouldConfirmImportCancel()) {
      setCancelConfirmOpen(true)
      return
    }
    resetImportSession()
  }

  const returnToInputScreen = () => {
    clearImportReviewState()
  }

  const goBackWithinEditFlow = () => {
    if (!editingRow || !editStep) return

    const isSingleEntry = editableRowIndices.length === 1
    const previousStep = getPreviousStepForActiveRow({
      currentStep: editStep,
      isImportedMessage: editingRow.isImportedMessage,
      detailsReturnStep,
      isSingleEntry,
    })

    if (previousStep) {
      if (editStep === 'details' && previousStep === 'review') {
        resetEditDraftToRow(editingRow)
        setEditErrors({})
      }
      if (editStep === 'details') {
        setDetailsReturnStep(null)
      }
      setEditStep(previousStep)
      return
    }

    if (isSingleEntry && (editStep === 'category' || editStep === 'details')) {
      returnToInputScreen()
      closeEditRow()
      return
    }

    if (!editOpenedFromReviewList && editStep === 'category' && !editingRow.isImportedMessage) {
      returnToInputScreen()
      closeEditRow()
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

  const openEditDetailsFromReview = () => {
    setDetailsReturnStep('review')
    setEditStep('details')
    setEditErrors({})
  }

  const openChangeCategoryFromDetails = () => {
    setEditErrors({})
    setCategoryFilter(editDraft?.categoryType === 'fixed' || editDraft?.categoryType === 'debt' ? editDraft.categoryType : 'everyday')
    setCategoryQuery('')
    setCategoryBrowserMode('select')
    setCreateCategoryLabel('')
    setCreateCategoryError(null)
    setCategoryBrowserNotice(null)
    setPickerDraftSelection(
      editDraft
        ? {
          categoryType: editDraft.categoryType,
          categoryKey: editDraft.categoryKey,
          customCategoryId: editDraft.customCategoryId,
        }
        : null,
    )
    setCategoryBrowserOpen(true)
    setEditStep('changeCategory')
  }

  const cancelDetailsEdit = () => {
    if (!editingRow) return
    if (editableRowIndices.length === 1) {
      returnToInputScreen()
      closeEditRow()
      return
    }
    resetEditDraftToRow(editingRow)
    setEditErrors({})
    setDetailsReturnStep(null)
    setEditStep('review')
  }

  const openCategoryBrowser = () => {
    setCategoryFilter(editDraft?.categoryType === 'fixed' || editDraft?.categoryType === 'debt' ? editDraft.categoryType : 'everyday')
    setCategoryQuery('')
    setCategoryBrowserMode('select')
    setCreateCategoryLabel('')
    setCreateCategoryError(null)
    setCategoryBrowserNotice(null)
    setCategoryBrowserOpen(true)
  }

  const closeCategoryBrowser = () => {
    setCategoryBrowserOpen(false)
    setCategoryQuery('')
    setCategoryBrowserMode('select')
    setCreateCategoryLabel('')
    setCreateCategoryError(null)
    setCategoryBrowserNotice(null)
    setPickerDraftSelection(null)
    if (editStep === 'changeCategory') {
      setEditStep('details')
    }
  }

  const selectCategoryInPicker = (option: { key: string; type: string; customCategoryId?: string | null }) => {
    const nextType = toImportCategoryType(option.type)
    if (!nextType) return
    setPickerDraftSelection({
      categoryType: nextType,
      categoryKey: option.key,
      customCategoryId: option.customCategoryId ?? null,
    })
    if (nextType === 'debt') ensureDebtsLoaded()
  }

  const commitPickerSelectionToDraft = () => {
    if (!pickerDraftSelection || !pickerDraftSelection.categoryType || !pickerDraftSelection.categoryKey) return
    const nextType = pickerDraftSelection.categoryType
    const nextKey = pickerDraftSelection.categoryKey
    const nextCustomId = pickerDraftSelection.customCategoryId
    setEditDraft((current) => {
      if (!current) return current
      const next = {
        ...current,
        categoryType: nextType,
        categoryKey: nextKey,
        customCategoryId: nextCustomId,
      }
      if (nextType !== 'everyday' && nextType !== 'fixed') {
        next.repeatsMonthly = false
      }
      if (nextType !== 'debt') {
        next.debtId = null
      }
      return next
    })
    setEditErrors((current) => ({ ...current, category: undefined, debtId: undefined }))
    setRecentCategoryKeys(recordRecentCategoryKey(nextKey))
    setPickerDraftSelection(null)
    setCategoryBrowserOpen(false)
    setCategoryQuery('')
    setCategoryBrowserMode('select')
    setCreateCategoryLabel('')
    setCreateCategoryError(null)
    setCategoryBrowserNotice(null)
    if (editStep === 'changeCategory') {
      setEditStep('details')
    }
  }

  const selectImportCategory = (option: { key: string; type: string; customCategoryId?: string | null }) => {
    const nextType = toImportCategoryType(option.type)
    if (!nextType) return
    setEditDraft((current) => {
      if (!current) return current
      const next = {
        ...current,
        categoryType: nextType,
        categoryKey: option.key,
        customCategoryId: option.customCategoryId ?? null,
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
    if (editStep === 'changeCategory') {
      setCategoryBrowserOpen(false)
      setCategoryQuery('')
      setCategoryBrowserMode('select')
      setCreateCategoryLabel('')
      setCreateCategoryError(null)
      setCategoryBrowserNotice(null)
      setPickerDraftSelection(null)
      setEditStep('details')
    }
  }

  const selectCategoryFromCreateMode = (option: ImportCategoryOption) => {
    if (bulkCategoryOpen) {
      applyBulkCategory(option)
      return
    }
    selectImportCategory(option)
    setCreateCategoryLabel('')
    setCreateCategoryError(null)
    setCategoryBrowserMode('select')
    setCategoryBrowserNotice(`${option.label} selected`)
  }

  const openCreateCategoryMode = () => {
    setCreateCategoryLabel(categoryQuery.trim())
    setCreateCategoryError(null)
    setCategoryBrowserNotice(null)
    setCategoryBrowserMode('create')
  }

  const returnToCategorySelection = () => {
    setCreateCategoryLabel('')
    setCreateCategoryError(null)
    setCategoryBrowserMode('select')
  }

  const handleCreateCustomCategory = async () => {
    const label = (createCategoryLabel || categoryQuery || editDraft?.label || '').trim()
    if (!label) {
      setCreateCategoryError('Category name is required.')
      return
    }

    setCreatingCategory(true)
    setCreateCategoryError(null)
    try {
      if (exactCreateCategoryMatch) {
        selectCategoryFromCreateMode(exactCreateCategoryMatch)
        return
      }

      const result = await createSmsCustomCategory({ label, type: 'everyday' })
      if (!result.ok) {
        setCreateCategoryError(
          result.error.kind === 'unauthorized'
            ? result.error.message
            : "We couldn't create that category."
        )
        return
      }
      setCustomCategories((current) => {
        const withoutExisting = current.filter((category) => category.customCategoryId !== result.data.customCategoryId)
        return [...withoutExisting, result.data].sort((a, b) => a.label.localeCompare(b.label))
      })
      selectCategoryFromCreateMode(result.data)
      setCategoryQuery('')
      setCategoryBrowserNotice(`${result.data.label} created`)
    } catch (err) {
      setCreateCategoryError(err instanceof Error ? err.message : "We couldn't create that category.")
    } finally {
      setCreatingCategory(false)
    }
  }

  const goToEditReview = () => {
    const nextErrors = collectEditErrors('category')
    if (Object.keys(nextErrors).length > 0) {
      setEditErrors(nextErrors)
      return
    }
    const nextRow = applyEditRow()
    if (!nextRow) return
    setEditErrors({})
    if (editableRowIndices.length === 1) {
      setDetailsReturnStep('category')
      setEditStep('details')
      return
    }
    setEditStep('review')
  }

  const buildEditedRowFromDraft = () => {
    if (!editingRowId || !editDraft) return null

    const nextErrors = collectEditErrors('all')
    if (Object.keys(nextErrors).length > 0) {
      setEditErrors(nextErrors)
      return null
    }

    const existingRow = rows.find((row) => row.id === editingRowId) ?? null
    if (!existingRow) return null
    const nextCategoryType = editDraft.categoryType
    const nextCategoryKey = editDraft.categoryKey
    const trimmedLabel = editDraft.label.trim()
    const amount = Number(editDraft.amount)
    const date = editDraft.date.trim()
    const selectedDebt = nextCategoryType === 'debt' && editDraft.debtId
      ? activeDebts.find((d) => d.id === editDraft.debtId) ?? null
      : null

    const nextRow: EditableRow = {
      ...existingRow,
      label: trimmedLabel,
      amount,
      date,
      dateSource: editDraft.dateSource,
      categoryType: nextCategoryType,
      categoryKey: nextCategoryKey ?? existingRow?.categoryKey ?? '',
      customCategoryId: editDraft.customCategoryId,
      repeatsMonthly:
        nextCategoryType === 'everyday' || nextCategoryType === 'fixed'
          ? editDraft.repeatsMonthly
          : false,
      debtId: selectedDebt ? selectedDebt.id : null,
      debtName: selectedDebt ? selectedDebt.name : null,
    }

    return nextRow
  }

  const applyEditRow = () => {
    const nextRow = buildEditedRowFromDraft()
    if (!nextRow || !editingRowId) return null
    updateRow(editingRowId, nextRow)
    setEditedRowIds((current) => current.includes(editingRowId) ? current : [...current, editingRowId])
    return nextRow
  }

  const saveDetailsChanges = async () => {
    const detailsErrors = collectEditErrors('details')
    if (Object.keys(detailsErrors).length > 0) {
      setEditErrors(detailsErrors)
      return
    }

    if (!editDraft?.categoryType || !editDraft.categoryKey) {
      setEditErrors({})
      setEditStep('category')
      return
    }

    const nextRow = applyEditRow()
    if (!nextRow) return

    if (editableRowIndices.length === 1) {
      const rowsToSave = replaceEditedReviewRow(rows, nextRow)
      const outcome = await handleSave(false, rowsToSave)
      if (outcome !== 'success') closeEditRow()
      return
    }

    setDetailsReturnStep(null)
    setEditStep('review')
  }

  const closeAddAnotherInput = () => {
    setAddAnotherOpen(false)
    setAddAnotherText('')
    setAddAnotherError(null)
    setAddAnotherParsing(false)
    const editable = rows.filter((row) => !isBlockedIncomeRow(row))
    if (editable.length === 1) {
      beginEditRow(editable[0], false, 1)
    }
  }

  const addAnotherExpenseFromEditFlow = () => {
    if (editingRow && editDraft) {
      const committed = applyEditRow()
      if (!committed) return
    }
    closeEditRow()
    setAddAnotherText('')
    setAddAnotherError(null)
    setAddAnotherParsing(false)
    setAddAnotherOpen(true)
  }

  const submitAddAnotherExpense = async () => {
    const text = addAnotherText.trim()
    if (!text) return
    setAddAnotherParsing(true)
    setAddAnotherError(null)
    try {
      const result = await parseSmsImport(text, {
        mode: importMode,
        defaultImportMonth: isPastMode ? defaultImportMonth : null,
      })
      if (!result.ok) {
        setAddAnotherError(
          result.error.kind === 'unauthorized'
            ? result.error.message
            : "We couldn't read that. Please try again."
        )
        return
      }
      const data = result.data
      if (data.rows.length === 0) {
        setAddAnotherError("Each line needs a name and an amount. Try 'food 500' or 'groceries 2500'.")
        return
      }
      const parsedRows: EditableRow[] = data.rows.map((row) => ({
        ...row,
        categoryType: row.blockedReason
          ? row.categoryType
          : row.confidence === 'high'
            ? row.categoryType
            : null,
        customCategoryId: row.blockedReason || row.confidence === 'high'
          ? row.customCategoryId ?? null
          : null,
        repeatsMonthly: false,
        debtId: null,
        debtName: null,
      }))
      applyRowsChange((current) => {
        const nextRows = [...current, ...parsedRows]
        return isPastMode ? sortPastRowsForReview(nextRows) : nextRows
      })
      setMonthlyReminderKeys((current) => {
        const merged = new Set<string>([...current, ...(data.monthlyReminderKeys ?? [])])
        return Array.from(merged)
      })
      setRowErrors((current) => {
        const next = { ...current }
        for (const row of parsedRows) {
          if (row.blockedReason) {
            next[row.id] = [row.blockedReason]
          } else if (row.parseStatus === 'invalid' && row.parseMessage) {
            next[row.id] = [row.parseMessage]
          }
        }
        return next
      })
      setRowWarnings((current) => {
        const next = { ...current }
        for (const row of parsedRows) {
          if (row.parseStatus === 'ambiguous' || row.parseStatus === 'partial') {
            next[row.id] = [
              row.parseMessage || (row.parseStatus === 'ambiguous'
                ? 'This line may contain more than one expense. Check these before saving.'
                : 'Check this before saving.'),
            ]
          }
        }
        return next
      })
      closeAddAnotherInput()
    } catch {
      setAddAnotherError("We couldn't read that. Please try again.")
    } finally {
      setAddAnotherParsing(false)
    }
  }

  const deleteEditingRow = () => {
    if (!editingRowId) return
    applyRowsChange((current) => current.filter((row) => row.id !== editingRowId))
    closeEditRow()
  }

  const handleReviewRowPrimaryAction = async () => {
    const nextRow = applyEditRow()
    if (!nextRow) return

    if (reviewRowPrimaryOutcome === 'next-entry') {
      openEditRowAtIndex(nextEditableRowIndex)
      return
    }

    if (reviewRowPrimaryOutcome === 'save-expense') {
      const rowsToSave = replaceEditedReviewRow(rows, nextRow)
      const outcome = await handleSave(false, rowsToSave)
      if (outcome !== 'success') closeEditRow()
      return
    }

    closeEditRow()
  }

  const applyParsedImportData = (data: ParseSmsImportData) => {
    const parsedRows: EditableRow[] = data.rows.map((row) => ({
      ...row,
      categoryType: row.blockedReason
        ? row.categoryType
        : row.confidence === 'high'
          ? row.categoryType
          : null,
      customCategoryId: row.blockedReason || row.confidence === 'high'
        ? row.customCategoryId ?? null
        : null,
      repeatsMonthly: false,
      debtId: null,
      debtName: null,
    }))
    const nextRows = isPastMode ? sortPastRowsForReview(parsedRows) : parsedRows
    const nextBlockedRowErrors = Object.fromEntries(
      nextRows
        .filter((row) => row.blockedReason)
        .map((row) => [row.id, [row.blockedReason as string]])
    )
    const nextParseWarnings = Object.fromEntries(
      nextRows
        .filter((row) => row.parseStatus === 'ambiguous' || row.parseStatus === 'partial')
        .map((row) => [
          row.id,
          [row.parseMessage || (row.parseStatus === 'ambiguous'
            ? 'This line may contain more than one expense. Check these before saving.'
            : 'Check this before saving.')],
        ])
    )
    const nextParseErrors = Object.fromEntries(
      nextRows
        .filter((row) => row.parseStatus === 'invalid' && row.parseMessage)
        .map((row) => [row.id, [row.parseMessage as string]])
    )
    setMonthlyReminderKeys(data.monthlyReminderKeys ?? [])
    setRows(nextRows)
    setParseMeta({ scanned: data.scanned, skippedCredits: data.skippedCredits })
    setRowErrors({ ...nextBlockedRowErrors, ...nextParseErrors })
    setRowWarnings(nextParseWarnings)
    setSelectedPastRowIds([])
    if (shouldAutoOpenSingleEntryEditFlow(nextRows)) {
      beginEditRow(nextRows[0], false, 1)
    }
    if (data.rows.length === 0) {
      setError("We couldn’t read this entry. Edit it to continue.")
    }
  }

  const handleParse = async () => {
    setParsing(true)
    setError(null)
    setCsvMappingRequired(null)
    try {
      const result = await parseSmsImport(rawText, {
        mode: importMode,
        defaultImportMonth: isPastMode ? defaultImportMonth : null,
      })
      if (!result.ok) {
        setError(
          result.error.kind === 'unauthorized'
            ? result.error.message
            : "We couldn't read those messages right now. Please try again in a moment."
        )
        return
      }
      applyParsedImportData(result.data)
    } catch {
      setError("We couldn't read those messages right now. Please try again in a moment.")
    } finally {
      setParsing(false)
    }
  }

  const handleCsvFileChange = async (file: File | null) => {
    setError(null)
    setCsvMappingRequired(null)
    setCsvMapping({ date: '', name: '', amount: '', category: '', note: '' })
    clearImportReviewState()
    if (!file) {
      setCsvFileName('')
      setCsvText('')
      return
    }
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      setCsvFileName('')
      setCsvText('')
      setError('Upload a CSV file to continue.')
      return
    }
    setCsvFileName(file.name)
    try {
      setCsvText(await file.text())
    } catch {
      setCsvText('')
      setError("We couldn't read that CSV file. Please try another file.")
    }
  }

  const buildCsvMappingPayload = (): CsvImportMapping | null => {
    const mapping = Object.entries(csvMapping).reduce<CsvImportMapping>((next, [field, value]) => {
      if (value !== '') next[field as CsvMappingField] = Number(value)
      return next
    }, {})
    return Object.keys(mapping).length > 0 ? mapping : null
  }

  const handleCsvParse = async () => {
    const text = csvText.trim()
    if (!text) {
      setError('Upload a CSV file to continue.')
      return
    }

    const mapping = buildCsvMappingPayload()
    if (csvMappingRequired) {
      const missingChoice = csvMappingRequired.missing.find((field) => csvMapping[field] === '')
      if (missingChoice) {
        setError(`Choose the ${missingChoice} column to continue.`)
        return
      }
    }

    setParsing(true)
    setError(null)
    try {
      const result = await parseSmsImport(text, {
        mode: 'past',
        defaultImportMonth,
        source: 'csv',
        csvMapping: mapping,
      })
      if (!result.ok) {
        setError(
          result.error.kind === 'unauthorized'
            ? result.error.message
            : "We couldn't read that CSV right now. Please try again in a moment."
        )
        return
      }
      if (result.data.csvMappingRequired) {
        const required = result.data.csvMappingRequired
        setCsvMappingRequired(required)
        setCsvMapping((current) => ({
          ...current,
          date: current.date || '',
          name: current.name || '',
          amount: current.amount || '',
          category: current.category || '',
          note: current.note || '',
        }))
        setError('Choose the columns we should use from this CSV.')
        return
      }
      setCsvMappingRequired(null)
      applyParsedImportData(result.data)
    } catch {
      setError("We couldn't read that CSV right now. Please try again in a moment.")
    } finally {
      setParsing(false)
    }
  }

  const handleSave = async (confirmOverride = false, rowsOverride?: EditableRow[]) => {
    const rowsToSave = rowsOverride ?? rows
    const saveStartedAt = performance.now()
    const logClientSaveTiming = (step: string, elapsedMs: number, extra?: Record<string, unknown>) => {
      if (process.env.NEXT_PUBLIC_PERF_DEBUG !== 'true') return
      const detail = extra ? ` ${JSON.stringify(extra)}` : ''
      console.info(`[sms-import] client-save ${step}=${elapsedMs.toFixed(1)}ms${detail}`)
    }

    setSaving(true)
    setError(null)
    try {
      const preSubmitStartedAt = performance.now()
      const nextRowErrors: Record<string, string[]> = {}
      for (const row of rowsToSave) {
        if (isBlockedIncomeRow(row)) {
          nextRowErrors[row.id] = [row.blockedReason as string]
          continue
        }
        const issues = validateImportRow(row)
        if (issues.length > 0) nextRowErrors[row.id] = issues
      }

      const blockingErrors = Object.entries(nextRowErrors).filter(([rowId]) => {
        const row = rowsToSave.find((item) => item.id === rowId)
        return row ? !isBlockedIncomeRow(row) : true
      })

      if (blockingErrors.length > 0) {
        setRowErrors(nextRowErrors)
        setRowWarnings({})
        const onlyCategoryIssues = blockingErrors.every(([rowId, issues]) => {
          const row = rowsToSave.find((item) => item.id === rowId)
          return row && !isBlockedIncomeRow(row) && issues.length === 1 && issues[0] === 'Choose a category'
        })
        setError(
          onlyCategoryIssues
            ? 'Add categories to current-month expenses before saving.'
            : 'Review the highlighted expenses before saving.'
        )
        setSaving(false)
        logClientSaveTiming('pre-submit-validation', performance.now() - preSubmitStartedAt, {
          rows: rowsToSave.length,
          blocked: true,
        })
        return 'client-error'
      }

      const payload = rowsToSave
        .filter((row) => !isBlockedIncomeRow(row))
        .map((row) => {
        // Pass categories through honestly. Past-mode uncategorized rows arrive
        // here with categoryType === null / categoryKey === ''; the server
        // recognises mode='past' and persists them as 'other' / 'uncategorized'
        // sentinel transactions instead of running canonical category
        // resolution (which throws on unknown keys). Current-mode rows can
        // never reach this mapper uncategorized — validation blocks save first.
        return {
          id: row.id,
          label: row.label.trim(),
          categoryType: row.categoryType,
          categoryKey: row.categoryKey ?? '',
          customCategoryId: row.customCategoryId,
          amount: Number(row.amount),
          date: row.date,
          sourceHash: row.sourceHash,
          blockedReason: row.blockedReason ?? null,
          repeatsMonthly:
            (row.categoryType === 'everyday' || row.categoryType === 'fixed') && !hasExistingMonthlyReminder(row)
              ? row.repeatsMonthly
              : false,
          debtId: row.categoryType === 'debt' ? row.debtId : null,
        }
      })
      setRowErrors(nextRowErrors)
      logClientSaveTiming('pre-submit-processing', performance.now() - preSubmitStartedAt, {
        rows: payload.length,
        confirmOverride,
      })

      const serverStartedAt = performance.now()
      const result = await saveParsedSmsExpenses(payload, { confirmOverride, mode: importMode })
      logClientSaveTiming('server-action', performance.now() - serverStartedAt, {
        rows: payload.length,
        confirmOverride,
      })
      if (!result.ok) {
        setError(
          result.error.kind === 'unauthorized'
            ? result.error.message
            : 'Something interrupted saving. Please try again.'
        )
        setSaving(false)
        logClientSaveTiming('post-save-work', performance.now() - saveStartedAt, {
          outcome: 'server-error',
        })
        return 'error'
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
          setError('Review the highlighted expenses before saving.')
        }
        setSaving(false)
        logClientSaveTiming('post-save-work', performance.now() - saveStartedAt, {
          outcome: 'blocked',
          duplicates: data.duplicates,
        })
        return 'blocked'
      }
      if (rowsOverride) setRows(rowsToSave)
      setSavedRowsSnapshot(rowsToSave)
      setSavedCount(data.saved)
      setRowWarnings({})
      logClientSaveTiming('post-save-work', performance.now() - saveStartedAt, {
        outcome: data.overridden ? 'overridden' : 'success',
        saved: data.saved,
        duplicates: data.duplicates,
      })
      return 'success'
    } catch {
      setError('Something interrupted saving. Please try again.')
      logClientSaveTiming('post-save-work', performance.now() - saveStartedAt, {
        outcome: 'exception',
      })
      return 'error'
    } finally {
      setSaving(false)
    }
  }

  if (savedCount > 0) {
    const savedDateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const successDateContext = (row: Pick<EditableRow, 'date' | 'dateSource'>) =>
      row.dateSource === 'default_month'
        ? getPastMonthGroupLabel(row.date)
        : savedDateLabel(row.date)
    const successRows = savedRowsSnapshot ?? rows
    const successEntries: ExpenseAddedSuccessEntry[] = successRows.map((row) => ({
      id: row.id,
      name: row.label,
      amountLabel: `${row.currency} ${row.amount.toLocaleString()}`,
      metaLabel: `${resolveImportCategoryLabel(row.categoryKey, row.categoryType, row.customCategoryId)} · ${successDateContext(row)}`,
      hasMonthlyReminder: row.repeatsMonthly,
    }))

    return (
      <div style={{ minHeight: '100vh', background: T.pageBg }}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px' }}>
          <ExpenseAddedSuccess
            entries={successEntries}
            onBack={() => { router.refresh(); router.push('/app') }}
            onImportPast={() => router.push('/log/import?mode=past&returnTo=/app')}
            showPastImportPrompt={!isPastMode}
            onAddAnother={() => {
              setSavedCount(0)
              setSavedRowsSnapshot(null)
              resetImportSession()
            }}
          />
        </div>

      </div>
    )
  }

  const showReview = rows.length > 0
  const showingEditFlow = !!(editingRow && editDraft && editStep)
  const showingAddAnother = addAnotherOpen && !showingEditFlow
  const topBackAction = () => {
    if (showingAddAnother) {
      closeAddAnotherInput()
      return
    }
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

        {showingAddAnother ? (
          <>
            <p style={{ margin: '8px 0 2px', fontSize: 'var(--text-xs)', color: T.text3, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 'var(--weight-semibold)' }}>
              Add another expense
            </p>
            <h1 style={{ margin: '0 0 16px', fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: T.text1, letterSpacing: '-0.02em' }}>
              Paste another message
            </h1>

            <div style={{
              background: T.white,
              border: `1px solid ${T.border}`,
              borderRadius: 20,
              padding: 20,
            }}>
              <textarea
                value={addAnotherText}
                onChange={(event) => {
                  setAddAnotherText(event.target.value)
                  if (addAnotherError) setAddAnotherError(null)
                }}
                placeholder="Paste a message or type something like 'food 500'"
                autoFocus
                className={styles.focusRing}
                style={{
                  width: '100%',
                  minHeight: 120,
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
              {addAnotherError && (
                <p style={{ margin: '10px 0 0', fontSize: 13, color: T.redDark, lineHeight: 1.45 }}>
                  {addAnotherError}
                </p>
              )}

              <div style={{ display: 'grid', gap: 'var(--space-sm)', marginTop: 14 }}>
                <PrimaryBtn
                  size="lg"
                  onClick={submitAddAnotherExpense}
                  disabled={addAnotherParsing || addAnotherText.trim().length === 0}
                >
                  {addAnotherParsing ? 'Reading…' : 'Add expense'}
                </PrimaryBtn>
                <SecondaryBtn
                  size="lg"
                  onClick={closeAddAnotherInput}
                  disabled={addAnotherParsing}
                >
                  Cancel
                </SecondaryBtn>
              </div>
            </div>
          </>
        ) : !showingEditFlow ? (
          <>
            <p style={{ margin: '8px 0 2px', fontSize: 'var(--text-xs)', color: T.text3 }}>
              {isPastMode ? 'Past expenses' : new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
            <h1 style={{ margin: '0 0 16px', fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', color: T.text1, letterSpacing: '-0.02em' }}>
              {isPastMode ? 'Import past expenses' : 'Add your expenses'}
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
                {isPastMode ? (pastInputMode === 'csv' ? 'Upload CSV' : 'Paste old expenses') : 'Paste your messages'}
              </p>
              <p style={{ margin: '0 0 14px', fontSize: 14, color: T.text3, lineHeight: 1.5 }}>
                {isPastMode
                  ? (pastInputMode === 'csv'
                    ? 'Upload a CSV from another app or spreadsheet.'
                    : 'Paste dated rows from old notes or spreadsheets.')
                  : <>Paste bank messages or simple entries like &lsquo;food 500&rsquo;.</>}
              </p>
              {isPastMode ? (
                <>
                  <div
                    role="tablist"
                    aria-label="Past import input type"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 8,
                      marginBottom: 14,
                    }}
                  >
                    {([
                      ['paste', 'Paste expenses'],
                      ['csv', 'Upload CSV'],
                    ] as const).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        role="tab"
                        aria-selected={pastInputMode === mode}
                        onClick={() => {
                          setPastInputMode(mode)
                          setError(null)
                        }}
                        style={{
                          border: `1px solid ${pastInputMode === mode ? T.brandDark : T.borderSubtle}`,
                          background: pastInputMode === mode ? 'var(--brand-50)' : T.white,
                          color: pastInputMode === mode ? T.brandDark : T.text2,
                          borderRadius: 12,
                          padding: '10px 12px',
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {pastInputMode === 'paste' ? (
                    <label
                      data-section="past-import-upfront-month"
                      style={{
                        display: 'grid',
                        gap: 6,
                        marginBottom: 14,
                        fontSize: 13,
                        color: T.text2,
                        fontWeight: 600,
                      }}
                    >
                      Which month are these expenses for?
                      <select
                        value={defaultImportMonth}
                        onChange={(event) => updateDefaultImportMonth(event.target.value)}
                        className={styles.focusRing}
                        style={{
                          width: '100%',
                          borderRadius: 12,
                          border: `var(--border-width) solid ${T.border}`,
                          padding: '10px 12px',
                          fontSize: 15,
                          color: T.text1,
                          background: 'var(--white)',
                          fontFamily: 'inherit',
                          outline: 'none',
                        }}
                      >
                        {recentImportMonths.map((month) => (
                          <option key={month.value} value={month.value}>{month.label}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </>
              ) : null}
              {isPastMode && pastInputMode === 'csv' ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  <label
                    style={{
                      border: `1px dashed ${T.border}`,
                      borderRadius: 14,
                      padding: 16,
                      display: 'grid',
                      gap: 8,
                      cursor: 'pointer',
                      color: T.text2,
                      background: 'var(--grey-50)',
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 700, color: T.text1 }}>
                      {csvFileName || 'Choose a CSV file'}
                    </span>
                    <span style={{ fontSize: 12, color: T.text3, lineHeight: 1.45 }}>
                      Supports .csv files with date, description/name, amount, category, and note columns.
                    </span>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(event) => handleCsvFileChange(event.target.files?.[0] ?? null)}
                      style={{ fontSize: 13, color: T.text2 }}
                    />
                  </label>
                  {csvMappingRequired ? (
                    <div
                      data-section="csv-column-mapping"
                      style={{
                        border: `1px solid ${T.borderSubtle}`,
                        borderRadius: 14,
                        padding: 14,
                        display: 'grid',
                        gap: 10,
                      }}
                    >
                      <p style={{ margin: 0, fontSize: 13, color: T.text1, fontWeight: 700 }}>
                        Match your CSV columns
                      </p>
                      {(['date', 'name', 'amount', 'category', 'note'] as const).map((field) => (
                        <label key={field} style={{ display: 'grid', gap: 5, fontSize: 12, color: T.text2, fontWeight: 700 }}>
                          {field === 'name' ? 'Name or description' : field[0].toUpperCase() + field.slice(1)}
                          <select
                            value={csvMapping[field]}
                            onChange={(event) => setCsvMapping((current) => ({ ...current, [field]: event.target.value }))}
                            className={styles.focusRing}
                            style={{
                              width: '100%',
                              borderRadius: 10,
                              border: `var(--border-width) solid ${T.border}`,
                              padding: '9px 10px',
                              fontSize: 14,
                              color: T.text1,
                              background: 'var(--white)',
                              fontFamily: 'inherit',
                              outline: 'none',
                            }}
                          >
                            <option value="">Do not import</option>
                            {csvMappingRequired.headers.map((header, index) => (
                              <option key={`${header}-${index}`} value={index}>{header || `Column ${index + 1}`}</option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
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
              )}
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
                onClick={isPastMode && pastInputMode === 'csv' ? handleCsvParse : handleParse}
                disabled={parsing || (isPastMode && pastInputMode === 'csv' ? csvText.trim().length === 0 : rawText.trim().length === 0)}
                style={{ marginTop: 12 }}
              >
                {parsing ? 'Reading…' : 'Continue'}
              </PrimaryBtn>
            </>
          ) : (
            <>
              {(() => {
                return (
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ margin: '0 0 4px', fontSize: 17, color: T.text1, fontWeight: 600 }}>
                      {reviewCopy.title}
                    </p>
                    <p style={{ margin: 0, fontSize: 13, color: T.text3, lineHeight: 1.5 }}>
                      {queueGuidance.instruction ?? reviewCopy.body}
                    </p>
                    {queueGuidance.summary && (
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: T.text2, lineHeight: 1.5, fontWeight: 600 }}>
                        {queueGuidance.summary}
                      </p>
                    )}
                    {parserReviewWarningCount > 0 ? (
                      <div
                        data-section="parser-review-notice"
                        style={{
                          marginTop: 10,
                          border: `1px solid ${T.amberBorder}`,
                          borderRadius: 12,
                          background: T.amberLight,
                          padding: '10px 12px',
                        }}
                      >
                        <p style={{ margin: 0, fontSize: 13, color: T.text2, lineHeight: 1.45, fontWeight: 600 }}>
                          Some entries may need checking.
                        </p>
                      </div>
                    ) : null}
                    {(() => {
                      if (!isPastMode) return null
                      const inheritedCount = rows.filter((row) => row.dateSource === 'default_month').length
                      // CSV flow only surfaces the picker if some rows actually inherited.
                      if (pastInputMode === 'csv' && inheritedCount === 0) return null
                      // Subtle caption shows only when at least one row will use the
                      // selected month as a fallback. The selector itself does the
                      // primary talking — no “Importing for X” headline above it.
                      const caption = inheritedCount > 0
                        ? `Expenses without dates will be added to ${defaultImportMonthLabel}`
                        : null
                      return (
                        <div
                          data-section="past-import-month-prompt"
                          style={{ marginTop: 10, display: 'grid', gap: 6 }}
                        >
                          <select
                            aria-label="Change import month"
                            value={defaultImportMonth}
                            onChange={(event) => updateDefaultImportMonth(event.target.value)}
                            className={styles.focusRing}
                            style={{
                              width: '100%',
                              borderRadius: 12,
                              border: `var(--border-width) solid ${T.border}`,
                              padding: '10px 12px',
                              fontSize: 15,
                              color: T.text1,
                              background: 'var(--white)',
                              fontFamily: 'inherit',
                              outline: 'none',
                            }}
                          >
                            {recentImportMonths.map((month) => (
                              <option key={month.value} value={month.value}>{month.label}</option>
                            ))}
                          </select>
                          {caption ? (
                            <p style={{ margin: 0, fontSize: 12, color: T.text3, lineHeight: 1.5 }}>
                              {caption}
                            </p>
                          ) : null}
                        </div>
                      )
                    })()}
                  </div>
                )
              })()}

              {isPastMode && rows.length > 0 && selectedPastRowIds.length > 0 ? (
                <div
                  data-section="past-import-bulk-toolbar"
                  style={{
                    background: 'var(--grey-50)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-sm) var(--space-md)',
                    marginBottom: 'var(--space-sm)',
                    display: 'grid',
                    gap: 'var(--space-sm)',
                  }}
                >
                  <p style={{
                    margin: 0,
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--weight-medium)',
                    color: T.text2,
                  }}>
                    {`${selectedPastRowIds.length} selected`}
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                    <button
                      type="button"
                      onClick={openBulkCategoryPicker}
                      style={{
                        border: 'none',
                        background: 'var(--chip-selected-bg)',
                        color: 'var(--chip-selected-text)',
                        fontSize: 'var(--text-sm)',
                        fontWeight: 'var(--weight-medium)',
                        padding: 'var(--space-2xs) var(--space-md)',
                        borderRadius: 'var(--radius-full)',
                        cursor: 'pointer',
                      }}
                    >
                      Apply category
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRowsById(selectedPastRowIds)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: T.redDark,
                        fontSize: 'var(--text-sm)',
                        fontWeight: 'var(--weight-medium)',
                        padding: 'var(--space-2xs) var(--space-md)',
                        borderRadius: 'var(--radius-full)',
                        cursor: 'pointer',
                      }}
                    >
                      Remove
                    </button>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--space-md)',
                    paddingTop: 'var(--space-sm)',
                    borderTop: `var(--border-width) solid var(--border-subtle)`,
                  }}>
                    {selectedPastRowIds.length < rows.length ? (
                      <button
                        type="button"
                        onClick={() => setSelectedPastRowIds(rows.map((row) => row.id))}
                        style={{
                          border: 'none',
                          background: 'none',
                          padding: 0,
                          color: T.text3,
                          fontSize: 'var(--text-xs)',
                          fontWeight: 'var(--weight-medium)',
                          cursor: 'pointer',
                        }}
                      >
                        Select all
                      </button>
                    ) : <span />}
                    <button
                      type="button"
                      onClick={() => setSelectedPastRowIds([])}
                      style={{
                        border: 'none',
                        background: 'none',
                        padding: 0,
                        color: T.text3,
                        fontSize: 'var(--text-xs)',
                        fontWeight: 'var(--weight-medium)',
                        cursor: 'pointer',
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ) : null}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {rows.map((row, index) => {
                  const serverErrors = rowErrors[row.id] ?? []
                  const rowWarningMessages = rowWarnings[row.id] ?? []
                  const hasParserWarning = rowWarningMessages.some((warning) => warning !== DUPLICATE_MESSAGE)
                  const clientIssues = validateImportRow(row)
                  const hasHardError = serverErrors.length > 0 || clientIssues.some((i) => i !== 'Choose a category')
                  const isBlocked = isBlockedIncomeRow(row)
                  const needsCategory = !row.categoryType && !hasHardError
                  const rowActionLabel = getReviewRowActionLabel({
                    needsCategory,
                    hasHardError,
                    isBlocked,
                    needsReview: hasParserWarning,
                  })
                  const cardBorder = hasHardError ? T.redBorder : hasParserWarning ? T.amberBorder : needsCategory ? T.border : T.borderSubtle
                  const cardBg = hasHardError ? T.redLight : hasParserWarning ? T.amberLight : 'var(--white)'
                  const monthGroupLabel = isPastMode ? getPastMonthGroupLabel(row.date) : null
                  const dateSourceLabel = isPastMode ? getPastDateSourceLabel(row) : null
                  const similarRowsCount = isPastMode && row.categoryType && row.categoryKey
                    ? rows.filter((candidate) =>
                      candidate.id !== row.id &&
                      !isBlockedIncomeRow(candidate) &&
                      getSimilarEntryKey(candidate.label) === getSimilarEntryKey(row.label) &&
                      (
                        candidate.categoryType !== row.categoryType ||
                        candidate.categoryKey !== row.categoryKey ||
                        (candidate.customCategoryId ?? null) !== (row.customCategoryId ?? null)
                      )
                    ).length
                    : 0
                  const previousMonthGroupLabel = isPastMode && index > 0
                    ? getPastMonthGroupLabel(rows[index - 1].date)
                    : null
                  const showMonthHeader = isPastMode && monthGroupLabel !== previousMonthGroupLabel

                  return (
                  <div key={row.id} style={{ display: 'contents' }}>
                  {showMonthHeader ? (
                    <div
                      data-section="past-import-month-header"
                      style={{
                        margin: index === 0 ? '2px 0 0' : '10px 0 0',
                        fontSize: 12,
                        color: T.text3,
                        textTransform: 'uppercase',
                        letterSpacing: '0.07em',
                        fontWeight: 700,
                      }}
                    >
                      {monthGroupLabel}
                    </div>
                  ) : null}
                  <div
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
                      {isPastMode ? (
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.label}`}
                          checked={selectedPastRowIds.includes(row.id)}
                          onChange={() => togglePastRowSelection(row.id)}
                          disabled={isBlocked}
                          style={{ width: 16, height: 16, marginTop: 3, accentColor: T.brandDark, flexShrink: 0 }}
                        />
                      ) : null}
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
                        <p style={{ margin: 0, fontSize: 12, color: needsCategory ? T.text2 : T.text3, lineHeight: 1.45 }}>
                          {needsCategory
                            ? buildNeedsCategoryMetaLabel(row)
                            : buildRowMetaLabel({
                              ...row,
                              categoryLabel: resolveImportCategoryLabel(row.categoryKey, row.categoryType, row.customCategoryId),
                            })}
                        </p>
                        {rowActionLabel ? (
                          <div
                            data-state={rowActionLabel === 'Ready' ? 'ready' : undefined}
                            style={{
                              marginTop: 6,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              flexWrap: 'wrap',
                            }}
                          >
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 12,
                                color: rowActionLabel === 'Ready'
                                  ? 'var(--green-dark)'
                                  : needsCategory ? T.brandDark : T.textMuted,
                                fontWeight: needsCategory ? 600 : 500,
                                lineHeight: 1.4,
                              }}
                            >
                              {rowActionLabel === 'Ready' ? (
                                <IconCheck size={14} strokeWidth={2.2} aria-hidden="true" />
                              ) : null}
                              {rowActionLabel}
                            </span>
                            {!needsCategory && row.repeatsMonthly ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  minHeight: 22,
                                  padding: '0 8px',
                                  borderRadius: 999,
                                  background: T.pageBg,
                                  border: `1px solid ${T.border}`,
                                  fontSize: 11,
                                  color: T.text2,
                                  fontWeight: 500,
                                  lineHeight: 1,
                                }}
                              >
                                Reminder on
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                        {dateSourceLabel ? (
                          <p style={{ margin: '6px 0 0', fontSize: 11, color: T.textMuted, lineHeight: 1.4 }}>
                            {dateSourceLabel}
                          </p>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        aria-label="Remove row"
                        onClick={() => {
                          removeRowsById([row.id])
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
                        const warnings = rowWarningMessages
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
                              <div style={{ display: 'grid', gap: 6 }}>
                                {warnings.includes(DUPLICATE_MESSAGE) ? (
                                  <>
                                    <p style={{ margin: 0, fontSize: 11, color: T.text2, lineHeight: 1.4, fontWeight: 700 }}>
                                      Possible duplicate
                                    </p>
                                    <p style={{ margin: 0, fontSize: 11, color: T.text2, lineHeight: 1.4 }}>
                                      This looks similar to an expense already saved.
                                    </p>
                                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                                      <span style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.4 }}>Keep row by saving anyway.</span>
                                      <button
                                        type="button"
                                        onClick={() => removeRowsById([row.id])}
                                        style={{ border: 'none', background: 'none', padding: 0, color: T.brandDark, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                                      >
                                        Remove row
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <p style={{ margin: 0, fontSize: 11, color: T.text2, lineHeight: 1.4, fontWeight: 700 }}>
                                      This may need checking.
                                    </p>
                                    {warnings.map((warning, warningIndex) => (
                                      <p key={`${row.id}-parse-warning-${warningIndex}`} style={{ margin: 0, fontSize: 11, color: T.text2, lineHeight: 1.4 }}>
                                        {warning}
                                      </p>
                                    ))}
                                  </>
                                )}
                              </div>
                            )}
                          </>
                        )
                      })()}
                      {similarRowsCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => applyCategoryToSimilarRows(row)}
                          style={{
                            border: 'none',
                            background: 'none',
                            padding: 0,
                            width: 'fit-content',
                            color: T.brandDark,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Apply {resolveImportCategoryLabel(row.categoryKey, row.categoryType, row.customCategoryId)} to similar entries?
                        </button>
                      ) : null}

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
                {!isPastMode && unresolvedCategoryCount > 0 ? (
                  <>
                    <p style={{ margin: 0, fontSize: 12, color: T.text2, lineHeight: 1.5 }}>
                      {unresolvedCategoryCount === 1
                        ? 'One current-month expense still needs a category.'
                        : `${unresolvedCategoryCount} current-month expenses still need categories.`}
                    </p>
                    <PrimaryBtn
                      size="lg"
                      onClick={guideCurrentRowsToCategoryCompletion}
                      disabled={firstUncategorizedCurrentRowIndex < 0}
                    >
                      Continue
                    </PrimaryBtn>
                  </>
                ) : validSavableRows.length === 0 ? (
                  <PrimaryBtn
                    size="lg"
                    onClick={resetImportSession}
                  >
                    Paste again
                  </PrimaryBtn>
                ) : hasDuplicateWarnings && !hasHardBlockedRows ? (
                  <>
                    {isPastMode && queueSaveHelper ? (
                      <p style={{ margin: 0, fontSize: 12, color: T.text3, lineHeight: 1.5 }}>
                        {queueSaveHelper}
                      </p>
                    ) : null}
                    <PrimaryBtn
                      size="lg"
                      onClick={() => handleSave(true)}
                      disabled={saving || validSavableRows.length === 0 || hasSavableClientValidationErrors}
                    >
                      {saving ? 'Saving…' : 'Save anyway'}
                    </PrimaryBtn>
                  </>
                ) : (
                  <>
                    {isPastMode && queueSaveHelper ? (
                      <p style={{ margin: 0, fontSize: 12, color: T.text3, lineHeight: 1.5 }}>
                        {queueSaveHelper}
                      </p>
                    ) : null}
                    <PrimaryBtn
                      size="lg"
                      onClick={() => handleSave(false)}
                      disabled={saving || validSavableRows.length === 0 || hasSavableClientValidationErrors || hasHardBlockedRows}
                    >
                      {saving ? 'Saving…' : hasHardBlockedRows
                        ? 'Remove blocked messages to continue'
                        : `Save ${validSavableRows.length} ${validSavableRows.length === 1 ? 'expense' : 'expenses'}`}
                    </PrimaryBtn>
                  </>
                )}
                {showReview ? (
                  <SecondaryBtn
                    size="lg"
                    onClick={requestCancelImport}
                  >
                    Cancel
                  </SecondaryBtn>
                ) : null}
              </div>
            </>
          )}
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 'var(--space-md)' }}>
              {editStep !== 'category' && editStep !== 'changeCategory' && (
                <p style={{
                  margin: '0 0 var(--space-2xs)',
                  fontSize: 'var(--text-xs)',
                  color: T.text3,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  fontWeight: 'var(--weight-semibold)',
                }}>
                  {editStep === 'details' ? 'Edit details' : 'Review row'}
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
            {editStep !== 'changeCategory' ? (
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 'var(--space-sm)',
                }}>
                  <h1 style={{
                    margin: 0,
                    fontSize: 'var(--text-xl)',
                    fontWeight: 'var(--weight-bold)',
                    color: T.text1,
                    letterSpacing: '-0.02em',
                    minWidth: 0,
                    wordBreak: 'break-word',
                  }}>
                    {editDraft.label.trim() || editingRow.label}
                  </h1>
                  <button
                    type="button"
                    aria-label="Remove row"
                    onClick={() => setEditDeleteConfirmOpen(true)}
                    style={{
                      flexShrink: 0,
                      width: 28,
                      height: 28,
                      marginTop: -2,
                      marginRight: -4,
                      padding: 0,
                      border: 'none',
                      background: 'none',
                      color: T.text3,
                      fontSize: 20,
                      lineHeight: 1,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    ×
                  </button>
                </div>
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
                      customCategoryId: editDraft.customCategoryId,
                      categoryLabel: resolveImportCategoryLabel(
                        editDraft.categoryKey,
                        editDraft.categoryType,
                        editDraft.customCategoryId,
                      ),
                      date: editDraft.date,
                      dateSource: editDraft.dateSource,
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
                {editStep === 'review' ? (
                  <div style={{ marginTop: 'var(--space-md)' }}>
                    <TertiaryBtn size="md" onClick={openEditDetailsFromReview}>
                      Edit details
                    </TertiaryBtn>
                  </div>
                ) : null}
              </div>
            ) : null}

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
                  autoFocus={false}
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
                      setEditDraft((current) => current ? { ...current, date: value, dateSource: 'explicit' } : current)
                      setEditErrors((current) => ({ ...current, date: undefined }))
                    }}
                    autoFocus={false}
                    error={editErrors.date}
                  />
                ) : null}

                <div
                  data-section="edit-details-category"
                  style={{
                    marginBottom: 'var(--space-md)',
                    padding: '10px 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--space-sm)',
                    borderBottom: `var(--border-width) solid ${T.borderSubtle}`,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{
                      margin: '0 0 2px',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 'var(--weight-medium)',
                      color: T.text3,
                      lineHeight: 1.3,
                    }}>
                      Category
                    </p>
                    <p style={{
                      margin: 0,
                      fontSize: 'var(--text-base)',
                      fontWeight: 'var(--weight-medium)',
                      color: editDraft.categoryKey ? T.text1 : T.text3,
                      lineHeight: 1.35,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {editDraft.categoryKey
                        ? resolveImportCategoryLabel(
                          editDraft.categoryKey,
                          editDraft.categoryType,
                          editDraft.customCategoryId,
                        )
                        : 'Not set'}
                    </p>
                  </div>
                  <TertiaryBtn size="md" onClick={openChangeCategoryFromDetails}>
                    {editDraft.categoryKey ? 'Change' : 'Choose'}
                  </TertiaryBtn>
                </div>

                {(editDraft.categoryType === 'everyday' || editDraft.categoryType === 'fixed') && (
                  <div
                    data-section="edit-details-reminder"
                    style={{
                      marginBottom: 'var(--space-md)',
                      padding: '8px 0 0',
                    }}
                  >
                    <label style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 'var(--space-sm)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 'var(--weight-regular)',
                      color: T.text2,
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
                        <span style={{ display: 'block', color: T.text2 }}>
                          Remind me about this every month
                        </span>
                        <span style={{
                          display: 'block',
                          marginTop: 'var(--space-2xs)',
                          fontSize: 'var(--text-xs)',
                          color: T.text3,
                          lineHeight: 1.4,
                        }}>
                          We’ll remind you before it’s due
                        </span>
                      </span>
                    </label>
                  </div>
                )}

                <div style={{ display: 'grid', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
                  <PrimaryBtn size="lg" onClick={saveDetailsChanges} disabled={saving}>
                    {saving
                      ? 'Saving…'
                      : !editDraft.categoryKey
                        ? 'Continue'
                        : editableRowIndices.length === 1
                          ? 'Save expense'
                          : 'Save changes'}
                  </PrimaryBtn>
                  <SecondaryBtn size="lg" onClick={cancelDetailsEdit} disabled={saving}>
                    Cancel
                  </SecondaryBtn>
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

                <button
                  type="button"
                  onClick={openCategoryBrowser}
                  style={{
                    width: '100%',
                    borderRadius: 14,
                    border: `var(--border-width) solid ${T.border}`,
                    background: T.white,
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--space-sm)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span>
                    <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: T.text1 }}>
                      Browse all categories
                    </span>
                    <span style={{ display: 'block', marginTop: 4, fontSize: 'var(--text-xs)', color: T.text3, lineHeight: 1.4 }}>
                      Search or browse the full category list
                    </span>
                  </span>
                  <span style={{ color: T.textMuted, fontSize: 18, lineHeight: 1 }}>›</span>
                </button>

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
                          Money I owe. You&apos;re recording a payment of {editDraft.amount ? Number(editDraft.amount).toLocaleString() : '0'} for this debt.
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
                    disabled={!editDraft.categoryType || !editDraft.categoryKey}
                  >
                    Continue
                  </PrimaryBtn>
                  <SecondaryBtn size="lg" onClick={requestCancelImport}>
                    Cancel
                  </SecondaryBtn>
                </div>
              </div>
            )}

            {editStep === 'review' && editedPreviewRow && (
              <div style={{ display: 'grid', gap: 'var(--space-lg)' }}>
                <div style={{
                  display: 'grid',
                  gap: 'var(--space-sm)',
                }}>
                  <SummaryRow label="Name" value={editedPreviewRow.label} />
                  <SummaryRow label="Amount" value={`${editedPreviewRow.currency} ${Number.isFinite(editedPreviewRow.amount) ? editedPreviewRow.amount.toLocaleString() : 0}`} />
                  <SummaryRow
                    label="Category"
                    value={resolveImportCategoryLabel(
                      editedPreviewRow.categoryKey,
                      editedPreviewRow.categoryType,
                      editedPreviewRow.customCategoryId,
                    )}
                    divided={editedPreviewRow.isImportedMessage || editedPreviewRow.categoryType === 'debt'}
                  />
                  {editedPreviewRow.isImportedMessage ? (
                    <SummaryRow
                      label={editedPreviewRow.dateSource === 'default_month' ? 'Month' : 'Date'}
                      value={editedPreviewRow.dateSource === 'default_month'
                        ? getPastDateSourceLabel(editedPreviewRow) ?? getPastMonthGroupLabel(editedPreviewRow.date)
                        : formatImportedRowDateLabel(editedPreviewRow.date)}
                      divided={editedPreviewRow.categoryType === 'debt'}
                    />
                  ) : null}
                  {editedPreviewRow.categoryType === 'debt' ? (
                    <SummaryRow label="Debt" value={editedPreviewRow.debtName ?? 'Select a debt'} divided={false} />
                  ) : null}
                </div>

                {(() => {
                  const hardErrors = validateImportRow(editedPreviewRow)
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

                {showReviewReminder ? (
                  <div style={{
                    border: `1px solid ${T.borderSubtle}`,
                    borderRadius: 16,
                    padding: 'var(--space-md)',
                    background: T.white,
                  }}>
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
                ) : null}

                <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
                  <PrimaryBtn size="lg" onClick={handleReviewRowPrimaryAction} disabled={saving}>
                    {saving ? 'Saving…' : getReviewRowPrimaryLabel({
                      hasNextEditableRow: !!nextEditableRow,
                      savesImmediately: shouldSaveReviewRowImmediately,
                    })}
                  </PrimaryBtn>
                  <SecondaryBtn size="lg" onClick={requestCancelImport}>
                    Cancel
                  </SecondaryBtn>
                </div>
              </div>
            )}
          </div>
          {editStep === 'review' || (editStep === 'details' && editableRowIndices.length === 1 && !!editDraft.categoryKey) ? (
            <div style={{ marginTop: 'var(--space-lg)', display: 'flex', justifyContent: 'center' }}>
              <TertiaryBtn size="md" onClick={addAnotherExpenseFromEditFlow}>
                + Add another expense
              </TertiaryBtn>
            </div>
          ) : null}
          </>
        )}
      </div>

      <Sheet
        open={
          bulkCategoryOpen ||
          (showingEditFlow && (editStep === 'category' || editStep === 'changeCategory') && categoryBrowserOpen)
        }
        onClose={bulkCategoryOpen ? closeBulkCategoryPicker : closeCategoryBrowser}
        title={
          bulkCategoryOpen
            ? (categoryBrowserMode === 'create' ? 'Create category' : 'Apply category')
            : (categoryBrowserMode === 'create' ? 'Create category' : 'Choose category')
        }
      >
        <div style={{ display: 'grid', gap: 'var(--space-lg)' }}>
          {bulkCategoryOpen && categoryBrowserMode === 'select' ? (
            <div
              data-section="bulk-category-preview"
              style={{
                display: 'grid',
                gap: 'var(--space-xs)',
              }}
            >
              <p style={{
                margin: 0,
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                color: T.text1,
              }}>
                {`Apply category to ${selectedPastRows.length} ${selectedPastRows.length === 1 ? 'expense' : 'expenses'}`}
              </p>
              {selectedPastRows.length > 0 ? (
                <p style={{
                  margin: 0,
                  fontSize: 'var(--text-xs)',
                  color: T.text3,
                  lineHeight: 1.5,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {(() => {
                    const previewLimit = 3
                    const labels = selectedPastRows
                      .slice(0, previewLimit)
                      .map((row) => row.label.trim() || 'Untitled')
                    const remaining = selectedPastRows.length - labels.length
                    return remaining > 0
                      ? `${labels.join(', ')} and ${remaining} more`
                      : labels.join(', ')
                  })()}
                </p>
              ) : null}
            </div>
          ) : null}
          {categoryBrowserMode === 'select' ? (
            <>
              <input
                type="search"
                value={categoryQuery}
                onChange={(event) => {
                  setCategoryQuery(event.target.value)
                  setCategoryBrowserNotice(null)
                }}
                placeholder="Search categories"
                aria-label="Search categories"
                className={styles.focusRing}
                style={{
                  width: '100%',
                  height: 44,
                  borderRadius: 12,
                  border: `var(--border-width) solid ${T.border}`,
                  background: T.white,
                  padding: '0 14px',
                  fontSize: 'var(--text-sm)',
                  color: T.text1,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />

              {categoryBrowserNotice ? (
                <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: T.brandDark, fontWeight: 600, lineHeight: 1.4 }}>
                  {categoryBrowserNotice}
                </p>
              ) : null}

              {!isSearchingCategories ? (
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
                  {importCategoryGroups.map((group) => {
                    const groupType = toImportCategoryType(group.type)
                    if (!groupType) return null
                    const active = categoryFilter === groupType
                    return (
                      <button
                        key={`modal-filter-${groupType}`}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setCategoryFilter(groupType)}
                        style={{
                          flex: 1,
                          height: 34,
                          borderRadius: 8,
                          border: 'none',
                          background: active ? T.white : 'transparent',
                          color: active ? T.text1 : T.text2,
                          fontSize: 'var(--text-sm)',
                          fontWeight: active ? 'var(--weight-semibold)' : 'var(--weight-medium)',
                          cursor: 'pointer',
                          boxShadow: active ? '0 1px 2px rgba(16, 24, 40, 0.08)' : 'none',
                        }}
                      >
                        {group.label}
                      </button>
                    )
                  })}
                </div>
              ) : null}

              <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                {(() => {
                  const isChangeCategory = editStep === 'changeCategory'
                  const selectedKey = isChangeCategory
                    ? pickerDraftSelection?.categoryKey ?? null
                    : editDraft?.categoryKey ?? null
                  const selectedCustomId = isChangeCategory
                    ? pickerDraftSelection?.customCategoryId ?? null
                    : editDraft?.customCategoryId ?? null
                  const handleChipClick = (option: ImportCategoryOption) => {
                    if (bulkCategoryOpen) {
                      applyBulkCategory(option)
                      return
                    }
                    if (isChangeCategory) {
                      selectCategoryInPicker(option)
                    } else {
                      selectImportCategory(option)
                    }
                  }

                  if (isSearchingCategories) {
                    if (categorySearchResults.length === 0) {
                      return (
                        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: T.text3, lineHeight: 1.5 }}>
                          No matches.
                        </p>
                      )
                    }
                    return (
                      <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                        {categorySearchResults.map((option) => (
                          <SingleSelectChip
                            key={`modal-search-${option.customCategoryId ?? option.key}`}
                            label={option.label}
                            selected={
                              selectedKey === option.key &&
                              selectedCustomId === (option.customCategoryId ?? null)
                            }
                            onClick={() => handleChipClick(option)}
                          />
                        ))}
                      </div>
                    )
                  }

                  if (tabCategoryOptions.length === 0) {
                    return (
                      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: T.text3, lineHeight: 1.5 }}>
                        No categories in this group.
                      </p>
                    )
                  }

                  return (
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                      {tabCategoryOptions.map((option) => (
                        <SingleSelectChip
                          key={`modal-filtered-${option.customCategoryId ?? option.key}`}
                          label={option.label}
                          selected={
                            selectedKey === option.key &&
                            selectedCustomId === (option.customCategoryId ?? null)
                          }
                          onClick={() => handleChipClick(option)}
                        />
                      ))}
                    </div>
                  )
                })()}
              </div>

              <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
                {bulkCategoryOpen ? null : editStep === 'changeCategory' ? (
                  <PrimaryBtn
                    size="lg"
                    onClick={commitPickerSelectionToDraft}
                    disabled={
                      !pickerDraftSelection?.categoryType ||
                      !pickerDraftSelection?.categoryKey
                    }
                  >
                    Continue
                  </PrimaryBtn>
                ) : (
                  <PrimaryBtn
                    size="lg"
                    onClick={closeCategoryBrowser}
                    disabled={!editDraft?.categoryKey}
                  >
                    Continue
                  </PrimaryBtn>
                )}
                <SecondaryBtn size="lg" onClick={openCreateCategoryMode}>
                  + Create category
                </SecondaryBtn>
                {!customCategoriesLoaded ? (
                  <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: T.text3, lineHeight: 1.4 }}>
                    Loading your categories…
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <Input
                label="Category name"
                value={createCategoryLabel}
                onChange={(value) => {
                  setCreateCategoryLabel(value)
                  setCreateCategoryError(null)
                }}
                autoFocus
                error={createCategoryError ?? undefined}
              />
              {createCategoryMatches.length > 0 ? (
                <div style={{ display: 'grid', gap: 'var(--space-xs)' }}>
                  <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 600, color: T.text1 }}>
                    {normalizedCreateCategoryLabel ? 'Matching categories' : 'Recent custom categories'}
                  </p>
                  <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                    {createCategoryMatches.map((option) => (
                      <SingleSelectChip
                        key={`create-match-${option.customCategoryId ?? option.key}`}
                        label={option.label}
                        selected={false}
                        onClick={() => selectCategoryFromCreateMode(option)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
              <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
                {!exactCreateCategoryMatch ? (
                  <PrimaryBtn
                    size="lg"
                    onClick={handleCreateCustomCategory}
                    disabled={creatingCategory || !createCategoryLabel.trim()}
                  >
                    {creatingCategory ? 'Saving…' : 'Save category'}
                  </PrimaryBtn>
                ) : null}
                <SecondaryBtn size="lg" onClick={returnToCategorySelection} disabled={creatingCategory}>
                  Back
                </SecondaryBtn>
              </div>
            </>
          )}
        </div>
      </Sheet>

      <Sheet
        open={showingEditFlow && editDeleteConfirmOpen}
        onClose={() => setEditDeleteConfirmOpen(false)}
        title="Delete row"
      >
        <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: T.text2, lineHeight: 1.5 }}>
            This will remove this expense from the import list.
          </p>

          <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
            <PrimaryBtn
              size="lg"
              onClick={deleteEditingRow}
              style={{ background: T.redDark, color: T.white }}
            >
              Delete row
            </PrimaryBtn>
            <SecondaryBtn size="lg" onClick={() => setEditDeleteConfirmOpen(false)}>
              Cancel
            </SecondaryBtn>
          </div>
        </div>
      </Sheet>

      <Sheet
        open={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        title="Cancel import?"
      >
        <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: T.text2, lineHeight: 1.5 }}>
            This will clear the pasted text and all rows you have reviewed.
          </p>

          <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
            <PrimaryBtn
              size="lg"
              onClick={resetImportSession}
              style={{ background: T.redDark, color: T.white }}
            >
              Cancel import
            </PrimaryBtn>
            <SecondaryBtn size="lg" onClick={() => setCancelConfirmOpen(false)}>
              Keep working
            </SecondaryBtn>
          </div>
        </div>
      </Sheet>
    </div>
  )
}
