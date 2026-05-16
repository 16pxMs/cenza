import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const emptyStateSource = readFileSync('src/components/flows/overview/OverviewEmptyState.tsx', 'utf8')
const emptyStateCss = readFileSync('src/components/flows/overview/OverviewEmptyState.module.css', 'utf8')
const appClientSource = readFileSync('src/app/(app)/app/AppPageClient.tsx', 'utf8')
const overviewSource = readFileSync('src/components/flows/overview/OverviewWithData.tsx', 'utf8')

describe('OverviewEmptyState add-expense CTA', () => {
  it('renders an in-card primary Add expense CTA for the empty overview', () => {
    expect(emptyStateSource).toContain('Ready to get started?')
    expect(emptyStateSource).toContain('Add your first expense to see where your money goes.')
    expect(emptyStateSource).toContain('+ Add expense')
    expect(emptyStateSource).toContain('<PrimaryBtn')
  })

  it('opens the shared Add expense choice from the in-card CTA with the app return path', () => {
    expect(emptyStateSource).toContain('AddExpenseChoiceSheet')
    expect(emptyStateSource).toContain('onClick={() => setAddExpenseChoiceOpen(true)}')
    expect(emptyStateSource).toContain('returnTo="/app"')
    expect(appClientSource).toContain('<GlobalAddButton returnTo="/app" />')
  })

  it('keeps the FAB separate from the empty overview card', () => {
    expect(emptyStateSource).not.toContain('GlobalAddButton')
    expect(appClientSource).toContain('GlobalAddButton')
  })

  it('defines a desktop split-card layout and mobile-safe stacked layout', () => {
    expect(emptyStateSource).toContain('styles.spendingSplit')
    expect(emptyStateSource).toContain('styles.spendingCta')
    expect(emptyStateCss).toContain('grid-template-columns: minmax(0, 1fr) minmax(220px, 0.82fr)')
    expect(emptyStateCss).toContain('border-left: var(--border-width) solid var(--border-subtle)')
    expect(emptyStateCss).toContain('@media (max-width: 640px)')
    expect(emptyStateCss).toContain('grid-template-columns: 1fr')
    expect(emptyStateCss).toContain('border-top: var(--border-width) solid var(--border-subtle)')
  })

  it('keeps category preview and goal card copy unchanged', () => {
    expect(emptyStateSource).toContain('Category preview')
    expect(emptyStateSource).toContain('We’ll organize your entries here automatically.')
    expect(emptyStateSource).toContain('Set up your first goal')
    expect(emptyStateSource).toContain('Add your first goal')
  })

  it('limits the empty-state component to the empty overview branch', () => {
    const emptyBranch = overviewSource.indexOf('!hasStartedCycleData')
    const emptyComponent = overviewSource.indexOf('<OverviewEmptyState', emptyBranch)
    expect(emptyBranch).toBeGreaterThan(-1)
    expect(emptyComponent).toBeGreaterThan(emptyBranch)
  })
})

