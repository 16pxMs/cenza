import { describe, expect, it } from 'vitest'
import { buildCategoryMigrationPlan, buildCategoryMigrationPreviewRow } from './migration-plan'

describe('category migration plan', () => {
  it('keeps valid rows as valid', () => {
    const row = buildCategoryMigrationPreviewRow({
      id: 'txn-1',
      category_type: 'everyday',
      category_key: 'transport',
      category_label: 'Transport',
    })

    expect(row.bucket).toBe('valid')
    expect(row.proposed).toEqual({
      type: 'everyday',
      key: 'transport',
      label: 'Transport',
    })
  })

  it('classifies alias keys as needs_key_fix', () => {
    const row = buildCategoryMigrationPreviewRow({
      id: 'txn-2',
      category_type: 'fixed',
      category_key: 'wifi',
      category_label: 'WiFi',
    })

    expect(row.bucket).toBe('needs_key_fix')
    expect(row.proposed).toEqual({
      type: 'fixed',
      key: 'internet',
      label: 'Internet',
    })
  })

  it('classifies type mismatches as needs_type_fix', () => {
    const row = buildCategoryMigrationPreviewRow({
      id: 'txn-3',
      category_type: 'essentials',
      category_key: 'transport',
      category_label: 'Transport',
    })

    expect(row.bucket).toBe('needs_type_fix')
    expect(row.proposed?.type).toBe('everyday')
  })

  it('classifies label mismatches as needs_label_fix', () => {
    const row = buildCategoryMigrationPreviewRow({
      id: 'txn-4',
      category_type: 'fixed',
      category_key: 'rent',
      category_label: 'House payment',
    })

    expect(row.bucket).toBe('needs_label_fix')
    expect(row.proposed?.label).toBe('Rent')
  })

  it('classifies legacy dirty keys as needs_key_fix when safely mapped', () => {
    const row = buildCategoryMigrationPreviewRow({
      id: 'txn-5',
      category_type: 'everyday',
      category_key: 'uber',
      category_label: 'Uber',
    })

    expect(row.bucket).toBe('needs_key_fix')
    expect(row.proposed).toEqual({
      type: 'everyday',
      key: 'transport',
      label: 'Transport',
    })
  })

  it('classifies blackTax rows toward family_support everyday spending', () => {
    const row = buildCategoryMigrationPreviewRow({
      id: 'txn-black-tax',
      category_type: 'fixed',
      category_key: 'blackTax',
      category_label: 'Family support',
    })

    expect(row.bucket).toBe('needs_key_fix')
    expect(row.proposed).toEqual({
      type: 'everyday',
      key: 'family_support',
      label: 'Family support',
    })
  })

  it('classifies unmapped keys as unknown', () => {
    const row = buildCategoryMigrationPreviewRow({
      id: 'txn-6',
      category_type: 'everyday',
      category_key: 'totally_random_label',
      category_label: 'Totally random label',
    })

    expect(row.bucket).toBe('unknown')
    expect(row.proposed).toBeNull()
  })

  it('builds summary and mapping table counts', () => {
    const report = buildCategoryMigrationPlan([
      { id: '1', category_type: 'fixed', category_key: 'wifi', category_label: 'WiFi' },
      { id: '2', category_type: 'essentials', category_key: 'transport', category_label: 'Transport' },
      { id: '3', category_type: 'everyday', category_key: 'transport', category_label: 'Transport' },
    ])

    expect(report.summary.find((row) => row.bucket === 'needs_key_fix')?.count).toBe(1)
    expect(report.summary.find((row) => row.bucket === 'needs_type_fix')?.count).toBe(1)
    expect(report.summary.find((row) => row.bucket === 'valid')?.count).toBe(1)
    expect(report.mappingTable.some((row) => row.changeType === 'key' && row.from === 'wifi' && row.to === 'internet')).toBe(true)
    expect(report.mappingTable.some((row) => row.changeType === 'type' && row.from === 'essentials' && row.to === 'everyday')).toBe(true)
  })
})
