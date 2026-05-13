import type { CategoryType, CustomCategory } from '@/types/database'
import { getCategoryConfig, getCategoriesByType, resolveCategoryKey, type CategoryConfig } from './config'
import { canonicalizeFixedBillKey } from '@/lib/fixed-bills/canonical'

export type CustomCategoryType = Extract<CategoryType, 'everyday' | 'fixed'>

export interface CategoryOption extends CategoryConfig {
  customCategoryId: string | null
  source: 'canonical' | 'custom'
}

export interface ResolvedWriteCategory {
  categoryType: CategoryType
  categoryKey: string
  categoryLabel: string
  customCategoryId: string | null
}

export interface CategoryIdentityInput {
  category_key?: string | null
  category_label?: string | null
  category_type?: string | null
  custom_category_id?: string | null
}

function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

export function slugifyCustomCategoryLabel(value: string) {
  return normalizeLabel(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function normalizeCustomCategoryType(value: string | null | undefined): CustomCategoryType | null {
  if (value === 'everyday' || value === 'fixed') return value
  return null
}

export function customCategoryToOption(category: Pick<CustomCategory, 'id' | 'key' | 'label' | 'type'>): CategoryOption {
  return {
    key: category.key,
    label: category.label,
    type: category.type,
    customCategoryId: category.id,
    source: 'custom',
  }
}

export function canonicalCategoryToOption(category: CategoryConfig): CategoryOption {
  return {
    ...category,
    customCategoryId: null,
    source: 'canonical',
  }
}

export function combineCategoryOptions(
  types: Array<Extract<CategoryType, 'everyday' | 'fixed' | 'debt' | 'goal'>>,
  customCategories: CustomCategory[] = []
) {
  return types.map((type) => ({
    type,
    label: type === 'fixed' ? 'Fixed' : type === 'debt' ? 'Debt' : type === 'goal' ? 'Goals' : 'Everyday',
    options: [
      ...getCategoriesByType(type).map(canonicalCategoryToOption),
      ...customCategories
        .filter((category) => category.type === type && !category.archived_at)
        .map(customCategoryToOption),
    ],
  })).filter((group) => group.options.length > 0)
}

export async function loadActiveCustomCategories(
  supabase: any,
  userId: string
): Promise<CustomCategory[]> {
  const { data, error } = await (supabase.from('custom_categories') as any)
    .select('id,user_id,key,label,type,archived_at,created_at,updated_at')
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('label', { ascending: true })

  if (error) {
    throw new Error(`Failed to load custom categories: ${error.message}`)
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    user_id: String(row.user_id),
    key: String(row.key),
    label: String(row.label),
    type: normalizeCustomCategoryType(row.type) ?? 'everyday',
    archived_at: row.archived_at ?? null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  }))
}

export async function loadCustomCategoryMap(
  supabase: any,
  userId: string,
  ids: string[]
): Promise<Map<string, CustomCategory>> {
  const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)))
  if (uniqueIds.length === 0) return new Map()

  const { data, error } = await (supabase.from('custom_categories') as any)
    .select('id,user_id,key,label,type,archived_at,created_at,updated_at')
    .eq('user_id', userId)
    .in('id', uniqueIds)

  if (error) {
    throw new Error(`Failed to load custom categories: ${error.message}`)
  }

  return new Map(
    (data ?? []).map((row: any) => {
      const category: CustomCategory = {
        id: String(row.id),
        user_id: String(row.user_id),
        key: String(row.key),
        label: String(row.label),
        type: normalizeCustomCategoryType(row.type) ?? 'everyday',
        archived_at: row.archived_at ?? null,
        created_at: String(row.created_at ?? ''),
        updated_at: String(row.updated_at ?? ''),
      }
      return [category.id, category] as const
    })
  )
}

export function resolveCanonicalCategoryForWrite(input: {
  categoryType: CategoryType
  categoryKey: string
  categoryLabel?: string | null
}): ResolvedWriteCategory {
  const rawKey = input.categoryKey.trim()
  if (!rawKey) {
    throw new Error('Category key is required')
  }

  if (input.categoryType === 'goal') {
    const knownGoalCategory = getCategoryConfig(rawKey)
    if (knownGoalCategory?.type === 'goal') {
      return {
        categoryType: knownGoalCategory.type,
        categoryKey: knownGoalCategory.key,
        categoryLabel: knownGoalCategory.label,
        customCategoryId: null,
      }
    }

    return {
      categoryType: 'goal',
      categoryKey: rawKey,
      categoryLabel: input.categoryLabel?.trim() || rawKey,
      customCategoryId: null,
    }
  }

  const normalizedKey =
    input.categoryType === 'fixed'
      ? canonicalizeFixedBillKey(rawKey)
      : rawKey

  const resolvedKey = resolveCategoryKey(normalizedKey)
  if (!resolvedKey) {
    throw new Error(`Unknown category key: ${rawKey}`)
  }

  const config = getCategoryConfig(resolvedKey)
  if (!config) {
    throw new Error(`Unknown category key: ${rawKey}`)
  }

  return {
    categoryType: config.type,
    categoryKey: config.key,
    categoryLabel: config.label,
    customCategoryId: null,
  }
}

export function resolveCustomCategoryForWrite(category: CustomCategory): ResolvedWriteCategory {
  if (category.archived_at) {
    throw new Error('Custom category is archived')
  }

  return {
    categoryType: category.type,
    categoryKey: category.key,
    categoryLabel: category.label,
    customCategoryId: category.id,
  }
}

export function resolveTransactionCategoryIdentity(row: CategoryIdentityInput) {
  const customId = typeof row.custom_category_id === 'string' ? row.custom_category_id.trim() : ''
  const key = typeof row.category_key === 'string' ? row.category_key.trim() : ''
  return customId ? `custom:${customId}` : key
}
