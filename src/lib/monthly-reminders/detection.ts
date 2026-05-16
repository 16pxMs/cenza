import { recurringExpenseKey } from '@/lib/fixed-bills/canonical'

export interface RecurringDetectionTransaction {
  id?: string | null
  display_name?: string | null
  amount?: number | string | null
  date?: string | null
  cycle_id?: string | null
  category_type?: string | null
  category_key?: string | null
  category_label?: string | null
}

export interface SmartRecurringCandidate {
  key: string
  label: string
  categoryType: 'everyday' | 'fixed'
  categoryKey: string
  amount: number
  cycleCount: number
  transactionCount: number
}

function normalizeLabel(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ')
}

function amountCloseEnough(left: number, right: number) {
  if (!Number.isFinite(left) || !Number.isFinite(right) || left <= 0 || right <= 0) return false
  const difference = Math.abs(left - right)
  return difference <= Math.max(100, Math.min(left, right) * 0.15)
}

function isEligibleCategory(type: string | null | undefined, key: string | null | undefined) {
  if (type !== 'everyday' && type !== 'fixed') return false
  const normalizedKey = String(key ?? '').trim()
  if (!normalizedKey || normalizedKey === 'uncategorized' || normalizedKey === 'debt_repayment') return false
  return true
}

function looksLikeNonExpense(value: string) {
  return /\b(?:salary|income|refund|cashback|reversal|reversed|reimbursement|chargeback|transfer|credited|deposit|paid in|paid-in|received)\b/i.test(value)
}

export function detectSmartRecurringCandidates(
  transactions: RecurringDetectionTransaction[],
  existingMonthlyReminderKeys: string[] = []
): SmartRecurringCandidate[] {
  const existingKeys = new Set(existingMonthlyReminderKeys.map((key) => key.trim()).filter(Boolean))
  const groups = new Map<string, Array<Required<Pick<SmartRecurringCandidate, 'label' | 'categoryType' | 'categoryKey' | 'amount'>> & { cycleId: string }>>()

  for (const transaction of transactions) {
    const label = String(transaction.display_name ?? '').trim()
    const categoryType = transaction.category_type === 'fixed' ? 'fixed' : transaction.category_type === 'everyday' ? 'everyday' : null
    const categoryKey = String(transaction.category_key ?? '').trim()
    const amount = Number(transaction.amount)
    const cycleId = String(transaction.cycle_id ?? transaction.date?.slice(0, 7) ?? '').trim()

    if (!label || looksLikeNonExpense(label)) continue
    if (!isEligibleCategory(categoryType, categoryKey)) continue
    // After isEligibleCategory, categoryType is guaranteed to be a real bucket —
    // narrow it explicitly so the downstream push satisfies the strict union.
    if (categoryType !== 'everyday' && categoryType !== 'fixed') continue
    if (!Number.isFinite(amount) || amount <= 0) continue
    if (!cycleId) continue

    const reminderKey = recurringExpenseKey(categoryType, categoryKey)
    if (!reminderKey || existingKeys.has(reminderKey)) continue

    const labelKey = normalizeLabel(label)
    if (!labelKey || labelKey.length < 3) continue

    const groupKey = `${categoryType}:${categoryKey}:${labelKey}`
    const group = groups.get(groupKey) ?? []
    group.push({ label, categoryType, categoryKey, amount, cycleId })
    groups.set(groupKey, group)
  }

  const candidates: SmartRecurringCandidate[] = []
  for (const group of groups.values()) {
    const cycles = new Set(group.map((item) => item.cycleId))
    if (cycles.size < 2 || group.length < 2) continue

    const sorted = [...group].sort((a, b) => b.cycleId.localeCompare(a.cycleId))
    const anchor = sorted[0]
    const similarAmountCount = sorted.filter((item) => amountCloseEnough(anchor.amount, item.amount)).length
    if (similarAmountCount < 2) continue

    const key = recurringExpenseKey(anchor.categoryType, anchor.categoryKey)
    if (!key) continue

    candidates.push({
      key,
      label: anchor.label,
      categoryType: anchor.categoryType,
      categoryKey: anchor.categoryKey,
      amount: anchor.amount,
      cycleCount: cycles.size,
      transactionCount: group.length,
    })
  }

  return candidates
    .sort((a, b) => b.cycleCount - a.cycleCount || b.amount - a.amount || a.label.localeCompare(b.label))
    .slice(0, 3)
}
