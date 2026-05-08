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
  })
})
