import { getCategoryLabel } from '@/lib/categories/config'

export interface EditDraftEntry {
  name: string
  amount: string
  date: string
  note: string
  categoryKey: string | null
}

export function isEditDetailsValid(draft: EditDraftEntry) {
  const amountValue = parseFloat(draft.amount)
  return (
    draft.name.trim().length > 0 &&
    Number.isFinite(amountValue) &&
    amountValue > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(draft.date)
  )
}

export function canEditSave(draft: EditDraftEntry) {
  return isEditDetailsValid(draft) && !!draft.categoryKey
}

export function resolveEditSuccessHref(entryId: string, returnTo?: string) {
  return returnTo ?? `/log/${entryId}`
}

export function getEditDetailsPrimaryLabel() {
  return 'Save'
}

export function getEditDetailsSecondaryLabel() {
  return 'Cancel'
}

export function getEditCategorySummary(draft: EditDraftEntry) {
  return draft.categoryKey ? getCategoryLabel(draft.categoryKey) : 'Choose a category'
}
