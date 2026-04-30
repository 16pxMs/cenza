export type GoalPaceStatus = 'ahead' | 'on_track' | 'behind'

function parseDateOnly(value: string | null | undefined) {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return null
  const normalized = value.slice(0, 10)
  const [year, month, day] = normalized.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    Number.isNaN(date.getTime())
    || date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null
  }
  return date
}

export function normalizeGoalTargetDate(value: string | null | undefined) {
  const trimmed = value?.trim() || null
  if (!trimmed) return null
  return parseDateOnly(trimmed) ? trimmed.slice(0, 10) : null
}

function toDateOnlyString(date: Date) {
  const year = date.getUTCFullYear()
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${date.getUTCDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function daysBetween(from: Date, to: Date) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000
  return Math.floor((to.getTime() - from.getTime()) / millisecondsPerDay)
}

function monthsBetween(from: Date, to: Date) {
  const yearDiff = to.getUTCFullYear() - from.getUTCFullYear()
  const monthDiff = to.getUTCMonth() - from.getUTCMonth()
  let months = yearDiff * 12 + monthDiff

  if (to.getUTCDate() < from.getUTCDate()) {
    months -= 1
  }

  return months
}

export function deriveGoalTargetDateFromMonths(months: number, fromDate = new Date()) {
  if (!Number.isFinite(months) || months <= 0) return null

  const base = new Date(Date.UTC(
    fromDate.getUTCFullYear(),
    fromDate.getUTCMonth(),
    fromDate.getUTCDate()
  ))
  base.setUTCMonth(base.getUTCMonth() + months)
  return toDateOnlyString(base)
}

export function getGoalMonthlySavingSuggestion(
  totalSaved: number,
  targetAmount: number | null,
  targetDate: string | null,
  today = new Date()
) {
  if (targetAmount == null || targetAmount <= 0 || !targetDate) return null

  const dueDate = parseDateOnly(targetDate)
  if (!dueDate) return null

  const current = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const monthsLeft = Math.max(1, monthsBetween(current, dueDate) + 1)
  const remaining = Math.max(0, targetAmount - totalSaved)

  if (remaining <= 0) return 0
  return Math.ceil(remaining / monthsLeft)
}

export function getGoalPaceStatus(input: {
  totalSaved: number
  targetAmount: number | null
  targetDate: string | null
  addedAt: string | null
  today?: Date
}): GoalPaceStatus | null {
  const { totalSaved, targetAmount, targetDate, addedAt } = input
  const today = input.today ?? new Date()

  if (targetAmount == null || targetAmount <= 0 || totalSaved >= targetAmount) return null

  const startDate = parseDateOnly(addedAt)
  const dueDate = parseDateOnly(targetDate)
  if (!startDate || !dueDate) return null

  const current = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  if (dueDate.getTime() <= startDate.getTime()) return null

  const totalDuration = daysBetween(startDate, dueDate)
  if (totalDuration <= 0) return null

  const elapsedDuration = Math.min(Math.max(daysBetween(startDate, current), 0), totalDuration)
  const expectedProgress = elapsedDuration / totalDuration
  const actualProgress = Math.min(Math.max(totalSaved / targetAmount, 0), 1)

  if (actualProgress >= expectedProgress + 0.05) return 'ahead'
  if (actualProgress < expectedProgress - 0.05) return 'behind'
  return 'on_track'
}
