export function isStandardDueDateSchemaMismatch(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const normalized = message.toLowerCase()
  return normalized.includes('standard_due_date') && (
    normalized.includes('schema cache') ||
    normalized.includes('column') ||
    normalized.includes('failed to check debt due date support')
  )
}
