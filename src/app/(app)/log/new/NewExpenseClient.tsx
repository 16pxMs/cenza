'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/context/UserContext'
import { deriveCurrentCycleId } from '@/lib/supabase/cycles-db'
import { hasIncomeForCycle } from '@/lib/income/derived'
import { PrimaryBtn, SecondaryBtn, TertiaryBtn } from '@/components/ui/Button/Button'
import { IconBack, IconCheck, IconPlus } from '@/components/ui/Icons'
import { ExpenseAddedSuccess, type ExpenseAddedSuccessEntry } from '@/components/flows/log/ExpenseAddedSuccess'
import { saveExpenseBatch } from './actions'
import { GOAL_META } from '@/constants/goals'
import type { GoalId } from '@/types/database'

type CategoryType = 'everyday' | 'fixed' | 'debt' | 'goal'
type Step = 'method' | 'queue' | 'review' | 'done'
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
  repeatsMonthly: boolean
}

interface RecentLoggedEntry {
  id: string
  label: string
  amount: number
  date: string
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
    title: 'Spending',
    helper: 'For everyday spending like food, transport, or going out',
  },
  fixed: {
    title: 'Fixed',
    helper: 'For fixed costs like rent, bills, or subscriptions',
  },
  debt: {
    title: 'Debt',
    helper: 'Debt is tracked separately with balances and repayments',
  },
}

const DEFAULT_COMMON_ITEMS: Array<{ label: string; categoryType: Exclude<CategoryType, 'goal'> }> = [
  { label: 'Groceries', categoryType: 'everyday' },
  { label: 'Transport', categoryType: 'everyday' },
  { label: 'Eating out', categoryType: 'everyday' },
  { label: 'Fuel', categoryType: 'everyday' },
  { label: 'Rent', categoryType: 'fixed' },
  { label: 'Internet', categoryType: 'fixed' },
  { label: 'Electricity', categoryType: 'fixed' },
  { label: 'Water', categoryType: 'fixed' },
  { label: 'Netflix', categoryType: 'fixed' },
]
const QUICK_ENTRY_LIMIT_WITHOUT_INCOME = 3

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

function normalizeCategoryType(value: string | null | undefined): CategoryType | null {
  if (value === 'essentials' || value === 'fixed') return 'fixed'
  if (value === 'everyday' || value === 'debt' || value === 'goal') return value
  return null
}

function categoryFromPriorEntries(items: PendingExpenseItem[]): CategoryType | null {
  if (items.length < 2) return null
  const firstType = items[0]?.categoryType
  if (!firstType) return null
  return items.every((item) => item.categoryType === firstType) ? firstType : null
}

