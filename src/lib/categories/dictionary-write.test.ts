import { describe, expect, it } from 'vitest'
import { buildDictionaryCategoryWriteRecord } from './dictionary-write'

describe('buildDictionaryCategoryWriteRecord', () => {
  it('rejects unknown category keys', () => {
    expect(() =>
      buildDictionaryCategoryWriteRecord({
        nameNormalizedSource: 'Dog Food',
        categoryType: 'everyday',
        categoryKey: 'custom_dog_food',
        categoryLabel: 'Dog Food',
      })
    ).toThrow('Unknown category key: custom_dog_food')
  })

  it('stores canonical dictionary metadata', () => {
    expect(buildDictionaryCategoryWriteRecord({
      nameNormalizedSource: 'Home WiFi',
      categoryType: 'fixed',
      categoryKey: 'wifi',
      categoryLabel: 'Home WiFi',
    })).toEqual({
      nameNormalized: 'home wifi',
      label: 'Internet',
      categoryKey: 'internet',
      categoryType: 'fixed',
    })
  })
})
