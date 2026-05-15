import { beforeEach, describe, expect, it, vi } from 'vitest'

const getAppSession = vi.fn()
const createServerSupabaseClient = vi.fn()
const revalidatePath = vi.fn()
const after = vi.fn()
const hasMonthlyStorageForUser = vi.fn()
const loadMonthlyStorageCycleIdsForUser = vi.fn()
const loadMonthlyReminderEntriesForCycle = vi.fn()
const saveMonthlyReminderEntriesForCycle = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('next/server', () => ({ after }))
vi.mock('@/lib/auth/app-session', () => ({ getAppSession }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient }))
vi.mock('@/lib/monthly-reminders/storage', async () => {
  const actual = await vi.importActual<typeof import('@/lib/monthly-reminders/storage')>(
    '@/lib/monthly-reminders/storage'
  )
  return {
    ...actual,
    hasMonthlyStorageForUser,
    loadMonthlyStorageCycleIdsForUser,
    loadMonthlyReminderEntriesForCycle,
    saveMonthlyReminderEntriesForCycle,
    loadMonthlyStorageSnapshotForCycle: vi.fn(async () => ({
      plannedTotal: 0,
      plannedEntries: [],
      reminderEntries: [],
    })),
  }
})

type TableName =
  | 'cycles'
  | 'transactions'
  | 'sms_import_lines'
  | 'item_dictionary'
  | 'custom_categories'
  | 'income_entries'
  | 'debt_transactions'
  | 'debts'
  | 'goal_targets'
  | 'spending_budgets'

class Query {
  private selectColumns: string | null = null
  private filters: Array<(row: any) => boolean> = []
  private orderSpecs: Array<{ column: string; ascending: boolean }> = []
  private limitCount: number | null = null
  private maybeSingleMode = false
  private singleMode = false
  private operation: 'select' | 'insert' | 'upsert' = 'select'
  private writeRows: any[] = []

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

