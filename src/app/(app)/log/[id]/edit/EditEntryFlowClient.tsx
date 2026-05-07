'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppSubpageLayout } from '@/components/layout/AppSubpageLayout/AppSubpageLayout'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { PrimaryBtn, SecondaryBtn } from '@/components/ui/Button/Button'
import { Input } from '@/components/ui/Input/Input'
import { MoneyInput } from '@/components/ui/MoneyInput/MoneyInput'
import { SingleSelectChip } from '@/components/ui/SingleSelectChip/SingleSelectChip'
import { IconBack } from '@/components/ui/Icons'
import { getGroupedCategoryOptions } from '@/lib/categories/options'
import type { LogEntry } from '@/lib/loaders/log'
import { updateLogEntry } from '../../actions'
import { getSuggestedCategoryOptions } from '@/app/(app)/log/import/presentation'
import {
  getFrequentCategoryOptions,
  loadRecentCategoryKeys,
  recordRecentCategoryKey,
} from '@/app/(app)/log/import/recent-categories'
import {
  canEditSave,
  getEditCategorySummary,
  getEditDetailsPrimaryLabel,
  getEditDetailsSecondaryLabel,
  isEditDetailsValid,
  resolveEditSuccessHref,
  type EditDraftEntry,
} from './presentation'

type Step = 'details' | 'category' | 'review'
type EditCategoryType = 'everyday' | 'fixed' | 'debt'

interface DraftEntry extends EditDraftEntry {}

interface Props {
  entry: LogEntry
  currency: string
  returnTo?: string
}

const STEPS: Step[] = ['details', 'category', 'review']

const CATEGORY_GROUPS = getGroupedCategoryOptions(['everyday', 'fixed', 'debt']) as Array<
  (ReturnType<typeof getGroupedCategoryOptions>[number] & { type: EditCategoryType })
>

const CATEGORY_PANEL_TEXT = {
  title: 'Pick a category',
  subtitle: 'Tap one to apply.',
  browserTitle: 'Browse all categories',
  browserSubtitle: 'Search or browse the full category list',
}

function parseStep(value: string | null): Step {
  return STEPS.includes(value as Step) ? (value as Step) : 'details'
}

function buildInitialDraft(entry: LogEntry): DraftEntry {
  return {
    name: entry.name,
    amount: String(entry.amount),
    date: entry.date,
    note: entry.note ?? '',
    categoryKey: entry.categoryKey,
  }
}

