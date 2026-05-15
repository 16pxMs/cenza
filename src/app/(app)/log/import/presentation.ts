import { getCategoryLabel } from '@/lib/categories/config'
import type { CategoryConfig } from '@/lib/categories/config'
import type { CategoryOptionGroup } from '@/lib/categories/options'

export type ImportPresentationCategoryType = 'everyday' | 'fixed' | 'debt' | null
export type ImportPresentationEditStep = 'details' | 'category' | 'review' | 'changeCategory'

function broadCategoryLabel(value: ImportPresentationCategoryType) {
  if (!value) return 'Not set'
  if (value === 'fixed') return 'Fixed'
  if (value === 'debt') return 'Debt'
  return 'Spending'
}

export function formatImportedRowDateLabel(date: string) {
  const parsed = new Date(`${date}T12:00:00`)
  if (!date || Number.isNaN(parsed.getTime())) return 'Date needed'
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function shouldShowRawMessageToggle(row: { isImportedMessage: boolean }) {
  return row.isImportedMessage
}

export function buildRowMetaLabel(row: {
  amount: number
  currency: string
  categoryKey: string
  categoryType: ImportPresentationCategoryType
  categoryLabel?: string | null
  customCategoryId?: string | null
  date: string
  isImportedMessage: boolean
  debtName?: string | null
  debtId?: string | null
}) {
  const parts = [
    `${row.currency} ${Number.isFinite(row.amount) ? row.amount.toLocaleString() : 0}`,
    row.categoryLabel?.trim() || getCategoryLabel(row.categoryKey, broadCategoryLabel(row.categoryType)),
  ]

  if (row.categoryType === 'debt' && row.debtName) {
    parts.push(row.debtName)
  } else if (row.categoryType === 'debt' && !row.debtId) {
    parts.push('Select a debt')
  }

  if (row.isImportedMessage) {
    parts.push(formatImportedRowDateLabel(row.date))
  }

  return parts.join(' · ')
}

export function buildNeedsCategoryMetaLabel(row: {
  amount: number
  currency: string
  date: string
  isImportedMessage: boolean
}) {
  const base = `${row.currency} ${Number.isFinite(row.amount) ? row.amount.toLocaleString() : 0} · Choose a category`
  return row.isImportedMessage ? `${base} · ${formatImportedRowDateLabel(row.date)}` : base
}

export function getNextEditableRowIndex<T>(
  currentIndex: number,
  rows: T[],
  isEditable: (row: T) => boolean
) {
  for (let index = currentIndex + 1; index < rows.length; index += 1) {
    if (isEditable(rows[index])) return index
  }
  return -1
}

export function getInitialEditStepForRow(
  row: {
    isImportedMessage: boolean
    label: string
    amount: number
    date?: string | null
    categoryType?: ImportPresentationCategoryType
    categoryKey?: string | null
  },
  options?: { isSingleEntry?: boolean }
): ImportPresentationEditStep {
  const hasValidLabel = row.label.trim().length > 0
  const hasValidAmount = Number.isFinite(row.amount) && row.amount > 0
  if (!hasValidLabel || !hasValidAmount) return 'details'

  if (row.isImportedMessage && !/^\d{4}-\d{2}-\d{2}$/.test(row.date ?? '')) {
    return 'details'
  }

  const hasCategory = !!(row.categoryType && row.categoryKey)
  if (!hasCategory) return 'category'
  return options?.isSingleEntry ? 'details' : 'review'
}

export function getPreviousStepForActiveRow(input: {
  currentStep: ImportPresentationEditStep
  isImportedMessage: boolean
  detailsReturnStep?: ImportPresentationEditStep | null
  isSingleEntry?: boolean
}): ImportPresentationEditStep | null {
  if (input.currentStep === 'details') {
    return input.detailsReturnStep ?? null
  }
  if (input.currentStep === 'review') return null
  if (input.currentStep === 'changeCategory') return 'details'
  if (input.currentStep === 'category') {
    if (input.isSingleEntry) return null
    return input.isImportedMessage ? 'details' : null
  }
  return null
}

export function shouldAutoOpenSingleEntryEditFlow<T extends {
  blockedReason?: string | null
}>(rows: T[]) {
  if (rows.length !== 1) return false
  const [row] = rows
  if (row.blockedReason) return false
  return true
}

const CATEGORY_SUGGESTION_RULES: Array<{ keywords: string[]; key: string }> = [
  { keywords: ['water'], key: 'water' },
  { keywords: ['rent'], key: 'rent' },
  { keywords: ['uber', 'boda', 'taxi'], key: 'transport' },
  { keywords: ['grocery', 'groceries', 'food'], key: 'groceries' },
  { keywords: ['lunch', 'restaurant', 'eating'], key: 'eatingOut' },
  { keywords: ['fuel', 'petrol'], key: 'fuel' },
  { keywords: ['wifi', 'internet'], key: 'internet' },
  { keywords: ['school', 'fees'], key: 'schoolFees' },
  { keywords: ['medicine', 'pills', 'pharmacy'], key: 'medicine' },
]

export function getSuggestedCategoryOptions(
  label: string,
  groups: CategoryOptionGroup[],
  max = 4
): CategoryConfig[] {
  const normalizedLabel = label.trim().toLowerCase()
  if (!normalizedLabel) return []

  const optionByKey = new Map<string, CategoryConfig>()
  for (const group of groups) {
    for (const option of group.options) {
      optionByKey.set(option.key, option)
    }
  }

  const suggestions: CategoryConfig[] = []
  const seen = new Set<string>()

  for (const rule of CATEGORY_SUGGESTION_RULES) {
    const matches = rule.keywords.some((keyword) => {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp(`\\b${escaped}\\b`, 'i').test(normalizedLabel)
    })
    if (!matches) continue

    const option = optionByKey.get(rule.key)
    if (!option || seen.has(option.key)) continue
    suggestions.push(option)
    seen.add(option.key)

    if (suggestions.length >= max) break
  }

  return suggestions
}

export function getQueueGuidanceCopy(unresolvedCount: number) {
  if (unresolvedCount <= 0) {
    return {
      summary: null,
      instruction: null,
    }
  }

  if (unresolvedCount === 1) {
    return {
      summary: null,
      instruction: '1 uncategorized',
    }
  }

  return {
    summary: null,
    instruction: `${unresolvedCount} uncategorized`,
  }
}

export function getQueueSaveHelperCopy(
  unresolvedCount: number,
  options: { isPastMode?: boolean } = {}
) {
  if (unresolvedCount <= 0) return null
  // Past imports allow saving without categories — the helper becomes a soft
  // reminder rather than a blocker. Current-mode imports keep the strict gate.
  if (options.isPastMode) {
    if (unresolvedCount === 1) return 'You can categorize this one later.'
    return 'You can categorize these later.'
  }
  if (unresolvedCount === 1) return 'Choose a category to continue.'
  return `Choose categories for ${unresolvedCount} expenses to continue.`
}

export function shouldSaveSingleCompletedReviewRow(input: {
  totalRows: number
  editableRowCount: number
  isCurrentRowEditable: boolean
  hasNextEditableRow: boolean
  currentRowHasErrors: boolean
  currentRowHasWarnings: boolean
}) {
  return (
    input.totalRows === 1 &&
    input.editableRowCount === 1 &&
    input.isCurrentRowEditable &&
    !input.hasNextEditableRow &&
    !input.currentRowHasErrors &&
    !input.currentRowHasWarnings
  )
}

export function getReviewRowPrimaryLabel(input: {
  hasNextEditableRow: boolean
  savesImmediately: boolean
}) {
  const outcome = getReviewRowPrimaryOutcome(input)
  if (outcome === 'next-entry') return 'Next entry'
  if (outcome === 'save-expense') return 'Save expense'
  return 'Done'
}

export function getReviewRowPrimaryOutcome(input: {
  hasNextEditableRow: boolean
  savesImmediately: boolean
}) {
  if (input.hasNextEditableRow) return 'next-entry'
  if (input.savesImmediately) return 'save-expense'
  return 'done'
}

export function replaceEditedReviewRow<T extends { id: string }>(rows: T[], nextRow: T) {
  return rows.map((row) => row.id === nextRow.id ? nextRow : row)
}

export function getReviewRowActionLabel(input: {
  needsCategory: boolean
  hasHardError: boolean
  isBlocked: boolean
  needsReview?: boolean
}) {
  if (input.isBlocked) return null
  if (input.hasHardError) return 'Edit details'
  if (input.needsCategory) return 'Add category'
  if (input.needsReview) return 'Edit details'
  return 'Ready'
}

export function shouldShowReviewReminder(input: {
  categoryType: ImportPresentationCategoryType
  hasExistingMonthlyReminder: boolean
}) {
  if (input.hasExistingMonthlyReminder) return false
  return input.categoryType === 'everyday' || input.categoryType === 'fixed'
}
