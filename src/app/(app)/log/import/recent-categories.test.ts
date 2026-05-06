import { describe, expect, it } from 'vitest'
import {
  FREQUENT_CATEGORY_BASELINE_KEYS,
  RECENT_CATEGORY_MAX,
  RECENT_CATEGORY_STORAGE_KEY,
  dedupeRecentCategoryKeys,
  getFrequentCategoryOptions,
  getRecentCategoryOptions,
  loadRecentCategoryKeys,
  recordRecentCategoryKey,
} from './recent-categories'

function fakeStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map<string, string>(Object.entries(initial))
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? map.get(key) ?? null : null),
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    removeItem: (key: string) => {
      map.delete(key)
    },
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
  } as unknown as Storage
}

describe('dedupeRecentCategoryKeys', () => {
  it('removes duplicates while preserving order', () => {
    expect(dedupeRecentCategoryKeys(['a', 'b', 'a', 'c', 'b'])).toEqual(['a', 'b', 'c'])
  })

  it('caps the list at the max length', () => {
    const input = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    expect(dedupeRecentCategoryKeys(input)).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    expect(dedupeRecentCategoryKeys(input).length).toBe(RECENT_CATEGORY_MAX)
  })

  it('drops empty/falsy keys', () => {
    expect(dedupeRecentCategoryKeys(['a', '', 'b'])).toEqual(['a', 'b'])
  })
})

describe('recordRecentCategoryKey', () => {
  it('records the most-recent key first and dedupes', () => {
    const storage = fakeStorage()
    recordRecentCategoryKey('groceries', storage)
    recordRecentCategoryKey('transport', storage)
    recordRecentCategoryKey('groceries', storage)

    expect(loadRecentCategoryKeys(storage)).toEqual(['groceries', 'transport'])
  })

  it('persists JSON to the expected storage key', () => {
    const storage = fakeStorage()
    recordRecentCategoryKey('rent', storage)

    expect(storage.getItem(RECENT_CATEGORY_STORAGE_KEY)).toBe(JSON.stringify(['rent']))
  })

  it('caps stored history to the max length', () => {
    const storage = fakeStorage()
    const keys = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    for (const key of keys) recordRecentCategoryKey(key, storage)

    const stored = JSON.parse(storage.getItem(RECENT_CATEGORY_STORAGE_KEY) ?? '[]')
    expect(stored).toEqual(['h', 'g', 'f', 'e', 'd', 'c'])
    expect(stored.length).toBe(RECENT_CATEGORY_MAX)
  })

  it('returns an empty list when the key is empty', () => {
    const storage = fakeStorage()
    expect(recordRecentCategoryKey('', storage)).toEqual([])
  })
})

describe('loadRecentCategoryKeys', () => {
  it('returns an empty list when storage is missing or empty', () => {
    expect(loadRecentCategoryKeys(null)).toEqual([])
    expect(loadRecentCategoryKeys(fakeStorage())).toEqual([])
  })

  it('ignores corrupt JSON gracefully', () => {
    const storage = fakeStorage({ [RECENT_CATEGORY_STORAGE_KEY]: 'not-json' })
    expect(loadRecentCategoryKeys(storage)).toEqual([])
  })

  it('filters non-string entries from a stored array', () => {
    const storage = fakeStorage({
      [RECENT_CATEGORY_STORAGE_KEY]: JSON.stringify(['a', 1, null, 'b']),
    })
    expect(loadRecentCategoryKeys(storage)).toEqual(['a', 'b'])
  })
})

describe('getRecentCategoryOptions', () => {
  const groups = [
    {
      type: 'everyday' as const,
      label: 'Everyday',
      options: [
        { key: 'transport', label: 'Transport', type: 'everyday' as const },
        { key: 'groceries', label: 'Groceries', type: 'everyday' as const },
        { key: 'eatingOut', label: 'Eating out', type: 'everyday' as const },
      ],
    },
    {
      type: 'fixed' as const,
      label: 'Fixed',
      options: [
        { key: 'water', label: 'Water', type: 'fixed' as const },
        { key: 'rent', label: 'Rent', type: 'fixed' as const },
      ],
    },
  ]

  it('returns option configs in the recent order', () => {
    expect(
      getRecentCategoryOptions(['rent', 'transport'], groups).map((option) => option.key),
    ).toEqual(['rent', 'transport'])
  })

  it('hides options already shown elsewhere (e.g. Suggested)', () => {
    expect(
      getRecentCategoryOptions(
        ['rent', 'transport', 'groceries'],
        groups,
        new Set(['transport']),
      ).map((option) => option.key),
    ).toEqual(['rent', 'groceries'])
  })

  it('skips unknown keys without crashing', () => {
    expect(
      getRecentCategoryOptions(['unknown_key', 'water'], groups).map((option) => option.key),
    ).toEqual(['water'])
  })

  it('respects the max cap', () => {
    expect(
      getRecentCategoryOptions(
        ['transport', 'groceries', 'eatingOut', 'water', 'rent'],
        groups,
        new Set(),
        2,
      ).map((option) => option.key),
    ).toEqual(['transport', 'groceries'])
  })
})

describe('getFrequentCategoryOptions', () => {
  const groups = [
    {
      type: 'everyday' as const,
      label: 'Everyday',
      options: [
        { key: 'groceries', label: 'Groceries', type: 'everyday' as const },
        { key: 'transport', label: 'Transport', type: 'everyday' as const },
        { key: 'eatingOut', label: 'Eating out', type: 'everyday' as const },
        { key: 'fuel', label: 'Fuel', type: 'everyday' as const },
      ],
    },
    {
      type: 'fixed' as const,
      label: 'Fixed',
      options: [
        { key: 'rent', label: 'Rent', type: 'fixed' as const },
        { key: 'internet', label: 'Internet', type: 'fixed' as const },
        { key: 'water', label: 'Water', type: 'fixed' as const },
      ],
    },
  ]

  it('returns baseline categories when the user has no recent picks', () => {
    expect(
      getFrequentCategoryOptions([], groups).map((option) => option.key),
    ).toEqual(FREQUENT_CATEGORY_BASELINE_KEYS)
  })

  it('puts recent picks before baseline defaults', () => {
    expect(
      getFrequentCategoryOptions(['water'], groups).map((option) => option.key),
    ).toEqual(['water', 'groceries', 'transport', 'eatingOut', 'rent', 'internet'])
  })

  it('dedupes a recent pick that also appears in the baseline', () => {
    expect(
      getFrequentCategoryOptions(['rent', 'transport'], groups).map((option) => option.key),
    ).toEqual(['rent', 'transport', 'groceries', 'eatingOut', 'internet', 'fuel'])
  })

  it('hides keys already shown in Suggested', () => {
    expect(
      getFrequentCategoryOptions(
        ['water'],
        groups,
        new Set(['transport']),
      ).map((option) => option.key),
    ).toEqual(['water', 'groceries', 'eatingOut', 'rent', 'internet', 'fuel'])
  })

  it('caps the returned list at the requested max', () => {
    expect(
      getFrequentCategoryOptions(['water'], groups, new Set(), 3).map((option) => option.key),
    ).toEqual(['water', 'groceries', 'transport'])
  })

  it('skips unknown keys without crashing', () => {
    expect(
      getFrequentCategoryOptions(['unknown_key', 'water'], groups).map((option) => option.key),
    ).toEqual(['water', 'groceries', 'transport', 'eatingOut', 'rent', 'internet'])
  })
})