export function EditEntryFlowClient({ entry, currency, returnTo }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const step = parseStep(searchParams.get('step'))
  const [draft, setDraft] = useState<DraftEntry>(() => buildInitialDraft(entry))
  const [error, setError] = useState<string | null>(null)
  const [isSaving, startSave] = useTransition()
  const [recentCategoryKeys, setRecentCategoryKeys] = useState<string[]>([])
  const [categoryFilter, setCategoryFilter] = useState<EditCategoryType>('everyday')
  const [categoryQuery, setCategoryQuery] = useState('')
  const [categoryBrowserOpen, setCategoryBrowserOpen] = useState(false)
  const successHref = resolveEditSuccessHref(entry.id, returnTo)

  useEffect(() => {
    setRecentCategoryKeys(loadRecentCategoryKeys())
  }, [])

  useEffect(() => {
    if (step !== 'category') {
      setCategoryBrowserOpen(false)
      setCategoryQuery('')
    }
  }, [step])

  useEffect(() => {
    if (!draft.categoryKey) return
    const activeGroup = CATEGORY_GROUPS.find((group) =>
      group.options.some((option) => option.key === draft.categoryKey)
    )
    if (!activeGroup) return
    setCategoryFilter(activeGroup.type)
  }, [draft.categoryKey])

  const goToStep = (next: Step) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next === 'details') {
      params.delete('step')
    } else {
      params.set('step', next)
    }
    const query = params.toString()
    router.replace(`/log/${entry.id}/edit${query ? `?${query}` : ''}`)
  }

  const updateDraft = (patch: Partial<DraftEntry>) => {
    setDraft((current) => ({ ...current, ...patch }))
  }

  const amountValue = parseFloat(draft.amount)
  const detailsValid = isEditDetailsValid(draft)
  const canSave = canEditSave(draft)

  const handleSave = () => {
    if (!canSave || isSaving) return
    if (!draft.categoryKey) {
      setError('Choose a category')
      return
    }
    if (!draft.name.trim()) {
      setError('Add a name')
      return
    }
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setError('Add an amount')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) {
      setError('Add a date')
      return
    }

    setError(null)
    startSave(async () => {
      try {
        await updateLogEntry({
          id: entry.id,
          amount: amountValue,
          date: draft.date,
          name: draft.name,
          note: draft.note,
          categoryKey: draft.categoryKey ?? undefined,
        })
        router.replace(successHref)
        router.refresh()
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not update entry')
      }
    })
  }

  const suggestedCategoryOptions = useMemo(() => {
    return getSuggestedCategoryOptions(draft.name, CATEGORY_GROUPS)
  }, [draft.name])

  const frequentCategoryOptions = useMemo(() => {
    return getFrequentCategoryOptions(
      recentCategoryKeys,
      CATEGORY_GROUPS,
      new Set(suggestedCategoryOptions.map((option) => option.key))
    )
  }, [recentCategoryKeys, suggestedCategoryOptions])

  const categorySearchResults = useMemo(() => {
    const query = categoryQuery.trim().toLowerCase()
    if (!query) return []
    const seen = new Set<string>()
    return CATEGORY_GROUPS.flatMap((group) => group.options)
      .filter((option) => {
        const matches = option.label.toLowerCase().includes(query)
          || option.key.toLowerCase().includes(query)
        if (!matches || seen.has(option.key)) return false
        seen.add(option.key)
        return true
      })
  }, [categoryQuery])

  const tabCategoryOptions = useMemo(() => {
    return CATEGORY_GROUPS.find((group) => group.type === categoryFilter)?.options ?? []
  }, [categoryFilter])

  const handleCategorySelect = (categoryKey: string) => {
    onChangeAndRememberCategory(categoryKey)
    goToStep('details')
  }

  const onChangeAndRememberCategory = (categoryKey: string) => {
    updateDraft({ categoryKey })
    setRecentCategoryKeys(recordRecentCategoryKey(categoryKey))
    setCategoryBrowserOpen(false)
    setCategoryQuery('')
  }

  const handleTopBack = () => {
    if (step === 'category') {
      goToStep('details')
      return
    }
    router.replace(successHref)
  }

  return (
    <AppSubpageLayout maxWidth={600}>
      <button
        type="button"
        aria-label={step === 'category' ? 'Back to details' : 'Back to entry'}
        onClick={handleTopBack}
        style={{
          width: 44,
          height: 44,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 'var(--space-md)',
          color: 'var(--grey-900)',
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <IconBack size={20} />
      </button>

      {step === 'details' ? (
        <DetailsStep
          draft={draft}
          currency={currency}
          onChange={updateDraft}
          canSave={canSave}
          isSaving={isSaving}
          error={error}
          onOpenCategory={() => goToStep('category')}
          onCancel={() => router.replace(successHref)}
          onSave={handleSave}
        />
      ) : null}

      {step === 'category' ? (
        <CategoryStep
          draft={draft}
          currency={currency}
          suggestedCategoryOptions={suggestedCategoryOptions}
          frequentCategoryOptions={frequentCategoryOptions}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          categoryQuery={categoryQuery}
          onCategoryQueryChange={setCategoryQuery}
          categorySearchResults={categorySearchResults}
          tabCategoryOptions={tabCategoryOptions}
          browserOpen={categoryBrowserOpen}
          onBrowserOpen={() => setCategoryBrowserOpen(true)}
          onBrowserClose={() => {
            setCategoryBrowserOpen(false)
            setCategoryQuery('')
          }}
          onSelectCategory={handleCategorySelect}
        />
      ) : null}
    </AppSubpageLayout>
  )
}

function StepHeader({ eyebrow, title, subtitle }: { eyebrow: string; title?: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 'var(--space-xl)' }}>
      <p style={{
        margin: '0 0 var(--space-xs)',
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--weight-semibold)',
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
      }}>
        {eyebrow}
      </p>
      {title ? (
        <h1 style={{
          margin: 0,
          fontSize: 'var(--text-2xl)',
          fontWeight: 'var(--weight-semibold)',
          color: 'var(--text-1)',
          letterSpacing: '-0.02em',
          lineHeight: 1.05,
        }}>
          {title}
        </h1>
      ) : null}
      {subtitle ? (
        <p style={{
          margin: title ? 'var(--space-sm) 0 0' : '0',
          fontSize: 'var(--text-base)',
          color: 'var(--text-3)',
          lineHeight: 1.55,
          maxWidth: 480,
        }}>
          {subtitle}
        </p>
      ) : null}
    </div>
  )
}

function FormCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--white)',
      border: 'var(--border-width) solid var(--border)',
      borderRadius: 'var(--radius-xl)',
      padding: 'var(--space-lg)',
    }}>
      {children}
    </div>
  )
}

function DetailsStep({
  draft,
  currency,
  onChange,
  canSave,
  isSaving,
  error,
  onOpenCategory,
  onCancel,
  onSave,
}: {
  draft: DraftEntry
  currency: string
  onChange: (patch: Partial<DraftEntry>) => void
  canSave: boolean
  isSaving: boolean
  error: string | null
  onOpenCategory: () => void
  onCancel: () => void
  onSave: () => void
}) {
  const categoryLabel = getEditCategorySummary(draft)
  const [noteExpanded, setNoteExpanded] = useState(false)
  const notePreview = draft.note.trim() || 'Add note'

  return (
    <div>
      <StepHeader eyebrow="Edit entry" subtitle="Update the basic information for this entry." />

      <FormCard>
        <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
          <Input
            label="Name"
            value={draft.name}
            onChange={(value) => onChange({ name: value })}
            placeholder="Name"
            flush
          />
          <MoneyInput
            label="Amount"
            currency={currency}
            value={draft.amount}
            onChange={(value) => onChange({ amount: value })}
            placeholder="0"
            flush
          />
          <Input
            label="Transaction date"
            hint="When this expense happened"
            type="date"
            value={draft.date}
            onChange={(value) => onChange({ date: value })}
            flush
          />
          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
            <span style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--weight-medium)',
              color: 'var(--text-2)',
            }}>
              Category
            </span>
            <button
              type="button"
              onClick={onOpenCategory}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-md)',
                width: '100%',
                height: 40,
                padding: '0 16px',
                borderRadius: 'var(--radius-sm)',
                border: 'var(--border-width) solid var(--border)',
                background: 'var(--white)',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-regular)',
                color: draft.categoryKey ? 'var(--text-1)' : 'var(--text-3)',
                lineHeight: 1.35,
              }}>
                {categoryLabel}
              </span>
              <span aria-hidden style={{
                fontSize: '16px',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--text-muted)',
                lineHeight: 1,
              }}>
                ›
              </span>
            </button>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
            <span style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--weight-medium)',
              color: 'var(--text-2)',
            }}>
              Note
            </span>
            {noteExpanded ? (
              <textarea
                value={draft.note}
                onChange={(event) => onChange({ note: event.target.value })}
                placeholder="Optional note"
                rows={3}
                style={{
                  borderRadius: 'var(--radius-sm)',
                  border: 'var(--border-width) solid var(--border)',
                  padding: '12px 16px',
                  fontSize: 'var(--text-sm)',
                  lineHeight: 1.5,
                  fontWeight: 'var(--weight-regular)',
                  color: 'var(--text-1)',
                  background: 'var(--white)',
                  outline: 'none',
                  width: '100%',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  minHeight: 88,
                  fontFamily: 'inherit',
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => setNoteExpanded(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-md)',
                  width: '100%',
                  minHeight: 40,
                  padding: '10px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'var(--border-width) solid var(--border)',
                  background: 'var(--white)',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span style={{
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--weight-regular)',
                  color: draft.note.trim() ? 'var(--text-1)' : 'var(--text-3)',
                  lineHeight: 1.4,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  flex: 1,
                }}>
                  {notePreview}
                </span>
                <span aria-hidden style={{
                  fontSize: '16px',
                  fontWeight: 'var(--weight-semibold)',
                  color: 'var(--text-muted)',
                  lineHeight: 1,
                }}>
                  ›
                </span>
              </button>
            )}
          </label>
        </div>

        {error ? (
          <p style={{
            margin: 'var(--space-md) 0 0',
            fontSize: 'var(--text-sm)',
            color: 'var(--red-dark)',
            lineHeight: 1.5,
          }}>
            {error}
          </p>
        ) : null}

        <div style={{ marginTop: 'var(--space-xl)' }}>
          <PrimaryBtn size="lg" onClick={onSave} disabled={!canSave || isSaving}>
            {isSaving ? 'Saving…' : getEditDetailsPrimaryLabel()}
          </PrimaryBtn>
        </div>
        <div style={{ marginTop: 'var(--space-sm)' }}>
          <SecondaryBtn size="lg" onClick={onCancel} disabled={isSaving}>
            {getEditDetailsSecondaryLabel()}
          </SecondaryBtn>
        </div>
      </FormCard>
    </div>
  )
}

