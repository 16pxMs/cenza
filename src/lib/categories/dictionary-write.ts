import type { CategoryType } from '@/types/database'
import { resolveTransactionCategoryForWrite } from '@/lib/supabase/transactions-db'

export interface DictionaryCategoryWriteInput {
  nameNormalizedSource: string
  categoryType: CategoryType
  categoryKey: string
  categoryLabel?: string | null
}

export interface DictionaryCategoryWriteRecord {
  nameNormalized: string
  label: string
  categoryKey: string
  categoryType: CategoryType
}

function normalizeDictionaryName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function buildDictionaryCategoryWriteRecord(
  input: DictionaryCategoryWriteInput
): DictionaryCategoryWriteRecord {
  const nameNormalized = normalizeDictionaryName(input.nameNormalizedSource)
  if (!nameNormalized) {
    throw new Error('Dictionary name is required')
  }

  const category = resolveTransactionCategoryForWrite({
    categoryType: input.categoryType,
    categoryKey: input.categoryKey,
    categoryLabel: input.categoryLabel,
  })

  return {
    nameNormalized,
    label: category.categoryLabel,
    categoryKey: category.categoryKey,
    categoryType: category.categoryType,
  }
}