function makePendingId(label: string, source: QueueSource) {
  const normalized = normalizeLabel(label) || source
  return `${normalized}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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
  return null
}

function buildPendingItem(
  label: string,
  source: QueueSource,
  dictEntry?: DictEntry | null,
): PendingExpenseItem {
  const cleanLabel = label.trim()
  const normalized = normalizeLabel(cleanLabel)
  const rememberedCategoryType = dictEntry && dictEntry.usageCount >= 2
    && dictEntry.categoryType !== 'debt'
    ? dictEntry.categoryType
    : null

  return {
    id: makePendingId(cleanLabel, source),
    label: cleanLabel,
    categoryType: rememberedCategoryType,
    categorySource: rememberedCategoryType ? 'remembered' : null,
    categoryKey: dictEntry?.key ?? normalized.replace(/\s+/g, '_'),
    amount: '',
    note: '',
    source,
    repeatsMonthly: false,
  }
}

function formatMonthLabel() {
  return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function parseLocalDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

function formatRecentEntryHint(entry: RecentLoggedEntry, currency: string, name: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const entryDate = parseLocalDate(entry.date)
  entryDate.setHours(0, 0, 0, 0)

  const diffDays = Math.round((today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24))
  const amount = `${currency} ${entry.amount.toLocaleString()}`
  const displayName = name.trim().toLowerCase() || 'entry'

  let timeAgo: string
  if (diffDays <= 0) timeAgo = 'today'
  else if (diffDays === 1) timeAgo = 'yesterday'
  else if (diffDays < 7) timeAgo = `${diffDays} days ago`
  else timeAgo = entryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return `Last ${displayName} entry: ${amount} · ${timeAgo}`
}

export function NewExpenseClient() {
  const router = useRouter()
  const params = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const { user, profile } = useUser()

  const paramKey = params.get('key')
  const paramLabel = params.get('label')
  const paramAmount = params.get('amount')
  const rawParamType = params.get('type')
  const isOther = params.get('isOther') === 'true'
  const returnTo = params.get('returnTo') || '/log'
  const paramType = normalizeCategoryType(rawParamType)
  const buildDebtCreateHref = (prefillName?: string, prefillAmount?: string) => {
    const target = new URLSearchParams({ returnTo })
    const cleanedName = prefillName?.trim()
    const cleanedAmount = prefillAmount?.replace(/,/g, '').trim()
    if (cleanedName) target.set('name', cleanedName)
    if (cleanedAmount) target.set('amount', cleanedAmount)
    return `/history/debt/new?${target.toString()}`
  }
  const debtCreateHref = buildDebtCreateHref()

  const hasInitialKnownItem = !isOther && Boolean(paramLabel)
  const [step, setStep] = useState<Step>(
    hasInitialKnownItem ? 'review' : isOther ? 'queue' : 'method'
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedCount, setSavedCount] = useState(0)
  const [savedItems, setSavedItems] = useState<PendingExpenseItem[]>([])
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
        repeatsMonthly: false,
      }]
    }

    return []
  })
  const [activeIndex, setActiveIndex] = useState(0)
  const [dictionary, setDictionary] = useState<Record<string, DictEntry>>({})
  const [commonItems, setCommonItems] = useState<DictEntry[]>(() => buildDefaultCommonItems())
  const [recentByLabel, setRecentByLabel] = useState<Record<string, RecentLoggedEntry>>({})
  const [quickEntryStatus, setQuickEntryStatus] = useState<{
    loaded: boolean
    hasIncome: boolean
    existingExpenseCount: number
  }>({
    loaded: false,
    hasIncome: true,
    existingExpenseCount: 0,
  })

  const currency = profile?.currency || 'USD'
  const activeItem = queue[activeIndex] ?? null
  const parsedAmount = parseFloat((activeItem?.amount ?? '').replace(/,/g, '')) || 0
  const activeLabelNormalized = activeItem ? normalizeLabel(activeItem.label) : ''
  const groupedEntriesForActiveItem = activeLabelNormalized
    ? queue.filter((item) => normalizeLabel(item.label) === activeLabelNormalized)
    : []
  const activeGroupedIndex = activeItem
    ? groupedEntriesForActiveItem.findIndex((item) => item.id === activeItem.id)
    : -1
  const groupedEntriesBeforeActive = activeGroupedIndex > 0
    ? groupedEntriesForActiveItem.slice(0, activeGroupedIndex)
    : []
  const groupedLabelsInOrder = useMemo(() => {
    const seen = new Set<string>()
    const labels: string[] = []

    for (const queuedItem of queue) {
      const normalized = normalizeLabel(queuedItem.label)
      if (!normalized || seen.has(normalized)) continue
      seen.add(normalized)
      labels.push(normalized)
    }

    return labels
  }, [queue])
  const activeGroupFlowIndex = activeLabelNormalized
    ? groupedLabelsInOrder.findIndex((label) => label === activeLabelNormalized)
    : -1

  useEffect(() => {
    if (paramType === 'debt') {
      router.replace(debtCreateHref)
    }
  }, [debtCreateHref, paramType, router])

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
          const normalizedCategoryType = normalizeCategoryType(row.category_type)
          if (normalizedCategoryType === 'debt') continue

          const entry: DictEntry = {
            categoryType: normalizedCategoryType ?? 'everyday',
            label: row.label,
            key: row.category_key,
            usageCount: 0,
            lastUsed: null,
          }
          dict[row.name_normalized] = entry
          items.push(entry)
        }

        const { data: recentRows } = await (supabase.from('transactions') as any)
          .select('id, category_label, category_type, category_key, amount, date')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .limit(300)

        const recentSeen = new Set<string>()
        const recentMap: Record<string, RecentLoggedEntry> = {}
        const categoryCountsByLabel = new Map<string, Map<CategoryType, number>>()
        for (const row of recentRows ?? []) {
          const normalized = normalizeLabel(row.category_label ?? '')
          const categoryType = normalizeCategoryType(row.category_type)
          if (categoryType === 'debt') continue
          if (normalized && categoryType) {
            const counts = categoryCountsByLabel.get(normalized) ?? new Map<CategoryType, number>()
            counts.set(categoryType, (counts.get(categoryType) ?? 0) + 1)
            categoryCountsByLabel.set(normalized, counts)
          }

          if (!normalized || recentSeen.has(normalized)) continue
          recentSeen.add(normalized)

          const existing = dict[normalized]
          if (existing) {
            existing.lastUsed = row.date ?? null
          } else {
            const entry: DictEntry = {
              categoryType: categoryType ?? suggestType(row.category_label ?? '') ?? 'everyday',
              label: row.category_label,
              key: row.category_key ?? normalized.replace(/\s+/g, '_'),
              usageCount: 0,
              lastUsed: row.date ?? null,
            }

            dict[normalized] = entry
            items.push(entry)
          }

          recentMap[normalized] = {
            id: String(row.id),
            label: row.category_label,
            amount: Math.abs(Number(row.amount ?? 0)),
            date: row.date,
          }
        }

        for (const [normalized, counts] of categoryCountsByLabel) {
          const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0)
          if (total < 2 || counts.size !== 1) continue
          const categoryType = Array.from(counts.keys())[0]
          if (categoryType === 'debt') continue
          const existing = dict[normalized]
          if (existing) {
            existing.categoryType = categoryType
            existing.usageCount = total
          }
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
        setRecentByLabel(recentMap)
      })
  }, [supabase, user])

  const [cycleId, setCycleId] = useState<string | null>(null)
  useEffect(() => {
    if (!user || !profile) return
    setCycleId(deriveCurrentCycleId(profile as any))
  }, [user, profile])

  useEffect(() => {
    if (!user?.id || !cycleId) return

    ;(async () => {
      const [{ data: incomeRow }, { data: txRows }] = await Promise.all([
        (supabase.from('income_entries') as any)
          .select('total, opening_balance, received')
          .eq('user_id', user.id)
          .eq('cycle_id', cycleId)
          .maybeSingle(),
        (supabase.from('transactions') as any)
          .select('id, category_type')
          .eq('user_id', user.id)
          .eq('cycle_id', cycleId),
      ])

      const hasIncomeForCurrentCycle = hasIncomeForCycle(incomeRow)
      const existingExpenseCount = (txRows ?? []).filter((txn: any) => txn.category_type !== 'goal').length

      setQuickEntryStatus({
        loaded: true,
        hasIncome: hasIncomeForCurrentCycle,
        existingExpenseCount,
      })
    })()
  }, [supabase, user?.id, cycleId])

  const remainingQuickEntries = quickEntryStatus.hasIncome
    ? Number.POSITIVE_INFINITY
    : Math.max(0, QUICK_ENTRY_LIMIT_WITHOUT_INCOME - quickEntryStatus.existingExpenseCount)

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

    if (!quickEntryStatus.hasIncome && queue.length >= remainingQuickEntries) {
      setQueueNotice('Add income to continue logging more expenses.')
      return
    }

    const dictEntry = dictionary[normalized] ?? null
    setQueue((current) => [...current, buildPendingItem(label, 'common', dictEntry)])
    setQueueNotice(null)
  }

  const addTypedItem = () => {
    const normalized = normalizeLabel(newItemName)
    if (!normalized) return false

    const exists = queue.some((item) => normalizeLabel(item.label) === normalized)
    if (exists) {
      setQueueNotice(`"${newItemName.trim()}" is already in your list.`)
      setNewItemName('')
      return false
    }

    if (!quickEntryStatus.hasIncome && queue.length >= remainingQuickEntries) {
      setQueueNotice('Add income to continue logging more expenses.')
      return false
    }

    const dictEntry = dictionary[normalized] ?? null
    setQueue((current) => [...current, buildPendingItem(newItemName, 'typed', dictEntry)])
    setQueueNotice(null)
    setNewItemName('')
    return true
  }

  const handleBack = () => {
    if (step === 'review') {
      if (activeIndex > 0) {
        setActiveIndex((current) => current - 1)
        return
      }

      if (hasInitialKnownItem) {
        router.push(returnTo)
        return
      }

      setStep('queue')
      return
    }

    if (step === 'queue') {
      router.push(`/log/import?returnTo=${encodeURIComponent(returnTo)}`)
      return
    }

    router.push(returnTo)
  }

  const handleContinueToReview = () => {
    if (queue.length === 0) return
    if (queue.some((item) => item.categoryType === 'debt')) {
      router.push(debtCreateHref)
      return
    }
    if (!quickEntryStatus.hasIncome && queue.length > remainingQuickEntries) {
      setQueueNotice('Add income to continue logging more expenses.')
      return
    }
    setActiveIndex(0)
    setStep('review')
  }

  const handleNext = () => {
    if (!activeItem || !activeItem.categoryType || parsedAmount <= 0 || !activeItem.label.trim()) return
    if (activeIndex < queue.length - 1) {
      setActiveIndex((current) => current + 1)
    }
  }

  const handlePrevious = () => {
    if (activeIndex > 0) {
      setActiveIndex((current) => current - 1)
    }
  }

  const handleAddAnotherCurrentItem = () => {
    if (!activeItem) return
    if (!activeItem.label.trim() || !activeItem.categoryType || parsedAmount <= 0) {
      setSaveError('Finish this entry before adding another.')
      return
    }
    if (!quickEntryStatus.hasIncome && queue.length >= remainingQuickEntries) {
      setSaveError('Add your income first so Cenza can calculate what is left accurately.')
      return
    }

    const previousSameLabelEntries = [
      ...queue.filter((item, index) => index < activeIndex && normalizeLabel(item.label) === normalizeLabel(activeItem.label)),
      activeItem,
    ]
    const learnedCategoryType = categoryFromPriorEntries(previousSameLabelEntries)
    const duplicate: PendingExpenseItem = {
      ...activeItem,
      id: makePendingId(activeItem.label, activeItem.source),
      categoryType: learnedCategoryType,
      categorySource: learnedCategoryType ? 'remembered' : null,
      amount: '',
      note: '',
      repeatsMonthly: false,
    }

    setQueue((current) => {
      const next = [...current]
      next.splice(activeIndex + 1, 0, duplicate)
      return next
    })
    setActiveIndex((current) => current + 1)
    setSaveError(null)
  }

  const handleSaveAll = async () => {
    if (!user || queue.length === 0) return
    if (!quickEntryStatus.hasIncome && queue.length > remainingQuickEntries) {
      setSaveError('Add your income first so Cenza can calculate what is left accurately.')
      return
    }

    setSaving(true)
    setSaveError(null)

    try {
      if (queue.some((item) => !item.categoryType)) {
        setSaveError('Choose a category for each expense before saving.')
        setSaving(false)
        return
      }
      if (queue.some((item) => item.categoryType === 'debt')) {
        setSaveError('Debt is tracked separately. Create it from the debt flow.')
        setSaving(false)
        router.push(debtCreateHref)
        return
      }
      if (queue.some((item) => !item.label.trim())) {
        setSaveError('Add a name for each expense before saving.')
        setSaving(false)
        return
      }

      const result = await saveExpenseBatch(queue.map((item) => ({
        mode: 'add',
        priorEntryId: null,
        categoryType: item.categoryType as CategoryType,
        categoryKey: item.categoryKey ?? normalizeLabel(item.label).replace(/\s+/g, '_'),
        categoryLabel: item.label,
        amount: parseFloat(item.amount.replace(/,/g, '')) || 0,
        note: item.note.trim() || null,
        rememberItem: true,
        repeatsMonthly: item.categoryType === 'everyday' || item.categoryType === 'fixed' ? item.repeatsMonthly : false,
      })))

      if (!result.ok) {
        setSaveError(result.error.message)
        setSaving(false)
        return
      }

      setSavedCount(queue.length)
      setSavedItems(queue)
      setSaving(false)
      setStep('done')
    } catch {
      setSaveError("We couldn't save right now. Please try again in a moment.")
      setSaving(false)
    }
  }

  const isLastItem = activeIndex === queue.length - 1
  const canReviewContinue = queue.length > 0
  const canAdvance = !!activeItem?.categoryType && parsedAmount > 0 && !!activeItem?.label.trim()
  const requiresIncomeRecovery = !quickEntryStatus.hasIncome && queue.length > remainingQuickEntries
  const recentMatch = activeItem ? recentByLabel[normalizeLabel(activeItem.label)] ?? null : null

  const goalMatchLabel = useMemo(() => {
    const typed = normalizeLabel(newItemName)
    if (!typed) return null
    const userGoals = (profile?.goals ?? []) as GoalId[]
    for (const id of userGoals) {
      const meta = GOAL_META[id]
      if (!meta) continue
      if (normalizeLabel(meta.label) === typed || typed.includes(normalizeLabel(meta.label))) {
        return meta.label
      }
    }
    return null
  }, [newItemName, profile?.goals])

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
            height: 44,
            minWidth: 44,
            padding: step === 'queue' ? '0 var(--space-sm) 0 0' : 0,
            color: 'var(--grey-900)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 'var(--space-xs)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--weight-medium)',
          }}
        >
          <IconBack size={20} />
          {step === 'queue' && <span>Back to SMS</span>}
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
        {(step === 'queue' || step === 'method') && (
          <h1 style={{ margin: '0 0 var(--space-lg)', fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', color: T.text1, letterSpacing: '-0.02em' }}>
            {step === 'method' ? 'Add your expenses in seconds' : 'Add an expense'}
          </h1>
        )}

        <div style={{
          background: T.white,
          borderRadius: 'var(--radius-card)',
          boxShadow: step === 'done' ? 'none' : 'var(--shadow-sm)',
          padding: 'var(--space-lg) var(--space-card-sm)',
        }}>
          {step === 'method' ? (
            <MethodStep
              onManual={() => setStep('queue')}
              onImportFromSms={() => router.push(`/log/import?returnTo=${encodeURIComponent('/log/new?returnTo=' + returnTo)}`)}
            />
          ) : step === 'queue' ? (
            <QueueStep
              newItemName={newItemName}
              setNewItemName={setNewItemName}
              queue={queue}
              commonItems={rankedCommonItems}
              queueNotice={queueNotice}
              quickEntryStatus={quickEntryStatus}
              quickEntryLimit={QUICK_ENTRY_LIMIT_WITHOUT_INCOME}
              onToggleCommon={toggleCommonItem}
              onAddTypedItem={addTypedItem}
              onContinue={handleContinueToReview}
              canContinue={canReviewContinue}
              goalMatchLabel={goalMatchLabel}
              onGoToGoals={() => router.push('/goals')}
              onGoToDebt={() => router.push(buildDebtCreateHref(newItemName))}
            />
          ) : step === 'done' ? (
            <DoneStep
              items={savedItems}
              currency={currency}
              onLogMore={() => {
                setQueue([])
                setActiveIndex(0)
                setNewItemName('')
                setSaveError(null)
                setSavedCount(0)
                setSavedItems([])
                setStep('queue')
              }}
              onGoToOverview={() => { router.refresh(); router.push('/app') }}
            />
          ) : activeItem ? (
            <ReviewStep
              item={activeItem}
              currency={currency}
              recentMatch={recentMatch}
              currentIndex={activeIndex}
              currentGroupIndex={Math.max(0, activeGroupFlowIndex)}
              totalGroups={groupedLabelsInOrder.length}
              isPreviousInSameGroup={activeIndex > 0 && normalizeLabel(queue[activeIndex - 1]?.label ?? '') === normalizeLabel(activeItem.label)}
              isNextInSameGroup={activeIndex < queue.length - 1 && normalizeLabel(queue[activeIndex + 1]?.label ?? '') === normalizeLabel(activeItem.label)}
              saving={saving}
              saveError={saveError}
              groupIndex={Math.max(0, activeGroupedIndex)}
              groupCount={groupedEntriesForActiveItem.length}
              previousGroupEntries={groupedEntriesBeforeActive}
              onAmountChange={(value) => updateActiveItem({ amount: value })}
              onLabelChange={(value) => updateActiveItem({
                label: value,
                categoryKey: normalizeLabel(value).replace(/\s+/g, '_'),
              })}
              onTypeSelect={(type) => updateActiveItem({
                categoryType: type,
                categorySource: 'manual',
                repeatsMonthly: type === 'everyday' || type === 'fixed' ? activeItem.repeatsMonthly : false,
              })}
              onRepeatsMonthlyChange={(checked) => updateActiveItem({ repeatsMonthly: checked })}
              onNoteChange={(value) => updateActiveItem({ note: value })}
              onPrevious={handlePrevious}
              onNext={handleNext}
              onAddAnother={handleAddAnotherCurrentItem}
              onSaveAll={handleSaveAll}
              onRecoverIncome={() => router.push(`/income/new?returnTo=${encodeURIComponent('/log/new?returnTo=' + returnTo)}`)}
              requiresIncomeRecovery={requiresIncomeRecovery}
              canAdvance={canAdvance}
              isLastItem={isLastItem}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

function MethodStep({
  onManual,
  onImportFromSms,
}: {
  onManual: () => void
  onImportFromSms: () => void
}) {
  return (
    <div>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: T.text3, lineHeight: 1.5 }}>
        Paste a few bank or payment messages to get started
      </p>
      <PrimaryBtn size="lg" onClick={onImportFromSms} style={{ marginBottom: 10 }}>
        Paste bank messages
      </PrimaryBtn>
      <SecondaryBtn size="md" onClick={onManual}>
        Add manually
      </SecondaryBtn>
    </div>
  )
}

function DoneStep({
  items,
  currency,
  onLogMore,
  onGoToOverview,
}: {
  items: PendingExpenseItem[]
  currency: string
  onLogMore: () => void
  onGoToOverview: () => void
}) {
  const formatSummaryAmount = (value: string) => {
    const amount = parseFloat(value.replace(/,/g, '')) || 0
    return `${currency} ${amount.toLocaleString()}`
  }

  const todayLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const successEntries: ExpenseAddedSuccessEntry[] = items.map((item) => {
    const categoryLabel = item.categoryType === 'goal'
      ? 'Goal'
      : item.categoryType
        ? TYPE_COPY[item.categoryType]?.title ?? 'Uncategorized'
        : 'Uncategorized'

    return {
      id: item.id,
      name: formatDisplayLabel(item.label),
      amountLabel: formatSummaryAmount(item.amount),
      metaLabel: `${categoryLabel} · ${todayLabel}`,
      hasMonthlyReminder: item.repeatsMonthly,
    }
  })

  return (
    <div>
      <ExpenseAddedSuccess
        entries={successEntries}
        onBack={onGoToOverview}
        onAddAnother={onLogMore}
      />
    </div>
  )
}

function QueueStep({
  newItemName,
  setNewItemName,
  queue,
  commonItems,
  queueNotice,
  quickEntryStatus,
  quickEntryLimit,
  onToggleCommon,
  onAddTypedItem,
  onContinue,
  canContinue,
  goalMatchLabel,
  onGoToGoals,
  onGoToDebt,
}: {
  newItemName: string
  setNewItemName: (value: string) => void
  queue: PendingExpenseItem[]
  commonItems: DictEntry[]
  queueNotice: string | null
  quickEntryStatus: { loaded: boolean; hasIncome: boolean; existingExpenseCount: number }
  quickEntryLimit: number
  onToggleCommon: (label: string) => void
  onAddTypedItem: () => boolean
  onContinue: () => void
  canContinue: boolean
  goalMatchLabel: string | null
  onGoToGoals: () => void
  onGoToDebt: () => void
}) {
  const addInputRef = useRef<HTMLInputElement | null>(null)
  const selectedSet = new Set(queue.map((item) => normalizeLabel(item.label)))
  const canAddTypedItem = newItemName.trim().length > 0
  const entriesLeftWithoutIncome = quickEntryStatus.hasIncome
    ? null
    : Math.max(0, quickEntryLimit - quickEntryStatus.existingExpenseCount)

  const handleAddTypedItem = () => {
    onAddTypedItem()
  }

  return (
    <div>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: T.text3, lineHeight: 1.5 }}>
        Select one or more items.
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
                    gap: 'var(--space-2xs)',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isSelected && <IconCheck size={14} color={T.brandDark} />}
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{displayLabel}</span>
                </button>
              )
            })}
            {queue
              .filter((item) => !commonItems.some((c) => normalizeLabel(c.label) === normalizeLabel(item.label)))
              .map((item) => {
                const displayLabel = formatDisplayLabel(item.label)
                return (
                  <button
                    key={item.id}
                    onClick={() => onToggleCommon(item.label)}
                    style={{
                      height: '38px',
                      padding: '0 var(--space-md)',
                      borderRadius: 'var(--radius-full)',
                      border: `${T.borderWidth} solid ${T.brandMid}`,
                      background: T.brandSoft,
                      color: T.brandDark,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2xs)',
                      transition: 'all 0.15s',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <IconCheck size={14} color={T.brandDark} />
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{displayLabel}</span>
                  </button>
                )
              })}
          </div>
        </div>
      )}

      {/* Add-new-item affordance */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={addInputRef}
            value={newItemName}
            onChange={(event) => setNewItemName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                handleAddTypedItem()
              }
            }}
            placeholder="Type something else"
            style={{
              flex: 1,
              height: 48,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              padding: '0 14px',
              fontSize: 'var(--text-base)',
              color: T.text1,
              background: T.white,
              outline: 'none',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={handleAddTypedItem}
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
            <IconPlus size={18} />
          </button>
        </div>
      </div>

      {/* Queue notice */}
      {quickEntryStatus.loaded && entriesLeftWithoutIncome !== null && (
        <p style={{ margin: '0 0 8px', fontSize: 12, color: T.text3, lineHeight: 1.5 }}>
          {entriesLeftWithoutIncome > 0
            ? `${entriesLeftWithoutIncome} of ${quickEntryLimit} quick ${entriesLeftWithoutIncome === 1 ? 'entry' : 'entries'} left before income setup.`
            : 'Quick entry limit reached. Add income to continue logging expenses.'}
        </p>
      )}
      {queueNotice && (
        <p style={{ margin: '0 0 12px', fontSize: 12, color: T.textMuted, lineHeight: 1.5 }}>
          {queueNotice}
        </p>
      )}
      {goalMatchLabel && (
        <p style={{ margin: '0 0 12px', fontSize: 12, color: T.textMuted, lineHeight: 1.5 }}>
          This looks like a goal. Add it from your{' '}
          <button
            type="button"
            onClick={onGoToGoals}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: T.brandDark,
              fontWeight: 'var(--weight-semibold)',
              cursor: 'pointer',
              textDecoration: 'underline',
              fontSize: 'inherit',
            }}
          >
            goals
          </button>
          .
        </p>
      )}

      <div style={{
        margin: '0 0 12px',
        padding: 'var(--space-md)',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${T.borderSubtle}`,
        background: T.grey50,
      }}>
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: T.text1 }}>
          Need to track money owed?
        </p>
        <p style={{ margin: 'var(--space-2xs) 0 var(--space-xs)', fontSize: 'var(--text-sm)', color: T.text3, lineHeight: 1.45 }}>
          We’ll help you set up the balance and repayments in the debt flow.
        </p>
        <button
          type="button"
          onClick={onGoToDebt}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: T.brandDark,
            fontWeight: 'var(--weight-semibold)',
            cursor: 'pointer',
            fontSize: 'var(--text-sm)',
          }}
        >
          Continue to debt setup
        </button>
      </div>

      {/* CTA */}
      <PrimaryBtn
        size="lg"
        onClick={onContinue}
        disabled={!canContinue}
        style={{
          background: canContinue ? T.brandDark : T.grey200,
          color: canContinue ? T.textInverse : T.textMuted,
          marginTop: 4,
        }}
      >
        {queue.length === 0
          ? 'Continue'
          : `Continue with ${queue.length} ${queue.length === 1 ? 'item' : 'items'}`}
      </PrimaryBtn>
    </div>
  )
}

