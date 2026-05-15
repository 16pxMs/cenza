import type { HistoryPageData, HistorySpendingGroup } from '@/lib/loaders/history'

export type HistoryHeroInsightKind =
  | 'no_expenses'
  | 'quiet_month'
  | 'low_remaining'
  | 'debt_dominant'
  | 'fixed_dominant'
  | 'category_dominant'
  | 'upcoming_burden'
  | 'evenly_distributed'

export const HERO_INSIGHT_THRESHOLDS = {
  maxSummaryInsights: 3,
  largestExpensePreviewLimit: 5,
  quietExpenseCount: 2,
  quietOutflowShareOfIncome: 5,
  meaningfulTopCategoryPercentage: 25,
  meaningfulTopCategoryGapPercentage: 8,
  dominantGroupPercentage: 50,
  spreadMinimumCategoryCount: 4,
  lowRemainingShareOfIncome: 10,
  lowRemainingAverageSpendDays: 5,
  assumedCycleDays: 30,
} as const

export interface HistoryHeroInsight {
  kind: HistoryHeroInsightKind
  headline: string
  category: HistoryPageData['rows'][number] | null
  group: HistorySpendingGroup | null
  recurringItem: HistoryPageData['recurringItems'][number] | null
  amount: number | null
  percentage: number | null
}

export interface HistorySummaryData {
  heroInsight: HistoryHeroInsight
  insights: HistoryHeroInsight[]
  biggestDriver: HistoryPageData['rows'][number] | null
  largestExpensePreview: HistoryPageData['topTransactions']
  spendingMix: HistorySpendingGroup[]
  recurringCount: number
  nextRecurringItem: HistoryPageData['recurringItems'][number] | null
}

function makeInsight(input: {
  kind: HistoryHeroInsightKind
  headline: string
  category?: HistoryPageData['rows'][number] | null
  group?: HistorySpendingGroup | null
  recurringItem?: HistoryPageData['recurringItems'][number] | null
  amount?: number | null
  percentage?: number | null
}): HistoryHeroInsight {
  return {
    category: null,
    group: null,
    recurringItem: null,
    amount: null,
    percentage: null,
    ...input,
  }
}

function isUncategorizedCategory(category: HistoryPageData['rows'][number] | null) {
  if (!category) return false
  return category.categoryKey === 'uncategorized' ||
    String(category.categoryType) === 'uncategorized' ||
    category.categoryLabel.trim().toLowerCase() === 'uncategorized'
}

function getUncategorizedDriver(data: HistoryPageData) {
  return data.topTransactions.find((transaction) =>
    transaction.categoryLabel.trim().toLowerCase() === 'uncategorized'
  ) ?? null
}

function getUncategorizedDriverName(transaction: HistoryPageData['topTransactions'][number] | null) {
  const title = transaction?.title.trim() ?? ''
  if (!title || title.toLowerCase() === 'uncategorized') return null
  return title
}

function makeCategoryDominantInsight(input: {
  data: HistoryPageData
  topCategory: HistoryPageData['rows'][number]
  topGroup: HistorySpendingGroup | null
}): HistoryHeroInsight {
  const { data, topCategory, topGroup } = input
  if (isUncategorizedCategory(topCategory)) {
    const driver = getUncategorizedDriver(data)
    const driverName = getUncategorizedDriverName(driver)
    return makeInsight({
      kind: 'category_dominant',
      headline: driverName
        ? `${driverName} shaped your month`
        : 'Older expenses shaped your month',
      category: topCategory,
      group: topGroup,
      amount: driver?.amount ?? topCategory.totalAmount,
      percentage: topCategory.percentageOfTotal,
    })
  }

  return makeInsight({
    kind: 'category_dominant',
    headline: `${topCategory.categoryLabel} shaped your month`,
    category: topCategory,
    group: topGroup,
    amount: topCategory.totalAmount,
    percentage: topCategory.percentageOfTotal,
  })
}

