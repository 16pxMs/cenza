'use server'

import { revalidatePath } from 'next/cache'
import { getAppSession } from '@/lib/auth/app-session'
import { hasIncomeForCycle } from '@/lib/income/derived'
import { createCycleTransaction } from '@/lib/supabase/transactions-db'
import { deriveCurrentCycleId } from '@/lib/supabase/cycles-db'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ok, runAction, unauthorized, type ActionResult } from '@/lib/actions/result'
import { canonicalizeFixedBillKey, slugifyBillLabel } from '@/lib/fixed-bills/canonical'
import { sumTrackedFixedExpenses, upsertTrackedFixedExpense } from '@/lib/fixed-bills/tracking'

type CategoryType = 'everyday' | 'fixed' | 'debt' | 'goal'

interface SaveExpenseInput {
  mode: 'add' | 'update'
  priorEntryId?: string | null
  categoryType: CategoryType
  categoryKey: string
  categoryLabel: string
  amount: number
  note?: string | null
  rememberItem: boolean
  trackAsEssential?: boolean
  trackedMonthlyAmount?: number | null
}

interface SaveExpenseBatchItem extends SaveExpenseInput {}
interface SaveRecurringSetupInput {
  label: string
  amount: number
  dueDay: number
  priority: 'core' | 'flex'
}
const QUICK_ENTRY_LIMIT_WITHOUT_INCOME = 3

async function rememberDictionaryItem(
  supabase: any,
  userId: string,
  item: Pick<SaveExpenseInput, 'categoryLabel' | 'categoryKey' | 'categoryType'>
) {
  const normalized = item.categoryLabel.trim().toLowerCase()
  const table = supabase.from('item_dictionary') as any

  if (typeof table.select !== 'function') {
    const { error } = await table.upsert({
      user_id: userId,
      name_normalized: normalized,
      label: item.categoryLabel,
      category_key: item.categoryKey,
      category_type: item.categoryType,
      usage_count: 1,
    }, {
      onConflict: 'user_id,name_normalized',
    })

    if (error) {
      throw new Error(`Failed to remember item: ${error.message}`)
    }

    return
  }

  const { data: existing, error: existingError } = await table
    .select('usage_count')
    .eq('user_id', userId)
    .eq('name_normalized', normalized)
    .maybeSingle()

  if (existingError) {
    throw new Error(`Failed to load remembered item: ${existingError.message}`)
  }

  const usageCount = Number(existing?.usage_count ?? 0) + 1

  const { error } = await table.upsert({
    user_id: userId,
    name_normalized: normalized,
    label: item.categoryLabel,
    category_key: item.categoryKey,
    category_type: item.categoryType,
    usage_count: usageCount,
  }, {
    onConflict: 'user_id,name_normalized',
  })

  if (error) {
    throw new Error(`Failed to remember item: ${error.message}`)
  }
}

export async function saveExpense(input: SaveExpenseInput): Promise<ActionResult<void>> {
  return saveExpenseBatch([input])
}

