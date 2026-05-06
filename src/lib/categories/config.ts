import type { CategoryType } from '../../types/database'
import {
  CATEGORY_ALIASES as CATEGORY_ALIASES_DATA,
  CATEGORY_CONFIG as CATEGORY_CONFIG_DATA,
  LEGACY_CATEGORY_KEY_MAP as LEGACY_CATEGORY_KEY_MAP_DATA,
  getCategoriesByType as getCategoriesByTypeData,
  getCategoryConfig as getCategoryConfigData,
  getCategoryLabel as getCategoryLabelData,
  getCategoryTypeFromKey as getCategoryTypeFromKeyData,
  isKnownCategoryKey as isKnownCategoryKeyData,
  resolveCategoryKey as resolveCategoryKeyData,
} from './config-data.js'

export interface CategoryConfig {
  key: string
  label: string
  type: CategoryType
}

export const CATEGORY_CONFIG = CATEGORY_CONFIG_DATA as Record<string, CategoryConfig>
export const CATEGORY_ALIASES = CATEGORY_ALIASES_DATA as Record<string, string>
export const LEGACY_CATEGORY_KEY_MAP = LEGACY_CATEGORY_KEY_MAP_DATA as Record<string, string>

export const resolveCategoryKey = resolveCategoryKeyData as (key: string | null | undefined) => string | null
export const getCategoryConfig = getCategoryConfigData as (key: string | null | undefined) => CategoryConfig | null
export const getCategoryLabel = getCategoryLabelData as (key: string | null | undefined, fallback?: string) => string
export const getCategoryTypeFromKey = getCategoryTypeFromKeyData as (
  key: string | null | undefined,
  fallback?: CategoryType
) => CategoryType | null
export const isKnownCategoryKey = isKnownCategoryKeyData as (key: string | null | undefined) => boolean
export const getCategoriesByType = getCategoriesByTypeData as (type: CategoryType) => CategoryConfig[]
