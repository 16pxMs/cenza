'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/context/UserContext'
import { deriveCurrentCycleId } from '@/lib/supabase/cycles-db'
import { saveExpenseBatch } from './actions'

type CategoryType = 'everyday' | 'fixed' | 'debt' | 'goal'
type Step = 'queue' | 'review' | 'done'
type QueueSource = 'common' | 'typed' | 'known'

interface DictEntry {
  categoryType: CategoryType
  label: string
  key: string | null
  usageCount: number
  lastUsed: string | null
}

interface PendingExpenseItem {
  id: string
  label: string
  categoryType: CategoryType | null
  categorySource: 'remembered' | 'manual' | null
  categoryKey: string | null
  amount: string
  note: string
  source: QueueSource
}

const T = {
  pageBg: 'var(--page-bg)',
  white: 'var(--white)',
  brandSoft: 'var(--brand)',
  brandMid: 'var(--brand-mid)',
  border: 'var(--border)',
  borderSubtle: 'var(--border-subtle)',
  borderWidth: 'var(--border-width)',
  text1: 'var(--text-1)',
  text2: 'var(--text-2)',
  text3: 'var(--text-3)',
  textMuted: 'var(--text-muted)',
  textInverse: 'var(--text-inverse)',
  brand: 'var(--brand)',
  brandDark: 'var(--brand-dark)',
  grey50: 'var(--grey-50)',
  grey100: 'var(--grey-100)',
  grey200: 'var(--grey-200)',
  redLight: 'var(--red-light)',
  redBorder: 'var(--red-border)',
  redDark: 'var(--red-dark)',
}

const TYPE_COPY: Record<Exclude<CategoryType, 'goal'>, { title: string; helper: string }> = {
  everyday: {
    title: 'Life',
    helper: 'Day-to-day, one-off, and personal expenses.',
  },
  fixed: {
    title: 'Essentials',
    helper: 'Must-pay home and living costs like rent or water.',
  },
  debt: {
    title: 'Debt',
    helper: 'Repayments like loans and credit cards.',
  },
}

const DEFAULT_COMMON_ITEMS: Array<{ label: string; categoryType: Exclude<CategoryType, 'goal'> }> = [
  { label: 'Groceries', categoryType: 'everyday' },
  { label: 'Transport', categoryType: 'everyday' },
  { label: 'Eating out', categoryType: 'everyday' },
  { label: 'Fuel', categoryType: 'everyday' },
  { label: 'Rent', categoryType: 'fixed' },
  { label: 'WiFi', categoryType: 'fixed' },
  { label: 'Electricity', categoryType: 'fixed' },
  { label: 'Water', categoryType: 'fixed' },
  { label: 'Netflix', categoryType: 'fixed' },
  { label: 'Loan payment', categoryType: 'debt' },
]

function buildDefaultCommonItems(): DictEntry[] {
  return DEFAULT_COMMON_ITEMS.map((item) => ({
    categoryType: item.categoryType,
    label: item.label,
    key: normalizeLabel(item.label).replace(/\s+/g, '_'),
    usageCount: 0,
    lastUsed: null,
  }))
}

function normalizeLabel(value: string) {
  return value.trim().toLowerCase()
}

function formatDisplayLabel(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/[A-Z]/.test(trimmed)) return trimmed

  return trimmed.replace(/\b\w/g, (char) => char.toUpperCase())
}

function suggestType(label: string): CategoryType | null {
  const l = label.toLowerCase()
  if (['rent', 'netflix', 'subscription', 'internet', 'wifi', 'water', 'power', 'electricity'].some(k => l.includes(k))) return 'fixed'
  if (['loan', 'debt', 'credit'].some(k => l.includes(k))) return 'debt'
  return 'everyday'
}

function buildPendingItem(label: string, source: QueueSource, dictEntry?: DictEntry | null): PendingExpenseItem {
  const cleanLabel = label.trim()
  const normalized = normalizeLabel(cleanLabel)
  const rememberedCategoryType = dictEntry && (dictEntry.usageCount > 0 || Boolean(dictEntry.lastUsed))
    ? dictEntry.categoryType
    : null

  return {
    id: normalized || `${source}-${Date.now()}`,
    label: cleanLabel,
    categoryType: rememberedCategoryType,
    categorySource: rememberedCategoryType ? 'remembered' : null,
    categoryKey: dictEntry?.key ?? normalized.replace(/\s+/g, '_'),
    amount: '',
    note: '',
    source,
  }
}

