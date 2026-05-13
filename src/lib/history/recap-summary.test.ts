import { describe, expect, it } from 'vitest'
import { deriveHistorySummaryData, HERO_INSIGHT_THRESHOLDS } from './recap-summary'
import type { HistoryPageData } from '@/lib/loaders/history'

function makeRecapData(overrides: Partial<HistoryPageData> = {}): HistoryPageData {
  return {
    cycleLabel: 'Apr 28 – May 27',
    currency: 'KES',
    amountFormatPreference: 'smart',
    rows: [],
    spendingGroups: [],
    topTransactions: [],
    recurringItems: [],
    totalSpent: 0,
    totalIncome: 0,
    expenseCount: 0,
    availableCycleIds: ['2026-05-01'],
    ...overrides,
  }
}

function category(
  categoryKey: string,
  categoryLabel: string,
  categoryType: HistoryPageData['rows'][number]['categoryType'],
  totalAmount: number,
  percentageOfTotal: number,
  transactionCount = 3
): HistoryPageData['rows'][number] {
  return {
    categoryKey,
    customCategoryId: null,
    categoryLabel,
    categoryType,
    totalAmount,
    percentageOfTotal,
    transactionCount,
  }
}

function group(
  key: HistoryPageData['spendingGroups'][number]['key'],
  label: string,
  amount: number,
  percentageOfTotal: number
): HistoryPageData['spendingGroups'][number] {
  return {
    key,
    label,
    amount,
    percentageOfTotal,
    transactionCount: 3,
    description: `${label} description`,
  }
}

function topTransaction(
  id: string,
  title: string,
  amount: number
): HistoryPageData['topTransactions'][number] {
  return {
    id,
    title,
    categoryLabel: title,
    amount,
    date: '2026-05-01',
  }
}

