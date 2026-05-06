'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppSubpageLayout } from '@/components/layout/AppSubpageLayout/AppSubpageLayout'
import { PrimaryBtn, SecondaryBtn } from '@/components/ui/Button/Button'
import { Input } from '@/components/ui/Input/Input'
import { MoneyInput } from '@/components/ui/MoneyInput/MoneyInput'
import { SingleSelectChip } from '@/components/ui/SingleSelectChip/SingleSelectChip'
import { IconBack } from '@/components/ui/Icons'
import { fmt, formatDate } from '@/lib/finance'
import { getCategoryLabel } from '@/lib/categories/config'
import { getGroupedCategoryOptions } from '@/lib/categories/options'
import type { LogEntry } from '@/lib/loaders/log'
import { updateLogEntry } from '../../actions'

type Step = 'details' | 'category' | 'review'

interface DraftEntry {
  name: string
  amount: string
  date: string
  note: string
  categoryKey: string | null
}

interface Props {
  entry: LogEntry
  currency: string
  returnTo?: string
}

const STEPS: Step[] = ['details', 'category', 'review']

const CATEGORY_GROUPS = getGroupedCategoryOptions(['everyday', 'fixed', 'debt'])

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
  const successHref = returnTo ?? `/log/${entry.id}`

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
  const detailsValid =
    draft.name.trim().length > 0 &&
    Number.isFinite(amountValue) &&
    amountValue > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(draft.date)

  const categoryValid = !!draft.categoryKey
  const canSave = detailsValid && categoryValid

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

  return (
    <AppSubpageLayout maxWidth={600}>
      <Link
        href={`/log/${entry.id}`}
        aria-label="Back to entry"
        style={{
          width: 44,
          height: 44,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 'var(--space-lg)',
          color: 'var(--grey-900)',
          textDecoration: 'none',
          flexShrink: 0,
        }}
      >
        <IconBack size={20} />
      </Link>

      {step === 'details' ? (
        <DetailsStep
          draft={draft}
          currency={currency}
          onChange={updateDraft}
          canContinue={detailsValid}
          onContinue={() => goToStep('category')}
        />
      ) : null}

      {step === 'category' ? (
        <CategoryStep
          draft={draft}
          onChange={updateDraft}
          canContinue={categoryValid}
          onBack={() => goToStep('details')}
          onContinue={() => goToStep('review')}
        />
      ) : null}

      {step === 'review' ? (
        <ReviewStep
          draft={draft}
          currency={currency}
          canSave={canSave}
          isSaving={isSaving}
          error={error}
          onBack={() => goToStep('category')}
          onSave={handleSave}
        />
      ) : null}
    </AppSubpageLayout>
  )
}

function StepHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 'var(--space-lg)' }}>
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
      <h1 style={{
        margin: 0,
        fontSize: 'var(--text-xl)',
        fontWeight: 'var(--weight-semibold)',
        color: 'var(--text-1)',
        letterSpacing: '-0.02em',
        lineHeight: 1.15,
      }}>
        {title}
      </h1>
      {subtitle ? (
        <p style={{
          margin: 'var(--space-xs) 0 0',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-3)',
          lineHeight: 1.5,
        }}>
          {subtitle}
        </p>
      ) : null}
    </div>
  )
}

