import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const commitmentsSource = readFileSync('src/app/(app)/commitments/CommitmentsPageClient.tsx', 'utf8')
const overviewSource = readFileSync('src/components/flows/overview/OverviewWithData.tsx', 'utf8')
const overviewCommitmentsCardSource = overviewSource.slice(
  overviewSource.indexOf('const obligationsPreviewCard'),
  overviewSource.indexOf('// ── Render')
)

describe('commitments page guardrails', () => {
  it('does not render unsupported snooze or paused placeholder actions', () => {
    expect(commitmentsSource).not.toContain('Snooze')
    expect(commitmentsSource).not.toContain('Pause')
    expect(commitmentsSource).not.toContain('Paused')
    expect(commitmentsSource).not.toContain('No paused commitments')
  })

  it('does not render filler empty states for every section', () => {
    expect(commitmentsSource).not.toContain('No commitments due soon.')
    expect(commitmentsSource).not.toContain('No active recurring expenses.')
    expect(commitmentsSource).not.toContain('No reminder-only items.')
    expect(commitmentsSource).toContain('Nothing to track yet')
  })

  it('keeps supported actions scoped to their real flows', () => {
    expect(commitmentsSource).toContain('/income/fixed?returnTo=/commitments')
    expect(commitmentsSource).toContain('updateMonthlyReminder')
    expect(commitmentsSource).toContain('removeMonthlyReminder')
    expect(commitmentsSource).toContain('Edit reminder')
    expect(commitmentsSource).toContain('Delete reminder')
    expect(commitmentsSource).not.toContain('rowActionStyle')
    expect(commitmentsSource).not.toContain('Monthly reminder')
  })

  it('keeps the overview card as a commitments doorway without overpromising management', () => {
    expect(overviewSource).toContain("const COMMITMENTS_ROUTE = '/commitments'")
    expect(overviewSource).toContain('aria-label="View commitments"')
    expect(overviewSource).toContain('View all')
    expect(overviewSource).not.toContain('Manage all reminders')
  })

  it('keeps the overview commitments card compact without duplicate footer metadata', () => {
    expect(overviewSource).toContain('Nothing due soon')
    expect(overviewSource).toContain('active monthly')
    expect(overviewCommitmentsCardSource).not.toContain("borderTop: '1px solid var(--border-subtle)'")
    expect(overviewCommitmentsCardSource).not.toContain('active {commitmentSummary.activeCount')
  })
})