export async function saveExpenseBatch(items: SaveExpenseBatchItem[]): Promise<ActionResult<void>> {
  return runAction<void>(async () => {
    const { user, profile } = await getAppSession()
    if (!user || !profile) return unauthorized()

    const supabase = await createServerSupabaseClient()
    const cycleId = deriveCurrentCycleId(profile)

    const [{ data: incomeRow, error: incomeError }, { data: cycleTxns, error: txnError }] = await Promise.all([
      (supabase.from('income_entries') as any)
        .select('total, opening_balance, received')
        .eq('user_id', user.id)
        .eq('cycle_id', cycleId)
        .maybeSingle(),
      (supabase.from('transactions') as any)
        .select('id, category_type')
        .eq('user_id', user.id)
        .eq('cycle_id', cycleId),
    ])

    if (incomeError) {
      throw new Error(`Failed to verify income status: ${incomeError.message}`)
    }
    if (txnError) {
      throw new Error(`Failed to verify current entries: ${txnError.message}`)
    }

    const hasIncomeForCurrentCycle = hasIncomeForCycle(incomeRow)

    const existingExpenseCount = (cycleTxns ?? []).filter((txn: any) => txn.category_type !== 'goal').length
    const netNewEntries = items.reduce((sum, input) => {
      const isReplacement = input.mode === 'update' && Boolean(input.priorEntryId)
      return sum + (isReplacement ? 0 : 1)
    }, 0)

    if (!hasIncomeForCurrentCycle && existingExpenseCount + netNewEntries > QUICK_ENTRY_LIMIT_WITHOUT_INCOME) {
      const entriesLeft = Math.max(0, QUICK_ENTRY_LIMIT_WITHOUT_INCOME - existingExpenseCount)
      return {
        ok: false,
        error: {
          kind: 'validation',
          message:
            entriesLeft > 0
              ? `You have ${entriesLeft} quick ${entriesLeft === 1 ? 'entry' : 'entries'} left. Add income to continue logging more expenses.`
              : 'Add your income first so Cenza can calculate what is left accurately.',
        },
      }
    }

    let savedCount = 0
    try {
      for (const input of items) {
        if (input.mode === 'update' && input.priorEntryId) {
          const { error } = await (supabase.from('transactions') as any)
            .delete()
            .eq('id', input.priorEntryId)

          if (error) {
            throw new Error(`Failed to delete prior entry: ${error.message}`)
          }
        }

        // Fixed bills share matching by category_key, so variants like
        // "WiFi" or "Home WiFi" must resolve to the same canonical key
        // before persisting. Other category types pass through unchanged.
        const persistedKey =
          input.categoryType === 'fixed'
            ? canonicalizeFixedBillKey(input.categoryKey)
            : input.categoryKey

        await createCycleTransaction(supabase as any, user.id, profile, {
          categoryType: input.categoryType,
          categoryKey: persistedKey,
          categoryLabel: input.categoryLabel,
          amount: input.amount,
          note: input.note,
        })
        savedCount += 1

        if (input.categoryType === 'fixed' && input.trackAsEssential) {
          const { data: existingFixedExpenses, error: fixedExpensesError } = await (supabase.from('fixed_expenses') as any)
            .select('entries')
            .eq('user_id', user.id)
            .eq('cycle_id', cycleId)
            .maybeSingle()

          if (fixedExpensesError) {
            throw new Error(`Failed to load tracked essentials: ${fixedExpensesError.message}`)
          }

          const nextEntries = upsertTrackedFixedExpense(existingFixedExpenses?.entries ?? null, {
            key: persistedKey,
            label: input.categoryLabel,
            monthly: Number(input.trackedMonthlyAmount ?? input.amount),
          })

          const { error: fixedExpensesUpsertError } = await (supabase.from('fixed_expenses') as any).upsert({
            user_id: user.id,
            cycle_id: cycleId,
            total_monthly: sumTrackedFixedExpenses(nextEntries),
            entries: nextEntries,
          }, { onConflict: 'user_id,cycle_id' })

          if (fixedExpensesUpsertError) {
            throw new Error(`Failed to track essential: ${fixedExpensesUpsertError.message}`)
          }
        }

        if (input.rememberItem) {
          // Non-critical side effect. A failure here must not fail the save
          // or surface a technical message to the user; the transaction
          // already landed.
          try {
            await rememberDictionaryItem(supabase, user.id, {
              ...input,
              categoryKey: persistedKey,
            })
          } catch (e) {
            console.error('[log/new] rememberDictionaryItem failed', e)
          }
        }
      }
    } finally {
      // Always refresh the UI for whatever actually landed, even if a later
      // item in the batch threw.
      if (savedCount > 0) {
        revalidatePath('/log')
        revalidatePath('/history')
        revalidatePath('/app')
      }
    }

    return ok(undefined)
  })
}

export async function saveRecurringSetup(input: SaveRecurringSetupInput): Promise<ActionResult<void>> {
  return runAction<void>(async () => {
    const { user, profile } = await getAppSession()
    if (!user || !profile) return unauthorized()

    const label = input.label.trim()
    const amount = Number(input.amount)
    const dueDay = Number(input.dueDay)
    const priority = input.priority === 'core' ? 'core' : 'flex'

    if (!label) {
      return {
        ok: false,
        error: { kind: 'validation', message: 'Name is required.' },
      }
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return {
        ok: false,
        error: { kind: 'validation', message: 'Amount must be greater than zero.' },
      }
    }

    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) {
      return {
        ok: false,
        error: { kind: 'validation', message: 'Choose a due day between 1 and 28.' },
      }
    }

    const supabase = await createServerSupabaseClient()
    const cycleId = deriveCurrentCycleId(profile)
    const recurringKey = canonicalizeFixedBillKey(slugifyBillLabel(label))

    const { data: existingFixedExpenses, error: fixedExpensesError } = await (supabase.from('fixed_expenses') as any)
      .select('entries')
      .eq('user_id', user.id)
      .eq('cycle_id', cycleId)
      .maybeSingle()

    if (fixedExpensesError) {
      throw new Error(`Failed to load recurring items: ${fixedExpensesError.message}`)
    }

    const nextEntries = upsertTrackedFixedExpense(existingFixedExpenses?.entries ?? null, {
      key: recurringKey,
      label,
      monthly: amount,
      due_day: dueDay,
      priority,
    })

    const { error: fixedExpensesUpsertError } = await (supabase.from('fixed_expenses') as any).upsert({
      user_id: user.id,
      cycle_id: cycleId,
      total_monthly: sumTrackedFixedExpenses(nextEntries),
      entries: nextEntries,
    }, { onConflict: 'user_id,cycle_id' })

    if (fixedExpensesUpsertError) {
      throw new Error(`Failed to save recurring setup: ${fixedExpensesUpsertError.message}`)
    }

    try {
      await rememberDictionaryItem(supabase, user.id, {
        categoryLabel: label,
        categoryKey: recurringKey,
        categoryType: 'fixed',
      })
    } catch (error) {
      console.error('[log/new] remember recurring item failed', error)
    }

    revalidatePath('/log')
    revalidatePath('/history')
    revalidatePath('/app')
    revalidatePath('/income')

    return ok(undefined)
  })
}