function formatMonthLabel() {
  return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function NewExpenseClient() {
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()
  const { user, profile } = useUser()

  const paramKey = params.get('key')
  const paramLabel = params.get('label')
  const paramAmount = params.get('amount')
  const rawParamType = params.get('type')
  const isOther = params.get('isOther') === 'true'
  const returnTo = params.get('returnTo') || '/log'
  const paramType = rawParamType === 'everyday' || rawParamType === 'fixed' || rawParamType === 'debt' || rawParamType === 'goal'
    ? rawParamType
    : null

  const [step, setStep] = useState<Step>(isOther ? 'queue' : 'review')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedCount, setSavedCount] = useState(0)
  const [queueNotice, setQueueNotice] = useState<string | null>(null)
  const [newItemName, setNewItemName] = useState('')
  const [queue, setQueue] = useState<PendingExpenseItem[]>(() => {
    if (!isOther && paramLabel) {
      return [{
        id: normalizeLabel(paramLabel),
        label: paramLabel,
        categoryType: paramType,
        categorySource: paramType ? 'remembered' : null,
        categoryKey: paramKey ?? normalizeLabel(paramLabel).replace(/\s+/g, '_'),
        amount: paramAmount ?? '',
        note: '',
        source: 'known',
      }]
    }

    return []
  })
  const [activeIndex, setActiveIndex] = useState(0)
  const [mode, setMode] = useState<'add' | 'update'>('add')
  const [priorEntry, setPriorEntry] = useState<{ id: string; amount: number } | null | undefined>(undefined)
  const [dictionary, setDictionary] = useState<Record<string, DictEntry>>({})
  const [commonItems, setCommonItems] = useState<DictEntry[]>(() => buildDefaultCommonItems())

  const currency = profile?.currency || 'USD'
  const activeItem = queue[activeIndex] ?? null
  const parsedAmount = parseFloat((activeItem?.amount ?? '').replace(/,/g, '')) || 0

  const rankedCommonItems = useMemo(() => {
    const visible = commonItems.slice(0, 10)
    const visibleSet = new Set(visible.map((item) => normalizeLabel(item.label)))
    const selectedExtras: DictEntry[] = []

    for (const queuedItem of queue) {
      const normalized = normalizeLabel(queuedItem.label)
      if (visibleSet.has(normalized)) continue

      selectedExtras.push({
        categoryType: queuedItem.categoryType ?? 'everyday',
        label: queuedItem.label,
        key: queuedItem.categoryKey,
        usageCount: 0,
        lastUsed: null,
      })
      visibleSet.add(normalized)
    }

    return [...visible, ...selectedExtras]
  }, [commonItems, queue])

  useEffect(() => {
    if (!user?.id) return

    ;(supabase.from('item_dictionary') as any)
      .select('name_normalized, label, category_type, category_key, usage_count')
      .eq('user_id', user.id)
      .then(async ({ data }: any) => {
        if (!data) return

        const dict: Record<string, DictEntry> = {}
        const items: DictEntry[] = []

        for (const row of data) {
          const entry: DictEntry = {
            categoryType: row.category_type as CategoryType,
            label: row.label,
            key: row.category_key,
            usageCount: Number(row.usage_count ?? 0),
            lastUsed: null,
          }
          dict[row.name_normalized] = entry
          items.push(entry)
        }

        const { data: recentRows } = await (supabase.from('transactions') as any)
          .select('category_label, category_type, category_key, date')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .limit(40)

        const recentSeen = new Set<string>()
        for (const row of recentRows ?? []) {
          const normalized = normalizeLabel(row.category_label ?? '')
          if (!normalized || recentSeen.has(normalized)) continue
          recentSeen.add(normalized)

          const existing = dict[normalized]
          if (existing) {
            existing.lastUsed = row.date ?? null
            continue
          }

          const entry: DictEntry = {
            categoryType: (row.category_type as CategoryType) ?? suggestType(row.category_label ?? '') ?? 'everyday',
            label: row.category_label,
            key: row.category_key ?? normalized.replace(/\s+/g, '_'),
            usageCount: 0,
            lastUsed: row.date ?? null,
          }

          dict[normalized] = entry
          items.push(entry)
        }

        const starterLabels = new Set(DEFAULT_COMMON_ITEMS.map((item) => normalizeLabel(item.label)))

        for (const starter of DEFAULT_COMMON_ITEMS) {
          const normalized = normalizeLabel(starter.label)
          if (dict[normalized]) continue

          const entry: DictEntry = {
            categoryType: starter.categoryType,
            label: starter.label,
            key: normalized.replace(/\s+/g, '_'),
            usageCount: 0,
            lastUsed: null,
          }

          dict[normalized] = entry
          items.push(entry)
        }

        const now = Date.now()
        const ranked = items
          .map((item) => {
            const recentDays = item.lastUsed
              ? Math.max(0, Math.floor((now - new Date(item.lastUsed).getTime()) / (1000 * 60 * 60 * 24)))
              : 999

            const recencyScore =
              recentDays <= 3 ? 100 :
              recentDays <= 7 ? 70 :
              recentDays <= 14 ? 40 :
              recentDays <= 30 ? 20 :
              0

            const frequencyScore = Math.min(item.usageCount * 8, 80)
            const starterScore = starterLabels.has(normalizeLabel(item.label)) ? 12 : 0

            return {
              ...item,
              score: recencyScore + frequencyScore + starterScore,
            }
          })
          .sort((a, b) => b.score - a.score || b.usageCount - a.usageCount || a.label.localeCompare(b.label))
          .map(({ score: _score, ...item }) => item)

        setDictionary(dict)
        setCommonItems(ranked)
      })
  }, [supabase, user])

  const [cycleId, setCycleId] = useState<string | null>(null)
  useEffect(() => {
    if (!user || !profile) return
    setCycleId(deriveCurrentCycleId(profile as any))
  }, [user, profile])

  useEffect(() => {
    if (isOther || !paramKey || !user || !cycleId) { setPriorEntry(null); return }
    ;(supabase.from('transactions') as any)
      .select('id, amount')
      .eq('user_id', user.id)
      .eq('category_key', paramKey)
      .eq('cycle_id', cycleId)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }: any) => setPriorEntry(data ?? null))
  }, [cycleId, isOther, paramKey, supabase, user])

  const updateActiveItem = (patch: Partial<PendingExpenseItem>) => {
    setQueue((current) => current.map((item, index) => (
      index === activeIndex ? { ...item, ...patch } : item
    )))
  }

  const toggleCommonItem = (label: string) => {
    const normalized = normalizeLabel(label)
    const exists = queue.some((item) => normalizeLabel(item.label) === normalized)

    if (exists) {
      setQueue((current) => current.filter((item) => normalizeLabel(item.label) !== normalized))
      setQueueNotice(null)
      return
    }

    const dictEntry = dictionary[normalized] ?? null
    setQueue((current) => [...current, buildPendingItem(label, 'common', dictEntry)])
    setQueueNotice(null)
  }

  const addTypedItem = () => {
    const normalized = normalizeLabel(newItemName)
    if (!normalized) return

    const exists = queue.some((item) => normalizeLabel(item.label) === normalized)
    if (exists) {
      setQueueNotice(`"${newItemName.trim()}" is already in your list.`)
      setNewItemName('')
      return
    }

    const dictEntry = dictionary[normalized] ?? null
    setQueue((current) => [...current, buildPendingItem(newItemName, 'typed', dictEntry)])
    setQueueNotice(null)
    setNewItemName('')
  }

  const handleBack = () => {
    if (step === 'review') {
      if (!isOther) {
        router.push(returnTo)
        return
      }

      if (activeIndex > 0) {
        setActiveIndex((current) => current - 1)
        return
      }

      setStep('queue')
      return
    }

    router.push(returnTo)
  }

  const handleContinueToReview = () => {
    if (queue.length === 0) return
    setActiveIndex(0)
    setStep('review')
  }

  const handleNext = () => {
    if (!activeItem || !activeItem.categoryType || parsedAmount <= 0) return
    if (activeIndex < queue.length - 1) {
      setActiveIndex((current) => current + 1)
    }
  }

  const handleSaveAll = async () => {
    if (!user || queue.length === 0) return

    setSaving(true)
    setSaveError(null)

    try {
      if (queue.some((item) => !item.categoryType)) {
        throw new Error('Choose a category for each expense before saving.')
      }

      await saveExpenseBatch(queue.map((item, index) => ({
        mode: !isOther && index === 0 ? mode : 'add',
        priorEntryId: !isOther && index === 0 ? priorEntry?.id ?? null : null,
        categoryType: item.categoryType as CategoryType,
        categoryKey: item.categoryKey ?? normalizeLabel(item.label).replace(/\s+/g, '_'),
        categoryLabel: item.label,
        amount: parseFloat(item.amount.replace(/,/g, '')) || 0,
        note: item.note.trim() || null,
        rememberItem: true,
      })))

      setSavedCount(queue.length)
      setSaving(false)
      setStep('done')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message.replace(/^.*?: /, '') : 'Failed to save expenses. Please try again.')
      setSaving(false)
    }
  }

  const isLastItem = activeIndex === queue.length - 1
  const canReviewContinue = queue.length > 0
  const canAdvance = !!activeItem?.categoryType && parsedAmount > 0

  return (
    <div style={{ minHeight: '100vh', background: T.pageBg, display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: 'var(--space-md) var(--space-page-mobile) 0',
        maxWidth: 560,
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box',
      }}>
        <button
          onClick={handleBack}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 'var(--space-xs)',
            color: T.text2,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ArrowLeft size={20} />
        </button>
      </div>

      <div style={{
        padding: 'var(--space-sm) var(--space-page-mobile) var(--space-xl)',
        maxWidth: 560,
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box',
        flex: 1,
      }}>
        <p style={{ margin: step === 'review' ? '0 0 var(--space-sm)' : step === 'done' ? '0 0 var(--space-lg)' : '0 0 2px', fontSize: 'var(--text-xs)', color: T.text3 }}>
          {formatMonthLabel()}
        </p>
        {step === 'queue' && (
          <h1 style={{ margin: '0 0 var(--space-lg)', fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', color: T.text1, letterSpacing: '-0.02em' }}>
            Add an expense
          </h1>
        )}

        <div style={{
          background: T.white,
          borderRadius: 'var(--radius-card)',
          boxShadow: step === 'done' ? 'none' : 'var(--shadow-sm)',
          padding: 'var(--space-lg) var(--space-card-sm)',
        }}>
          {step === 'queue' ? (
            <QueueStep
              newItemName={newItemName}
              setNewItemName={setNewItemName}
              queue={queue}
              commonItems={rankedCommonItems}
              queueNotice={queueNotice}
              onToggleCommon={toggleCommonItem}
              onAddTypedItem={addTypedItem}
              onContinue={handleContinueToReview}
              canContinue={canReviewContinue}
            />
          ) : step === 'done' ? (
            <DoneStep
              savedCount={savedCount}
              items={queue}
              currency={currency}
              onLogMore={() => {
                setQueue([])
                setActiveIndex(0)
                setNewItemName('')
                setSaveError(null)
                setSavedCount(0)
                setStep('queue')
              }}
              onGoToRecap={() => router.push('/log')}
            />
          ) : activeItem ? (
            <ReviewStep
              item={activeItem}
              currency={currency}
              currentIndex={activeIndex}
              totalItems={queue.length}
              mode={mode}
              setMode={setMode}
              priorEntry={priorEntry ?? null}
              saving={saving}
              saveError={saveError}
              onAmountChange={(value) => updateActiveItem({ amount: value })}
              onTypeSelect={(type) => updateActiveItem({ categoryType: type, categorySource: 'manual' })}
              onNoteChange={(value) => updateActiveItem({ note: value })}
              onNext={handleNext}
              onSaveAll={handleSaveAll}
              canAdvance={canAdvance}
              isLastItem={isLastItem}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

function DoneStep({
  savedCount,
  items,
  currency,
  onLogMore,
  onGoToRecap,
}: {
  savedCount: number
  items: PendingExpenseItem[]
  currency: string
  onLogMore: () => void
  onGoToRecap: () => void
}) {
  const formatSummaryAmount = (value: string) => {
    const amount = parseFloat(value.replace(/,/g, '')) || 0
    return `${currency} ${amount.toLocaleString()}`
  }

  return (
    <div>
      <p style={{ margin: '0 0 var(--space-sm)', fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: T.text1, lineHeight: 1.15 }}>
        {savedCount} {savedCount === 1 ? 'expense added' : 'expenses added'}
      </p>
      <p style={{ margin: '0 0 var(--space-lg)', fontSize: 'var(--text-base)', color: T.text2, lineHeight: 1.5 }}>
        Your expense log is up to date.
      </p>

      <div style={{ marginBottom: 'var(--space-lg)', borderTop: `${T.borderWidth} solid ${T.borderSubtle}`, borderBottom: `${T.borderWidth} solid ${T.borderSubtle}` }}>
        {items.map((item, index) => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 'var(--space-md)',
              padding: 'var(--space-md) 0',
              borderBottom: index < items.length - 1 ? `${T.borderWidth} solid ${T.borderSubtle}` : 'none',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: '0 0 var(--space-xs)', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: T.text1, lineHeight: 1.35 }}>
                {formatDisplayLabel(item.label)}
              </p>
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: T.text3, lineHeight: 1.4 }}>
                {item.categoryType ? TYPE_COPY[item.categoryType as Exclude<CategoryType, 'goal'>].title : 'Uncategorized'}
              </p>
            </div>
            <p style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: T.text1, whiteSpace: 'nowrap' }}>
              {formatSummaryAmount(item.amount)}
            </p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
        <button
          onClick={onLogMore}
          style={{
            width: '100%',
            height: 'var(--button-height)',
            borderRadius: 'var(--radius-md)',
            background: T.brandDark,
            border: 'none',
            color: T.textInverse,
            fontSize: 'var(--text-base)',
          fontWeight: 'var(--weight-semibold)',
          cursor: 'pointer',
        }}
        >
          Log more
        </button>
        <button
          onClick={onGoToRecap}
          style={{
            width: '100%',
            height: 'var(--button-height)',
            borderRadius: 'var(--radius-md)',
            background: T.white,
            border: `${T.borderWidth} solid ${T.border}`,
            color: T.text1,
            fontSize: 'var(--text-base)',
            fontWeight: 'var(--weight-semibold)',
            cursor: 'pointer',
          }}
        >
          View expense log
        </button>
      </div>
    </div>
  )
}

function QueueStep({
  newItemName,
  setNewItemName,
  queue,
  commonItems,
  queueNotice,
  onToggleCommon,
  onAddTypedItem,
  onContinue,
  canContinue,
}: {
  newItemName: string
  setNewItemName: (value: string) => void
  queue: PendingExpenseItem[]
  commonItems: DictEntry[]
  queueNotice: string | null
  onToggleCommon: (label: string) => void
  onAddTypedItem: () => void
  onContinue: () => void
  canContinue: boolean
}) {
  const selectedSet = new Set(queue.map((item) => normalizeLabel(item.label)))
  const canAddTypedItem = newItemName.trim().length > 0

  return (
    <div>
      {/* Title */}
      <p style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 600, color: T.text1, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
        What did you spend on?
      </p>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: T.text3, lineHeight: 1.5 }}>
        Tap what applies, or add something new.
      </p>

      {/* Common items */}
      {commonItems.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Common items
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {commonItems.map((item) => {
              const label = item.label
              const displayLabel = formatDisplayLabel(label)
              const isSelected = selectedSet.has(normalizeLabel(label))

              return (
                <button
                  key={label}
                  onClick={() => onToggleCommon(label)}
                  style={{
                    height: '38px',
                    padding: '0 var(--space-md)',
                    borderRadius: 'var(--radius-full)',
                    border: isSelected
                      ? `${T.borderWidth} solid ${T.brandMid}`
                      : `${T.borderWidth} solid ${T.border}`,
                    background: isSelected ? T.brandSoft : T.grey100,
                    color: isSelected ? T.brandDark : T.text1,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{displayLabel}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Free-text input row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={newItemName}
          onChange={(event) => setNewItemName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onAddTypedItem()
            }
          }}
          placeholder="Add something else"
          style={{
            flex: 1,
            height: 48,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            padding: '0 14px',
            fontSize: 15,
            color: T.text1,
            background: T.white,
            outline: 'none',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={onAddTypedItem}
          disabled={!canAddTypedItem}
          style={{
            width: 48,
            height: 48,
            borderRadius: 'var(--radius-sm)',
            border: `${T.borderWidth} solid ${T.border}`,
            background: canAddTypedItem ? T.brandSoft : T.white,
            color: canAddTypedItem ? T.brandDark : T.textMuted,
            cursor: canAddTypedItem ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 0.15s ease',
          }}
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Queue notice */}
      {queueNotice && (
        <p style={{ margin: '0 0 12px', fontSize: 12, color: T.textMuted, lineHeight: 1.5 }}>
          {queueNotice}
        </p>
      )}

      {/* CTA */}
      <button
        onClick={onContinue}
        disabled={!canContinue}
        style={{
          width: '100%',
          height: 52,
          borderRadius: 'var(--radius-md)',
          background: canContinue ? T.brandDark : T.grey200,
          border: 'none',
          color: canContinue ? T.textInverse : T.textMuted,
          fontSize: 'var(--text-base)',
          fontWeight: 'var(--weight-semibold)',
          cursor: canContinue ? 'pointer' : 'not-allowed',
          letterSpacing: '-0.01em',
          marginTop: 4,
        }}
      >
        Continue with {queue.length} {queue.length === 1 ? 'item' : 'items'}
      </button>
    </div>
  )
}

function ReviewStep({
  item,
  currency,
  currentIndex,
  totalItems,
  mode,
  setMode,
  priorEntry,
  saving,
  saveError,
  onAmountChange,
  onTypeSelect,
  onNoteChange,
  onNext,
  onSaveAll,
  canAdvance,
  isLastItem,
}: {
  item: PendingExpenseItem
  currency: string
  currentIndex: number
  totalItems: number
  mode: 'add' | 'update'
  setMode: (mode: 'add' | 'update') => void
  priorEntry: { id: string; amount: number } | null
  saving: boolean
  saveError: string | null
  onAmountChange: (value: string) => void
  onTypeSelect: (type: CategoryType | null) => void
  onNoteChange: (value: string) => void
  onNext: () => void
  onSaveAll: () => void
  canAdvance: boolean
  isLastItem: boolean
}) {
  const [showNote, setShowNote] = useState(Boolean(item.note))
  useEffect(() => {
    setShowNote(Boolean(item.note))
  }, [item.id, item.note])

  const displayAmount = item.amount
    ? item.amount.replace(/,/g, '').split('.').map((part, index) => (
      index === 0 ? part.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : part
    )).join('.')
    : ''

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <span style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: T.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 'var(--space-xs)' }}>
          {currentIndex + 1} of {totalItems}
        </span>
        <div style={{ height: 'var(--size-bar-sm)', background: T.grey100, borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${((currentIndex + 1) / totalItems) * 100}%`,
            background: T.brandDark,
            borderRadius: 'var(--radius-full)',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          minHeight: '40px',
          padding: '0 var(--space-md)',
          borderRadius: 'var(--radius-full)',
          background: T.grey50,
          color: T.text1,
          fontSize: 'var(--text-lg)',
          fontWeight: 'var(--weight-semibold)',
          lineHeight: 1,
        }}>
          {formatDisplayLabel(item.label)}
        </span>
      </div>

      {priorEntry && totalItems === 1 && (
        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
          {(['update', 'add'] as const).map((value) => (
            <button
              key={value}
              onClick={() => {
                setMode(value)
                if (value === 'update') onAmountChange(String(priorEntry.amount))
              }}
              style={{
                flex: 1,
                height: '40px',
                borderRadius: 'var(--radius-full)',
                border: mode === value ? `2px solid ${T.brandDark}` : `${T.borderWidth} solid ${T.grey200}`,
                background: mode === value ? T.brandDark : T.grey100,
                color: mode === value ? T.textInverse : T.text2,
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {value === 'update' ? 'Update entry' : 'Add another'}
            </button>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <p style={{ margin: '0 0 var(--space-sm)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Amount
        </p>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        height: '56px',
        border: `${T.borderWidth} solid ${T.border}`,
        borderRadius: 'var(--radius-sm)',
        background: T.white,
        overflow: 'hidden',
      }}>
        <span style={{
          padding: '0 var(--space-md)',
          fontSize: 'var(--text-base)',
          fontWeight: 'var(--weight-medium)',
          color: T.text3,
          borderRight: `${T.borderWidth} solid ${T.border}`,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          background: T.grey50,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          {currency}
        </span>
        <input
          autoFocus
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={displayAmount}
          onChange={(event) => {
            const raw = event.target.value.replace(/,/g, '')
            if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return
            onAmountChange(raw)
          }}
          style={{
            flex: 1,
            height: '100%',
            border: 'none',
            outline: 'none',
            padding: '0 var(--space-md)',
            fontSize: 'var(--text-xl)',
            fontWeight: 'var(--weight-semibold)',
            color: T.text1,
            background: 'transparent',
            fontFamily: 'inherit',
          }}
        />
      </div>
      </div>

      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <p style={{ margin: '0 0 var(--space-sm)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Count this as
        </p>
        <TypeChips selected={item.categoryType} onSelect={onTypeSelect} />
        <p style={{ margin: 'var(--space-sm) 0 0', fontSize: 'var(--text-sm)', color: T.text3, lineHeight: 1.5, minHeight: '20px' }}>
          {item.categoryType
            ? TYPE_COPY[item.categoryType as Exclude<CategoryType, 'goal'>].helper
            : 'Choose how Cenza should count this expense.'}
        </p>
      </div>

      <div style={{ marginBottom: 'var(--space-lg)' }}>
        {!showNote && !item.note ? (
          <button
            onClick={() => setShowNote(true)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: T.text3,
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--weight-medium)',
              cursor: 'pointer',
            }}
          >
            Add a note (optional)
          </button>
        ) : (
          <input
            type="text"
            placeholder="Add a note (optional)"
            value={item.note}
            onChange={(event) => onNoteChange(event.target.value)}
            style={{
              width: '100%',
              height: '48px',
              borderRadius: 'var(--radius-sm)',
              border: `${T.borderWidth} solid ${T.border}`,
              padding: '0 var(--space-md)',
              fontSize: 'var(--text-base)',
              color: T.text1,
              background: T.white,
              outline: 'none',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
            }}
          />
        )}
      </div>

      {saveError && (
        <p style={{
          margin: '0 0 var(--space-md)',
          padding: '10px 14px',
          borderRadius: 'var(--radius-sm)',
          background: T.redLight,
          border: `${T.borderWidth} solid ${T.redBorder}`,
          fontSize: 'var(--text-sm)',
          color: T.redDark,
          lineHeight: 1.5,
        }}>
          {saveError}
        </p>
      )}

      <button
        onClick={isLastItem ? onSaveAll : onNext}
        disabled={!canAdvance || saving}
        style={{
          width: '100%',
          height: '52px',
          borderRadius: 'var(--radius-md)',
          background: canAdvance ? 'var(--brand-dark)' : 'var(--grey-200)',
          border: 'none',
          color: canAdvance ? T.textInverse : T.textMuted,
          fontSize: 'var(--text-base)',
          fontWeight: 'var(--weight-semibold)',
          cursor: canAdvance ? 'pointer' : 'not-allowed',
          letterSpacing: '-0.01em',
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? 'Saving…' : isLastItem ? 'Save all' : 'Next'}
      </button>
    </div>
  )
}

function TypeChips({ selected, onSelect }: {
  selected: CategoryType | null
  onSelect: (type: CategoryType | null) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
      {(Object.entries(TYPE_COPY) as [Exclude<CategoryType, 'goal'>, { title: string }][])
        .map(([value, copy]) => (
          <button
            key={value}
            onClick={() => onSelect(selected === value ? null : value)}
            style={{
              height: '40px',
              padding: '0 var(--space-md)',
              borderRadius: 'var(--radius-full)',
              border: selected === value
                ? `${T.borderWidth} solid ${T.brandMid}`
                : `${T.borderWidth} solid ${T.grey200}`,
              background: selected === value ? T.brandSoft : T.grey50,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', color: selected === value ? T.brandDark : T.text1 }}>
              {copy.title}
            </div>
          </button>
        ))}
    </div>
  )
}