function ReviewStep({
  item,
  currency,
  recentMatch,
  currentIndex,
  currentGroupIndex,
  totalGroups,
  isPreviousInSameGroup,
  isNextInSameGroup,
  saving,
  saveError,
  groupIndex,
  groupCount,
  previousGroupEntries,
  onAmountChange,
  onLabelChange,
  onTypeSelect,
  onRepeatsMonthlyChange,
  onNoteChange,
  onPrevious,
  onNext,
  onAddAnother,
  onSaveAll,
  onRecoverIncome,
  requiresIncomeRecovery,
  canAdvance,
  isLastItem,
}: {
  item: PendingExpenseItem
  currency: string
  recentMatch: RecentLoggedEntry | null
  currentIndex: number
  currentGroupIndex: number
  totalGroups: number
  isPreviousInSameGroup: boolean
  isNextInSameGroup: boolean
  saving: boolean
  saveError: string | null
  groupIndex: number
  groupCount: number
  previousGroupEntries: PendingExpenseItem[]
  onAmountChange: (value: string) => void
  onLabelChange: (value: string) => void
  onTypeSelect: (type: CategoryType | null) => void
  onRepeatsMonthlyChange: (checked: boolean) => void
  onNoteChange: (value: string) => void
  onPrevious: () => void
  onNext: () => void
  onAddAnother: () => void
  onSaveAll: () => void
  onRecoverIncome: () => void
  requiresIncomeRecovery: boolean
  canAdvance: boolean
  isLastItem: boolean
}) {
  const displayAmount = item.amount
    ? item.amount.replace(/,/g, '').split('.').map((part, index) => (
      index === 0 ? part.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : part
    )).join('.')
    : ''
  const incomeBlocked = isLastItem && requiresIncomeRecovery
  const displayLabel = formatDisplayLabel(item.label)
  const previousEntriesLabel = `${previousGroupEntries.length} ${previousGroupEntries.length === 1 ? 'entry is' : 'entries are'} already saved for this item.`
  const primaryActionLabel = saving
    ? 'Saving…'
    : incomeBlocked
      ? 'Add income to continue'
      : isLastItem
        ? 'Save'
        : isNextInSameGroup
          ? 'Next entry'
          : 'Next item'

  return (
    <div>
      {totalGroups > 1 && (
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <span style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: T.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 'var(--space-xs)' }}>
            {currentGroupIndex + 1} of {totalGroups}
          </span>
          <div style={{ height: 'var(--size-bar-sm)', background: T.grey100, borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${((currentGroupIndex + 1) / totalGroups) * 100}%`,
              background: T.brandDark,
              borderRadius: 'var(--radius-full)',
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      )}

      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <p style={{ margin: '0 0 var(--space-xs)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Name
        </p>
        <input
          type="text"
          value={item.label}
          onChange={(event) => onLabelChange(event.target.value)}
          placeholder="What is this expense?"
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
        {item.categoryType === 'debt' && (
          <p style={{ margin: 'var(--space-xs) 0 0', fontSize: 'var(--text-sm)', color: T.text3, lineHeight: 1.5 }}>
            Debt is tracked separately with balances and repayments.
          </p>
        )}
        {groupCount > 1 && (
          <p style={{
            margin: '10px 0 0',
            fontSize: 'var(--text-sm)',
            color: T.text3,
            lineHeight: 1.5,
          }}>
            You&apos;re on entry {groupIndex + 1} of {groupCount} for {displayLabel}.
          </p>
        )}
        {previousGroupEntries.length > 0 && (
          <p style={{
            margin: '6px 0 0',
            fontSize: 'var(--text-sm)',
            color: T.textMuted,
            lineHeight: 1.5,
          }}>
            {previousEntriesLabel}
          </p>
        )}
        {recentMatch && (
          <p style={{
            margin: 'var(--space-sm) 0 0',
            fontSize: 'var(--text-sm)',
            color: T.text3,
            lineHeight: 1.5,
          }}>
            {formatRecentEntryHint(recentMatch, currency, item.label)}
          </p>
        )}
      </div>

      {previousGroupEntries.length > 0 && (
        <div style={{
          marginBottom: 'var(--space-lg)',
          padding: 'var(--space-md)',
          borderRadius: 'var(--radius-sm)',
          background: T.grey50,
          border: `${T.borderWidth} solid ${T.borderSubtle}`,
        }}>
          <p style={{
            margin: '0 0 var(--space-xs)',
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--weight-semibold)',
            color: T.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
          }}>
            Added so far
          </p>
          <div style={{ display: 'grid', gap: '6px' }}>
            {previousGroupEntries.map((entry) => {
              const previewAmount = parseFloat((entry.amount || '0').replace(/,/g, '')) || 0
              return (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--space-md)',
                  }}
                >
                  <span style={{ fontSize: 'var(--text-sm)', color: T.text2, lineHeight: 1.5, minWidth: 0 }}>
                    {entry.note.trim() || 'No description'}
                  </span>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: T.text1, whiteSpace: 'nowrap' }}>
                    {currency} {previewAmount.toLocaleString()}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 'var(--space-lg)' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        height: '64px',
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
        <p style={{ margin: '0 0 var(--space-xs)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Category
        </p>
        <TypeChips
          selected={item.categoryType}
          onSelect={onTypeSelect}
          types={['everyday', 'fixed']}
        />
        {(item.categoryType === 'everyday' || item.categoryType === 'fixed') && (
          <p style={{
            margin: 'var(--space-sm) 0 0',
            fontSize: 'var(--text-sm)',
            color: T.text3,
            lineHeight: 1.5,
          }}>
            {TYPE_COPY[item.categoryType].helper}
          </p>
        )}
      </div>

      {(item.categoryType === 'everyday' || item.categoryType === 'fixed') && (
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <p style={{ margin: '0 0 var(--space-xs)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Reminder
          </p>
          <label style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-sm)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--weight-medium)',
            color: T.text1,
            cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={item.repeatsMonthly}
              onChange={(event) => onRepeatsMonthlyChange(event.target.checked)}
              style={{ width: 18, height: 18, marginTop: 2, accentColor: T.brandDark }}
            />
            <span>
              <span style={{ display: 'block', color: T.text1 }}>
                Remind me about this every month
              </span>
              <span style={{ display: 'block', marginTop: 4, fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-regular)', color: T.text3, lineHeight: 1.4 }}>
                We’ll remind you before it’s due
              </span>
            </span>
          </label>

          {item.repeatsMonthly && (
            <div style={{
              marginTop: 'var(--space-md)',
              display: 'grid',
              gap: 'var(--space-xs)',
              justifyItems: 'start',
            }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: T.text1, lineHeight: 1.35 }}>
                ✓ Monthly reminder set
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: T.text3, lineHeight: 1.4 }}>
                We’ll remind you before it’s due
              </div>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--brand-light)',
                color: T.brandDark,
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-medium)',
                lineHeight: 1.2,
              }}>
                Monthly reminder
              </span>
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: 'var(--space-lg)' }}>
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
      </div>

      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <SecondaryBtn
          size="md"
          onClick={onAddAnother}
          disabled={saving || !canAdvance || incomeBlocked}
          style={{ width: '100%', borderColor: T.border, color: T.text1 }}
        >
          Save and add another entry
        </SecondaryBtn>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-sm)', marginBottom: saveError ? 'var(--space-md)' : 'var(--space-lg)' }}>
        {currentIndex > 0 && (
          <TertiaryBtn
            size="sm"
            onClick={onPrevious}
            style={{ justifyContent: 'flex-start', paddingInline: 0 }}
          >
            {isPreviousInSameGroup ? 'Back to previous entry' : 'Back'}
          </TertiaryBtn>
        )}
      </div>

      {saveError && (
        <div style={{ margin: '0 0 var(--space-md)' }}>
          <p style={{
            margin: '0 0 var(--space-sm)',
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
          {saveError.toLowerCase().includes('add your income first') && (
            <SecondaryBtn
              size="md"
              onClick={onRecoverIncome}
              style={{ borderColor: T.border, color: T.text1 }}
            >
              Add income
            </SecondaryBtn>
          )}
        </div>
      )}

      <PrimaryBtn
        size="lg"
        onClick={incomeBlocked ? onRecoverIncome : (isLastItem ? onSaveAll : onNext)}
        disabled={saving || (!incomeBlocked && !canAdvance)}
        style={{
          background: (incomeBlocked || canAdvance) ? T.brandDark : T.grey200,
          color: (incomeBlocked || canAdvance) ? T.textInverse : T.textMuted,
          opacity: saving ? 0.7 : 1,
        }}
      >
        {primaryActionLabel}
      </PrimaryBtn>
    </div>
  )
}

function TypeChips({ selected, onSelect, types }: {
  selected: CategoryType | null
  onSelect: (type: CategoryType | null) => void
  types?: Array<Exclude<CategoryType, 'goal'>>
}) {
  const entries = (Object.entries(TYPE_COPY) as [Exclude<CategoryType, 'goal'>, { title: string }][])
    .filter(([value]) => !types || types.includes(value))
  return (
    <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
      {entries.map(([value, copy]) => (
          <button
            key={value}
            onClick={() => onSelect(selected === value ? null : value)}
	            style={{
	              height: '40px',
	              padding: '0 var(--space-md)',
	              borderRadius: 'var(--radius-full)',
	              border: selected === value
	                ? `${T.borderWidth} solid transparent`
	                : `${T.borderWidth} solid ${T.borderSubtle}`,
	              background: selected === value ? 'var(--brand-light)' : 'transparent',
	              cursor: 'pointer',
	              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              whiteSpace: 'nowrap',
            }}
          >
	            <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', color: selected === value ? T.brandDark : T.textMuted }}>
              {copy.title}
            </div>
          </button>
      ))}
    </div>
  )
}