function DetailsStep({
  draft,
  currency,
  onChange,
  canContinue,
  onContinue,
}: {
  draft: DraftEntry
  currency: string
  onChange: (patch: Partial<DraftEntry>) => void
  canContinue: boolean
  onContinue: () => void
}) {
  return (
    <div>
      <StepHeader eyebrow="Edit entry" title="Details" subtitle="Update the basic information for this entry." />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        <Input
          label="Name"
          value={draft.name}
          onChange={(value) => onChange({ name: value })}
          placeholder="Name"
          autoFocus
        />
        <MoneyInput
          label="Amount"
          currency={currency}
          value={draft.amount}
          onChange={(value) => onChange({ amount: value })}
          placeholder="0"
        />
        <Input
          label="Date"
          type="date"
          value={draft.date}
          onChange={(value) => onChange({ date: value })}
        />
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--weight-medium)',
            color: 'var(--text-2)',
          }}>
            Note
          </span>
          <textarea
            value={draft.note}
            onChange={(event) => onChange({ note: event.target.value })}
            placeholder="Optional note"
            rows={3}
            style={{
              borderRadius: 14,
              border: '1px solid var(--border)',
              padding: '12px 14px',
              fontSize: 'var(--text-base)',
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
        </label>
      </div>

      <div style={{ marginTop: 'var(--space-xxl)' }}>
        <PrimaryBtn size="lg" onClick={onContinue} disabled={!canContinue}>
          Continue
        </PrimaryBtn>
      </div>
    </div>
  )
}

function CategoryStep({
  draft,
  onChange,
  canContinue,
  onBack,
  onContinue,
}: {
  draft: DraftEntry
  onChange: (patch: Partial<DraftEntry>) => void
  canContinue: boolean
  onBack: () => void
  onContinue: () => void
}) {
  return (
    <div>
      <StepHeader eyebrow="Edit entry" title="Category" subtitle="Choose where this entry belongs." />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        {CATEGORY_GROUPS.map((group) => (
          <div key={group.type}>
            <p style={{
              margin: '0 0 var(--space-sm)',
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
            }}>
              {group.label}
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
              {group.options.map((option) => (
                <SingleSelectChip
                  key={option.key}
                  label={option.label}
                  selected={draft.categoryKey === option.key}
                  onClick={() => onChange({ categoryKey: option.key })}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 'var(--space-xxl)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-sm)',
      }}>
        <PrimaryBtn size="lg" onClick={onContinue} disabled={!canContinue}>
          Continue
        </PrimaryBtn>
        <SecondaryBtn size="lg" onClick={onBack}>
          Back
        </SecondaryBtn>
      </div>
    </div>
  )
}

function ReviewStep({
  draft,
  currency,
  canSave,
  isSaving,
  error,
  onBack,
  onSave,
}: {
  draft: DraftEntry
  currency: string
  canSave: boolean
  isSaving: boolean
  error: string | null
  onBack: () => void
  onSave: () => void
}) {
  const amountValue = useMemo(() => parseFloat(draft.amount) || 0, [draft.amount])
  const categoryLabel = draft.categoryKey ? getCategoryLabel(draft.categoryKey) : '—'

  return (
    <div>
      <StepHeader eyebrow="Edit entry" title="Review" subtitle="Make sure everything looks right." />

      <section style={{
        background: 'var(--white)',
        border: 'var(--border-width) solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-sm)',
      }}>
        <SummaryRow label="Name" value={draft.name.trim() || '—'} />
        <SummaryRow
          label="Amount"
          value={fmt(amountValue, currency)}
          monospaced
        />
        <SummaryRow label="Date" value={draft.date ? formatDate(draft.date) : '—'} />
        <SummaryRow label="Category" value={categoryLabel} />
        <SummaryRow label="Note" value={draft.note.trim() || '—'} />
      </section>

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

      <div style={{
        marginTop: 'var(--space-xxl)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-sm)',
      }}>
        <PrimaryBtn size="lg" onClick={onSave} disabled={!canSave || isSaving}>
          {isSaving ? 'Saving…' : 'Save changes'}
        </PrimaryBtn>
        <SecondaryBtn size="lg" onClick={onBack} disabled={isSaving}>
          Back
        </SecondaryBtn>
      </div>
    </div>
  )
}

function SummaryRow({ label, value, monospaced = false }: { label: string; value: string; monospaced?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 'var(--space-md)',
    }}>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>
        {label}
      </span>
      <span style={{
        fontSize: 'var(--text-base)',
        fontWeight: 'var(--weight-medium)',
        color: 'var(--text-1)',
        textAlign: 'right',
        ...(monospaced ? { fontVariantNumeric: 'tabular-nums' } : {}),
      }}>
        {value}
      </span>
    </div>
  )
}
