'use client'
export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// /log — Add a payment
//
// Single scrollable page with 4 sections:
//   Fixed spending | Goals | Daily expenses | Debts
//
// Tap any item → amount sheet (native keyboard)
// Pinned "Other" button at bottom → sheet with group picker
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/context/UserContext'
import { useToast } from '@/lib/context/ToastContext'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { SideNav } from '@/components/layout/SideNav/SideNav'
// TODO: remove after confirming new flow
import { AddExpenseSheet } from '@/components/flows/log/AddExpenseSheet'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { IconBack, IconTrash } from '@/components/ui/Icons'
import { fmt } from '@/lib/finance'

function titleCase(s: string) {
  return s.replace(/\b\w/g, c => c.toUpperCase())
}

// ─── Tokens ───────────────────────────────────────────────────────────────────
const T = {
  brand:        '#EADFF4',
  brandMid:     '#C9AEE8',
  brandDeep:    '#9B6FCC',
  brandDark:    '#5C3489',
  pageBg:       '#F8F9FA',
  white:        '#FFFFFF',
  border:       '#E4E7EC',
  borderStrong: '#D0D5DD',
  text1:        '#101828',
  text2:        '#475467',
  text3:        '#667085',
  textMuted:    '#98A2B3',
}

// ─── Static meta ─────────────────────────────────────────────────────────────
const GOAL_META: Record<string, string> = {
  emergency: 'Emergency Fund', car: 'Car', travel: 'Travel',
  home: 'Home', education: 'Education', business: 'Business',
  family: 'Family', other: 'Other Goal',
}

const GOAL_ICONS: Record<string, string> = {
  emergency: '🛡️', car: '🚗', travel: '✈️',
  home: '🏠', education: '🎓', business: '💼',
  family: '👨‍👩‍👧', other: '🎯',
}

const SECTION_EMPTY: Record<string, string> = {
  fixed:  'No fixed expenses set up for this month.',
  goals:  'No active goals. Add one from the Goals tab.',
  daily:  'No spending categories set up yet.',
  debts:  'No debt payments logged this month.',
  other:  '',
}

const EXPENSE_LABELS: Record<string, string> = {
  rent: 'Rent', electricity: 'Electricity', water: 'Water',
  gas: 'Cooking fuel', internet: 'Internet', phone: 'Phone',
  houseKeeping: 'Housekeeping', blackTax: 'Black tax',
  schoolFees: 'School fees', childcare: 'Childcare',
}

// ─── Types ────────────────────────────────────────────────────────────────────
type GroupKey = 'fixed' | 'goals' | 'daily' | 'debts' | 'other'

interface SubItem {
  key:           string
  label:         string
  sublabel:      string | null
  groupType:     string
  loggedAmount:  number
  plannedAmount?: number  // monthly planned amount (fixed expenses only)
}

