import { beforeEach, describe, expect, it, vi } from 'vitest'

const createServerSupabaseClient = vi.fn()
const deriveCurrentCycleId = vi.fn()
const deriveCycleIdForDate = vi.fn()
const loadMonthlyStorageCycleIdsForUser = vi.fn()
const loadMonthlyStorageSnapshotForCycle = vi.fn()

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient }))
vi.mock('@/lib/supabase/cycles-db', async () => {
  const actual = await vi.importActual<typeof import('@/lib/supabase/cycles-db')>('@/lib/supabase/cycles-db')
  return {
    ...actual,
    deriveCurrentCycleId,
    deriveCycleIdForDate,
  }
})
vi.mock('@/lib/monthly-reminders/storage', async () => {
  const actual = await vi.importActual<typeof import('@/lib/monthly-reminders/storage')>('@/lib/monthly-reminders/storage')
  return {
    ...actual,
    loadMonthlyStorageCycleIdsForUser,
    loadMonthlyStorageSnapshotForCycle,
  }
})

function makeHistorySupabase(transactionRows: any[], incomeRow: any = {
  salary: 300000,
  extra_income: [],
  total: 300000,
  cycle_start_mode: 'full_month',
  opening_balance: null,
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'transactions') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ data: transactionRows }),
            })),
          })),
        }
      }

      if (table === 'income_entries') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: incomeRow }),
              })),
            })),
          })),
        }
      }

      throw new Error(`Unexpected table ${table}`)
    }),
  }
}