function resolveSummaryInsights(data: HistoryPageData): HistoryHeroInsight[] {
  const topCategory = data.rows[0] ?? null
  const secondCategory = data.rows[1] ?? null
  const topGroup = data.spendingGroups[0] ?? null
  const topCategoryGap = topCategory && secondCategory
    ? topCategory.percentageOfTotal - secondCategory.percentageOfTotal
    : topCategory?.percentageOfTotal ?? 0
  const remaining = data.totalIncome - data.totalSpent
  const averageDailySpend = data.totalSpent > 0
    ? data.totalSpent / HERO_INSIGHT_THRESHOLDS.assumedCycleDays
    : 0
  const recurringTotal = data.recurringItems.reduce((sum, item) => sum + item.amount, 0)

  if (data.expenseCount === 0 || data.totalSpent <= 0) {
    return [makeInsight({
      kind: 'no_expenses',
      headline: 'No spending recorded yet',
    })]
  }

  const insights: HistoryHeroInsight[] = []

  if (
    data.totalIncome > 0 &&
    (
      remaining <= data.totalIncome * (HERO_INSIGHT_THRESHOLDS.lowRemainingShareOfIncome / 100) ||
      (averageDailySpend > 0 && remaining <= averageDailySpend * HERO_INSIGHT_THRESHOLDS.lowRemainingAverageSpendDays)
    )
  ) {
    insights.push(makeInsight({
      kind: 'low_remaining',
      headline: 'You’re running low for this period',
      category: topCategory,
      group: topGroup,
      amount: remaining,
      percentage: (data.totalSpent / data.totalIncome) * 100,
    }))
  }

  if (data.expenseCount <= HERO_INSIGHT_THRESHOLDS.quietExpenseCount) {
    insights.push(makeInsight({
      kind: 'quiet_month',
      headline: 'Quiet month so far',
      category: topCategory,
      group: topGroup,
      amount: data.totalSpent,
    }))
  }

  if (
    topCategory &&
    (
      topCategory.percentageOfTotal >= HERO_INSIGHT_THRESHOLDS.meaningfulTopCategoryPercentage ||
      topCategoryGap >= HERO_INSIGHT_THRESHOLDS.meaningfulTopCategoryGapPercentage
    )
  ) {
    insights.push(makeCategoryDominantInsight({ data, topCategory, topGroup }))
  }

  if (topGroup?.key === 'debt' && topGroup.percentageOfTotal >= HERO_INSIGHT_THRESHOLDS.dominantGroupPercentage) {
    insights.push(makeInsight({
      kind: 'debt_dominant',
      headline: 'Debt payments took a large share of outflow',
      category: topCategory,
      group: topGroup,
      amount: topGroup.amount,
      percentage: topGroup.percentageOfTotal,
    }))
  }

  if (topGroup?.key === 'fixed' && topGroup.percentageOfTotal >= HERO_INSIGHT_THRESHOLDS.dominantGroupPercentage) {
    insights.push(makeInsight({
      kind: 'fixed_dominant',
      headline: 'Fixed costs led your spending',
      category: topCategory,
      group: topGroup,
      amount: topGroup.amount,
      percentage: topGroup.percentageOfTotal,
    }))
  }

  if (
    recurringTotal > 0 &&
    data.recurringItems[0]
  ) {
    insights.push(makeInsight({
      kind: 'upcoming_burden',
      headline: 'You still have upcoming commitments',
      recurringItem: data.recurringItems[0],
      amount: recurringTotal,
    }))
  }

  if (
    data.rows.length >= HERO_INSIGHT_THRESHOLDS.spreadMinimumCategoryCount &&
    topCategory &&
    topCategory.percentageOfTotal < HERO_INSIGHT_THRESHOLDS.meaningfulTopCategoryPercentage &&
    topCategoryGap < HERO_INSIGHT_THRESHOLDS.meaningfulTopCategoryGapPercentage
  ) {
    insights.push(makeInsight({
      kind: 'evenly_distributed',
      headline: 'Your spending was spread across categories',
      category: topCategory,
      group: topGroup,
      percentage: topCategory.percentageOfTotal,
    }))
  }

  if (insights.length === 0 && (
    (
      data.totalIncome > 0 &&
      data.totalSpent <= data.totalIncome * (HERO_INSIGHT_THRESHOLDS.quietOutflowShareOfIncome / 100)
    )
  )) {
    insights.push(makeInsight({
      kind: 'quiet_month',
      headline: 'Quiet month so far',
      category: topCategory,
      group: topGroup,
      amount: data.totalSpent,
    }))
  }

  if (insights.length === 0 && topCategory) {
    insights.push(makeCategoryDominantInsight({ data, topCategory, topGroup }))
  }

  if (insights.length === 0) {
    insights.push(makeInsight({
      kind: 'evenly_distributed',
      headline: 'Your spending was spread across categories',
      category: topCategory,
      group: topGroup,
    }))
  }

  return insights.slice(0, HERO_INSIGHT_THRESHOLDS.maxSummaryInsights)
}

export function deriveHistorySummaryData(data: HistoryPageData): HistorySummaryData {
  const insights = resolveSummaryInsights(data)

  return {
    heroInsight: insights[0],
    insights,
    biggestDriver: data.rows[0] ?? null,
    largestExpensePreview: data.topTransactions.slice(0, HERO_INSIGHT_THRESHOLDS.largestExpensePreviewLimit),
    spendingMix: data.spendingGroups,
    recurringCount: data.recurringItems.length,
    nextRecurringItem: data.recurringItems[0] ?? null,
  }
}