describe('deriveHistorySummaryData hero insight', () => {
  it('returns no-expenses insight when there is no included outflow', () => {
    const summary = deriveHistorySummaryData(makeRecapData())

    expect(summary.insights).toHaveLength(1)
    expect(summary.heroInsight).toMatchObject({
      kind: 'no_expenses',
      headline: 'No spending recorded yet',
      category: null,
      group: null,
    })
    expect(summary.largestExpensePreview).toEqual([])
  })

  it('returns dominant category insight when the top category meaningfully dominates', () => {
    const emergency = category('emergency_fund', 'Emergency Fund', 'goal', 32000, 32)
    const groceries = category('groceries', 'Groceries', 'everyday', 30000, 30)
    const summary = deriveHistorySummaryData(makeRecapData({
      rows: [emergency, groceries],
      spendingGroups: [
        group('goal', 'Goals', 32000, 32),
        group('everyday', 'Everyday spending', 30000, 30),
      ],
      totalSpent: 100000,
      expenseCount: 6,
    }))

    expect(summary.heroInsight.kind).toBe('category_dominant')
    expect(summary.heroInsight.headline).toBe('Emergency Fund shaped your month')
    expect(summary.heroInsight.category).toBe(emergency)
  })

  it('returns at most three summary insights', () => {
    const summary = deriveHistorySummaryData(makeRecapData({
      rows: [
        category('emergency_fund', 'Emergency Fund', 'goal', 32000, 32),
        category('loan_payment', 'Loan payment', 'debt', 24000, 24),
        category('rent', 'Rent', 'fixed', 22000, 22),
      ],
      spendingGroups: [
        group('goal', 'Goals', 32000, 32),
        group('debt', 'Debt payments', 52000, 52),
        group('fixed', 'Fixed costs', 22000, 22),
      ],
      recurringItems: [
        { key: 'rent', label: 'Rent', amount: 22000, kind: 'fixed' },
      ],
      totalSpent: 95000,
      totalIncome: 100000,
      expenseCount: 8,
    }))

    expect(summary.insights.length).toBeLessThanOrEqual(HERO_INSIGHT_THRESHOLDS.maxSummaryInsights)
  })

  it('prioritizes low remaining balance before other insights', () => {
    const summary = deriveHistorySummaryData(makeRecapData({
      rows: [
        category('emergency_fund', 'Emergency Fund', 'goal', 32000, 32),
        category('groceries', 'Groceries', 'everyday', 25000, 25),
      ],
      spendingGroups: [
        group('goal', 'Goals', 32000, 32),
        group('everyday', 'Everyday spending', 25000, 25),
      ],
      totalSpent: 95000,
      totalIncome: 100000,
      expenseCount: 8,
    }))

    expect(summary.heroInsight.kind).toBe('low_remaining')
    expect(summary.heroInsight.headline).toBe('You’re running low for this period')
    expect(summary.heroInsight.percentage).toBe(95)
    expect(summary.heroInsight.amount).toBe(5000)
    expect(summary.insights[1]?.kind).toBe('category_dominant')
  })

  it('keeps a compact largest-expense preview capped to five individual rows', () => {
    const summary = deriveHistorySummaryData(makeRecapData({
      rows: [category('rent', 'Rent', 'fixed', 61000, 61)],
      spendingGroups: [group('fixed', 'Fixed costs', 61000, 61)],
      topTransactions: [
        topTransaction('rent-1', 'Rent', 61000),
        topTransaction('family-1', 'Family support', 18400),
        topTransaction('groceries-1', 'Groceries', 12000),
        topTransaction('transport-1', 'Transport', 9000),
        topTransaction('coffee-1', 'Coffee', 3000),
        topTransaction('snack-1', 'Snack', 1000),
      ],
      totalSpent: 100000,
      expenseCount: 4,
    }))

    expect(summary.largestExpensePreview).toHaveLength(HERO_INSIGHT_THRESHOLDS.largestExpensePreviewLimit)
    expect(summary.largestExpensePreview.map((txn) => txn.id)).toEqual([
      'rent-1',
      'family-1',
      'groceries-1',
      'transport-1',
      'coffee-1',
    ])
  })

  it('returns evenly distributed insight when no category strongly dominates', () => {
    const summary = deriveHistorySummaryData(makeRecapData({
      rows: [
        category('groceries', 'Groceries', 'everyday', 24000, 24),
        category('rent', 'Rent', 'fixed', 23000, 23),
        category('debt', 'Debt repayment', 'debt', 22000, 22),
        category('family', 'Family support', 'everyday', 21000, 21),
      ],
      spendingGroups: [
        group('everyday', 'Everyday spending', 45000, 45),
        group('fixed', 'Fixed costs', 23000, 23),
        group('debt', 'Debt payments', 22000, 22),
      ],
      totalSpent: 100000,
      expenseCount: 9,
    }))

    expect(summary.heroInsight.kind).toBe('evenly_distributed')
    expect(summary.heroInsight.headline).toBe('Your spending was spread across categories')
  })

  it('returns debt-dominant insight when debt takes most outflow', () => {
    const summary = deriveHistorySummaryData(makeRecapData({
      rows: [
        category('loan_payment', 'Loan payment', 'debt', 24000, 24),
        category('credit_card', 'Credit card', 'debt', 23000, 23),
        category('rent', 'Rent', 'fixed', 20000, 20),
      ],
      spendingGroups: [
        group('debt', 'Debt payments', 55000, HERO_INSIGHT_THRESHOLDS.dominantGroupPercentage),
        group('fixed', 'Fixed costs', 30000, 30),
      ],
      totalSpent: 100000,
      expenseCount: 6,
    }))

    expect(summary.heroInsight.kind).toBe('debt_dominant')
    expect(summary.heroInsight.headline).toBe('Debt payments took a large share of outflow')
  })

  it('returns fixed-cost-dominant insight when fixed costs take most outflow', () => {
    const summary = deriveHistorySummaryData(makeRecapData({
      rows: [
        category('rent', 'Rent', 'fixed', 24000, 24),
        category('internet', 'Internet', 'fixed', 23000, 23),
        category('groceries', 'Groceries', 'everyday', 24000, 24),
      ],
      spendingGroups: [
        group('fixed', 'Fixed costs', 52000, HERO_INSIGHT_THRESHOLDS.dominantGroupPercentage),
        group('everyday', 'Everyday spending', 24000, 24),
      ],
      totalSpent: 100000,
      expenseCount: 7,
    }))

    expect(summary.heroInsight.kind).toBe('fixed_dominant')
    expect(summary.heroInsight.headline).toBe('Fixed costs led your spending')
  })

  it('returns quiet-month insight for very low activity before claiming dominance', () => {
    const summary = deriveHistorySummaryData(makeRecapData({
      rows: [category('coffee', 'Coffee', 'everyday', 500, 100, 1)],
      spendingGroups: [group('everyday', 'Everyday spending', 500, 100)],
      totalSpent: 500,
      expenseCount: HERO_INSIGHT_THRESHOLDS.quietExpenseCount,
    }))

    expect(summary.heroInsight.kind).toBe('quiet_month')
    expect(summary.heroInsight.headline).toBe('Quiet month so far')
  })
})
