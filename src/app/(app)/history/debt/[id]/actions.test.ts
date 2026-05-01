import { beforeEach, describe, expect, it, vi } from 'vitest'

const revalidatePath = vi.fn()
const getAppSession = vi.fn()
const addDebtTransaction = vi.fn()
const deleteDebt = vi.fn()
const deleteDebtTransaction = vi.fn()
const getDebt = vi.fn()
const getDebtTransactions = vi.fn()
const updateDebtDetails = vi.fn()
const updateStandardDebtDueDate = vi.fn()
const updateDebtTransaction = vi.fn()
const deleteDebtMirrorTransaction = vi.fn()
const isMirrorableDebtEntryType = vi.fn(() => true)
const updateDebtMirrorTransaction = vi.fn()
const createAndLinkDebtMirrorTransaction = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/auth/app-session', () => ({ getAppSession }))
vi.mock('@/lib/supabase/debt-db', () => ({
  addDebtTransaction,
  deleteDebt,
  deleteDebtTransaction,
  getDebt,
  getDebtTransactions,
  updateDebtDetails,
  updateStandardDebtDueDate,
  updateDebtTransaction,
}))
vi.mock('@/lib/supabase/debt-mirror', () => ({
  createAndLinkDebtMirrorTransaction,
  deleteDebtMirrorTransaction,
  isMirrorableDebtEntryType,
  updateDebtMirrorTransaction,
}))

describe('debt detail actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAppSession.mockResolvedValue({
      user: { id: 'user-1' },
      profile: { pay_schedule_type: 'monthly', pay_schedule_days: [25] },
    })
  })

  it('deletes linked debt transactions before removing the debt row', async () => {
    getDebtTransactions.mockResolvedValue([
      {
        id: 'txn-1',
        linked_transaction_id: 'mirror-1',
        entry_type: 'principal_increase',
      },
      {
        id: 'txn-2',
        linked_transaction_id: null,
        entry_type: 'payment_out',
      },
    ])

    const { deleteDebtForDebtDetail } = await import('./actions')

    const result = await deleteDebtForDebtDetail('debt-1')

    expect(deleteDebtMirrorTransaction).toHaveBeenCalledWith('mirror-1', 'user-1')
    expect(deleteDebtTransaction).toHaveBeenNthCalledWith(1, 'txn-1')
    expect(deleteDebtTransaction).toHaveBeenNthCalledWith(2, 'txn-2')
    expect(deleteDebt).toHaveBeenCalledWith('debt-1', 'user-1')
    expect(result.redirectTo).toBe('/history/debt')
  })

  it('updates the editable debt fields without touching transaction history', async () => {
    getDebt.mockResolvedValue({
      id: 'debt-1',
      debt_kind: 'standard',
    })
    updateDebtDetails.mockResolvedValue({ dueDateSupported: true })

    const { updateDebtDetailsAction } = await import('./actions')

    const result = await updateDebtDetailsAction({
      debtId: 'debt-1',
      name: 'Updated debt',
      note: 'Bring receipt',
      dueDate: '2026-05-22',
    })

    expect(updateDebtDetails).toHaveBeenCalledWith({
      debtId: 'debt-1',
      userId: 'user-1',
      name: 'Updated debt',
      note: 'Bring receipt',
      standardDueDate: '2026-05-22',
    })
    expect(result).toEqual({ dueDateSupported: true })
  })

  it('uses today when a manual repayment is saved without a date', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-01T12:00:00.000Z'))
    getDebt.mockResolvedValue({
      id: 'debt-1',
      name: 'Visa',
      direction: 'owed_by_me',
      current_balance: 4000,
      currency: 'KES',
    })
    getDebtTransactions.mockResolvedValue([])
    addDebtTransaction.mockResolvedValue({ id: 'txn-1' })

    const { addRepayment } = await import('./actions')

    await addRepayment({
      debtId: 'debt-1',
      amount: 2000,
      note: 'Manual payment',
    })

    expect(addDebtTransaction).toHaveBeenCalledWith({
      debtId: 'debt-1',
      entryType: 'payment_out',
      amount: 2000,
      currency: 'KES',
      transactionDate: '2026-05-01',
      note: 'Manual payment',
    })
  })

  it('uses a parsed repayment date when one is provided', async () => {
    getDebt.mockResolvedValue({
      id: 'debt-1',
      name: 'Visa',
      direction: 'owed_by_me',
      current_balance: 4000,
      currency: 'KES',
    })
    getDebtTransactions.mockResolvedValue([])
    addDebtTransaction.mockResolvedValue({ id: 'txn-1' })

    const { addRepayment } = await import('./actions')

    await addRepayment({
      debtId: 'debt-1',
      amount: 2000,
      date: '2026-04-29',
      note: 'Ref ABC123',
    })

    expect(addDebtTransaction).toHaveBeenCalledWith({
      debtId: 'debt-1',
      entryType: 'payment_out',
      amount: 2000,
      currency: 'KES',
      transactionDate: '2026-04-29',
      note: 'Ref ABC123',
    })
  })

  it('does not create a general expense mirror when adding an opening balance', async () => {
    getDebt.mockResolvedValue({
      id: 'debt-1',
      name: 'Visa',
      direction: 'owed_by_me',
      current_balance: 0,
      currency: 'KES',
    })
    addDebtTransaction.mockResolvedValue({ id: 'txn-1' })

    const { addOpeningBalance } = await import('./actions')

    await addOpeningBalance({
      debtId: 'debt-1',
      amount: 4000,
      date: '2026-05-01',
      note: 'Start tracking',
    })

    expect(addDebtTransaction).toHaveBeenCalledWith({
      debtId: 'debt-1',
      entryType: 'principal_increase',
      amount: 4000,
      currency: 'KES',
      transactionDate: '2026-05-01',
      note: 'Start tracking',
    })
    expect(createAndLinkDebtMirrorTransaction).not.toHaveBeenCalled()
  })

  it('treats an already-missing debt as a successful delete redirect', async () => {
    getDebtTransactions.mockRejectedValue(new Error('Debt debt-1 does not exist'))

    const { deleteDebtForDebtDetail } = await import('./actions')

    const result = await deleteDebtForDebtDetail('debt-1')

    expect(deleteDebt).not.toHaveBeenCalled()
    expect(result).toEqual({ redirectTo: '/history/debt' })
  })
})
