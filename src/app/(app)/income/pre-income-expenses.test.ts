import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getAppSession = vi.fn()
const createServerSupabaseClient = vi.fn()
const revalidatePath = vi.fn()
const after = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('next/server', () => ({ after }))
vi.mock('@/lib/auth/app-session', () => ({ getAppSession }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient }))

type TableName =
  | 'cycles'
  | 'transactions'
  | 'income_entries'
  | 'item_dictionary'
  | 'sms_import_lines'
  | 'monthly_expenses'
  | 'fixed_expenses'
  | 'spending_budgets'
  | 'debts'
  | 'goal_targets'
  | 'debt_transactions'
  | 'user_profiles'

class Query {
  private selectColumns: string | null = null
  private filters: Array<(row: any) => boolean> = []
  private orderSpecs: Array<{ column: string; ascending: boolean }> = []
  private limitCount: number | null = null
  private maybeSingleMode = false
  private singleMode = false
  private operation: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select'
  private writeRows: any[] = []
  private updatePatch: Record<string, any> = {}

  constructor(private readonly db: InMemorySupabase, private readonly table: TableName) {}

  select(columns = '*') {
    this.selectColumns = columns
    return this
  }

  insert(rows: any | any[]) {
    this.operation = 'insert'
    this.writeRows = Array.isArray(rows) ? rows : [rows]
    return this
  }

  upsert(rows: any | any[]) {
    this.operation = 'upsert'
    this.writeRows = Array.isArray(rows) ? rows : [rows]
    return this
  }

  update(patch: Record<string, any>) {
    this.operation = 'update'
    this.updatePatch = patch
    return this
  }

  delete() {
    this.operation = 'delete'
    return this
  }

  eq(column: string, value: any) {
    this.filters.push((row) => row[column] === value)
    return this
  }

  gte(column: string, value: any) {
    this.filters.push((row) => row[column] >= value)
    return this
  }

  lte(column: string, value: any) {
    this.filters.push((row) => row[column] <= value)
    return this
  }

  gt(column: string, value: any) {
    this.filters.push((row) => Number(row[column]) > Number(value))
    return this
  }

  in(column: string, values: any[]) {
    const accepted = new Set(values)
    this.filters.push((row) => accepted.has(row[column]))
    return this
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.orderSpecs.push({ column, ascending: opts?.ascending !== false })
    return this
  }

  limit(count: number) {
    this.limitCount = count
    return this
  }

  maybeSingle() {
    this.maybeSingleMode = true
    return this
  }

  single() {
    this.singleMode = true
    return this
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.resolve().then(onfulfilled, onrejected)
  }

  private async resolve() {
    if (this.operation === 'insert') {
      const inserted = this.db.insertRows(this.table, this.writeRows)
      return this.singleMode ? { data: inserted[0] ?? null, error: null } : { data: inserted, error: null }
    }

    if (this.operation === 'upsert') {
      const rows = this.db.upsertRows(this.table, this.writeRows)
      return { data: rows, error: null }
    }

    if (this.operation === 'update') {
      this.db.rows[this.table] = this.db.rows[this.table].map((row) =>
        this.filters.every((filter) => filter(row)) ? { ...row, ...this.updatePatch } : row
      )
      return { data: null, error: null }
    }

    if (this.operation === 'delete') {
      this.db.rows[this.table] = this.db.rows[this.table].filter((row) =>
        !this.filters.every((filter) => filter(row))
      )
      return { data: null, error: null }
    }

    let rows = [...this.db.rows[this.table]].filter((row) => this.filters.every((filter) => filter(row)))
    for (const spec of this.orderSpecs) {
      rows.sort((a, b) => {
        const left = String(a[spec.column] ?? '')
        const right = String(b[spec.column] ?? '')
        const result = left.localeCompare(right)
        return spec.ascending ? result : -result
      })
    }
    if (this.limitCount != null) rows = rows.slice(0, this.limitCount)
    rows = rows.map((row) => this.project(row))

    if (this.maybeSingleMode || this.singleMode) {
      return { data: rows[0] ?? null, error: null }
    }
    return { data: rows, error: null }
  }

  private project(row: any) {
    if (!this.selectColumns || this.selectColumns === '*') return { ...row }
    const next: Record<string, any> = {}
    for (const column of this.selectColumns.split(',').map((part) => part.trim()).filter(Boolean)) {
      next[column] = row[column]
    }
    return next
  }
}