  update() {
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

  is(column: string, value: any) {
    this.filters.push((row) => value === null ? row[column] == null : row[column] === value)
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
      const inserted = this.db.upsertRows(this.table, this.writeRows)
      return { data: inserted, error: null }
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
    sms_import_lines: [],
    item_dictionary: [],
    custom_categories: [],
    income_entries: [],
    debt_transactions: [],
    debts: [],
    goal_targets: [],
    spending_budgets: [],
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
    if (table !== 'item_dictionary') return this.insertRows(table, rows)
    const upserted: any[] = []
    for (const row of rows) {
      const existing = this.rows.item_dictionary.find((candidate) =>
        candidate.user_id === row.user_id &&
        candidate.name_normalized === row.name_normalized
      )
      if (existing) {
        Object.assign(existing, row)
        upserted.push(existing)
      } else {
        upserted.push(...this.insertRows(table, [row]))
      }
    }
    return upserted
  }
}

type ImportedExpenseRow = {
  id: string
  label: string
  categoryType: 'everyday' | 'fixed' | 'debt'
  categoryKey: string
  amount: number
  date: string
  sourceHash: string
  blockedReason?: string | null
  repeatsMonthly?: boolean
  debtId?: string | null
  customCategoryId?: string | null
}

const profile = {
  currency: 'KES',
  pay_schedule_type: 'monthly',
  pay_schedule_days: [1],
  amount_format_preference: 'smart',
}

function importRow(overrides: Partial<ImportedExpenseRow>) {
  return {
    id: overrides.id ?? 'row-1',
    label: overrides.label ?? 'Naivas groceries',
    categoryType: overrides.categoryType ?? 'everyday',
    categoryKey: overrides.categoryKey ?? 'groceries',
    amount: overrides.amount ?? 2100,
    date: overrides.date ?? '2026-05-10',
    sourceHash: overrides.sourceHash ?? `hash-${overrides.id ?? 'row-1'}`,
    repeatsMonthly: overrides.repeatsMonthly ?? false,
    debtId: overrides.debtId ?? null,
    customCategoryId: overrides.customCategoryId ?? null,
  } satisfies ImportedExpenseRow
}

describe('saveParsedSmsExpenses import visibility', () => {
  let db: InMemorySupabase

  beforeEach(() => {
    vi.clearAllMocks()
    db = new InMemorySupabase()
    getAppSession.mockResolvedValue({ user: { id: 'user-1' }, profile })
    createServerSupabaseClient.mockResolvedValue(db)
    hasMonthlyStorageForUser.mockResolvedValue(false)
    loadMonthlyStorageCycleIdsForUser.mockResolvedValue([])
    loadMonthlyReminderEntriesForCycle.mockResolvedValue([])
    saveMonthlyReminderEntriesForCycle.mockResolvedValue(undefined)
    after.mockImplementation(() => undefined)
  })

  it('persists imported expenses directly to transactions and makes them visible to app loaders after reload', async () => {
    const { saveParsedSmsExpenses } = await import('./actions')
    const { loadLogPageData } = await import('@/lib/loaders/log')
    const { loadOverviewCriticalData, loadOverviewSecondaryData } = await import('@/lib/loaders/overview')
    const { loadHistoryPageData } = await import('@/lib/loaders/history')
    const { loadHistoryLedgerPageData } = await import('@/lib/loaders/history-ledger')

    const result = await saveParsedSmsExpenses([
      importRow({ id: 'may-grocery', label: 'Naivas groceries', categoryKey: 'groceries', amount: 2100, date: '2026-05-10' }),
      importRow({ id: 'may-transport', label: 'Matatu ride', categoryKey: 'transport', amount: 150, date: '2026-05-01' }),
      importRow({ id: 'may-rent', label: 'May rent', categoryType: 'fixed', categoryKey: 'rent', amount: 45000, date: '2026-05-13', repeatsMonthly: true }),
    ])

    expect(result).toEqual(expect.objectContaining({ ok: true }))
    expect(db.rows.transactions).toHaveLength(3)
    expect(db.rows.sms_import_lines).toHaveLength(3)

    const logData = await loadLogPageData('user-1', profile as any)
    expect(logData.entries.map((entry) => entry.name)).toEqual(
      expect.arrayContaining(['May rent', 'Matatu ride', 'Naivas groceries'])
    )
    expect(logData.totalOutflow).toBe(47250)

    const overviewCritical = await loadOverviewCriticalData('user-1', profile as any)
    expect(overviewCritical.totalSpent).toBe(47250)

    const overviewSecondary = await loadOverviewSecondaryData('user-1', { ...profile, goals: [] } as any)
    expect(overviewSecondary.recentActivity.map((entry) => entry.label)).toEqual(
      expect.arrayContaining(['May rent', 'Matatu ride', 'Naivas groceries'])
    )
    expect(overviewSecondary.topOutflowCategories.map((row) => row.categoryKey)).toEqual(['rent', 'groceries', 'transport'])

    const historyData = await loadHistoryPageData('user-1', profile as any, new Date('2026-05-01T00:00:00'), ['2026-05-01'])
    expect(historyData.totalSpent).toBe(47250)
    expect(historyData.rows.map((row) => row.categoryKey)).toEqual(['rent', 'groceries', 'transport'])

    const groceryLedger = await loadHistoryLedgerPageData(
      'user-1',
      profile as any,
      'groceries',
      'everyday',
      'key',
      undefined,
      new Date('2026-05-01T00:00:00')
    )
    expect(groceryLedger.txns).toEqual([
      expect.objectContaining({
        displayName: 'Naivas groceries',
        categoryLabel: 'Groceries',
        amount: 2100,
      }),
    ])

    expect(saveMonthlyReminderEntriesForCycle).toHaveBeenCalledWith(
      db,
      'user-1',
      '2026-05-01',
      [expect.objectContaining({ key: 'rent', label: 'May rent', monthly: 45000 })]
    )
  })

  it('saves imported expenses with custom category snapshots and exposes them through loaders', async () => {
    const { createSmsCustomCategory, saveParsedSmsExpenses } = await import('./actions')
    const { loadLogPageData } = await import('@/lib/loaders/log')
    const { loadOverviewSecondaryData } = await import('@/lib/loaders/overview')
    const { loadHistoryPageData } = await import('@/lib/loaders/history')

    const created = await createSmsCustomCategory({ label: 'Pets', type: 'everyday' })
    expect(created).toEqual(expect.objectContaining({ ok: true }))
    const customCategory = created.ok ? created.data : null
    expect(customCategory).toEqual(expect.objectContaining({
      label: 'Pets',
      type: 'everyday',
      customCategoryId: expect.any(String),
    }))

    const result = await saveParsedSmsExpenses([
      importRow({
        id: 'dog-food',
        label: 'Dog food',
        categoryKey: customCategory!.key,
        categoryType: customCategory!.type,
        customCategoryId: customCategory!.customCategoryId,
        amount: 875,
        date: '2026-05-10',
        sourceHash: 'dog-food-hash',
      }),
    ])

    expect(result).toEqual(expect.objectContaining({ ok: true }))
    expect(db.rows.transactions).toEqual([
      expect.objectContaining({
        display_name: 'Dog food',
        amount: 875,
        date: '2026-05-10',
        category_key: customCategory!.key,
        category_label: 'Pets',
        category_type: 'everyday',
        custom_category_id: customCategory!.customCategoryId,
        note: 'Imported from SMS',
      }),
    ])

    const logData = await loadLogPageData('user-1', profile as any)
    expect(logData.entries[0]).toEqual(expect.objectContaining({
      name: 'Dog food',
      categoryLabel: 'Pets',
      customCategoryId: customCategory!.customCategoryId,
      amount: 875,
    }))

    const overview = await loadOverviewSecondaryData('user-1', { ...profile, goals: [] } as any)
    expect(overview.topOutflowCategories[0]).toEqual(expect.objectContaining({
      categoryKey: customCategory!.key,
      customCategoryId: customCategory!.customCategoryId,
      categoryLabel: 'Pets',
      totalAmount: 875,
    }))

    const history = await loadHistoryPageData('user-1', profile as any, new Date('2026-05-01T00:00:00'), ['2026-05-01'])
    expect(history.rows[0]).toEqual(expect.objectContaining({
      categoryKey: customCategory!.key,
      customCategoryId: customCategory!.customCategoryId,
      categoryLabel: 'Pets',
      totalAmount: 875,
    }))
  })

  it('reuses normalized duplicate custom category names instead of inserting another row', async () => {
    const { createSmsCustomCategory } = await import('./actions')

    const first = await createSmsCustomCategory({ label: 'Eating out', type: 'everyday' })
    const second = await createSmsCustomCategory({ label: '  eating   out  ', type: 'everyday' })

    expect(first).toEqual(expect.objectContaining({ ok: true }))
    expect(second).toEqual(expect.objectContaining({ ok: true }))
    expect(db.rows.custom_categories).toHaveLength(1)
    expect(second.ok ? second.data.customCategoryId : null).toBe(first.ok ? first.data.customCategoryId : null)
    expect(db.rows.custom_categories[0]).toEqual(expect.objectContaining({
      label: 'Eating out',
      type: 'everyday',
    }))
  })

  it('rejects unknown category keys unless a valid active custom category id is supplied', async () => {
    const { saveParsedSmsExpenses } = await import('./actions')

    const result = await saveParsedSmsExpenses([
      importRow({
        id: 'unknown',
        label: 'Dog food',
        categoryKey: 'totally_unknown_custom_key',
        categoryType: 'everyday',
        amount: 875,
        date: '2026-05-10',
        sourceHash: 'unknown-hash',
      }),
    ])

    expect(result.ok).toBe(false)
    expect(db.rows.transactions).toHaveLength(0)
  })

  it('keeps previous-month and boundary imports accessible through their cycle loaders', async () => {
    const { saveParsedSmsExpenses } = await import('./actions')
    const { loadHistoryPageData } = await import('@/lib/loaders/history')

    await saveParsedSmsExpenses([
      importRow({ id: 'apr-transport', label: 'April bus', categoryKey: 'transport', amount: 300, date: '2026-04-30' }),
      importRow({ id: 'may-transport', label: 'May bus', categoryKey: 'transport', amount: 400, date: '2026-05-01' }),
    ])

    expect(db.rows.transactions).toEqual([
      expect.objectContaining({ display_name: 'April bus', cycle_id: '2026-04-01', date: '2026-04-30' }),
      expect.objectContaining({ display_name: 'May bus', cycle_id: '2026-05-01', date: '2026-05-01' }),
    ])

    const aprilHistory = await loadHistoryPageData('user-1', profile as any, new Date('2026-04-01T00:00:00'), ['2026-04-01', '2026-05-01'])
    const mayHistory = await loadHistoryPageData('user-1', profile as any, new Date('2026-05-01T00:00:00'), ['2026-04-01', '2026-05-01'])

    expect(aprilHistory.totalSpent).toBe(300)
    expect(aprilHistory.topTransactions[0]).toEqual(expect.objectContaining({ title: 'April bus', date: '2026-04-30' }))
    expect(mayHistory.totalSpent).toBe(400)
    expect(mayHistory.topTransactions[0]).toEqual(expect.objectContaining({ title: 'May bus', date: '2026-05-01' }))
  })

  it('revalidates every expense surface before background dictionary work runs', async () => {
    const { saveParsedSmsExpenses } = await import('./actions')

    await saveParsedSmsExpenses([
      importRow({ id: 'may-grocery', label: 'Naivas groceries', categoryKey: 'groceries', amount: 2100, date: '2026-05-10' }),
    ])

    expect(revalidatePath).toHaveBeenCalledWith('/log')
    expect(revalidatePath).toHaveBeenCalledWith('/history')
    expect(revalidatePath).toHaveBeenCalledWith('/app')
    expect(after).toHaveBeenCalled()
  })

  it('parses past import rows through the shared import action without enrichment reads', async () => {
    const { parseSmsImport } = await import('./actions')

    const result = await parseSmsImport(
      ['Date, Name, Amount, Category', '2026-01-05, Uber, 1200, Transport'].join('\n'),
      { mode: 'past' }
    )

    expect(result).toEqual(expect.objectContaining({ ok: true }))
    expect(result.ok ? result.data.rows : []).toEqual([
      expect.objectContaining({
        label: 'Uber',
        amount: 1200,
        date: '2026-01-05',
        currency: 'KES',
        categoryType: 'everyday',
        categoryKey: 'transport',
        sourceHash: '',
        sourceType: 'pasted_table',
      }),
    ])
    expect(result.ok ? result.data.monthlyReminderKeys : ['unexpected']).toEqual([])
    expect(createServerSupabaseClient).not.toHaveBeenCalled()
    expect(loadMonthlyReminderEntriesForCycle).not.toHaveBeenCalled()
  })

  it('applies default past import month to undated rows while preserving explicit dates', async () => {
    const { parseSmsImport } = await import('./actions')

    const result = await parseSmsImport(
      ['Uber 500', 'Mar 2 Rent 25000', 'Food 1200'].join('\n'),
      { mode: 'past', defaultImportMonth: '2026-02' }
    )

    expect(result).toEqual(expect.objectContaining({ ok: true }))
    expect(result.ok ? result.data.rows.map((row) => ({
      label: row.label,
      date: row.date,
      dateSource: row.dateSource,
    })) : []).toEqual([
      { label: 'Uber', date: '2026-02-01', dateSource: 'default_month' },
      { label: 'Rent', date: '2026-03-02', dateSource: 'explicit' },
      { label: 'Food', date: '2026-02-01', dateSource: 'default_month' },
    ])
    expect(createServerSupabaseClient).not.toHaveBeenCalled()
  })

  it('parses CSV past imports through the shared parse action', async () => {
    const { parseSmsImport } = await import('./actions')

    const result = await parseSmsImport(
      ['Transaction Date,Description,Amount,Category', '2026-01-05,"Uber, airport",1200,Transport'].join('\n'),
      { mode: 'past', source: 'csv' }
    )

    expect(result).toEqual(expect.objectContaining({ ok: true }))
    expect(result.ok ? result.data.rows : []).toEqual([
      expect.objectContaining({
        label: 'Uber, airport',
        amount: 1200,
        date: '2026-01-05',
        categoryKey: 'transport',
        sourceType: 'csv',
      }),
    ])
    expect(result.ok ? result.data.csvMappingRequired : 'unexpected').toBeNull()
    expect(createServerSupabaseClient).not.toHaveBeenCalled()
  })

  it('asks for CSV column mapping when required columns cannot be detected', async () => {
    const { parseSmsImport } = await import('./actions')

    const result = await parseSmsImport(
      ['When,Thing,Cost', '2026-01-05,Uber,1200'].join('\n'),
      { mode: 'past', source: 'csv' }
    )

    expect(result).toEqual(expect.objectContaining({ ok: true }))
    expect(result.ok ? result.data.csvMappingRequired : null).toEqual({
      headers: ['When', 'Thing', 'Cost'],
      missing: ['name'],
    })
    expect(result.ok ? result.data.rows : ['unexpected']).toEqual([])
    expect(createServerSupabaseClient).not.toHaveBeenCalled()
  })

  it('uses provided CSV column mapping to produce normal reviewed rows', async () => {
    const { parseSmsImport } = await import('./actions')

    const result = await parseSmsImport(
      ['When,Thing,Cost', '2026-01-05,Uber,1200'].join('\n'),
      { mode: 'past', source: 'csv', csvMapping: { date: 0, name: 1, amount: 2 } }
    )

    expect(result).toEqual(expect.objectContaining({ ok: true }))
    expect(result.ok ? result.data.rows : []).toEqual([
      expect.objectContaining({
        label: 'Uber',
        amount: 1200,
        date: '2026-01-05',
        sourceType: 'csv',
      }),
    ])
  })

  it('blocks past import rows without dates before deriving cycles or writing transactions', async () => {
    const { saveParsedSmsExpenses } = await import('./actions')

    const result = await saveParsedSmsExpenses([
      importRow({
        id: 'missing-date',
        label: 'Uber',
        categoryKey: 'transport',
        amount: 1200,
        date: '',
        sourceHash: '',
      }),
    ])

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      data: expect.objectContaining({
        saved: 0,
        blocked: true,
        rowErrors: { 'missing-date': ['Date is invalid.'] },
      }),
    }))
    expect(db.rows.cycles).toHaveLength(0)
    expect(db.rows.transactions).toHaveLength(0)
    expect(db.rows.sms_import_lines).toHaveLength(0)
  })

  it('saves historical past-import rows as normal transactions without SMS import-line records or reminders by default', async () => {
    const { saveParsedSmsExpenses } = await import('./actions')
    const { loadHistoryPageData } = await import('@/lib/loaders/history')
    const { loadLogPageData } = await import('@/lib/loaders/log')

    const result = await saveParsedSmsExpenses([
      importRow({ id: 'jan-uber', label: 'Uber', categoryKey: 'transport', amount: 1200, date: '2026-01-05', sourceHash: '' }),
      importRow({ id: 'feb-rent', label: 'Rent', categoryType: 'fixed', categoryKey: 'rent', amount: 25000, date: '2026-02-02', sourceHash: '' }),
      importRow({ id: 'mar-food', label: 'Groceries', categoryKey: 'groceries', amount: 3400, date: '2026-03-12', sourceHash: '' }),
    ])

    expect(result).toEqual(expect.objectContaining({ ok: true }))
    expect(db.rows.transactions).toEqual([
      expect.objectContaining({ display_name: 'Uber', date: '2026-01-05', cycle_id: '2026-01-01' }),
      expect.objectContaining({ display_name: 'Rent', date: '2026-02-02', cycle_id: '2026-02-01' }),
      expect.objectContaining({ display_name: 'Groceries', date: '2026-03-12', cycle_id: '2026-03-01' }),
    ])
    expect(db.rows.sms_import_lines).toHaveLength(0)
    expect(saveMonthlyReminderEntriesForCycle).not.toHaveBeenCalled()

    const januaryHistory = await loadHistoryPageData('user-1', profile as any, new Date('2026-01-01T00:00:00'), ['2026-01-01'])
    expect(januaryHistory.totalSpent).toBe(1200)
    expect(januaryHistory.topTransactions[0]).toEqual(expect.objectContaining({ title: 'Uber', date: '2026-01-05' }))

    const currentLog = await loadLogPageData('user-1', profile as any)
    expect(currentLog.entries.map((entry) => entry.name)).not.toEqual(
      expect.arrayContaining(['Uber', 'Rent', 'Groceries'])
    )
  })

  it('saves historical rows with inherited default-month dates into the selected month cycle', async () => {
    const { parseSmsImport, saveParsedSmsExpenses } = await import('./actions')
    const { loadHistoryPageData } = await import('@/lib/loaders/history')

    const parsed = await parseSmsImport('Uber 500', { mode: 'past', defaultImportMonth: '2026-02' })
    expect(parsed).toEqual(expect.objectContaining({ ok: true }))
    const row = parsed.ok ? parsed.data.rows[0] : null
    expect(row).toEqual(expect.objectContaining({ date: '2026-02-01', dateSource: 'default_month' }))

    const result = await saveParsedSmsExpenses([
      importRow({
        id: row!.id,
        label: row!.label,
        categoryKey: 'transport',
        amount: row!.amount,
        date: row!.date,
        sourceHash: row!.sourceHash,
      }),
    ])

    expect(result).toEqual(expect.objectContaining({ ok: true }))
    expect(db.rows.transactions[0]).toEqual(expect.objectContaining({
      display_name: 'Uber',
      date: '2026-02-01',
      cycle_id: '2026-02-01',
    }))

    const februaryHistory = await loadHistoryPageData('user-1', profile as any, new Date('2026-02-01T00:00:00'), ['2026-02-01'])
    expect(februaryHistory.totalSpent).toBe(500)
  })

  it('parses a single simple entry through the fast path without database enrichment reads', async () => {
    const { parseSmsImport } = await import('./actions')

    const result = await parseSmsImport('food 500')

    expect(result).toEqual(expect.objectContaining({ ok: true }))
    expect(result.ok ? result.data.rows : []).toEqual([
      expect.objectContaining({
        label: 'food',
        amount: 500,
        currency: 'KES',
        isImportedMessage: false,
        confidence: 'medium',
        sourceHash: expect.any(String),
      }),
    ])
    expect(result.ok ? result.data.usedFallback : false).toBe(true)
    expect(result.ok ? result.data.monthlyReminderKeys : ['unexpected']).toEqual([])
    expect(createServerSupabaseClient).not.toHaveBeenCalled()
    expect(loadMonthlyReminderEntriesForCycle).not.toHaveBeenCalled()
  })

  it('keeps terse merchant-style manual entries on the fast path', async () => {
    const { parseSmsImport } = await import('./actions')

    const result = await parseSmsImport('mpesa 200')

    expect(result).toEqual(expect.objectContaining({ ok: true }))
    expect(result.ok ? result.data.rows[0] : null).toEqual(expect.objectContaining({
      label: 'mpesa',
      amount: 200,
      isImportedMessage: false,
    }))
    expect(createServerSupabaseClient).not.toHaveBeenCalled()
  })

  it('keeps structured SMS imports on the enriched database-backed path', async () => {
    const { parseSmsImport } = await import('./actions')

    const result = await parseSmsImport('M-PESA confirmed. KES 2,100 paid to Naivas. Ref ABC123. Balance KES 8,000')

    expect(result).toEqual(expect.objectContaining({ ok: true }))
    expect(result.ok ? result.data.rows[0] : null).toEqual(expect.objectContaining({
      label: 'Naivas.',
      amount: 2100,
      isImportedMessage: true,
      sourceHash: expect.any(String),
    }))
    expect(createServerSupabaseClient).toHaveBeenCalledTimes(1)
    expect(loadMonthlyReminderEntriesForCycle).toHaveBeenCalledTimes(1)
  })
})