describe('OverviewWithData new-user card states', () => {
  it('softens the largest-expenses title when only one or two categories are available', () => {
    expect(overviewSource).toContain(
      "{topOutflowCategories.length <= 2 ? 'Spending so far' : 'Your largest expenses this month'}"
    )
  })

  it('hides the Upcoming commitments card when there are no commitments to show', () => {
    expect(overviewSource).toContain(
      "const hasCommitmentsToShow =\n    !!commitmentSummary && commitmentSummary.state !== 'empty'"
    )
    expect(overviewSource).toContain('const hasCommitmentsAreaToShow = hasCommitmentsToShow || hasDebtSummary')
    expect(overviewSource).toContain('const obligationsPreviewCard = !hasCommitmentsAreaToShow ? null : (')
    expect(overviewSource).not.toContain("'No recurring commitments yet'")
    expect(overviewSource).not.toContain("'Turn reminders on for recurring expenses'")
  })

  it('makes the rendered commitments card a full-card button when commitments exist', () => {
    const cardStart = overviewSource.indexOf('const obligationsPreviewCard = !hasCommitmentsAreaToShow ? null : (')
    const cardEnd = overviewSource.indexOf('// ── Render', cardStart)
    expect(cardStart).toBeGreaterThan(-1)
    expect(cardEnd).toBeGreaterThan(cardStart)
    const cardSource = overviewSource.slice(cardStart, cardEnd)

    expect(cardSource).toContain('<button')
    expect(cardSource).toContain('aria-label="View commitments"')
    expect(cardSource).toContain('onClick={() => router.push(COMMITMENTS_ROUTE)}')
    expect(cardSource).toContain("width: '100%'")
    expect(cardSource).toContain('<ChevronRight size={12}')
    expect(cardSource).not.toContain('View all')
    expect(cardSource).not.toContain('role="button"')
  })

  it('renders active debt visibility in the overview commitments area', () => {
    expect(overviewSource).toContain("const DEBTS_ROUTE = '/history/debt'")
    expect(overviewSource).toContain("debt.status === 'active' && Number(debt.current_balance) > 0")
    expect(overviewSource).toContain('Number(b.current_balance) - Number(a.current_balance)')
    expect(overviewSource).toContain('const debtPreviewRows = activeDebtRows.slice(0, 3)')
    expect(overviewSource).toContain('Money you owe')
    expect(overviewSource).toContain('View debts')
    expect(overviewSource).toContain('onClick={() => router.push(DEBTS_ROUTE)}')
    expect(overviewSource).toContain('+{hiddenDebtCount} more')
  })

  it('does not let deferred secondary overview data wipe critical debt rows', () => {
    // Reconciliation is now memoized so AppPageClient re-renders (sheets,
    // navigation toggles, etc.) don't re-walk the debt list each time. The
    // dedup-by-id logic is preserved: critical rows are seeded first, then
    // secondary rows overwrite on the same id.
    expect(appClientSource).toContain('const activeDebts = useMemo(() => {')
    expect(appClientSource).toContain('const byId = new Map(overview.activeDebts.map((debt) => [debt.id, debt]))')
    expect(appClientSource).toContain('for (const debt of secondaryOverview?.activeDebts ?? [])')
    expect(appClientSource).toContain('}, [overview.activeDebts, secondaryOverview?.activeDebts])')
    expect(appClientSource).toContain('const debtTotal = useMemo(')
    expect(appClientSource).toContain('activeDebts={activeDebts}')
    expect(appClientSource).toContain('debtTotal={debtTotal}')
  })

  it('combines commitments and debts in one obligations card', () => {
    const cardStart = overviewSource.indexOf('const obligationsPreviewCard = !hasCommitmentsAreaToShow ? null : (')
    const cardEnd = overviewSource.indexOf('// ── Render', cardStart)
    const cardSource = overviewSource.slice(cardStart, cardEnd)

    expect(cardSource).toContain('hasCommitmentsToShow && !hasDebtSummary')
    expect(cardSource).toContain('Upcoming commitments')
    expect(cardSource).toContain('{debtSummarySection}')
    expect(overviewSource).toContain("borderTop: hasCommitmentsToShow ? '1px solid var(--border-subtle)' : 'none'")
  })

  it('replaces the empty goals body with the first-time goal CTA and copy', () => {
    expect(overviewSource).toContain('const goalsPreviewCard = totalGoals === 0 ? (')
    expect(overviewSource).toContain('Set up your first goal')
    expect(overviewSource).toContain('Give your money a purpose.')
    expect(overviewSource).toContain('Whether it is school fees, an emergency fund, or something else. Set a goal and track it here.')
    expect(overviewSource).toContain("router.push('/goals/new?from=overview')")
    expect(overviewSource).toContain('Add your first goal')
    expect(overviewSource).not.toContain('You have no goals yet.')
  })

  it('still renders the standard goals preview when the user has goals', () => {
    expect(overviewSource).toContain('{totalGoals > 0 ? (')
    expect(overviewSource).toContain("router.push('/goals')")
    expect(overviewSource).toContain('You have no active goals.')
  })
})