class InMemorySupabase {
  rows: Record<TableName, any[]> = {
    cycles: [],
    transactions: [],
    income_entries: [],
    item_dictionary: [],
    sms_import_lines: [],
    monthly_expenses: [],
    fixed_expenses: [],
    spending_budgets: [],
    debts: [],
    goal_targets: [],
    debt_transactions: [],
    user_profiles: [],
  }

  from(table: TableName) {
    return new Query(this, table)
  }

  insertRows(table: TableName, rows: any[]) {
    const inserted = rows.map((row) => ({
      id: row.id ?? `${table}-${this.rows[table].length + 1}`,
      created_at: row.created_at ?? `2026-05-13T10:00:${String(this.rows[table].length).padStart(2, '0')}Z`,
      ...row,
    }))
    this.rows[table].push(...inserted)
    return inserted
  }

  upsertRows(table: TableName, rows: any[]) {
    const upserted: any[] = []
    for (const row of rows) {
      const index = this.rows[table].findIndex((existing) => {
        if (table === 'cycles') return existing.user_id === row.user_id && existing.start_date === row.start_date
        if (table === 'income_entries') return existing.user_id === row.user_id && existing.cycle_id === row.cycle_id
        if (table === 'item_dictionary') return existing.user_id === row.user_id && existing.name_normalized === row.name_normalized
        return false
      })
      const next = {
        id: row.id ?? (index >= 0 ? this.rows[table][index].id : `${table}-${this.rows[table].length + 1}`),
        created_at: row.created_at ?? (index >= 0 ? this.rows[table][index].created_at : `2026-05-13T10:00:${String(this.rows[table].length).padStart(2, '0')}Z`),
        ...(index >= 0 ? this.rows[table][index] : {}),
        ...row,
      }
      if (index >= 0) this.rows[table][index] = next
      else this.rows[table].push(next)
      upserted.push(next)
    }
    return upserted
  }
}

const preIncomeProfile = {
  id: 'user-1',
  name: 'New User',
  currency: 'KES',
  income_type: null,
  pay_schedule_type: null,
  pay_schedule_days: null,
  goals: [],
  amount_format_preference: 'smart',
}

const postIncomeProfile = {
  ...preIncomeProfile,
  income_type: 'salaried',
  pay_schedule_type: 'monthly',
  pay_schedule_days: [25],
}