interface Section {
  key:       GroupKey
  label:     string
  groupType: string
  items:     SubItem[]
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LogPage() {
  const router        = useRouter()
  const searchParams  = useSearchParams()
  const supabase      = createClient()
  const { isDesktop } = useBreakpoint()
  const { user, profile: ctxProfile } = useUser()

  const { toast } = useToast()

  const autoOpened = useRef(false)

  const [loading, setLoading]             = useState(true)
  const [currency, setCurrency]           = useState('KES')
  const [sections, setSections]           = useState<Section[]>([])
  const [isFirstTime, setIsFirstTime]     = useState(false)
  const [expanded, setExpanded]         = useState<Set<string>>(new Set())
  const [deletingKey, setDeletingKey]                             = useState<string | null>(null)
  const [pendingDelete, setPendingDelete]                         = useState<SubItem | null>(null)
  const [deleteStep, setDeleteStep]                               = useState<'reason' | 'confirm' | 'refund'>('reason')
  const [refundAmount, setRefundAmount]                           = useState('')
  const [refundNote, setRefundNote]                               = useState('')
  const [savingRefund, setSavingRefund]                           = useState(false)

  const currentMonth = new Date().toISOString().slice(0, 7)

  const logItem = useCallback((item: SubItem) => {
    const params = new URLSearchParams({
      key:    item.key,
      label:  item.label,
      type:   item.groupType,
      ...(item.plannedAmount ? { amount: String(item.plannedAmount) } : {}),
    })
    router.push(`/log/new?${params.toString()}`)
  }, [router])

  const logOther = useCallback(() => {
    router.push('/log/new?isOther=true')
  }, [router])

  const loadData = useCallback(async () => {
    if (!user) return

    const [
      { data: txns },
      { data: expenses },
      { data: targets },
      { data: budgets },
    ] = await Promise.all([
      (supabase.from('transactions') as any)
        .select('category_key, category_label, category_type, amount, date')
        .eq('user_id', user.id).eq('month', currentMonth),
      (supabase.from('fixed_expenses') as any)
        .select('entries').eq('user_id', user.id).eq('month', currentMonth).maybeSingle(),
      (supabase.from('goal_targets') as any)
        .select('goal_id, amount, added_at').eq('user_id', user.id),
      (supabase.from('spending_budgets') as any)
        .select('categories').eq('user_id', user.id).eq('month', currentMonth).maybeSingle(),
    ])

    const cur = ctxProfile?.currency ?? 'KES'
    setCurrency(cur)

    // ── Build added_at map to filter stale goal transactions ─
    const addedAtMap: Record<string, string> = {}
    for (const row of targets ?? []) {
      if (row.added_at) addedAtMap[row.goal_id] = row.added_at
    }

    // ── Sum transactions per category_key ───────────────────
    const logged: Record<string, number> = {}
    for (const t of txns ?? []) {
      // Skip goal transactions from before this goal instance was added
      if (t.category_type === 'goal') {
        const addedAt = addedAtMap[t.category_key]
        if (addedAt && t.date < addedAt.slice(0, 10)) continue
      }
      logged[t.category_key] = (logged[t.category_key] ?? 0) + Number(t.amount)
    }

    // ── Fixed expenses ──────────────────────────────────────
    const fixedItems: SubItem[] = (expenses?.entries ?? [])
      .filter((e: any) => e.confidence === 'known' && e.monthly > 0)
      .map((e: any) => ({
        key:           e.key,
        label:         EXPENSE_LABELS[e.key] ?? titleCase(e.label ?? e.key),
        sublabel:      fmt(e.monthly, cur),
        groupType:     'fixed',
        loggedAmount:  logged[e.key] ?? 0,
        plannedAmount: e.monthly,
      }))

    // ── Goals ───────────────────────────────────────────────
    const profileGoals: string[] = ctxProfile?.goals ?? []
    const goalItems: SubItem[] = profileGoals
      .filter((g: string) => GOAL_META[g])
      .map((g: string) => {
        const target = (targets ?? []).find((t: any) => t.goal_id === g)
        return {
          key:          g,
          label:        GOAL_META[g],
          sublabel:     target?.amount ? fmt(target.amount, cur) : null,
          groupType:    'goal',
          loggedAmount: logged[g] ?? 0,
        }
      })

    // ── Daily spending ──────────────────────────────────────

    const dailyItems: SubItem[] = (budgets?.categories ?? []).map((c: any) => ({
      key:          c.key,
      label:        titleCase(c.label ?? c.key),
      sublabel:     c.budget ? fmt(c.budget, cur) : null,
      groupType:    'variable',
      loggedAmount: logged[c.key] ?? 0,
    }))

    // ── Debts — built from transactions logged this month ────
    const debtMap: Record<string, { label: string; amount: number }> = {}
    for (const t of txns ?? []) {
      if (t.category_type !== 'debt') continue
      if (!debtMap[t.category_key]) debtMap[t.category_key] = { label: titleCase(t.category_label ?? t.category_key), amount: 0 }
      debtMap[t.category_key].amount += Number(t.amount)
    }
    const debtItems: SubItem[] = Object.entries(debtMap).map(([key, { label, amount }]) => ({
      key, label, sublabel: null, groupType: 'debt', loggedAmount: amount,
    }))

    // ── Other — custom items logged via "Something else" ────
    // Any transaction whose key isn't covered by a planned section item
    const knownKeys = new Set([
      ...fixedItems.map(i => i.key),
      ...goalItems.map(i => i.key),
      ...dailyItems.map(i => i.key),
      ...debtItems.map(i => i.key),
    ])
    const otherMap: Record<string, { label: string; amount: number }> = {}
    for (const t of txns ?? []) {
      if (knownKeys.has(t.category_key)) continue
      if (t.category_type === 'debt') continue  // already in debts
      if (!otherMap[t.category_key]) otherMap[t.category_key] = { label: titleCase(t.category_label ?? t.category_key), amount: 0 }
      otherMap[t.category_key].amount += Number(t.amount)
    }
    const otherItems: SubItem[] = Object.entries(otherMap).map(([key, { label, amount }]) => ({
      key, label, sublabel: null, groupType: 'variable', loggedAmount: amount,
    }))

    setSections([
      { key: 'fixed', label: 'Fixed spending',  groupType: 'fixed',    items: fixedItems  },
      { key: 'goals', label: 'Goals',            groupType: 'goal',     items: goalItems   },
      { key: 'daily', label: 'Daily expenses',   groupType: 'variable', items: dailyItems  },
      { key: 'debts', label: 'Debts',            groupType: 'debt',     items: debtItems   },
      ...(otherItems.length > 0 ? [{ key: 'other' as GroupKey, label: 'Other', groupType: 'variable', items: otherItems }] : []),
    ])

    // First-time if no actual expense transactions logged this month (goal contributions don't count)
    setIsFirstTime((txns ?? []).filter((t: any) => t.category_type !== 'goal').length === 0)

    setLoading(false)
  }, [supabase, router, currentMonth, user, ctxProfile])

  useEffect(() => { if (user) loadData() }, [loadData, user])

  // When navigated from overview with ?open=true, after income check-in:
  // — first-time users → go to the guided first-log page
  // — returning users → navigate to the new expense page directly
  useEffect(() => {
    if (loading || autoOpened.current) return
    if (searchParams.get('open') !== 'true') return
    autoOpened.current = true
    if (isFirstTime) {
      router.push('/log/first')
    } else {
      logOther()
    }
  }, [loading, searchParams, isFirstTime, logOther, router])

  const handleSaveRefund = async () => {
    if (!pendingDelete) return
    const amount = parseFloat(refundAmount)
    if (!amount || amount <= 0) return
    setSavingRefund(true)
    if (!user) { setSavingRefund(false); return }
    await (supabase.from('transactions') as any).insert({
      user_id:        user.id,
      date:           new Date().toISOString().slice(0, 10),
      month:          currentMonth,
      category_type:  pendingDelete.groupType,
      category_key:   pendingDelete.key,
      category_label: pendingDelete.label,
      amount:         -amount,
      note:           refundNote.trim() || null,
    })
    toast('Refund recorded')
    setSavingRefund(false)
    setPendingDelete(null)
    setRefundAmount('')
    setRefundNote('')
    loadData()
    router.refresh()
  }

  const handleDeleteCategory = async (key: string) => {
    setDeletingKey(key)
    if (!user) { setDeletingKey(null); return }
    await (supabase.from('transactions') as any)
      .delete()
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('category_key', key)
    toast('Entry removed')
    setDeletingKey(null)
    setPendingDelete(null)
    loadData()
    router.refresh()
  }

  // ─── Loading ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--page-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 14,
      }}>
        Loading...
      </div>
    )
  }

  // ─── Content ─────────────────────────────────────────────────
  const content = (
    // Extra bottom padding: BottomNav (72) + pinned Other bar (~72) = 144 mobile
    <div style={{ paddingBottom: isDesktop ? 80 : 144, paddingTop: 4 }}>

      {/* Page header */}
      <div style={{ padding: isDesktop ? '32px 32px 20px' : '20px 16px 16px' }}>
        <button
          onClick={() => router.push('/app')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 12px', display: 'flex', alignItems: 'center' }}
        >
          <IconBack size={18} color={T.text3} />
        </button>
        <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 500, color: T.textMuted, letterSpacing: 0 }}>
          {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>
        <h1 style={{ fontSize: isDesktop ? 28 : 26, fontWeight: 700, color: T.text1, margin: 0, letterSpacing: -0.5 }}>
          Add an expense
        </h1>
      </div>

      {/* Sections */}
      {sections.map(section => {
        // Hide empty daily/debt sections — the "Add an expense" CTA covers them
        if (section.items.length === 0 && (section.key === 'daily' || section.key === 'debts')) return null
        const isAccordion = section.items.length >= 4
        const isOpen      = expanded.has(section.key)
        const toggleOpen  = () => setExpanded(prev => {
          const next = new Set(prev)
          next.has(section.key) ? next.delete(section.key) : next.add(section.key)
          return next
        })

        // Logged items first, then unlogged — determines the visible 3
        const sortedItems = isAccordion
          ? [...section.items].sort((a, b) => (b.loggedAmount > 0 ? 1 : 0) - (a.loggedAmount > 0 ? 1 : 0))
          : section.items
        const visibleItems = isAccordion && !isOpen ? sortedItems.slice(0, 3) : sortedItems
        const hiddenCount  = isAccordion ? sortedItems.length - 3 : 0
        const totalLogged  = section.items.reduce((s, i) => s + i.loggedAmount, 0)

        // Shared item row renderer
        const renderItem = (item: SubItem, index: number) => {
          const isLogged   = item.loggedAmount > 0
          const isLast     = index === visibleItems.length - 1
          const isDeleting = deletingKey === item.key
          const goalIcon   = item.groupType === 'goal' ? GOAL_ICONS[item.key] : null

          return (
            <div
              key={item.key}
              style={{
                display: 'flex', alignItems: 'center',
                background: T.white,
                borderBottom: isLast ? 'none' : `1px solid #F2F4F7`,
                minHeight: 60,
              }}
            >
              {/* Main tap area */}
              <button
                onClick={() => logItem(item)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center',
                  gap: 12,
                  border: 'none', background: 'transparent',
                  padding: '12px 16px', minHeight: 60,
                  cursor: 'pointer',
                  textAlign: 'left', boxSizing: 'border-box',
                } as React.CSSProperties}
              >
                {/* Goal icon */}
                {goalIcon && (
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: '#F3EDFB',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 17,
                  }}>
                    {goalIcon}
                  </div>
                )}

                {/* Label + sublabel */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: isLogged ? 500 : 400, color: T.text1, lineHeight: 1.3 }}>
                    {item.label}
                  </div>
                  {item.sublabel && !isLogged && (
                    <div style={{ fontSize: 12, color: T.textMuted, marginTop: 1 }}>
                      {item.sublabel}
                    </div>
                  )}
                </div>

                {/* Right: recorded amount or disclosure chevron */}
                {isLogged ? (
                  <span style={{ fontSize: 15, fontWeight: 600, color: T.text1, flexShrink: 0, marginLeft: 8 }}>
                    {fmt(item.loggedAmount, currency)}
                  </span>
                ) : (
                  <span style={{ fontSize: 20, color: T.textMuted, flexShrink: 0, lineHeight: 1, marginLeft: 8, opacity: 0.4 }}>
                    ›
                  </span>
                )}
              </button>

              {/* Delete — only visible when something is recorded */}
              {isLogged && (
                <button
                  onClick={() => { setPendingDelete(item); setDeleteStep('reason') }}
                  disabled={isDeleting}
                  style={{
                    width: 44, height: 60, flexShrink: 0,
                    background: 'transparent', border: 'none',
                    borderLeft: `1px solid #F2F4F7`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', opacity: isDeleting ? 0.4 : 1,
                  }}
                >
                  <IconTrash size={14} color="#C8CCCF" />
                </button>
              )}
            </div>
          )
        }

        // ── All sections rendered as cards ───────────────────
        return (
          <div key={section.key} style={{ margin: isDesktop ? '0 32px 16px' : '0 16px 16px' }}>
            <div style={{
              background: T.white,
              border: `1px solid var(--border)`,
              borderRadius: 16,
              overflow: 'hidden',
            }}>

              {/* Card header — divider only when there are items below */}
              <div style={{
                padding: '13px 16px 12px',
                borderBottom: section.items.length > 0 ? `1px solid #F2F4F7` : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <p style={{
                    margin: 0, fontSize: 12, fontWeight: 600,
                    letterSpacing: 0, textTransform: 'none',
                    color: T.text3,
                  }}>
                    {section.label}
                  </p>
                  {isAccordion && (
                    <span style={{
                      fontSize: 11, fontWeight: 500, color: T.textMuted,
                      background: '#F1F3F5', borderRadius: 99, padding: '2px 7px',
                    }}>
                      {section.items.length}
                    </span>
                  )}
                </div>
                {totalLogged > 0 && (
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.brandDark }}>
                    {fmt(totalLogged, currency)}
                  </span>
                )}
              </div>

              {/* Items */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>

                {section.items.length === 0 && SECTION_EMPTY[section.key] && (
                  <p style={{ fontSize: 13, color: T.textMuted, margin: '12px 16px 16px' }}>
                    {SECTION_EMPTY[section.key]}
                  </p>
                )}

                {visibleItems.map((item, index) => renderItem(item, index))}

              </div>


              {/* View more / collapse — only when 4+ items */}
              {isAccordion && (
                <button
                  onClick={toggleOpen}
                  style={{
                    width: '100%', background: 'none', border: 'none',
                    padding: '12px 16px', cursor: 'pointer',
                    fontSize: 13, fontWeight: 500,
                    color: T.brandDark,
                    textAlign: 'left',
                  }}
                >
                  {isOpen ? 'Show less' : `View ${hiddenCount} more`}
                </button>
              )}

              {/* Bottom padding when no view-more button and items exist */}
              {!isAccordion && section.items.length > 0 && <div style={{ height: 4 }} />}

            </div>
          </div>
        )
      })}

      {/* Desktop: Something else button inline at bottom */}
      {isDesktop && (
        <div style={{ padding: '0 32px' }}>
          <button
            onClick={() => isFirstTime ? router.push('/log/first') : logOther()}
            style={{
              width: '100%', height: 50,
              background: T.brandDark,
              border: 'none',
              borderRadius: 14,
              cursor: 'pointer',
              fontSize: 14, fontWeight: 600,
              color: '#fff',
              boxSizing: 'border-box',
            } as React.CSSProperties}
          >
            Add an expense
          </button>
        </div>
      )}

      {/* Delete — reason picker + confirm */}
      {pendingDelete && (
        <Sheet
          open={true}
          onClose={() => setPendingDelete(null)}
          title={deleteStep === 'reason' ? 'Why are you removing this?' : deleteStep === 'refund' ? 'Log a refund' : 'Are you sure?'}
        >
          {deleteStep === 'reason' && (
            <div>
              <p style={{ fontSize: 14, color: T.text2, margin: '0 0 20px', lineHeight: 1.6 }}>
                You logged <strong>{fmt(pendingDelete.loggedAmount, currency)}</strong> for{' '}
                <strong>{pendingDelete.label}</strong> this month.
              </p>
              {[
                {
                  label: '✏️ I logged the wrong amount',
                  sub:   'Correct it right here',
                  action: () => { setPendingDelete(null); if (pendingDelete) logItem(pendingDelete) },
                },
                {
                  label: '💸 I got a refund',
                  sub:   'Log it here so your totals stay honest',
                  action: () => { setRefundAmount(''); setRefundNote(''); setDeleteStep('refund') },
                },
                {
                  label: '🚫 This never happened',
                  sub:   'Remove it entirely',
                  action: () => setDeleteStep('confirm'),
                },
              ].map(opt => (
                <button
                  key={opt.label}
                  onClick={opt.action}
                  style={{
                    width: '100%', textAlign: 'left', padding: '14px 16px',
                    background: T.white, border: `1px solid var(--border)`,
                    borderRadius: 14, cursor: 'pointer', marginBottom: 10, display: 'block',
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 600, color: T.text1 }}>{opt.label}</div>
                  <div style={{ fontSize: 12, color: T.text3, marginTop: 3 }}>{opt.sub}</div>
                </button>
              ))}
              <button
                onClick={() => setPendingDelete(null)}
                style={{
                  marginTop: 4, width: '100%', padding: '12px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 14, color: T.textMuted,
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {deleteStep === 'confirm' && (
            <div>
              <p style={{ fontSize: 14, color: T.text2, margin: '0 0 24px', lineHeight: 1.6 }}>
                This will permanently remove your <strong>{pendingDelete.label}</strong> entry of{' '}
                <strong>{fmt(pendingDelete.loggedAmount, currency)}</strong> for this month.
              </p>
              <button
                onClick={() => handleDeleteCategory(pendingDelete.key)}
                disabled={deletingKey === pendingDelete.key}
                style={{
                  width: '100%', padding: '14px', borderRadius: 14,
                  background: '#D93025', border: 'none', cursor: 'pointer',
                  fontSize: 15, fontWeight: 600, color: '#fff',
                  opacity: deletingKey === pendingDelete.key ? 0.6 : 1,
                }}
              >
                {deletingKey === pendingDelete.key ? 'Removing…' : 'Yes, remove it'}
              </button>
              <button
                onClick={() => setDeleteStep('reason')}
                style={{
                  marginTop: 10, width: '100%', padding: '12px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 14, color: T.text3,
                }}
              >
                Go back
              </button>
            </div>
          )}

          {deleteStep === 'refund' && (
            <div>
              <p style={{ fontSize: 14, color: T.text2, margin: '0 0 20px', lineHeight: 1.6 }}>
                How much was refunded for <strong>{pendingDelete.label}</strong>?
              </p>
              <div style={{
                display: 'flex', alignItems: 'center',
                border: `1px solid var(--border-strong)`, borderRadius: 12,
                background: T.white, overflow: 'hidden', marginBottom: 12,
              }}>
                <span style={{
                  padding: '0 14px', fontSize: 14, fontWeight: 600,
                  color: T.text3, borderRight: `1px solid var(--border-subtle)`, whiteSpace: 'nowrap',
                }}>
                  {currency}
                </span>
                <input
                  autoFocus
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={refundAmount.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  onChange={e => {
                    const raw = e.target.value.replace(/,/g, '')
                    if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return
                    setRefundAmount(raw)
                  }}
                  style={{
                    flex: 1, height: 52, border: 'none', outline: 'none',
                    padding: '0 14px', fontSize: 18, fontWeight: 600,
                    color: T.text1,
                    background: 'transparent',
                  }}
                />
              </div>
              <input
                type="text"
                placeholder="Note (optional)"
                value={refundNote}
                onChange={e => setRefundNote(e.target.value)}
                style={{
                  width: '100%', height: 46, borderRadius: 12,
                  border: `1px solid var(--border)`, padding: '0 14px',
                  fontSize: 14, color: T.text1,
                  background: T.white, outline: 'none', boxSizing: 'border-box',
                  marginBottom: 20,
                }}
              />
              <button
                onClick={handleSaveRefund}
                disabled={!refundAmount || parseFloat(refundAmount) <= 0 || savingRefund}
                style={{
                  width: '100%', padding: '14px', borderRadius: 14,
                  background: refundAmount && parseFloat(refundAmount) > 0 ? T.brandDark : T.border,
                  border: 'none', cursor: 'pointer',
                  fontSize: 15, fontWeight: 600,
                  color: refundAmount && parseFloat(refundAmount) > 0 ? '#fff' : T.textMuted,
                }}
              >
                {savingRefund ? 'Saving…' : 'Log refund'}
              </button>
              <button
                onClick={() => setDeleteStep('reason')}
                style={{
                  marginTop: 10, width: '100%', padding: '12px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 14, color: T.text3,
                }}
              >
                Go back
              </button>
            </div>
          )}
        </Sheet>
      )}

    </div>
  )

  // ─── Mobile: pinned Other bar ────────────────────────────────
  const pinnedOther = !isDesktop && (
    <div style={{
      position: 'fixed',
      bottom: 72,
      left: 0, right: 0,
      padding: '10px 16px',
      background: T.pageBg,
      borderTop: `1px solid var(--border-subtle)`,
      zIndex: 40,
    }}>
      <button
        onClick={() => isFirstTime ? router.push('/log/first') : logOther()}
        style={{
          width: '100%', height: 50,
          background: T.brandDark,
          border: 'none',
          borderRadius: 14,
          cursor: 'pointer',
          fontSize: 14, fontWeight: 600,
          color: '#fff',
          boxSizing: 'border-box',
        } as React.CSSProperties}
      >
        Add an expense
      </button>
    </div>
  )

  // ─── Desktop layout ───────────────────────────────────────────
  if (isDesktop) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <SideNav />
        <main style={{ flex: 1, maxWidth: 720, margin: '0 auto' }}>{content}</main>
      </div>
    )
  }

  // ─── Mobile layout ────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', paddingBottom: 88 }}>
      <main>{content}</main>
      {pinnedOther}
      <BottomNav />
    </div>
  )
}
