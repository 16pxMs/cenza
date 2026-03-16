// ─────────────────────────────────────────────────────────────
// /app — Main app shell
// Handles auth check, profile load, tab routing.
// Mobile: BottomNav. Desktop: SideNav.
// State: profile, incomeData, incomeSheetOpen, tab
// ─────────────────────────────────────────────────────────────
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { OverviewEmpty } from '@/components/flows/overview/OverviewEmpty'
import { AddIncomeSheet } from '@/components/flows/income/AddIncomeSheet'

export default function AppPage() {
  const router = useRouter()
  const supabase = createClient()
  const { isDesktop } = useBreakpoint()
  const [tab, setTab] = useState('overview')
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [incomeSheetOpen, setIncomeSheetOpen] = useState(false)
  const [incomeData, setIncomeData] = useState<any>(null)

  const currentMonth = new Date().toISOString().slice(0, 7) // "YYYY-MM"

  const saveIncome = useCallback(async (data: { income: number; extraIncome: any[]; total: number }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await (supabase.from('income_entries') as any).upsert({
      user_id: user.id,
      month: currentMonth,
      salary: data.income,
      extra_income: data.extraIncome,
      total: data.total,
    }, { onConflict: 'user_id,month' })
    if (!error) {
      setIncomeData(data)
    }
  }, [supabase])

  useEffect(() => {
    async function load() {
      // Redirect to login if no session
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single() as { data: any }

      // Redirect to onboarding if profile incomplete or not found
      if (!profile || !profile.onboarding_complete) {
        router.push('/onboarding')
        return
      }

      setProfile(profile)

      // Load existing income for current month if any
      const { data: income } = await (supabase
        .from('income_entries') as any)
        .select('*')
        .eq('user_id', user.id)
        .eq('month', new Date().toISOString().slice(0, 7))
        .single()

      if (income) setIncomeData(income)
      setLoading(false)
    }
    load()
  }, [])

  // Loading state — shown while auth + profile check runs
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--page-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-sans)',
        color: 'var(--text-3)',
        fontSize: 14,
      }}>
        Loading...
      </div>
    )
  }

  // Tab content map — swap out as real screens are built
  const tabContent: Record<string, React.ReactNode> = {
    overview: (
      <OverviewEmpty
        name={profile?.name}
        goals={profile?.goals || []}
        onAddIncome={() => setIncomeSheetOpen(true)}
        isDesktop={isDesktop}
      />
    ),
    spend: (
      <div style={{ padding: '24px 28px', fontFamily: 'var(--font-sans)', color: 'var(--text-3)', fontSize: 14 }}>
        Spend tab coming soon
      </div>
    ),
    goals: (
      <div style={{ padding: '24px 28px', fontFamily: 'var(--font-sans)', color: 'var(--text-3)', fontSize: 14 }}>
        Goals tab coming soon
      </div>
    ),
    finance: (
      <div style={{ padding: '24px 28px', fontFamily: 'var(--font-sans)', color: 'var(--text-3)', fontSize: 14 }}>
        Finance tab coming soon
      </div>
    ),
  }

  // Desktop layout — SideNav on left, content on right
  if (isDesktop) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--page-bg)' }}>
        <button
          onClick={async () => {
            const supabase = createClient()
            await supabase.auth.signOut()
            window.location.href = '/login'
          }}
          style={{
            position: 'fixed', top: 12, right: 16, zIndex: 9999,
            background: 'none', border: '1px solid #ccc', borderRadius: 8,
            padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: '#666'
          }}
        >
          Sign out
        </button>
        <SideNav active={tab} onChange={setTab} />
        <main style={{ flex: 1, maxWidth: 720, padding: '0 0 40px' }}>
          {tabContent[tab]}
        </main>
        <AddIncomeSheet
          open={incomeSheetOpen}
          onClose={() => setIncomeSheetOpen(false)}
          onSave={(data) => { saveIncome(data); setIncomeSheetOpen(false) }}
          currency={profile?.currency || 'KES'}
          isDesktop={isDesktop}
        />
      </div>
    )
  }

  // Mobile layout — BottomNav fixed at bottom
  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', paddingBottom: 72 }}>
      <button
        onClick={async () => {
          const supabase = createClient()
          await supabase.auth.signOut()
          window.location.href = '/login'
        }}
        style={{
          position: 'fixed', top: 12, right: 16, zIndex: 9999,
          background: 'none', border: '1px solid #ccc', borderRadius: 8,
          padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: '#666'
        }}
      >
        Sign out
      </button>
      <main>{tabContent[tab]}</main>
      <BottomNav active={tab} onChange={setTab} />
      <AddIncomeSheet
        open={incomeSheetOpen}
        onClose={() => setIncomeSheetOpen(false)}
        onSave={(data) => { saveIncome(data); setIncomeSheetOpen(false) }}
        currency={profile?.currency || 'KES'}
        isDesktop={isDesktop}
      />
    </div>
  )
}
