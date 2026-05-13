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
    expect(importSource).toContain("{editStep === 'changeCategory' ? (")
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
    expect(importSource).not.toContain('Remove row\n')
    expect(importSource).not.toContain('>Remove row<')
    expect(importSource).not.toContain("onClick={() => setEditDeleteConfirmOpen(true)} style={{ color: T.redDark }}")
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
    expect(block).toContain('await parseSmsImport(text)')
    expect(block).toContain('applyRowsChange((current) => [...current, ...parsedRows])')
    expect(block).toContain('setMonthlyReminderKeys((current)')
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
