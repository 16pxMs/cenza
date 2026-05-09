import { createServerSupabaseClient } from '@/lib/supabase/server'
import { deriveCurrentCycleId } from '@/lib/supabase/cycles-db'
import { loadMonthlyStorageSnapshotForCycle } from '@/lib/monthly-reminders/storage'
import {
  deriveBillsLeftToPay,
  deriveOverviewCommitmentSummary,
  deriveOverviewObligations,
  type OverviewCommitmentSummary,
  type OverviewObligation,
} from '@/lib/loaders/overview'
import type { Debt, UserProfile } from '@/types/database'

interface CommitmentTransactionRow {
  amount: number | string
  category_key: string
  category_type: string
}

export interface CommitmentRecurringItem {
  key: string
  label: string
  amount: number
  paid: number
  remaining: number
  status: 'active' | 'completed'
}

export interface CommitmentReminderItem {
  key: string
  keys: string[]
  label: string
  amount: number
}

export interface CommitmentsPageData {
  currency: string
  summary: OverviewCommitmentSummary
  dueSoon: OverviewObligation[]
  activeRecurring: CommitmentRecurringItem[]
  reminderOnly: CommitmentReminderItem[]
  completedThisCycle: CommitmentRecurringItem[]
}

function dedupeReminderItems(entries: Array<{ key: string; label: string; monthly: number }>): CommitmentReminderItem[] {
  const byLabelAndAmount = new Map<string, CommitmentReminderItem>()

  for (const entry of entries) {
    const label = entry.label.trim() || entry.key
    const amount = Number(entry.monthly)
    const signature = `${label.toLowerCase()}:${amount}`
    const existing = byLabelAndAmount.get(signature)

    if (existing) {
      existing.keys.push(entry.key)
      continue
    }

    byLabelAndAmount.set(signature, {
      key: entry.key,
      keys: [entry.key],
      label,
      amount,
    })
  }

  return Array.from(byLabelAndAmount.values())
}

export async function loadCommitmentsPageData(userId: string, profile: UserProfile): Promise<CommitmentsPageData> {
  const supabase = await createServerSupabaseClient()
  const cycleId = deriveCurrentCycleId(profile)
  const [
    monthlyStorage,
    { data: transactionRowsRaw },
    { data: debtRowsRaw },
  ] = await Promise.all([
    loadMonthlyStorageSnapshotForCycle(supabase, userId, cycleId),
    (supabase.from('transactions') as any)
      .select('amount, category_key, category_type')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId),
    (supabase.from('debts') as any)
      .select('id, name, status, current_balance, debt_kind, standard_due_date, financing_target_date, currency')
      .eq('user_id', userId),
  ])

  const transactionRows = (transactionRowsRaw ?? []) as CommitmentTransactionRow[]
  const debtRows = (debtRowsRaw ?? []) as Debt[]
  const billsLeftToPay = deriveBillsLeftToPay(monthlyStorage.plannedEntries, transactionRows)
  const overviewObligations = deriveOverviewObligations({
    debts: debtRows,
    currency: profile.currency ?? 'KES',
    cycleTransactions: transactionRows,
  })
  const summary = deriveOverviewCommitmentSummary({
    plannedEntries: monthlyStorage.plannedEntries,
    monthlyReminders: monthlyStorage.reminderEntries,
    billsLeftToPay,
    overviewObligations,
  })
  const billByKey = new Map(billsLeftToPay.items.map((item) => [item.key, item]))
  const recurringItems = monthlyStorage.plannedEntries.map((entry) => {
    const bill = billByKey.get(entry.key)
    const remaining = bill?.leftToPay ?? entry.monthly
    return {
      key: entry.key,
      label: entry.label,
      amount: entry.monthly,
      paid: bill?.paid ?? 0,
      remaining,
      status: remaining > 0 ? 'active' as const : 'completed' as const,
    }
  })

  return {
    currency: profile.currency ?? 'KES',
    summary,
    dueSoon: overviewObligations.filter((item) => item.status === 'overdue' || item.status === 'today' || item.status === 'soon'),
    activeRecurring: recurringItems.filter((item) => item.status === 'active'),
    reminderOnly: dedupeReminderItems(monthlyStorage.reminderEntries),
    completedThisCycle: recurringItems.filter((item) => item.status === 'completed'),
  }
}