describe('history recap loader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    deriveCurrentCycleId.mockReturnValue('2026-05-01')
    deriveCycleIdForDate.mockReturnValue('2026-05-01')
    loadMonthlyStorageCycleIdsForUser.mockResolvedValue([])
    loadMonthlyStorageSnapshotForCycle.mockResolvedValue({
      plannedTotal: 45000,
      plannedEntries: [
        { key: 'rent', label: 'Rent', monthly: 45000, entry_type: 'planned' },
      ],
      reminderEntries: [
        { key: 'water', label: 'Water', monthly: 1500, reminder: true, entry_type: 'monthly_reminder' },
      ],
    })
  })

  it('returns category breakdown, broad groups, and top transactions for included outflow', async () => {
    createServerSupabaseClient.mockResolvedValue(makeHistorySupabase([
      {
        id: 'opening',
        category_type: 'debt',
        category_key: 'debt_opening_balance',
        category_label: 'Debt opening balance',
        display_name: 'Opening balance',
        amount: 80000,
        date: '2026-05-01',
        created_at: '2026-05-01T08:00:00Z',
      },
      {
        id: 'rent-1',
        category_type: 'fixed',
        category_key: 'rent',
        category_label: 'House rent',
        display_name: 'May rent',
        amount: 60000,
        date: '2026-05-02',
        created_at: '2026-05-02T08:00:00Z',
      },
      {
        id: 'grocery-1',
        category_type: 'everyday',
        category_key: 'groceries',
        category_label: 'Groceries',
        display_name: 'Naivas run',
        amount: 30000,
        date: '2026-05-03',
        created_at: '2026-05-03T08:00:00Z',
      },
      {
        id: 'grocery-2',
        category_type: 'everyday',
        category_key: 'groceries',
        category_label: 'Groceries',
        display_name: '',
        note: 'Do not use note as title',
        amount: 10000,
        date: '2026-05-04',
        created_at: '2026-05-04T08:00:00Z',
      },
      {
        id: 'refund-1',
        category_type: 'everyday',
        category_key: 'groceries',
        category_label: 'Groceries',
        display_name: 'Refund',
        amount: -5000,
        date: '2026-05-05',
        created_at: '2026-05-05T08:00:00Z',
      },
    ]))

    const { loadHistoryPageData } = await import('./history')
    const data = await loadHistoryPageData('user-1', {
      currency: 'KES',
      amount_format_preference: 'full',
      pay_schedule_type: 'monthly',
      pay_schedule_days: [25],
    } as any, undefined, ['2026-05-01'])

    expect(data.amountFormatPreference).toBe('full')
    expect(data.totalSpent).toBe(100000)
    expect(data.expenseCount).toBe(3)
    expect(data.rows).toEqual([
      expect.objectContaining({
        categoryKey: 'rent',
        categoryLabel: 'House rent',
        totalAmount: 60000,
        percentageOfTotal: 60,
        transactionCount: 1,
      }),
      expect.objectContaining({
        categoryKey: 'groceries',
        categoryLabel: 'Groceries',
        totalAmount: 40000,
        percentageOfTotal: 40,
        transactionCount: 2,
      }),
    ])
    expect(data.rows.find((row) => row.categoryKey === 'debt_opening_balance')).toBeUndefined()
    expect(Math.round(data.rows.reduce((sum, row) => sum + row.percentageOfTotal, 0))).toBe(100)
    expect(data.spendingGroups).toEqual([
      expect.objectContaining({ key: 'fixed', amount: 60000, percentageOfTotal: 60 }),
      expect.objectContaining({ key: 'everyday', amount: 40000, percentageOfTotal: 40 }),
    ])
    expect(data.topTransactions.map((txn) => txn.title)).toEqual([
      'May rent',
      'Naivas run',
      'Groceries',
    ])
    expect(data.recurringItems).toEqual([
      expect.objectContaining({ key: 'rent', label: 'Rent', amount: 45000, kind: 'fixed' }),
      expect.objectContaining({ key: 'water', label: 'Water', amount: 1500, kind: 'reminder' }),
    ])

    const { deriveHistorySummaryData } = await import('@/lib/history/recap-summary')
    const summary = deriveHistorySummaryData(data)

    expect(summary.biggestDriver).toEqual(expect.objectContaining({
      categoryKey: 'rent',
      categoryLabel: 'House rent',
      totalAmount: 60000,
      percentageOfTotal: 60,
    }))
    expect(summary.spendingMix.map((group) => group.key)).toEqual(['fixed', 'everyday'])
    expect(summary.recurringCount).toBe(2)
    expect(summary.nextRecurringItem).toEqual(expect.objectContaining({
      key: 'rent',
      amount: 45000,
    }))
  })

  it('returns empty recap data when there are no included expenses', async () => {
    loadMonthlyStorageSnapshotForCycle.mockResolvedValue({
      plannedTotal: 0,
      plannedEntries: [],
      reminderEntries: [],
    })
    createServerSupabaseClient.mockResolvedValue(makeHistorySupabase([
      {
        id: 'opening',
        category_type: 'debt',
        category_key: 'debt_opening_balance',
        category_label: 'Debt opening balance',
        display_name: 'Opening balance',
        amount: 80000,
        date: '2026-05-01',
        created_at: '2026-05-01T08:00:00Z',
      },
    ]))

    const { loadHistoryPageData } = await import('./history')
    const data = await loadHistoryPageData('user-1', {
      currency: 'KES',
      pay_schedule_type: 'monthly',
      pay_schedule_days: [25],
    } as any, undefined, ['2026-05-01'])

    expect(data.amountFormatPreference).toBe('smart')
    expect(data.totalSpent).toBe(0)
    expect(data.expenseCount).toBe(0)
    expect(data.rows).toEqual([])
    expect(data.spendingGroups).toEqual([])
    expect(data.topTransactions).toEqual([])
    expect(data.recurringItems).toEqual([])

    const { deriveHistorySummaryData } = await import('@/lib/history/recap-summary')
    expect(deriveHistorySummaryData(data)).toMatchObject({
      heroInsight: {
        kind: 'no_expenses',
        headline: 'No spending recorded yet',
        category: null,
        group: null,
      },
      insights: [
        expect.objectContaining({
          kind: 'no_expenses',
          headline: 'No spending recorded yet',
        }),
      ],
      biggestDriver: null,
      spendingMix: [],
      recurringCount: 0,
      nextRecurringItem: null,
    })
  })

  it('keeps category totals, group totals, monthly total, and individual top expenses mathematically distinct', async () => {
    loadMonthlyStorageSnapshotForCycle.mockResolvedValue({
      plannedTotal: 0,
      plannedEntries: [],
      reminderEntries: [],
    })
    createServerSupabaseClient.mockResolvedValue(makeHistorySupabase([
      {
        id: 'family-1',
        category_type: 'everyday',
        category_key: 'family_support',
        category_label: 'Family support',
        display_name: 'Family support',
        amount: 18400,
        date: '2026-05-01',
        created_at: '2026-05-01T08:00:00Z',
      },
      {
        id: 'family-2',
        category_type: 'everyday',
        category_key: 'family_support',
        category_label: 'Family support',
        display_name: 'Family support top-up',
        amount: 6000,
        date: '2026-05-02',
        created_at: '2026-05-02T08:00:00Z',
      },
      {
        id: 'family-3',
        category_type: 'everyday',
        category_key: 'family_support',
        category_label: 'Family support',
        display_name: 'Family support',
        amount: 3500,
        date: '2026-05-03',
        created_at: '2026-05-03T08:00:00Z',
      },
      {
        id: 'family-4',
        category_type: 'everyday',
        category_key: 'family_support',
        category_label: 'Family support',
        display_name: 'Family support',
        amount: 2000,
        date: '2026-05-04',
        created_at: '2026-05-04T08:00:00Z',
      },
      {
        id: 'rent-1',
        category_type: 'fixed',
        category_key: 'rent',
        category_label: 'Rent',
        display_name: 'Rent',
        amount: 61000,
        date: '2026-05-05',
        created_at: '2026-05-05T08:00:00Z',
      },
      {
        id: 'opening',
        category_type: 'debt',
        category_key: 'debt_opening_balance',
        category_label: 'Debt opening balance',
        display_name: 'Opening balance',
        amount: 90000,
        date: '2026-05-06',
        created_at: '2026-05-06T08:00:00Z',
      },
      {
        id: 'transfer-1',
        category_type: 'transfer',
        category_key: 'savings_transfer',
        category_label: 'Savings transfer',
        display_name: 'Savings transfer',
        amount: 50000,
        date: '2026-05-07',
        created_at: '2026-05-07T08:00:00Z',
      },
      {
        id: 'refund-1',
        category_type: 'everyday',
        category_key: 'family_support',
        category_label: 'Family support',
        display_name: 'Family support refund',
        amount: -1000,
        date: '2026-05-08',
        created_at: '2026-05-08T08:00:00Z',
      },
      {
        id: 'zero-1',
        category_type: 'everyday',
        category_key: 'family_support',
        category_label: 'Family support',
        display_name: 'Zero row',
        amount: 0,
        date: '2026-05-09',
        created_at: '2026-05-09T08:00:00Z',
      },
    ]))

    const { loadHistoryPageData } = await import('./history')
    const data = await loadHistoryPageData('user-1', {
      currency: 'KES',
      pay_schedule_type: 'monthly',
      pay_schedule_days: [25],
    } as any, undefined, ['2026-05-01'])

    const categoryTotal = data.rows.reduce((sum, row) => sum + row.totalAmount, 0)
    const groupTotal = data.spendingGroups.reduce((sum, group) => sum + group.amount, 0)
    const familySupport = data.rows.find((row) => row.categoryKey === 'family_support')

    expect(familySupport).toEqual(expect.objectContaining({
      categoryLabel: 'Family support',
      totalAmount: 29900,
      transactionCount: 4,
    }))
    expect(data.totalSpent).toBe(90900)
    expect(categoryTotal).toBe(data.totalSpent)
    expect(groupTotal).toBe(data.totalSpent)
    expect(data.expenseCount).toBe(5)
    expect(data.rows.find((row) => row.categoryKey === 'debt_opening_balance')).toBeUndefined()
    expect(data.rows.find((row) => row.categoryKey === 'savings_transfer')).toBeUndefined()
    expect(data.spendingGroups.find((group) => group.key === 'debt')).toBeUndefined()
    expect(data.topTransactions.map((txn) => txn.id)).toEqual([
      'rent-1',
      'family-1',
      'family-2',
      'family-3',
      'family-4',
    ])
    expect(data.topTransactions.find((txn) => txn.id === 'family-1')).toEqual(expect.objectContaining({
      title: 'Family support',
      amount: 18400,
    }))
  })
})
