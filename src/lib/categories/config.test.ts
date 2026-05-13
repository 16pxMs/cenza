import { describe, expect, it } from 'vitest'
import {
  CATEGORY_ALIASES,
  CATEGORY_CONFIG,
  LEGACY_CATEGORY_KEY_MAP,
  getCategoriesByType,
  getCategoryConfig,
  getCategoryLabel,
  getCategoryTypeFromKey,
  isKnownCategoryKey,
  resolveCategoryKey,
} from './config'

describe('category config', () => {
  it('maps transport to everyday', () => {
    expect(getCategoryConfig('transport')).toEqual({
      key: 'transport',
      label: 'Transport',
      type: 'everyday',
    })
  })

  it('maps rent to fixed', () => {
    expect(getCategoryTypeFromKey('rent')).toBe('fixed')
  })

  it('maps debt_repayment to debt', () => {
    expect(getCategoryTypeFromKey('debt_repayment')).toBe('debt')
  })

  it('keeps debt opening balance canonical while presenting it as money I owe', () => {
    expect(getCategoryConfig('debt_opening_balance')).toEqual({
      key: 'debt_opening_balance',
      label: 'Money I owe',
      type: 'debt',
    })
    expect(getCategoryLabel('debt_opening_balance', 'Fallback label')).toBe('Money I owe')
  })

  it('maps medicine to everyday', () => {
    expect(getCategoryConfig('medicine')).toEqual({
      key: 'medicine',
      label: 'Medicine',
      type: 'everyday',
    })
    expect(getCategoryTypeFromKey('medicine')).toBe('everyday')
  })

  it('maps emergency to goal', () => {
    expect(getCategoryConfig('emergency')).toEqual({
      key: 'emergency',
      label: 'Emergency fund',
      type: 'goal',
    })
    expect(getCategoryTypeFromKey('emergency')).toBe('goal')
  })

  it('maps family to goal', () => {
    expect(getCategoryConfig('family')).toEqual({
      key: 'family',
      label: 'Family',
      type: 'goal',
    })
    expect(getCategoryTypeFromKey('family')).toBe('goal')
  })

  it('keeps family_support as the canonical support spending category', () => {
    expect(getCategoryConfig('family_support')).toEqual({
      key: 'family_support',
      label: 'Family support',
      type: 'everyday',
    })
    expect(getCategoryTypeFromKey('family_support')).toBe('everyday')
  })

  it('returns fallback for unknown keys', () => {
    expect(getCategoryLabel('unknown_key', 'Fallback label')).toBe('Fallback label')
    expect(getCategoryTypeFromKey('unknown_key', 'other')).toBe('other')
  })

  it('returns everyday categories by type', () => {
    const categories = getCategoriesByType('everyday')

    expect(categories.some((category) => category.key === 'transport')).toBe(true)
    expect(categories.every((category) => category.type === 'everyday')).toBe(true)
  })

  it('resolves aliases without changing canonical keys', () => {
    expect(resolveCategoryKey('wifi')).toBe('internet')
    expect(getCategoryConfig('wifi')).toEqual(CATEGORY_CONFIG.internet)
    expect(CATEGORY_ALIASES.house_help).toBe('housekeeping')
  })

  it('treats blackTax as legacy-only and resolves it to family_support', () => {
    expect(resolveCategoryKey('blackTax')).toBe('family_support')
    expect(resolveCategoryKey('black_tax')).toBe('family_support')
  })

  it('resolves legacy transport keys', () => {
    expect(resolveCategoryKey('uber')).toBe('transport')
    expect(resolveCategoryKey('boda')).toBe('transport')
  })

  it('resolves legacy snake_case and dirty keys', () => {
    expect(resolveCategoryKey('eating_out')).toBe('eatingOut')
    expect(resolveCategoryKey('chat_gpt')).toBe('subscriptions')
    expect(resolveCategoryKey('skin_care')).toBe('beauty')
    expect(resolveCategoryKey('tennis')).toBe('sports')
    expect(resolveCategoryKey('houseKeeping')).toBe('housekeeping')
    expect(resolveCategoryKey('credit_card')).toBe('debt_repayment')
  })

  it('resolves additional conservative legacy keys', () => {
    expect(resolveCategoryKey('hardware')).toBe('tools')
    expect(resolveCategoryKey('accessories')).toBe('shopping')
    expect(resolveCategoryKey('school_trip')).toBe('schoolFees')
    expect(resolveCategoryKey('school_fees')).toBe('schoolFees')
  })

  it('resolves the latest safe grocery, tools, shopping, and family mappings', () => {
    expect(resolveCategoryKey('groceries_eggs')).toBe('groceries')
    expect(resolveCategoryKey('spent_on_groceries')).toBe('groceries')
    expect(resolveCategoryKey('plier_tool')).toBe('tools')
    expect(resolveCategoryKey('screw_for_socket')).toBe('tools')
    expect(resolveCategoryKey('45v_switch_and_electrical_tape')).toBe('tools')
    expect(resolveCategoryKey('pot_plants_part_payment')).toBe('shopping')
    expect(resolveCategoryKey('philippa')).toBe('family_support')
    expect(resolveCategoryKey('wanjiku_wanjohi')).toBe('family_support')
  })

  it('reports whether a key is known', () => {
    expect(isKnownCategoryKey('internet')).toBe(true)
    expect(isKnownCategoryKey('wifi')).toBe(true)
    expect(isKnownCategoryKey('totally_unknown')).toBe(false)
  })

  it('keeps unrelated unknown random keys unresolved', () => {
    expect(resolveCategoryKey('totally_random_label')).toBeNull()
  })

  it('exposes legacy map entries explicitly', () => {
    expect(LEGACY_CATEGORY_KEY_MAP.uber).toBe('transport')
    expect(LEGACY_CATEGORY_KEY_MAP.chat_gpt).toBe('subscriptions')
    expect(LEGACY_CATEGORY_KEY_MAP.blackTax).toBe('family_support')
  })
})
