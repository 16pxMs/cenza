import type { CategoryType } from '@/types/database'
import { getCategoriesByType, type CategoryConfig } from './config'

export type CategoryOptionType = Extract<CategoryType, 'everyday' | 'fixed' | 'debt' | 'goal'>

export interface CategoryOptionGroup {
  type: CategoryOptionType
  label: string
  options: CategoryConfig[]
}

const CATEGORY_GROUP_LABELS: Record<CategoryOptionType, string> = {
  everyday: 'Everyday',
  fixed: 'Fixed',
  debt: 'Debt',
  goal: 'Goals',
}

export function getGroupedCategoryOptions(
  types: CategoryOptionType[] = ['everyday', 'fixed', 'debt', 'goal']
): CategoryOptionGroup[] {
  return types.map((type) => ({
    type,
    label: CATEGORY_GROUP_LABELS[type],
    options: getCategoriesByType(type),
  })).filter((group) => group.options.length > 0)
}

