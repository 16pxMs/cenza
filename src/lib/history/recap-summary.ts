import type { HistoryPageData, HistorySpendingGroup } from '@/lib/loaders/history'

export interface HistorySummaryData {
  biggestDriver: HistoryPageData['rows'][number] | null
  spendingMix: HistorySpendingGroup[]
  recurringCount: number
  nextRecurringItem: HistoryPageData['recurringItems'][number] | null
}

export function deriveHistorySummaryData(data: HistoryPageData): HistorySummaryData {
  return {
    biggestDriver: data.rows[0] ?? null,
    spendingMix: data.spendingGroups,
    recurringCount: data.recurringItems.length,
    nextRecurringItem: data.recurringItems[0] ?? null,
  }
}
