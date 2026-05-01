import { beforeEach, describe, expect, it, vi } from 'vitest'

const revalidatePath = vi.fn()
const getAppSession = vi.fn()
const createServerSupabaseClient = vi.fn()
const createAndLinkDebtMirrorTransaction = vi.fn()
const addDebtTransaction = vi.fn()
const createDebt = vi.fn()
const createFinancingDebt = vi.fn()
const updateStandardDebtDueDate = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/auth/app-session', () => ({ getAppSession }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient }))
vi.mock('@/lib/supabase/debt-mirror', () => ({ createAndLinkDebtMirrorTransaction }))
vi.mock('@/lib/supabase/debt-db', () => ({
  addDebtTransaction,
  createDebt,
  createFinancingDebt,
  updateStandardDebtDueDate,
}))

function buildDebtNameCheckClient() {
  const limit = vi.fn().mockResolvedValue({ data: [], error: null })
  const eqNormalized = vi.fn(() => ({ limit }))
  const eqStatus = vi.fn(() => ({ eq: eqNormalized }))
  const eqUser = vi.fn(() => ({ eq: eqStatus }))
  const select = vi.fn(() => ({ eq: eqUser }))
  return {
    from: vi.fn(() => ({ select })),
  }
}

describe('create debt actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAppSession.mockResolvedValue({
      user: { id: 'user-1' },
      profile: { currency: 'KES' },
    })
    createServerSupabaseClient.mockResolvedValue(buildDebtNameCheckClient())
    createDebt.mockResolvedValue({
      id: 'debt-1',
      name: 'Laptop',
      currency: 'KES',
    })
    addDebtTransaction.mockResolvedValue({ id: 'txn-1' })
    updateStandardDebtDueDate.mockResolvedValue(true)
  })

  it('creates a standard debt without trying to save a due date when none was provided', async () => {
    const { createDebtWithOpeningBalance } = await import('./actions')

    const debtId = await createDebtWithOpeningBalance({
      mode: 'standard',
      name: 'Laptop',
      direction: 'owed_by_me',
      openingAmount: 45000,
    })

    expect(debtId).toBe('debt-1')
    expect(updateStandardDebtDueDate).not.toHaveBeenCalled()
  })

  it('does not create a general expense mirror for a new opening balance', async () => {
    const { createDebtWithOpeningBalance } = await import('./actions')

    await createDebtWithOpeningBalance({
      mode: 'standard',
      name: 'Laptop',
      direction: 'owed_by_me',
      openingAmount: 45000,
    })

    expect(createAndLinkDebtMirrorTransaction).not.toHaveBeenCalled()
  })

  it('does not fail the create flow when due date support is unavailable after the debt is created', async () => {
    updateStandardDebtDueDate.mockResolvedValue(false)

    const { createDebtWithOpeningBalance } = await import('./actions')

    const debtId = await createDebtWithOpeningBalance({
      mode: 'standard',
      name: 'Laptop',
      direction: 'owed_by_me',
      openingAmount: 45000,
      dueDate: '2026-05-20',
    })

    expect(debtId).toBe('debt-1')
    expect(createDebt).toHaveBeenCalled()
    expect(addDebtTransaction).toHaveBeenCalled()
    expect(updateStandardDebtDueDate).toHaveBeenCalledWith('debt-1', 'user-1', '2026-05-20')
  })
})