describe('pre-income expenses after income setup', () => {
  let db: InMemorySupabase
  let sessionProfile: any

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-13T12:00:00'))
    vi.clearAllMocks()
    after.mockImplementation(() => undefined)
    db = new InMemorySupabase()
    sessionProfile = preIncomeProfile
    db.rows.user_profiles = [{ ...preIncomeProfile }]
    createServerSupabaseClient.mockResolvedValue(db)
    getAppSession.mockImplementation(async () => ({
      user: { id: 'user-1' },
      profile: sessionProfile,
    }))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps expenses added before income visible after payday setup without mutating original rows', async () => {
    const { saveParsedSmsExpenses } = await import('@/app/(app)/log/import/actions')
    const { saveIncome } = await import('./actions')
    const { loadOverviewCriticalData, loadOverviewSecondaryData } = await import('@/lib/loaders/overview')
    const { loadLogPageData } = await import('@/lib/loaders/log')
    const { loadHistoryPageData } = await import('@/lib/loaders/history')

    await saveParsedSmsExpenses([
      {
        id: 'row-1',
        label: 'Naivas groceries',
        categoryType: 'everyday',
        categoryKey: 'groceries',
        amount: 2100,
        date: '2026-05-13',
        sourceHash: 'pre-income-row-1',
      },
      {
        id: 'row-2',
        label: 'Matatu ride',
        categoryType: 'everyday',
        categoryKey: 'transport',
        amount: 150,
        date: '2026-05-13',
        sourceHash: 'pre-income-row-2',
      },
    ])

    const beforeIncomeRows = db.rows.transactions.map((row) => ({ ...row }))
    expect(beforeIncomeRows).toEqual([
      expect.objectContaining({
        user_id: 'user-1',
        cycle_id: '2026-05-01',
        date: '2026-05-13',
        category_key: 'groceries',
        category_label: 'Groceries',
        display_name: 'Naivas groceries',
        amount: 2100,
        note: 'Imported from SMS',
      }),
      expect.objectContaining({
        user_id: 'user-1',
        cycle_id: '2026-05-01',
        date: '2026-05-13',
        category_key: 'transport',
        category_label: 'Transport',
        display_name: 'Matatu ride',
        amount: 150,
        note: 'Imported from SMS',
      }),
    ])

    await saveIncome({
      income: 90000,
      extraIncome: [],
      total: 90000,
      incomeType: 'salaried',
      paydayDay: 25,
    })
    sessionProfile = postIncomeProfile

    expect(db.rows.transactions).toEqual(beforeIncomeRows)
    expect(db.rows.income_entries).toEqual([
      expect.objectContaining({
        user_id: 'user-1',
        cycle_id: '2026-04-25',
        salary: 90000,
      }),
    ])

    const overviewCritical = await loadOverviewCriticalData('user-1', postIncomeProfile as any)
    expect(overviewCritical.totalSpent).toBe(2250)
    expect(overviewCritical.hasStartedCycleData).toBe(true)

    const overviewSecondary = await loadOverviewSecondaryData('user-1', postIncomeProfile as any)
    expect(overviewSecondary.recentActivity).toEqual([
      expect.objectContaining({
        label: 'Naivas groceries',
        amount: 2100,
        date: '2026-05-13',
      }),
      expect.objectContaining({
        label: 'Matatu ride',
        amount: 150,
        date: '2026-05-13',
      }),
    ])

    const logData = await loadLogPageData('user-1', postIncomeProfile as any)
    expect(logData.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'Naivas groceries',
        categoryKey: 'groceries',
        categoryLabel: 'Groceries',
        amount: 2100,
        date: '2026-05-13',
        note: 'Imported from SMS',
      }),
      expect.objectContaining({
        name: 'Matatu ride',
        categoryKey: 'transport',
        categoryLabel: 'Transport',
        amount: 150,
        date: '2026-05-13',
        note: 'Imported from SMS',
      }),
    ]))

    const historyData = await loadHistoryPageData(
      'user-1',
      postIncomeProfile as any,
      new Date('2026-05-13T00:00:00'),
      ['2026-04-25']
    )
    expect(historyData.totalSpent).toBe(2250)
    expect(historyData.topTransactions).toEqual([
      expect.objectContaining({
        title: 'Naivas groceries',
        categoryLabel: 'Groceries',
        amount: 2100,
        date: '2026-05-13',
      }),
      expect.objectContaining({
        title: 'Matatu ride',
        categoryLabel: 'Transport',
        amount: 150,
        date: '2026-05-13',
      }),
    ])
  })

  it('keeps a pre-income expense from the previous calendar month visible when it belongs to the new payday cycle', async () => {
    const { saveIncome } = await import('./actions')
    const { loadOverviewCriticalData } = await import('@/lib/loaders/overview')
    const { loadLogPageData } = await import('@/lib/loaders/log')
    const { loadHistoryPageData } = await import('@/lib/loaders/history')

    db.insertRows('transactions', [{
      user_id: 'user-1',
      cycle_id: '2026-04-01',
      date: '2026-04-30',
      category_type: 'everyday',
      category_key: 'groceries',
      category_label: 'Groceries',
      display_name: 'April market run',
      amount: 1800,
      note: 'before payday setup',
    }])
    const beforeIncomeRows = db.rows.transactions.map((row) => ({ ...row }))

    await saveIncome({
      income: 90000,
      extraIncome: [],
      total: 90000,
      incomeType: 'salaried',
      paydayDay: 25,
    })
    sessionProfile = postIncomeProfile

    expect(db.rows.transactions).toEqual(beforeIncomeRows)

    const overviewCritical = await loadOverviewCriticalData('user-1', postIncomeProfile as any)
    expect(overviewCritical.totalSpent).toBe(1800)

    const logData = await loadLogPageData('user-1', postIncomeProfile as any)
    expect(logData.entries).toEqual([
      expect.objectContaining({
        name: 'April market run',
        categoryKey: 'groceries',
        categoryLabel: 'Groceries',
        amount: 1800,
        date: '2026-04-30',
        note: 'before payday setup',
      }),
    ])

    const historyData = await loadHistoryPageData(
      'user-1',
      postIncomeProfile as any,
      new Date('2026-04-30T00:00:00'),
      ['2026-04-25']
    )
    expect(historyData.topTransactions).toEqual([
      expect.objectContaining({
        title: 'April market run',
        categoryLabel: 'Groceries',
        amount: 1800,
        date: '2026-04-30',
      }),
    ])
  })
})