function CategoryStep({
  draft,
  currency,
  suggestedCategoryOptions,
  frequentCategoryOptions,
  categoryFilter,
  onCategoryFilterChange,
  categoryQuery,
  onCategoryQueryChange,
  categorySearchResults,
  tabCategoryOptions,
  browserOpen,
  onBrowserOpen,
  onBrowserClose,
  onSelectCategory,
}: {
  draft: DraftEntry
  currency: string
  suggestedCategoryOptions: Array<(typeof CATEGORY_GROUPS)[number]['options'][number]>
  frequentCategoryOptions: Array<(typeof CATEGORY_GROUPS)[number]['options'][number]>
  categoryFilter: EditCategoryType
  onCategoryFilterChange: (value: EditCategoryType) => void
  categoryQuery: string
  onCategoryQueryChange: (value: string) => void
  categorySearchResults: Array<(typeof CATEGORY_GROUPS)[number]['options'][number]>
  tabCategoryOptions: Array<(typeof CATEGORY_GROUPS)[number]['options'][number]>
  browserOpen: boolean
  onBrowserOpen: () => void
  onBrowserClose: () => void
  onSelectCategory: (categoryKey: string) => void
}) {
  const isSearchingCategories = categoryQuery.trim().length > 0

  return (
    <div>
      <StepHeader eyebrow="Edit entry" title="Category" subtitle="Choose where this entry belongs." />

      <FormCard>
        <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
          <div style={{
            border: 'var(--border-width) solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '12px 14px',
            background: 'var(--white)',
          }}>
            <div style={{ display: 'grid', gap: '2px' }}>
              <span style={{
                fontSize: 'var(--text-base)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--text-1)',
                lineHeight: 1.3,
              }}>
                {draft.name.trim() || 'Expense'}
              </span>
              <span style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-3)',
                lineHeight: 1.4,
              }}>
                {`${currency} ${Number.isFinite(parseFloat(draft.amount)) ? parseFloat(draft.amount).toLocaleString() : draft.amount || '0'} · ${getEditCategorySummary(draft)}`}
              </span>
            </div>
          </div>

          {suggestedCategoryOptions.length > 0 || frequentCategoryOptions.length > 0 ? (
            <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
              {suggestedCategoryOptions.length > 0 ? (
                <div style={{ display: 'grid', gap: '6px' }}>
                  <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-1)' }}>
                    Suggested
                  </p>
                  <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
                    {suggestedCategoryOptions.map((option) => (
                      <SingleSelectChip
                        key={`suggested-${option.key}`}
                        label={option.label}
                        selected={draft.categoryKey === option.key}
                        onClick={() => onSelectCategory(option.key)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {frequentCategoryOptions.length > 0 ? (
                <div style={{ display: 'grid', gap: '6px' }}>
                  <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-2)' }}>
                    Frequent
                  </p>
                  <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
                    {frequentCategoryOptions.map((option) => (
                      <SingleSelectChip
                        key={`frequent-${option.key}`}
                        label={option.label}
                        selected={draft.categoryKey === option.key}
                        onClick={() => onSelectCategory(option.key)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            onClick={onBrowserOpen}
            style={{
              width: '100%',
              borderRadius: 14,
              border: 'var(--border-width) solid var(--border)',
              background: 'var(--white)',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-sm)',
              cursor: 'pointer',
              textAlign: 'left',
            }}
            >
              <span>
                <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-1)' }}>
                  {CATEGORY_PANEL_TEXT.browserTitle}
                </span>
                <span style={{ display: 'block', marginTop: 2, fontSize: 'var(--text-xs)', color: 'var(--text-3)', lineHeight: 1.4 }}>
                  {CATEGORY_PANEL_TEXT.browserSubtitle}
                </span>
              </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 18, lineHeight: 1 }}>›</span>
          </button>
        </div>
      </FormCard>

      <Sheet open={browserOpen} onClose={onBrowserClose} title="Choose category">
        <div style={{ display: 'grid', gap: 'var(--space-lg)' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-3)', lineHeight: 1.5 }}>
            Select a category and we&apos;ll return you to this entry.
          </p>

          <input
            type="search"
            value={categoryQuery}
            onChange={(event) => onCategoryQueryChange(event.target.value)}
            placeholder="Search categories"
            aria-label="Search categories"
            style={{
              width: '100%',
              height: 44,
              borderRadius: 12,
              border: 'var(--border-width) solid var(--border)',
              background: 'var(--white)',
              padding: '0 14px',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-1)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />

          {!isSearchingCategories ? (
            <div
              role="tablist"
              aria-label="Category groups"
              style={{
                display: 'flex',
                padding: 3,
                borderRadius: 10,
                background: 'var(--grey-100)',
                width: '100%',
              }}
            >
              {CATEGORY_GROUPS.map((group) => {
                const active = categoryFilter === group.type
                return (
                  <button
                    key={`modal-filter-${group.type}`}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => onCategoryFilterChange(group.type)}
                    style={{
                      flex: 1,
                      height: 34,
                      borderRadius: 8,
                      border: 'none',
                      background: active ? 'var(--white)' : 'transparent',
                      color: active ? 'var(--text-1)' : 'var(--text-2)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: active ? 'var(--weight-semibold)' : 'var(--weight-medium)',
                      cursor: 'pointer',
                      boxShadow: active ? '0 1px 2px rgba(16, 24, 40, 0.08)' : 'none',
                    }}
                  >
                    {group.label}
                  </button>
                )
              })}
            </div>
          ) : null}

          <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
            {isSearchingCategories ? (
              categorySearchResults.length > 0 ? (
                <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                  {categorySearchResults.map((option) => (
                    <SingleSelectChip
                      key={`modal-search-${option.key}`}
                      label={option.label}
                      selected={draft.categoryKey === option.key}
                      onClick={() => onSelectCategory(option.key)}
                    />
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-3)', lineHeight: 1.5 }}>
                  No matches.
                </p>
              )
            ) : tabCategoryOptions.length > 0 ? (
              <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                {tabCategoryOptions.map((option) => (
                  <SingleSelectChip
                    key={`modal-filtered-${option.key}`}
                    label={option.label}
                    selected={draft.categoryKey === option.key}
                    onClick={() => onSelectCategory(option.key)}
                  />
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-3)', lineHeight: 1.5 }}>
                No categories in this group.
              </p>
            )}
          </div>
        </div>
      </Sheet>
    </div>
  )
}
