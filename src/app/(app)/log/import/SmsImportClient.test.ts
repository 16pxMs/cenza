import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const importSource = readFileSync('src/app/(app)/log/import/SmsImportClient.tsx', 'utf8')
const globalAddSource = readFileSync('src/components/layout/GlobalAddButton.tsx', 'utf8')
const legacyFirstSource = readFileSync('src/app/(app)/log/first/page.tsx', 'utf8')
const logPageSource = readFileSync('src/app/(app)/log/LogPageClient.tsx', 'utf8')

describe('SMS import expense entry surface', () => {
  it('does not render the manual-entry doorway from the import screen', () => {
    expect(importSource).not.toContain('Add manually')
    expect(importSource).not.toContain('isOther=true')
  })

  it('keeps the paste/import-first experience as the surfaced add-expense path', () => {
    expect(importSource).toContain('<textarea')
    expect(importSource).toContain('Paste your messages')
    expect(importSource).toContain('Continue')
    expect(importSource).not.toContain('See my expenses')
  })

  it('has a true cancel path that clears pasted input and reviewed rows', () => {
    expect(importSource).toContain('Cancel')
    expect(importSource).toContain('Cancel import?')
    expect(importSource).toContain('requestCancelImport')
    expect(importSource).toContain("setRawText('')")
    expect(importSource).toContain('setRows([])')
    expect(importSource).toContain('setParseMeta({ scanned: 0, skippedCredits: 0 })')
  })

  it('routes default add-entry affordances to import while preserving manual route infrastructure elsewhere', () => {
    expect(globalAddSource).toContain('/log/import?returnTo=')
    expect(legacyFirstSource).toContain('/log/import?returnTo=/app')
    expect(logPageSource).toContain('/log/import?returnTo=/log')
  })
})
