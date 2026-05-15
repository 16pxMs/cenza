import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const importSource = readFileSync('src/app/(app)/log/import/SmsImportClient.tsx', 'utf8')
const globalAddSource = readFileSync('src/components/layout/GlobalAddButton.tsx', 'utf8')
const legacyFirstSource = readFileSync('src/app/(app)/log/first/page.tsx', 'utf8')
const logPageSource = readFileSync('src/app/(app)/log/LogPageClient.tsx', 'utf8')
const legacyNewSource = readFileSync('src/app/(app)/log/new/page.tsx', 'utf8')
const historySource = readFileSync('src/app/(app)/history/HistoryPageClient.tsx', 'utf8')
const successSource = readFileSync('src/components/flows/log/ExpenseAddedSuccess.tsx', 'utf8')
const addChoiceSource = readFileSync('src/components/flows/log/AddExpenseChoiceSheet.tsx', 'utf8')
const addChoiceCss = readFileSync('src/components/flows/log/AddExpenseChoiceSheet.module.css', 'utf8')

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

  it('routes default add-entry affordances to import', () => {
    expect(globalAddSource).toContain('AddExpenseChoiceSheet')
    expect(legacyFirstSource).toContain('/log/import?returnTo=/app')
    expect(logPageSource).toContain('/log/import?returnTo=/log')
    expect(addChoiceSource).toContain('/log/import?returnTo=')
    expect(globalAddSource).not.toContain('mode=past')
  })

  it('shows current and past choices from Add expense entry points', () => {
    expect(addChoiceSource).toContain('Add a recent expense')
    expect(addChoiceSource).toContain('Track something you spent today or this month.')
    expect(addChoiceSource).toContain('Add older expenses')
    expect(addChoiceSource).toContain('Bring in expenses from previous months or another app.')
    expect(addChoiceSource).not.toContain('Add current expense')
    expect(addChoiceSource).not.toContain('Import past expenses')
    expect(addChoiceSource).toContain("buildExpenseImportHref(returnTo, mode)")
    expect(addChoiceSource).toContain("if (mode === 'past') return `/log/import?mode=past&returnTo=${encodedReturnTo}`")
    expect(addChoiceSource).toContain('return `/log/import?returnTo=${encodedReturnTo}`')
    expect(addChoiceSource).toContain('className={styles.optionCard}')
    expect(addChoiceSource).toContain('<Sheet open={open} onClose={onClose} title="Add expense">')
    expect(globalAddSource).toContain('onClick={() => setChoiceOpen(true)}')
    expect(historySource).toContain('onClick={() => setAddExpenseChoiceOpen(true)}')
  })

  it('uses responsive option-card styling instead of stacked plain buttons', () => {
    expect(addChoiceCss).toContain('.optionCard')
    expect(addChoiceCss).toContain('grid-template-columns: auto minmax(0, 1fr) auto')
    expect(addChoiceCss).toContain('@media (max-width: 640px)')
    expect(addChoiceSource).not.toContain('<PrimaryBtn')
    expect(addChoiceSource).not.toContain('<SecondaryBtn')
    expect(addChoiceSource).not.toContain('variant="bottom"')
  })

  it('surfaces past import from history recap even when recap has data without changing normal add expense routes', () => {
    const importCtaIndex = historySource.indexOf('Import past expenses')
    const summaryBranchIndex = historySource.indexOf("viewMode === 'summary'")
    const emptyHistoryIndex = historySource.indexOf('data.expenseCount === 0')

    expect(importCtaIndex).toBeGreaterThan(-1)
    expect(summaryBranchIndex).toBeGreaterThan(importCtaIndex)
    expect(emptyHistoryIndex).toBeGreaterThan(importCtaIndex)
    expect(historySource).toContain('Import past expenses')
    expect(historySource).toContain('Add older expenses from another app, spreadsheet, or notes.')
    expect(historySource).toContain("router.push('/log/import?mode=past&returnTo=/history')")
    expect(historySource).toContain('AddExpenseChoiceSheet')
    expect(historySource).toContain('returnTo={currentCycleRoute}')
  })

  it('offers a dismissible past-import prompt after saving a normal expense for returning users too', () => {
    expect(successSource).toContain('Have older expenses?')
    expect(successSource).toContain('Add expenses from previous months so your history starts complete.')
    expect(successSource).toContain('Import past expenses')
    expect(successSource).toContain('Skip for now')
    expect(successSource).toContain('pastImportPromptDismissed')
    expect(importSource).toContain("onImportPast={() => router.push('/log/import?mode=past&returnTo=/app')}")
    expect(importSource).toContain('showPastImportPrompt={!isPastMode}')
    expect(importSource).not.toContain('showPastImportPrompt={isFirst')
    expect(importSource).not.toContain('showPastImportPrompt={savedCount === 1')
  })

  it('redirects legacy manual entry URLs into SMS import', () => {
    expect(legacyNewSource).toContain('redirect(`/log/import?returnTo=${encodeURIComponent(returnTo)}`)')
    expect(legacyNewSource).not.toContain('NewExpenseClient')
    expect(legacyNewSource).not.toContain('Suspense')
  })

  it('keeps custom category creation out of the default picker state', () => {
    expect(importSource).toContain("type CategoryBrowserMode = 'select' | 'create'")
    expect(importSource).toContain("categoryBrowserMode === 'select'")
    expect(importSource).toContain("categoryBrowserMode === 'create'")
    expect(importSource).toContain('+ Create category')
    expect(importSource).toContain('<SecondaryBtn size="lg" onClick={openCreateCategoryMode}>')
    expect(importSource).not.toContain("Select a category and we&apos;ll return you to this entry.")
  })

  it('keeps category creation focused and defaults SMS-created categories to everyday', () => {
    expect(importSource).toContain("createSmsCustomCategory({ label, type: 'everyday' })")
    expect(importSource).toContain('Save category')
    expect(importSource).toContain('Back')
    expect(importSource).toContain('autoFocus')
    expect(importSource).not.toContain('Create fixed category')
    expect(importSource).not.toContain('Create everyday category')
  })

  it('returns to selection after creating a category while keeping Continue as the picker CTA', () => {
    expect(importSource).toContain("setCategoryBrowserMode('select')")
    expect(importSource).toContain('setCategoryBrowserNotice(`${result.data.label} created`)')
    expect(importSource).toContain('Continue')
    expect(importSource).toContain('selectCategoryFromCreateMode(result.data)')
  })

  it('surfaces recent and matching categories before creating duplicates', () => {
    expect(importSource).toContain('recentCustomCategoryOptions')
    expect(importSource).toContain('createCategoryMatches')
    expect(importSource).toContain('exactCreateCategoryMatch')
    expect(importSource).toContain('Matching categories')
    expect(importSource).toContain('Recent custom categories')
    expect(importSource).toContain('selectCategoryFromCreateMode(option)')
  })

  it('hides Save category when an exact normalized category match exists', () => {
    expect(importSource).toContain('normalize(option.label) === normalizedCreateCategoryLabel')
    expect(importSource).toContain('{!exactCreateCategoryMatch ? (')
    expect(importSource).toContain("createSmsCustomCategory({ label, type: 'everyday' })")
  })

  it('separates review, edit details, and change category states for an entry', () => {
    expect(importSource).toContain("type EditStep = 'details' | 'category' | 'review' | 'changeCategory'")
    expect(importSource).toContain('openEditDetailsFromReview')
    expect(importSource).toContain('openChangeCategoryFromDetails')
    expect(importSource).toContain("setEditStep('changeCategory')")
    expect(importSource).toContain("setEditStep('details')")
    expect(importSource).toContain("setEditStep('review')")
    expect(importSource).toContain('Save changes')
    expect(importSource).toContain('onClick={openChangeCategoryFromDetails}')
  })

  it('orders edit details fields as Name, Amount, Category, Reminder', () => {
    const detailsBlockStart = importSource.indexOf("{editStep === 'details' && (")
    const detailsBlockEnd = importSource.indexOf("{editStep === 'category' && (", detailsBlockStart + 1)
    expect(detailsBlockStart).toBeGreaterThan(-1)
    expect(detailsBlockEnd).toBeGreaterThan(detailsBlockStart)
    const detailsBlock = importSource.slice(detailsBlockStart, detailsBlockEnd)

    const nameIdx = detailsBlock.indexOf('label="Name"')
    const amountIdx = detailsBlock.indexOf('label="Amount"')
    const categoryIdx = detailsBlock.indexOf('data-section="edit-details-category"')
    const reminderIdx = detailsBlock.indexOf('data-section="edit-details-reminder"')

    expect(nameIdx).toBeGreaterThan(-1)
    expect(amountIdx).toBeGreaterThan(nameIdx)
    expect(categoryIdx).toBeGreaterThan(amountIdx)
    expect(reminderIdx).toBeGreaterThan(categoryIdx)
  })

  it('renders the edit-details category action as a lightweight TertiaryBtn, not a SecondaryBtn', () => {
    expect(importSource).toContain('<TertiaryBtn size="md" onClick={openChangeCategoryFromDetails}>')
    expect(importSource).not.toContain('<SecondaryBtn size="md" onClick={openChangeCategoryFromDetails}>')
    expect(importSource).toContain("{editDraft.categoryKey ? 'Change' : 'Choose'}")
  })

  it('shows Not set and a Choose action when no category is selected', () => {
    const rowStart = importSource.indexOf('data-section="edit-details-category"')
    const rowEnd = importSource.indexOf('</TertiaryBtn>', rowStart)
    expect(rowStart).toBeGreaterThan(-1)
    expect(rowEnd).toBeGreaterThan(rowStart)
    const categoryRow = importSource.slice(rowStart, rowEnd)
    expect(categoryRow).toContain("'Not set'")
    expect(categoryRow).toContain("'Change' : 'Choose'")
  })

  it('uses a non-destructive picker draft selection in changeCategory mode', () => {
    expect(importSource).toContain('const [pickerDraftSelection, setPickerDraftSelection] = useState<{')
    expect(importSource).toContain('const selectCategoryInPicker = (option')
    expect(importSource).toContain('const commitPickerSelectionToDraft = () =>')
  })

  it('seeds the picker draft selection from the current edit draft when opening Change category', () => {
    const fnIdx = importSource.indexOf('const openChangeCategoryFromDetails = () =>')
    expect(fnIdx).toBeGreaterThan(-1)
    const fnBlockEnd = importSource.indexOf('\n  }\n', fnIdx)
    const fnBlock = importSource.slice(fnIdx, fnBlockEnd)
    expect(fnBlock).toContain('setPickerDraftSelection(')
    expect(fnBlock).toContain('categoryType: editDraft.categoryType')
    expect(fnBlock).toContain('categoryKey: editDraft.categoryKey')
    expect(fnBlock).toContain('customCategoryId: editDraft.customCategoryId')
  })

  it('clears the picker draft selection on close/cancel without touching the edit draft', () => {
    const closeIdx = importSource.indexOf('const closeCategoryBrowser = () =>')
    const closeEnd = importSource.indexOf('\n  }\n', closeIdx)
    const closeBlock = importSource.slice(closeIdx, closeEnd)
    expect(closeBlock).toContain('setPickerDraftSelection(null)')
    expect(closeBlock).not.toContain('setEditDraft(')

    const closeEditIdx = importSource.indexOf('const closeEditRow = () =>')
    const closeEditEnd = importSource.indexOf('\n  }\n', closeEditIdx)
    const closeEditBlock = importSource.slice(closeEditIdx, closeEditEnd)
    expect(closeEditBlock).toContain('setPickerDraftSelection(null)')
  })

  it('only commits a picker selection to the edit draft when Continue is pressed', () => {
    const pickerSelectIdx = importSource.indexOf('const selectCategoryInPicker = (option')
    const pickerSelectEnd = importSource.indexOf('\n  }\n', pickerSelectIdx)
    const pickerSelectBlock = importSource.slice(pickerSelectIdx, pickerSelectEnd)
    expect(pickerSelectBlock).toContain('setPickerDraftSelection({')
    expect(pickerSelectBlock).not.toContain('setEditDraft(')

    const commitIdx = importSource.indexOf('const commitPickerSelectionToDraft = () =>')
    const commitEnd = importSource.indexOf('\n  }\n', commitIdx)
    const commitBlock = importSource.slice(commitIdx, commitEnd)
    expect(commitBlock).toContain('setEditDraft(')
    expect(commitBlock).toContain('setPickerDraftSelection(null)')
  })

  it('wires the picker sheet Continue button to commit picker draft selection in changeCategory mode', () => {
    expect(importSource).toContain("editStep === 'changeCategory' ? (")
    expect(importSource).toContain('onClick={commitPickerSelectionToDraft}')
    expect(importSource).toContain('!pickerDraftSelection?.categoryType ||')
    expect(importSource).toContain('!pickerDraftSelection?.categoryKey')
  })

  it('uses picker draft selection for chip highlight in changeCategory mode and editDraft otherwise', () => {
    expect(importSource).toContain("const isChangeCategory = editStep === 'changeCategory'")
    expect(importSource).toContain('pickerDraftSelection?.categoryKey ?? null')
    expect(importSource).toContain('pickerDraftSelection?.customCategoryId ?? null')
    expect(importSource).toContain('selectCategoryInPicker(option)')
  })

  it('auto-opens single-entry rows (any type) to skip the review-list wrapper', () => {
    expect(importSource).toContain('shouldAutoOpenSingleEntryEditFlow')
    expect(importSource).toContain('if (shouldAutoOpenSingleEntryEditFlow(nextRows)) {')
    expect(importSource).toContain('beginEditRow(nextRows[0], false, 1)')
    expect(importSource).not.toContain('shouldAutoOpenSingleQuickTypedCategoryRow')
  })

  it('routes initial edit step based on whether the import is single-entry', () => {
    expect(importSource).toContain('const beginEditRow = (row: EditableRow, fromReviewList: boolean, editableRowCount: number) =>')
    expect(importSource).toContain('const isSingleEntry = editableRowCount === 1')
    expect(importSource).toContain('getInitialEditStepForRow(row, { isSingleEntry })')
  })

  it('skips the per-row review step for single-entry after picking a category', () => {
    const goToReviewIdx = importSource.indexOf('const goToEditReview = () =>')
    expect(goToReviewIdx).toBeGreaterThan(-1)
    const goToReviewEnd = importSource.indexOf('\n  }\n', goToReviewIdx)
    const block = importSource.slice(goToReviewIdx, goToReviewEnd)
    expect(block).toContain('if (editableRowIndices.length === 1) {')
    expect(block).toContain("setEditStep('details')")
    expect(block).toContain("setEditStep('review')")
    const singleIdx = block.indexOf("setEditStep('details')")
    const multiIdx = block.indexOf("setEditStep('review')")
    expect(singleIdx).toBeGreaterThan(-1)
    expect(multiIdx).toBeGreaterThan(singleIdx)
  })

  it('saves directly from edit-details for single-entry and goes to per-row review for multi-entry', () => {
    const saveIdx = importSource.indexOf('const saveDetailsChanges = async () =>')
    expect(saveIdx).toBeGreaterThan(-1)
    const saveEnd = importSource.indexOf('\n  }\n', saveIdx)
    const block = importSource.slice(saveIdx, saveEnd)
    expect(block).toContain('if (editableRowIndices.length === 1) {')
    expect(block).toContain('const rowsToSave = replaceEditedReviewRow(rows, nextRow)')
    expect(block).toContain('await handleSave(false, rowsToSave)')
    expect(block).toContain("setEditStep('review')")
  })

  it('uses Save expense CTA for single-entry edit-details and Save changes for multi-entry', () => {
    expect(importSource).toContain("editableRowIndices.length === 1")
    expect(importSource).toContain("? 'Save expense'")
    expect(importSource).toContain(": 'Save changes'")
    expect(importSource).toContain('disabled={saving}')
  })

  it('returns from edit-details to the input screen for single-entry on Cancel or Back', () => {
    const cancelIdx = importSource.indexOf('const cancelDetailsEdit = () =>')
    expect(cancelIdx).toBeGreaterThan(-1)
    const cancelEnd = importSource.indexOf('\n  }\n', cancelIdx)
    const cancelBlock = importSource.slice(cancelIdx, cancelEnd)
    expect(cancelBlock).toContain('if (editableRowIndices.length === 1) {')
    expect(cancelBlock).toContain('returnToInputScreen()')
    expect(cancelBlock).toContain('closeEditRow()')

    const backIdx = importSource.indexOf('const goBackWithinEditFlow = () =>')
    expect(backIdx).toBeGreaterThan(-1)
    const backEnd = importSource.indexOf('\n  }\n', backIdx)
    const backBlock = importSource.slice(backIdx, backEnd)
    expect(backBlock).toContain('const isSingleEntry = editableRowIndices.length === 1')
    expect(backBlock).toContain("if (isSingleEntry && (editStep === 'category' || editStep === 'details')) {")
    expect(backBlock).toContain('returnToInputScreen()')
    expect(backBlock).toContain('isSingleEntry,')
  })

  it('preserves Add another expense for single-entry edit-details once a category is set', () => {
    expect(importSource).toContain("editStep === 'review' || (editStep === 'details' && editableRowIndices.length === 1 && !!editDraft.categoryKey)")
    expect(importSource).toContain('addAnotherExpenseFromEditFlow')
  })

  it('keeps the multi-entry per-row review summary, Edit details, and Next entry/Save expense flow intact', () => {
    expect(importSource).toContain("{editStep === 'review' && editedPreviewRow && (")
    expect(importSource).toContain('handleReviewRowPrimaryAction')
    expect(importSource).toContain('shouldSaveSingleCompletedReviewRow')
    expect(importSource).toContain('getReviewRowPrimaryLabel')
    expect(importSource).toContain('openEditDetailsFromReview')
  })

  it('does not introduce a new review layer for single-entry: per-row review block is gated on editStep === review only', () => {
    const reviewBlockOpen = importSource.indexOf("{editStep === 'review' && editedPreviewRow && (")
    expect(reviewBlockOpen).toBeGreaterThan(-1)
    expect(importSource).not.toContain("editStep === 'review' || (editStep === 'details' && editableRowIndices.length === 1 && editedPreviewRow")
  })

  it('puts the Remove row action inside the edit card header, not as a floating action below the card', () => {
    const cardHeaderIdx = importSource.indexOf("{editStep !== 'changeCategory' ? (")
    expect(cardHeaderIdx).toBeGreaterThan(-1)
    const cardHeaderEnd = importSource.indexOf("{editStep === 'category' && (", cardHeaderIdx)
    expect(cardHeaderEnd).toBeGreaterThan(cardHeaderIdx)
    const headerBlock = importSource.slice(cardHeaderIdx, cardHeaderEnd)
    expect(headerBlock).toContain('aria-label="Remove row"')
    expect(headerBlock).toContain('onClick={() => setEditDeleteConfirmOpen(true)}')
  })

  it('no longer renders the floating Remove row TertiaryBtn below the card', () => {
    expect(importSource).not.toContain("onClick={() => setEditDeleteConfirmOpen(true)} style={{ color: T.redDark }}")
    expect(importSource).not.toContain("color: T.redDark }}>\n                  Remove row")
  })

  it('orders below-card actions as primary, secondary, then tertiary Add another expense', () => {
    const cardCloseIdx = importSource.lastIndexOf('</div>\n          {editStep === \'review\' || (editStep === \'details\' && editableRowIndices.length === 1 && !!editDraft.categoryKey) ? (')
    expect(cardCloseIdx).toBeGreaterThan(-1)
    const addAnotherIdx = importSource.indexOf('+ Add another expense')
    expect(addAnotherIdx).toBeGreaterThan(cardCloseIdx)
    expect(importSource).toContain('<TertiaryBtn size="md" onClick={addAnotherExpenseFromEditFlow}>')
    expect(importSource).not.toContain("color: T.redDark }}>\n                  Remove row")
  })

  it('preserves removal behavior: clicking the in-card X opens the existing delete confirm flow', () => {
    expect(importSource).toContain('setEditDeleteConfirmOpen(true)')
    expect(importSource).toContain('const deleteEditingRow = () =>')
    expect(importSource).toContain('applyRowsChange((current) => current.filter((row) => row.id !== editingRowId))')
  })

  it('Add another expense opens a compact parser input, not a manual editor', () => {
    expect(importSource).toContain('const [addAnotherOpen, setAddAnotherOpen] = useState(false)')
    expect(importSource).toContain('const [addAnotherText, setAddAnotherText] = useState')
    expect(importSource).toContain('const submitAddAnotherExpense = async () =>')
    expect(importSource).toContain("Paste a message or type something like 'food 500'")
    expect(importSource).toContain('Add expense')
    expect(importSource).toContain('onClick={submitAddAnotherExpense}')
    expect(importSource).toContain('onClick={closeAddAnotherInput}')
  })

  it('reuses the existing SMS parser for Add another expense', () => {
    const submitIdx = importSource.indexOf('const submitAddAnotherExpense = async () =>')
    expect(submitIdx).toBeGreaterThan(-1)
    const submitEnd = importSource.indexOf('\n  }\n', submitIdx)
    const block = importSource.slice(submitIdx, submitEnd)
    expect(block).toContain('await parseSmsImport(text, {')
    expect(block).toContain('defaultImportMonth: isPastMode ? defaultImportMonth : null')
    expect(block).toContain('const nextRows = [...current, ...parsedRows]')
    expect(block).toContain('setMonthlyReminderKeys((current)')
  })

  it('supports a past import mode on the existing import route without a second import system', () => {
    expect(importSource).toContain("type ImportMode = 'current' | 'past'")
    expect(importSource).toContain("searchParams.get('mode') === 'past'")
    expect(importSource).toContain('await parseSmsImport(rawText, {')
    expect(importSource).toContain('mode: importMode,')
    expect(importSource).toContain('defaultImportMonth: isPastMode ? defaultImportMonth : null')
    expect(importSource).toContain('Import past expenses')
    expect(importSource).toContain('Paste old expenses')
  })

  it('asks for default month only in past mode and updates inherited dates when it changes', () => {
    expect(importSource).toContain('Which month are these expenses for?')
    expect(importSource).toContain('const [defaultImportMonth, setDefaultImportMonth] = useState(getCurrentImportMonth)')
    expect(importSource).toContain('const updateDefaultImportMonth = (month: string) =>')
    expect(importSource).toContain("row.dateSource === 'default_month'")
    expect(importSource).toContain('date: inheritedDate')
    expect(importSource).toContain('aria-label="Change import month"')
    expect(importSource).toContain('Added to ${getPastMonthGroupLabel(row.date)}')
    expect(importSource).not.toContain('Inherited from')
  })

  it('only shows the upfront month selector for the paste past-mode tab, not for CSV upload', () => {
    expect(importSource).toContain('data-section="past-import-upfront-month"')
    const upfrontIdx = importSource.indexOf('data-section="past-import-upfront-month"')
    expect(upfrontIdx).toBeGreaterThan(-1)
    // Walk back from the data-section attribute to the enclosing conditional —
    // the upfront month label is wrapped in {pastInputMode === 'paste' ? (...) : null}.
    const windowStart = Math.max(0, upfrontIdx - 200)
    const guardWindow = importSource.slice(windowStart, upfrontIdx)
    expect(guardWindow).toContain("pastInputMode === 'paste' ? (")
  })

  it('keeps the review month picker gated on rows actually inheriting a date in CSV mode', () => {
    expect(importSource).toContain('data-section="past-import-month-prompt"')
    expect(importSource).toContain("const inheritedCount = rows.filter((row) => row.dateSource === 'default_month').length")
    expect(importSource).toContain("if (pastInputMode === 'csv' && inheritedCount === 0) return null")
  })

  it('drops the redundant "Importing for" headline above the month selector and uses a subtle inherited-rows caption instead', () => {
    expect(importSource).not.toContain('`Importing for ${defaultImportMonthLabel}`')
    expect(importSource).toContain('`Expenses without dates will be added to ${defaultImportMonthLabel}`')
    // Caption only renders when at least one row will inherit the selected month.
    expect(importSource).toContain('const caption = inheritedCount > 0')
  })

  it('preserves explicit CSV dates: updateDefaultImportMonth only rewrites rows whose dateSource is default_month', () => {
    const updateIdx = importSource.indexOf('const updateDefaultImportMonth = (month: string) =>')
    expect(updateIdx).toBeGreaterThan(-1)
    const updateEnd = importSource.indexOf('\n  }\n', updateIdx)
    const updateBlock = importSource.slice(updateIdx, updateEnd)
    expect(updateBlock).toContain("row.dateSource === 'default_month'")
    expect(updateBlock).toContain('date: inheritedDate')
    expect(updateBlock).not.toContain("row.dateSource === 'explicit'")
  })

  it('keeps current SMS import mode unaffected: month selectors only render under isPastMode guards', () => {
    const upfrontIdx = importSource.indexOf('data-section="past-import-upfront-month"')
    const promptIdx = importSource.indexOf('data-section="past-import-month-prompt"')
    expect(upfrontIdx).toBeGreaterThan(-1)
    expect(promptIdx).toBeGreaterThan(-1)
    // Upfront month select must sit inside the {isPastMode ? (<>... block.
    const upfrontWindow = importSource.slice(Math.max(0, upfrontIdx - 2000), upfrontIdx)
    expect(upfrontWindow).toContain('{isPastMode ? (')
    // Review prompt block is guarded by an early `if (!isPastMode) return null`
    // at the top of an IIFE that ends with the prompt's data-section div.
    const iifeStart = importSource.lastIndexOf('{(() => {', promptIdx)
    expect(iifeStart).toBeGreaterThan(-1)
    const promptIIFE = importSource.slice(iifeStart, promptIdx)
    expect(promptIIFE).toContain('if (!isPastMode) return null')
  })

  it('groups past import review rows by month and marks missing-date rows clearly', () => {
    expect(importSource).toContain('function getPastMonthGroupLabel(date: string)')
    expect(importSource).toContain("'Needs date'")
    expect(importSource).toContain('data-section="past-import-month-header"')
    expect(importSource).toContain('sortPastRowsForReview')
  })

  it('relaxes category enforcement for past mode while keeping current-mode strictness', () => {
    // validateRow accepts a requireCategory option, defaulting to true (strict).
    expect(importSource).toContain('function validateRow(row: EditableRow, options: { requireCategory?: boolean } = {})')
    expect(importSource).toContain('const requireCategory = options.requireCategory !== false')
    expect(importSource).toContain('if (requireCategory && !row.categoryType)')

    // The client builds a memoized validator gated on isPastMode.
    expect(importSource).toContain('const validateImportRow = useMemo(')
    expect(importSource).toContain('(row: EditableRow) => validateRow(row, { requireCategory: !isPastMode })')
  })

  it('sends honest categories to the server and tells it which mode to apply', () => {
    // The client no longer invents a fake canonical category key on save.
    expect(importSource).not.toContain("const effectiveCategoryKey = row.categoryKey?.trim() || 'uncategorized'")
    expect(importSource).not.toContain("const effectiveCategoryType: ImportCategoryType = (row.categoryType ?? 'everyday') as ImportCategoryType")

    // categoryType is passed through as-is (may be null for past-mode rows).
    expect(importSource).toContain('categoryType: row.categoryType,')

    // The save action is told which mode is invoking it.
    expect(importSource).toContain('await saveParsedSmsExpenses(payload, { confirmOverride, mode: importMode })')
  })

  it('guides current-mode uncategorized rows to category completion instead of showing final save', () => {
    expect(importSource).toContain('!isPastMode && unresolvedCategoryCount > 0 ?')
    expect(importSource).toContain('const firstUncategorizedCurrentRowIndex = useMemo(')
    expect(importSource).toContain('const guideCurrentRowsToCategoryCompletion = () =>')
    expect(importSource).toContain('beginEditRow(row, true, editableRowIndices.length)')
    expect(importSource).toContain("setEditStep('category')")
    expect(importSource).toContain('One current-month expense still needs a category.')
    expect(importSource).toContain('current-month expenses still need categories.')
    expect(importSource).toContain('onClick={guideCurrentRowsToCategoryCompletion}')
    expect(importSource).toContain('Continue')
    expect(importSource).not.toContain("We couldn't save right now. Please try again in a moment.")
  })

  it('keeps past mode category forgiveness and enabled save behavior', () => {
    // Soft helper still renders above the enabled save button in past mode.
    expect(importSource).toContain('isPastMode && queueSaveHelper ? (')
    // Helper is passed isPastMode to swap copy.
    expect(importSource).toContain('getQueueSaveHelperCopy(unresolvedCategoryCount, { isPastMode })')
    // The fake client-side fallback is gone — the server resolves uncategorized rows via mode.
    expect(importSource).not.toContain("const effectiveCategoryKey = row.categoryKey?.trim() || 'uncategorized'")
  })

  it('uses month-level date context on success for default-month past rows', () => {
    expect(importSource).toContain('const successDateContext = (row: Pick<EditableRow')
    expect(importSource).toContain("row.dateSource === 'default_month'")
    expect(importSource).toContain('? getPastMonthGroupLabel(row.date)')
    expect(importSource).toContain(': savedDateLabel(row.date)')
    expect(importSource).toContain('${resolveImportCategoryLabel(row.categoryKey, row.categoryType, row.customCategoryId)} · ${successDateContext(row)}')
  })

  it('renders the Ready row state with a Lucide check icon, green semantic color, and sentence-case copy', () => {
    // IconCheck is wired through the shared icon set, not a stray import.
    expect(importSource).toContain("import { IconBack, IconCheck } from '@/components/ui/Icons'")
    // Ready uses the existing --green-dark semantic token instead of hardcoded hex.
    expect(importSource).toContain("rowActionLabel === 'Ready'\n                                  ? 'var(--green-dark)'")
    // Icon renders only for the Ready state, lightweight size, decorative-aria-hidden.
    expect(importSource).toContain("rowActionLabel === 'Ready' ? (\n                                <IconCheck size={14} strokeWidth={2.2} aria-hidden=\"true\" />")
    // Surrounding span flips to inline-flex so the icon aligns vertically with the text.
    expect(importSource).toContain("display: 'inline-flex',\n                                alignItems: 'center',\n                                gap: 4,")
    // Status data-attribute makes the resolved state addressable for snapshots/UI debugging.
    expect(importSource).toContain("data-state={rowActionLabel === 'Ready' ? 'ready' : undefined}")
  })

  it('keeps the Ready styling scoped — uncategorized rows still use the brand-dark action color and no icon', () => {
    expect(importSource).toContain('needsCategory ? T.brandDark : T.textMuted')
    expect(importSource).toContain("rowActionLabel === 'Ready' ? (")
    // The fallback branch (uncategorized / warning / etc) renders no icon.
    expect(importSource).toContain("rowActionLabel === 'Ready' ? (\n                                <IconCheck")
    expect(importSource).toContain(') : null}\n                              {rowActionLabel}')
  })

  it('adds past-import bulk review tools without changing the save path', () => {
    expect(importSource).toContain('data-section="past-import-bulk-toolbar"')
    expect(importSource).toContain('const [selectedPastRowIds, setSelectedPastRowIds] = useState<string[]>([])')
    expect(importSource).toContain('const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false)')
    expect(importSource).toContain('const togglePastRowSelection = (id: string) =>')
    expect(importSource).toContain('const applyCategoryToRows = (')
    expect(importSource).toContain('const applyBulkCategory = (option: ImportCategoryOption) =>')
    expect(importSource).toContain('Apply category')
    expect(importSource).toContain('saveParsedSmsExpenses(payload, { confirmOverride, mode: importMode })')
  })

  it('only reveals the bulk toolbar after the user selects at least one expense', () => {
    // The misleading "Select rows" mode-switch is gone — selection happens via
    // the per-row checkbox first.
    expect(importSource).not.toContain('Select rows')
    expect(importSource).not.toContain("'Select rows'")
    // Toolbar render condition requires at least one selection.
    expect(importSource).toContain('isPastMode && rows.length > 0 && selectedPastRowIds.length > 0 ?')
  })

  it('groups bulk actions inside a single subtle contextual container with calm copy', () => {
    expect(importSource).toContain("`${selectedPastRowIds.length} selected`")
    expect(importSource).toContain('Apply category')
    expect(importSource).toContain('Clear')
    // Remove selected is renamed to plain Remove.
    expect(importSource).not.toContain('Remove selected')

    const toolbarIdx = importSource.indexOf('data-section="past-import-bulk-toolbar"')
    expect(toolbarIdx).toBeGreaterThan(-1)
    const toolbarEnd = importSource.indexOf("display: 'flex', flexDirection: 'column'", toolbarIdx)
    const toolbar = importSource.slice(toolbarIdx, toolbarEnd)

    // Single subtle container — soft background, rounded, token-based padding.
    expect(toolbar).toContain("background: 'var(--grey-50)'")
    expect(toolbar).toContain("borderRadius: 'var(--radius-md)'")
    expect(toolbar).toContain("padding: 'var(--space-sm) var(--space-md)'")

    // No SecondaryBtn or page-CTA chrome — actions are tonal/ghost contextual buttons.
    expect(toolbar).not.toContain('<SecondaryBtn')
    expect(toolbar).not.toContain('<PrimaryBtn')

    // Apply category uses tonal brand-chip tokens (not the hero filled brand-dark).
    expect(toolbar).toContain('onClick={openBulkCategoryPicker}')
    expect(toolbar).toContain("background: 'var(--chip-selected-bg)'")
    expect(toolbar).toContain("color: 'var(--chip-selected-text)'")
    expect(toolbar).not.toContain('background: T.brandDark')

    // Remove is a ghost danger button — no outline, danger-semantic text color.
    expect(toolbar).toContain('onClick={() => removeRowsById(selectedPastRowIds)}')
    expect(toolbar).toContain('color: T.redDark')
    expect(toolbar).toContain("background: 'transparent'")
    expect(toolbar).not.toContain('${T.redBorder}')
  })

  it('places Select all and Clear in a separated utility row that visually recedes', () => {
    const toolbarIdx = importSource.indexOf('data-section="past-import-bulk-toolbar"')
    expect(toolbarIdx).toBeGreaterThan(-1)
    const toolbarEnd = importSource.indexOf("display: 'flex', flexDirection: 'column'", toolbarIdx)
    const toolbar = importSource.slice(toolbarIdx, toolbarEnd)

    // Utility row uses a subtle border-top separator and tertiary text-xs styling.
    expect(toolbar).toContain('borderTop: `var(--border-width) solid var(--border-subtle)`')
    expect(toolbar).toContain("fontSize: 'var(--text-xs)'")
    expect(toolbar).toContain('selectedPastRowIds.length < rows.length ? (')
    expect(toolbar).toContain('setSelectedPastRowIds(rows.map((row) => row.id))')
    expect(toolbar).toContain('onClick={() => setSelectedPastRowIds([])}')
  })

  it('offers an explicit secondary "Select all" affordance only when not every expense is already selected', () => {
    const toolbarIdx = importSource.indexOf('data-section="past-import-bulk-toolbar"')
    expect(toolbarIdx).toBeGreaterThan(-1)
    // Slice from the toolbar marker to the next major section (review row list) —
    // captures the whole bulk-toolbar tree including Select all + Clear actions.
    const toolbarEnd = importSource.indexOf("display: 'flex', flexDirection: 'column'", toolbarIdx)
    expect(toolbarEnd).toBeGreaterThan(toolbarIdx)
    const toolbar = importSource.slice(toolbarIdx, toolbarEnd)
    expect(toolbar).toContain('selectedPastRowIds.length < rows.length ? (')
    expect(toolbar).toContain('Select all')
    expect(toolbar).toContain('setSelectedPastRowIds(rows.map((row) => row.id))')
    expect(toolbar).toContain('onClick={() => setSelectedPastRowIds([])}')
  })

  it('keeps the shared category picker entry point for bulk apply', () => {
    expect(importSource).toContain('onClick={openBulkCategoryPicker}')
    expect(importSource).toContain('Apply category')
    expect(importSource).toContain('openBulkCategoryPicker')
  })

  it('bulk category assignment reuses the shared category picker — no duplicate Sheet', () => {
    // The previous standalone bulk Sheet listed canonical options inline with
    // type tags (EVERYDAY/LIFESTYLE). Verify it is gone.
    expect(importSource).not.toContain('Apply a category to {selectedPastRows.length} selected')
    expect(importSource).not.toContain('canonical}-${option.type}-${option.key}')
    expect(importSource).not.toMatch(/textTransform:\s*'uppercase',\s*letterSpacing:\s*'0\.06em'/)

    // The shared picker Sheet's open condition must now include the bulk state.
    expect(importSource).toContain('open={\n          bulkCategoryOpen ||')
    expect(importSource).toContain('onClose={bulkCategoryOpen ? closeBulkCategoryPicker : closeCategoryBrowser}')

    // The shared picker chip handler routes to applyBulkCategory in bulk mode.
    expect(importSource).toContain('if (bulkCategoryOpen) {\n                      applyBulkCategory(option)')

    // Custom category creation flow also routes through bulk apply when in bulk mode.
    const createModeIdx = importSource.indexOf('const selectCategoryFromCreateMode = (option: ImportCategoryOption) =>')
    expect(createModeIdx).toBeGreaterThan(-1)
    const createModeEnd = importSource.indexOf('\n  }\n', createModeIdx)
    const createModeBlock = importSource.slice(createModeIdx, createModeEnd)
    expect(createModeBlock).toContain('if (bulkCategoryOpen) {')
    expect(createModeBlock).toContain('applyBulkCategory(option)')
  })

  it('bulk picker shows row-count headline and a compact preview of selected rows', () => {
    expect(importSource).toContain('data-section="bulk-category-preview"')
    expect(importSource).toContain('Apply category to ${selectedPastRows.length} ${selectedPastRows.length === 1 ? \'expense\' : \'expenses\'}')
    expect(importSource).toContain('const previewLimit = 3')
    expect(importSource).toContain("`${labels.join(', ')} and ${remaining} more`")
  })

  it('bulk picker resets shared picker state on open and close to avoid stale search/tab/notice', () => {
    const openIdx = importSource.indexOf('const openBulkCategoryPicker = () =>')
    expect(openIdx).toBeGreaterThan(-1)
    const openEnd = importSource.indexOf('\n  }\n', openIdx)
    const openBlock = importSource.slice(openIdx, openEnd)
    expect(openBlock).toContain("setCategoryFilter('everyday')")
    expect(openBlock).toContain("setCategoryQuery('')")
    expect(openBlock).toContain("setCategoryBrowserMode('select')")
    expect(openBlock).toContain('setBulkCategoryOpen(true)')

    const closeIdx = importSource.indexOf('const closeBulkCategoryPicker = () =>')
    expect(closeIdx).toBeGreaterThan(-1)
    const closeEnd = importSource.indexOf('\n  }\n', closeIdx)
    const closeBlock = importSource.slice(closeIdx, closeEnd)
    expect(closeBlock).toContain('setBulkCategoryOpen(false)')
    expect(closeBlock).toContain("setCategoryQuery('')")
  })

  it('bulk picker hides the row-edit Continue button so chip tap is the commit', () => {
    expect(importSource).toContain('{bulkCategoryOpen ? null : editStep === \'changeCategory\' ? (')
  })

  it('adds CSV upload only to past import while reusing the shared parse and review state', () => {
    expect(importSource).toContain("type PastInputMode = 'paste' | 'csv'")
    expect(importSource).toContain("const [pastInputMode, setPastInputMode] = useState<PastInputMode>('paste')")
    expect(importSource).toContain('Upload CSV')
    expect(importSource).toContain('accept=".csv,text/csv"')
    expect(importSource).toContain('const handleCsvFileChange = async (file: File | null) =>')
    expect(importSource).toContain('const handleCsvParse = async () =>')
    expect(importSource).toContain("source: 'csv'")
    expect(importSource).toContain('applyParsedImportData(result.data)')
    expect(importSource).toContain('csvMappingRequired')
    expect(importSource).toContain('data-section="csv-column-mapping"')
    expect(importSource).toContain('setRows(nextRows)')
    expect(importSource).toContain('saveParsedSmsExpenses(payload, { confirmOverride, mode: importMode })')
  })

  it('can apply a category to similar past entries and remove duplicate warning rows', () => {
    expect(importSource).toContain('const applyCategoryToSimilarRows = (sourceRow: EditableRow) =>')
    expect(importSource).toContain('getSimilarEntryKey(candidate.label) === getSimilarEntryKey(row.label)')
    expect(importSource).toContain('Apply {resolveImportCategoryLabel(row.categoryKey, row.categoryType, row.customCategoryId)} to similar entries?')
    expect(importSource).toContain('Possible duplicate')
    expect(importSource).toContain('This looks similar to an expense already saved.')
    expect(importSource).toContain('Keep row by saving anyway.')
    expect(importSource).toContain('onClick={() => removeRowsById([row.id])}')
  })

  it('surfaces parser ambiguity and invalid states in the existing review warning lane', () => {
    expect(importSource).toContain("parseStatus?: 'clear' | 'partial' | 'ambiguous' | 'failed' | 'invalid'")
    expect(importSource).toContain('parseMessage?: string | null')
    expect(importSource).toContain("row.parseStatus === 'ambiguous' || row.parseStatus === 'partial'")
    expect(importSource).toContain('This line may contain more than one expense. Check these before saving.')
    expect(importSource).toContain("row.parseStatus === 'invalid' && row.parseMessage")
    expect(importSource).toContain('data-section="parser-review-notice"')
    expect(importSource).toContain('Some entries may need checking.')
    expect(importSource).toContain('This may need checking.')
    expect(importSource).toContain('We couldn’t read this entry. Edit it to continue.')
    expect(importSource).toContain('needsReview: hasParserWarning')
    expect(importSource).toContain('hasParserWarning ? T.amberBorder')
    expect(importSource).toContain('hasParserWarning ? T.amberLight')
    expect(importSource).toContain("currentRowHasWarnings: editedPreviewRow ? (rowWarnings[editedPreviewRow.id] ?? []).includes(DUPLICATE_MESSAGE) : true")
    expect(importSource).toContain('hasDuplicateWarnings && !hasHardBlockedRows')
    expect(importSource).toContain('setRowWarnings(nextParseWarnings)')
  })

  it('does not invent manual row structures or bypass the parser', () => {
    const openIdx = importSource.indexOf('const addAnotherExpenseFromEditFlow = () =>')
    expect(openIdx).toBeGreaterThan(-1)
    const openEnd = importSource.indexOf('\n  }\n', openIdx)
    const openBlock = importSource.slice(openIdx, openEnd)
    expect(openBlock).not.toContain('id: `manual-${Date.now()}`')
    expect(openBlock).not.toContain('isImportedMessage: false')
    expect(openBlock).not.toContain("setEditStep('details')")
    expect(openBlock).toContain('setAddAnotherOpen(true)')
    expect(importSource).not.toContain("id: `manual-${Date.now()}`")
  })

  it('commits the current edit row before opening the Add another expense parser input', () => {
    const openIdx = importSource.indexOf('const addAnotherExpenseFromEditFlow = () =>')
    const openEnd = importSource.indexOf('\n  }\n', openIdx)
    const openBlock = importSource.slice(openIdx, openEnd)
    expect(openBlock).toContain('const committed = applyEditRow()')
    expect(openBlock).toContain('closeEditRow()')
  })

  it('renders the Add another expense view as a top-level pane, not inside the edit card', () => {
    expect(importSource).toContain('const showingAddAnother = addAnotherOpen && !showingEditFlow')
    expect(importSource).toContain('{showingAddAnother ? (')
    expect(importSource).toContain('Paste another message')
  })

  it('back button closes the Add another expense input', () => {
    const topBackIdx = importSource.indexOf('const topBackAction = () =>')
    const topBackEnd = importSource.indexOf('\n  }\n', topBackIdx)
    const block = importSource.slice(topBackIdx, topBackEnd)
    expect(block).toContain('if (showingAddAnother) {')
    expect(block).toContain('closeAddAnotherInput()')
  })

  it('preserves persisted row data: no source metadata mutation when interacting with the picker', () => {
    const pickerSelectIdx = importSource.indexOf('const selectCategoryInPicker = (option')
    const pickerSelectEnd = importSource.indexOf('\n  }\n', pickerSelectIdx)
    const pickerSelectBlock = importSource.slice(pickerSelectIdx, pickerSelectEnd)
    expect(pickerSelectBlock).not.toContain('sourceHash')
    expect(pickerSelectBlock).not.toContain('applyRowsChange')
    expect(pickerSelectBlock).not.toContain('updateRow')

    const closeIdx = importSource.indexOf('const closeCategoryBrowser = () =>')
    const closeEnd = importSource.indexOf('\n  }\n', closeIdx)
    const closeBlock = importSource.slice(closeIdx, closeEnd)
    expect(closeBlock).not.toContain('sourceHash')
    expect(closeBlock).not.toContain('updateRow')
    expect(closeBlock).not.toContain('applyRowsChange')
  })

  it('keeps category-picking UI out of the selected-category review state', () => {
    expect(importSource).toContain("{editStep === 'category' && (")
    expect(importSource).toContain('Pick a category')
    expect(importSource).toContain('Browse all categories')
    expect(importSource).toContain("{editStep === 'review' ? (")
    expect(importSource).toContain('+ Add another expense')
    expect(importSource).toContain('addAnotherExpenseFromEditFlow')
  })

  it('commits the selected category to the row before entering review', () => {
    expect(importSource).toContain('const goToEditReview = () =>')
    expect(importSource).toContain('const nextRow = applyEditRow()')
    expect(importSource).toContain('if (!nextRow) return')
    expect(importSource).toContain("disabled={!editDraft.categoryType || !editDraft.categoryKey}")
  })

  it('keeps category changes in memory until the user saves the reviewed import', () => {
    expect(importSource).toContain('sourceHash: row.sourceHash')
    expect(importSource).toContain('replaceEditedReviewRow(rows, nextRow)')
    expect(importSource).toContain('customCategoryId: editDraft.customCategoryId')
    expect(importSource).toContain('resetEditDraftToRow(editingRow)')
  })
})
