export const DUPLICATE_MESSAGE = 'This message was already added.'

export interface SmsImportRowLike {
  id: string
  blockedReason?: string | null
}

interface SmsImportReviewStateArgs<T extends SmsImportRowLike> {
  rows: T[]
  rowErrors: Record<string, string[]>
  getClientIssues: (row: T) => string[]
}

export function isBlockedIncomeRow(row: SmsImportRowLike) {
  return Boolean(row.blockedReason)
}

export function isDuplicateBlockedRow(
  rowId: string,
  rowErrors: Record<string, string[]>
) {
  return (rowErrors[rowId] ?? []).includes(DUPLICATE_MESSAGE)
}

export function getSmsImportReviewState<T extends SmsImportRowLike>({
  rows,
  rowErrors,
  getClientIssues,
}: SmsImportReviewStateArgs<T>) {
  const savableRows = rows.filter((row) => !isBlockedIncomeRow(row))
  const hardBlockedRows = savableRows.filter((row) => (rowErrors[row.id] ?? []).length > 0)
  const duplicateBlockedRows = hardBlockedRows.filter((row) =>
    isDuplicateBlockedRow(row.id, rowErrors)
  )
  const validSavableRows = savableRows.filter((row) => {
    if ((rowErrors[row.id] ?? []).length > 0) return false
    return getClientIssues(row).length === 0
  })

  return {
    savableRows,
    validSavableRows,
    hasHardBlockedRows: hardBlockedRows.length > 0,
    hasDuplicateBlockedRows: duplicateBlockedRows.length > 0,
    hasSavableClientValidationErrors: savableRows.some((row) => getClientIssues(row).length > 0),
  }
}
