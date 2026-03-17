// ─────────────────────────────────────────────────────────────
// /log — Add a payment
//
// Single scrollable page with 4 sections:
//   Fixed spending | Goals | Daily expenses | Debts
//
// Tap any item → amount sheet (native keyboard)
// Pinned "Other" button at bottom → sheet with group picker
// ─────────────────────────────────────────────────────────────
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { AddExpenseSheet, type SheetItem, type ExpenseSaveData, type PriorEntry, type DictionaryEntry } from '@/components/flows/log/AddExpenseSheet'
import { IconBack } from '@/components/ui/Icons'
import { fmt } from '@/lib/finance'

// ─── Tokens ───────────────────────────────────────────────────────────────────
const T = {
  brand:        '#EADFF4',
  brandMid:     '#C9AEE8',
  brandDeep:    '#9B6FCC',
  brandDark:    '#5C3489',
  pageBg:       '#FAFAF8',
  white:        '#FFFFFF',
  border:       '#EDE8F5',
  borderStrong: '#D5CDED',
  text1:        '#1A1025',
  text2:        '#4A3B66',
  text3:        '#8B7BA8',
  textMuted:    '#B8AECE',
}

// ─── Static meta ─────────────────────────────────────────────────────────────
const GOAL_META: Record<string, string> = {
  emergency: 'Emergency Fund', car: 'Car', travel: 'Travel',
  home: 'Home', education: 'Education', business: 'Business',
  family: 'Family', other: 'Other Goal',
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
  key:          string
  label:        string
  sublabel:     string | null
  groupType:    string
  loggedAmount: number
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
  const supabase      = createClient()
  const { isDesktop } = useBreakpoint()

  const [loading, setLoading]       = useState(true)
  const [currency, setCurrency]     = useState('KES')
  const [sections, setSections]     = useState<Section[]>([])
  const [sheetOpen, setSheetOpen]   = useState(false)
  const [sheetItem, setSheetItem]   = useState<SheetItem | null>(null)
  const [priorEntry, setPriorEntry]     = useState<PriorEntry | null | undefined>(undefined)
  const [dictionary, setDictionary]     = useState<Record<string, DictionaryEntry>>({})
  const [expanded, setExpanded]         = useState<Set<string>>(new Set())

  const currentMonth = new Date().toISOString().slice(0, 7)

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('currency, goals')
      .eq('id', user.id)
      .single() as { data: any }

    const cur = profile?.currency ?? 'KES'
    setCurrency(cur)

    // ── Transactions logged this month ──────────────────────
    const { data: txns } = await (supabase.from('transactions') as any)
      .select('category_key, category_label, category_type, amount')
      .eq('user_id', user.id)
      .eq('month', currentMonth)

    // Sum per category_key
    const logged: Record<string, number> = {}
    for (const t of txns ?? []) {
      logged[t.category_key] = (logged[t.category_key] ?? 0) + Number(t.amount)
    }

    // ── Fixed expenses ──────────────────────────────────────
    const { data: expenses } = await (supabase.from('fixed_expenses') as any)
      .select('entries')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .maybeSingle()

    const fixedItems: SubItem[] = (expenses?.entries ?? [])
      .filter((e: any) => e.confidence === 'known' && e.monthly > 0)
      .map((e: any) => ({
        key:          e.key,
        label:        EXPENSE_LABELS[e.key] ?? e.key,
        sublabel:     fmt(e.monthly, cur) + '/mo',
        groupType:    'fixed',
        loggedAmount: logged[e.key] ?? 0,
      }))

    // ── Goals ───────────────────────────────────────────────
    const { data: targets } = await (supabase.from('goal_targets') as any)
      .select('goal_id, amount')
      .eq('user_id', user.id)

    const profileGoals: string[] = profile?.goals ?? []
    const goalItems: SubItem[] = profileGoals
      .filter((g: string) => GOAL_META[g])
      .map((g: string) => {
        const target = (targets ?? []).find((t: any) => t.goal_id === g)
        return {
          key:          g,
          label:        GOAL_META[g],
          sublabel:     target?.amount ? 'Target: ' + fmt(target.amount, cur) : null,
          groupType:    'goal',
          loggedAmount: logged[g] ?? 0,
        }
      })

    // ── Daily spending ──────────────────────────────────────
    const { data: budgets } = await (supabase.from('spending_budgets') as any)
      .select('categories')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .maybeSingle()

    const dailyItems: SubItem[] = (budgets?.categories ?? []).map((c: any) => ({
      key:          c.key,
      label:        c.label,
      sublabel:     c.budget ? 'Budget: ' + fmt(c.budget, cur) : null,
      groupType:    'variable',
      loggedAmount: logged[c.key] ?? 0,
    }))

    // ── Debts — built from transactions logged this month ────
    const debtMap: Record<string, { label: string; amount: number }> = {}
    for (const t of txns ?? []) {
      if (t.category_type !== 'debt') continue
      if (!debtMap[t.category_key]) debtMap[t.category_key] = { label: t.category_label, amount: 0 }
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
      if (!otherMap[t.category_key]) otherMap[t.category_key] = { label: t.category_label, amount: 0 }
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

    setLoading(false)
  }, [supabase, router, currentMonth])

  useEffect(() => { loadData() }, [loadData])

  const openSheet = (item: SheetItem) => {
    setSheetItem(item)
    setSheetOpen(true)

    // For Other items, fetch the user's item dictionary for auto-recognition
    if (item.isOther) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return
        ;(supabase.from('item_dictionary') as any)
          .select('name_normalized, label, group_type, usage_count')
          .eq('user_id', user.id)
          .then(({ data }: any) => {
            if (!data) return
            const dict: Record<string, DictionaryEntry> = {}
            for (const row of data) {
              dict[row.name_normalized] = { groupType: row.group_type, label: row.label, count: row.usage_count ?? 1 }
            }
            setDictionary(dict)
          })
      })
    }

    if (!item.isOther) {
      // Always check for a prior entry this month — if none found, chips won't show
      setPriorEntry(undefined)
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) { setPriorEntry(null); return }
        ;(supabase.from('transactions') as any)
          .select('amount, date')
          .eq('user_id', user.id)
          .eq('month', currentMonth)
          .eq('category_key', item.key)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle()
          .then(({ data: prior }: any) => {
            setPriorEntry(prior ? { amount: Number(prior.amount), date: prior.date } : null)
          })
      })
    } else {
      setPriorEntry(null)
    }
  }

  const handleSave = async (data: ExpenseSaveData) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Replace mode: delete all existing entries for this category this month first
    if (data.replaceExisting) {
      await (supabase.from('transactions') as any)
        .delete()
        .eq('user_id', user.id)
        .eq('month', currentMonth)
        .eq('category_key', data.key)
    }

    await (supabase.from('transactions') as any).insert({
      user_id:        user.id,
      date:           new Date().toISOString().slice(0, 10),
      month:          currentMonth,
      category_type:  data.groupType,
      category_key:   data.key,
      category_label: data.label,
      amount:         data.amount,
      note:           data.note || null,
    })

    // Write Other items to the dictionary for future auto-recognition
    if (sheetItem?.isOther) {
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (!user) return
        const normalized = data.label.trim().toLowerCase()
        // Fetch existing count so we can increment it
        const { data: existing } = await (supabase.from('item_dictionary') as any)
          .select('usage_count')
          .eq('user_id', user.id)
          .eq('name_normalized', normalized)
          .maybeSingle()
        ;(supabase.from('item_dictionary') as any).upsert({
          user_id:         user.id,
          name_normalized: normalized,
          label:           data.label,
          group_type:      data.groupType,
          category_key:    data.key,
          usage_count:     (existing?.usage_count ?? 0) + 1,
        }, { onConflict: 'user_id,name_normalized' })
      })
    }

    // Refresh list so logged amounts update instantly
    loadData()
    // Clear Next.js router cache so overview re-fetches on next navigation
    router.refresh()
  }

  // ─── Loading ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--page-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-sans)', color: 'var(--text-3)', fontSize: 14,
      }}>
        Loading...
      </div>
    )
  }

  // ─── Content ─────────────────────────────────────────────────
  const content = (
    // Extra bottom padding: BottomNav (72) + pinned Other bar (~72) = 144 mobile
    <div style={{ paddingBottom: isDesktop ? 80 : 144 }}>

      {/* Page header */}
      <div style={{ padding: isDesktop ? '32px 32px 20px' : '20px 16px 16px' }}>
        <button
          onClick={() => router.push('/')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 10px', display: 'flex', alignItems: 'center' }}
        >
          <IconBack size={18} color={T.text3} />
        </button>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: isDesktop ? 28 : 24, fontWeight: 600, color: T.text1, margin: 0 }}>
          Add a payment
        </h1>
      </div>

      {/* Sections */}
      {sections.map(section => {
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
        const renderItem = (item: SubItem) => {
          const isLogged = item.loggedAmount > 0
          return (
            <button
              key={item.key}
              onClick={() => openSheet({ key: item.key, label: item.label, groupType: item.groupType, isOther: false })}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
                background: T.white,
                border: `1px solid ${isLogged ? '#DDD4F0' : '#F0ECF8'}`,
                borderRadius: 14, padding: '14px 16px',
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
                textAlign: 'left', boxSizing: 'border-box',
              } as React.CSSProperties}
            >
              <span style={{ fontSize: 15, fontWeight: 500, color: T.text1 }}>
                {item.label}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                {isLogged ? (
                  <>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.brandDark }}>
                      {fmt(item.loggedAmount, currency)} logged
                    </span>
                    {item.sublabel && (
                      <span style={{ fontSize: 12, color: T.textMuted }}>· {item.sublabel}</span>
                    )}
                  </>
                ) : item.sublabel ? (
                  <span style={{ fontSize: 12.5, color: T.text3 }}>{item.sublabel}</span>
                ) : null}
              </div>
            </button>
          )
        }

        // ── All sections rendered as cards ───────────────────
        return (
          <div key={section.key} style={{ margin: isDesktop ? '0 32px 28px' : '0 16px 28px' }}>
            <div style={{
              background: T.white,
              border: `1.5px solid ${T.border}`,
              borderRadius: 16,
              overflow: 'hidden',
            }}>

              {/* Card header */}
              <div style={{
                padding: '14px 16px',
                borderBottom: `1px solid ${T.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <p style={{
                    margin: 0, fontSize: 11, fontWeight: 700,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    color: T.textMuted, fontFamily: 'var(--font-sans)',
                  }}>
                    {section.label}
                  </p>
                  {isAccordion && (
                    <span style={{
                      fontSize: 11, fontWeight: 600, color: T.text3,
                      background: '#F4F0FB', borderRadius: 99, padding: '2px 8px',
                      fontFamily: 'var(--font-sans)',
                    }}>
                      {section.items.length} items
                    </span>
                  )}
                </div>
                {totalLogged > 0 && (
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.brandDark, fontFamily: 'var(--font-sans)' }}>
                    {fmt(totalLogged, currency)} logged
                  </span>
                )}
              </div>

              {/* Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 12px 0' }}>

                {section.items.length === 0 && section.key !== 'debts' && (
                  <p style={{ fontSize: 13, color: T.textMuted, fontFamily: 'var(--font-sans)', margin: '0 0 4px', fontStyle: 'italic' }}>
                    Nothing set up yet.
                  </p>
                )}

                {visibleItems.map(renderItem)}

              </div>

              {/* Debts: always show add button */}
              {section.key === 'debts' && (
                <div style={{ padding: '8px 12px 0' }}>
                  <button
                    onClick={() => openSheet({ key: 'debt_new', label: 'Add a debt', groupType: 'debt', isOther: true })}
                    style={{
                      width: '100%', background: 'transparent',
                      border: `1.5px dashed ${T.borderStrong}`,
                      borderRadius: 14, padding: '13px 16px', cursor: 'pointer',
                      fontSize: 14, fontWeight: 500, color: T.text2,
                      fontFamily: 'var(--font-sans)', textAlign: 'left', boxSizing: 'border-box',
                    } as React.CSSProperties}
                  >
                    + Add a debt payment
                  </button>
                </div>
              )}

              {/* View more / collapse — only when 4+ items */}
              {isAccordion && (
                <button
                  onClick={toggleOpen}
                  style={{
                    width: '100%', background: 'none', border: 'none',
                    padding: '12px 16px', cursor: 'pointer',
                    fontSize: 13, fontWeight: 500,
                    color: T.brandDark, fontFamily: 'var(--font-sans)',
                    textAlign: 'left',
                  }}
                >
                  {isOpen ? 'Show less' : `View ${hiddenCount} more`}
                </button>
              )}

              {/* Bottom padding when no view-more button */}
              {!isAccordion && <div style={{ height: 12 }} />}

            </div>
          </div>
        )
      })}

      {/* Desktop: Something else button inline at bottom */}
      {isDesktop && (
        <div style={{ padding: '0 32px' }}>
          <button
            onClick={() => openSheet({ key: 'other', label: 'Other', groupType: '', isOther: true })}
            style={{
              width: '100%', height: 50,
              background: T.brandDark,
              border: 'none',
              borderRadius: 14,
              cursor: 'pointer',
              fontSize: 14, fontWeight: 600,
              color: '#fff',
              fontFamily: 'var(--font-sans)',
              boxSizing: 'border-box',
            } as React.CSSProperties}
          >
            Log a new payment
          </button>
        </div>
      )}

      {/* Sheet */}
      <AddExpenseSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        item={sheetItem}
        priorEntry={priorEntry}
        dictionary={dictionary}
        currency={currency}
        isDesktop={isDesktop}
        onSave={handleSave}
      />

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
      borderTop: `1px solid ${T.border}`,
      zIndex: 40,
    }}>
      <button
        onClick={() => openSheet({ key: 'other', label: 'Other', groupType: '', isOther: true })}
        style={{
          width: '100%', height: 50,
          background: T.brandDark,
          border: 'none',
          borderRadius: 14,
          cursor: 'pointer',
          fontSize: 14, fontWeight: 600,
          color: '#fff',
          fontFamily: 'var(--font-sans)',
          boxSizing: 'border-box',
        } as React.CSSProperties}
      >
        Log a new payment
      </button>
    </div>
  )

  // ─── Desktop layout ───────────────────────────────────────────
  if (isDesktop) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--page-bg)' }}>
        <SideNav />
        <main style={{ flex: 1, maxWidth: 720 }}>{content}</main>
      </div>
    )
  }

  // ─── Mobile layout ────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', paddingBottom: 72 }}>
      <main>{content}</main>
      {pinnedOther}
      <BottomNav />
    </div>
  )
}
