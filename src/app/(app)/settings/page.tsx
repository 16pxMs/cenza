'use client'
export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// /settings — User settings
//
// Sections:
//   1. Profile       — name, email (display only, from Google)
//   2. Preferences   — currency, pay day
//   3. This month    — update declared income
//   4. Account       — sign out, delete account
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/context/UserContext'
import { useToast } from '@/lib/context/ToastContext'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { AddIncomeSheet } from '@/components/flows/income/AddIncomeSheet'
import { ChangePinSheet } from '@/components/flows/pin/ChangePinSheet'
import { clearPinVerified } from '@/lib/actions/pin'
import { IconBack } from '@/components/ui/Icons'
import { CheckCircle2 } from 'lucide-react'
import { fmt } from '@/lib/finance'
import { CURATED_CURRENCIES, ALL_CURRENCIES } from '@/lib/locale'
import { getCurrentCycleId } from '@/lib/supabase/cycles-db'

const T = {
  pageBg:    '#F8F9FA',
  white:     '#FFFFFF',
  border:    '#E4E7EC',
  text1:     '#101828',
  text2:     '#475467',
  text3:     '#667085',
  textMuted: '#98A2B3',
  brandDark: '#5C3489',
}

const PAY_DAYS = Array.from({ length: 28 }, (_, i) => i + 1)
const MONTHLY_DAYS = PAY_DAYS  // 1-28 for monthly pay day

export default function SettingsPage() {
  const router        = useRouter()
  const supabase      = createClient()
  const { isDesktop } = useBreakpoint()
  const { user, profile: ctxProfile } = useUser()

  const { toast } = useToast()

  const [loading, setLoading]             = useState(true)
  const [cycleId, setCycleId]             = useState<string>('')
  const [name, setName]                   = useState('')
  const [email, setEmail]                 = useState('')
  const [currency, setCurrency]           = useState('')
  const [monthlyTotal, setMonthlyTotal]   = useState<number | null>(null)
  const [incomeSheetOpen, setIncomeSheetOpen] = useState(false)
  const [changePinOpen, setChangePinOpen]     = useState(false)
  const hasPinCookie = typeof document !== 'undefined' &&
    document.cookie.split(';').some(c => c.trim().startsWith('cenza-has-pin=1'))

  // Currency picker panel
  const [showCurrency, setShowCurrency]   = useState(false)
  const [currencyQuery, setCurrencyQuery] = useState('')
  const [savingCurrency, setSavingCurrency] = useState(false)

  // Pay schedule picker panel
  const [showPaySchedule, setShowPaySchedule]     = useState(false)
  const [scheduleType, setScheduleType]           = useState<'monthly' | 'twice_monthly'>('monthly')
  const [scheduleDays, setScheduleDays]           = useState<number[]>([1])
  const [savingPaySchedule, setSavingPaySchedule] = useState(false)

  // Delete account
  const [deleteStep, setDeleteStep]       = useState<'idle' | 'confirm'>('idle')
  const [deleting, setDeleting]           = useState(false)

  useEffect(() => {
    if (!user || !ctxProfile) return
    setName(ctxProfile.name || user.user_metadata?.full_name || user.email?.split('@')[0] || '')
    setEmail(user.email ?? '')
    setCurrency(ctxProfile.currency ?? '')
    if (ctxProfile.pay_schedule_type) {
      setScheduleType(ctxProfile.pay_schedule_type as 'monthly' | 'twice_monthly')
      setScheduleDays(ctxProfile.pay_schedule_days ?? [1])
    }
    ;(async () => {
      const resolvedCycleId = await getCurrentCycleId(supabase as any, user.id, ctxProfile as any)
      setCycleId(resolvedCycleId)
      const { data: income } = await (supabase.from('income_entries') as any)
        .select('total').eq('user_id', user.id).eq('cycle_id', resolvedCycleId).maybeSingle()
      setMonthlyTotal(income?.total ?? null)
      setLoading(false)
    })()
  }, [user, ctxProfile])

  const saveCurrency = async (code: string) => {
    setSavingCurrency(true)
    if (!user) return
    await (supabase.from('user_profiles') as any).update({ currency: code }).eq('id', user.id)
    toast('Currency updated')
    setCurrency(code)
    setSavingCurrency(false)
    setShowCurrency(false)
    setCurrencyQuery('')
  }

  const savePaySchedule = async () => {
    setSavingPaySchedule(true)
    if (!user) return
    await (supabase.from('user_profiles') as any)
      .update({ pay_schedule_type: scheduleType, pay_schedule_days: scheduleDays })
      .eq('id', user.id)
    toast('Pay schedule saved')
    setSavingPaySchedule(false)
    setShowPaySchedule(false)
  }

  const handleIncomeSave = async (data: { income: number; extraIncome: any[]; total: number }) => {
    if (!user) return
    await (supabase.from('income_entries') as any).upsert({
      user_id:      user.id,
      month:        new Date().toISOString().slice(0, 7),
      cycle_id:     cycleId,
      salary:       data.income,
      extra_income: data.extraIncome,
      total:        data.total,
    }, { onConflict: 'user_id,cycle_id' })
    toast('Income updated')
    setMonthlyTotal(data.total)
    setIncomeSheetOpen(false)
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    if (!user) return
    // Delete all user data then sign out — actual account deletion via Supabase admin requires a server action
    await Promise.all([
      (supabase.from('user_profiles') as any).delete().eq('id', user.id),
      (supabase.from('income_entries') as any).delete().eq('user_id', user.id),
      (supabase.from('transactions') as any).delete().eq('user_id', user.id),
      (supabase.from('goal_targets') as any).delete().eq('user_id', user.id),
      (supabase.from('fixed_expenses') as any).delete().eq('user_id', user.id),
    ])
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const currencyMeta = ALL_CURRENCIES.find(c => c.code === currency)
  const initial      = (name || '?')[0].toUpperCase()

  // ── Currency picker panel ─────────────────────────────────
  const isSearching  = currencyQuery.trim().length > 0
  const currencyList = isSearching
    ? ALL_CURRENCIES.filter(c =>
        c.code.toLowerCase().includes(currencyQuery.toLowerCase()) ||
        c.name.toLowerCase().includes(currencyQuery.toLowerCase())
      )
    : CURATED_CURRENCIES

  // ── Shared row style ──────────────────────────────────────
  const row = (
    label: string,
    value: React.ReactNode,
    onTap?: () => void,
    isLast = false,
  ): React.ReactNode => (
    <button
      onClick={onTap}
      disabled={!onTap}
      style={{
        width: '100%', textAlign: 'left', background: 'none',
        border: 'none', borderBottom: isLast ? 'none' : `1px solid ${T.border}`,
        padding: '14px 16px', cursor: onTap ? 'pointer' : 'default',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxSizing: 'border-box',
      }}
    >
      <span style={{ fontSize: 15, color: T.text1 }}>{label}</span>
      <span style={{ fontSize: 14, color: onTap ? T.brandDark : T.textMuted, fontWeight: onTap ? 500 : 400 }}>
        {value}
      </span>
    </button>
  )

  const sectionCard = (children: React.ReactNode) => (
    <div style={{
      background: T.white, border: `1px solid ${T.border}`,
      borderRadius: 16, overflow: 'hidden', marginBottom: 20,
    }}>
      {children}
    </div>
  )

  const sectionLabel = (text: string) => (
    <p style={{
      margin: '0 0 8px', fontSize: 12, fontWeight: 600,
      color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em',
    }}>
      {text}
    </p>
  )

  const content = loading ? (
    <div style={{ textAlign: 'center', padding: '48px 0', color: T.textMuted, fontSize: 14 }}>Loading…</div>
  ) : (
    <div style={{ padding: isDesktop ? '40px 32px' : '24px 16px', maxWidth: 560 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 12px', display: 'flex', alignItems: 'center' }}
        >
          <IconBack size={18} color={T.text3} />
        </button>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: T.text1, letterSpacing: -0.4 }}>
          Settings
        </h1>
      </div>

      {/* Section 1 — Profile */}
      {sectionLabel('Profile')}
      {sectionCard(<>
        {/* Avatar + name row */}
        <div style={{
          padding: '16px', display: 'flex', alignItems: 'center', gap: 14,
          borderBottom: `1px solid ${T.border}`,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: T.brandDark, color: '#fff',
            fontSize: 18, fontWeight: 600, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {initial}
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: T.text1 }}>{name}</p>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: T.text3 }}>{email}</p>
          </div>
        </div>
        {row('Account type', 'Google', undefined, true)}
      </>)}

      {/* Section 2 — Financial preferences */}
      {sectionLabel('Preferences')}
      {sectionCard(<>
        {row(
          'Currency',
          currencyMeta ? `${currencyMeta.flag}  ${currency}` : currency,
          () => setShowCurrency(v => !v),
        )}
        {/* Currency picker — inline expand */}
        {showCurrency && (
          <div style={{ padding: '0 16px 16px', borderBottom: `1px solid ${T.border}` }}>
            {/* Search */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: T.pageBg, border: `1px solid ${T.border}`,
              borderRadius: 12, padding: '0 12px', height: 44, marginBottom: 12,
            }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="7" cy="7" r="5" stroke={T.textMuted} strokeWidth="1.5"/>
                <path d="M11 11l2.5 2.5" stroke={T.textMuted} strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input
                value={currencyQuery}
                onChange={e => setCurrencyQuery(e.target.value)}
                placeholder="Search currencies…"
                style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 14, color: T.text1, outline: 'none' }}
              />
            </div>
            {!isSearching && (
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Common currencies
              </p>
            )}
            <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
              {currencyList.length === 0 ? (
                <p style={{ padding: '16px', fontSize: 14, color: T.textMuted, margin: 0 }}>No results for "{currencyQuery}"</p>
              ) : currencyList.map((c, i) => {
                const sel = currency === c.code
                return (
                  <button
                    key={c.code}
                    onClick={() => !savingCurrency && saveCurrency(c.code)}
                    style={{
                      width: '100%', textAlign: 'left', cursor: 'pointer',
                      background: sel ? '#F3EDFB' : 'transparent',
                      border: 'none',
                      borderBottom: i === currencyList.length - 1 ? 'none' : `1px solid #F2F4F7`,
                      padding: '11px 14px',
                      display: 'flex', alignItems: 'center', gap: 12,
                      boxSizing: 'border-box',
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{c.flag}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.text1 }}>{c.code}</div>
                      <div style={{ fontSize: 12, color: T.text3 }}>{c.name}</div>
                    </div>
                    {sel && <CheckCircle2 size={20} color={T.brandDark} fill={T.brandDark} strokeWidth={2} />}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        {row(
          'Pay schedule',
          scheduleType === 'monthly'
            ? `${scheduleDays[0]}${scheduleDays[0] === 1 ? 'st' : scheduleDays[0] === 2 ? 'nd' : scheduleDays[0] === 3 ? 'rd' : 'th'} of the month`
            : `${scheduleDays[0]}th & ${scheduleDays[1] ?? scheduleDays[0]}th`,
          () => setShowPaySchedule(v => !v),
          !showPaySchedule,
        )}
        {/* Pay schedule picker — inline expand */}
        {showPaySchedule && (
          <div style={{ padding: '12px 16px 16px' }}>
            {/* Toggle: Monthly / Twice a month */}
            <div style={{
              display: 'flex', gap: 8, marginBottom: 16,
              background: T.pageBg, border: `1px solid ${T.border}`,
              borderRadius: 12, padding: 4,
            }}>
              {(['monthly', 'twice_monthly'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => {
                    setScheduleType(type)
                    setScheduleDays(type === 'monthly' ? [scheduleDays[0] ?? 1] : [1, 15])
                  }}
                  style={{
                    flex: 1, height: 36, borderRadius: 9,
                    background: scheduleType === type ? T.white : 'transparent',
                    border: scheduleType === type ? `1px solid ${T.border}` : 'none',
                    color: scheduleType === type ? T.text1 : T.textMuted,
                    fontSize: 13, fontWeight: scheduleType === type ? 600 : 400,
                    cursor: 'pointer',
                    boxShadow: scheduleType === type ? '0 1px 3px rgba(0,0,0,0.07)' : 'none',
                  }}
                >
                  {type === 'monthly' ? 'Monthly' : 'Twice a month'}
                </button>
              ))}
            </div>

            {/* Day picker(s) */}
            {scheduleType === 'monthly' && (
              <>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: T.textMuted }}>Pay day</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 16 }}>
                  {MONTHLY_DAYS.map(d => {
                    const sel = scheduleDays[0] === d
                    return (
                      <button
                        key={d}
                        onClick={() => setScheduleDays([d])}
                        style={{
                          height: 40, borderRadius: 10,
                          background: sel ? T.brandDark : T.pageBg,
                          border: `1px solid ${sel ? T.brandDark : T.border}`,
                          color: sel ? '#fff' : T.text2,
                          fontSize: 13, fontWeight: sel ? 600 : 400,
                          cursor: 'pointer',
                        }}
                      >
                        {d}
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {scheduleType === 'twice_monthly' && (
              <>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: T.textMuted }}>First pay day (must be 1–3)</p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  {[1, 2, 3].map(d => {
                    const sel = scheduleDays[0] === d
                    return (
                      <button
                        key={d}
                        onClick={() => setScheduleDays([d, scheduleDays[1] ?? 15])}
                        style={{
                          flex: 1, height: 44, borderRadius: 10,
                          background: sel ? T.brandDark : T.pageBg,
                          border: `1px solid ${sel ? T.brandDark : T.border}`,
                          color: sel ? '#fff' : T.text2,
                          fontSize: 15, fontWeight: sel ? 600 : 400,
                          cursor: 'pointer',
                        }}
                      >
                        {d}
                      </button>
                    )
                  })}
                </div>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: T.textMuted }}>Second pay day</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 16 }}>
                  {MONTHLY_DAYS.filter(d => d > (scheduleDays[0] ?? 1)).map(d => {
                    const sel = scheduleDays[1] === d
                    return (
                      <button
                        key={d}
                        onClick={() => setScheduleDays([scheduleDays[0] ?? 1, d])}
                        style={{
                          height: 40, borderRadius: 10,
                          background: sel ? T.brandDark : T.pageBg,
                          border: `1px solid ${sel ? T.brandDark : T.border}`,
                          color: sel ? '#fff' : T.text2,
                          fontSize: 13, fontWeight: sel ? 600 : 400,
                          cursor: 'pointer',
                        }}
                      >
                        {d}
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            <button
              onClick={savePaySchedule}
              disabled={savingPaySchedule}
              style={{
                width: '100%', height: 44, borderRadius: 12,
                background: T.brandDark, border: 'none',
                color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: savingPaySchedule ? 'not-allowed' : 'pointer',
                opacity: savingPaySchedule ? 0.7 : 1,
              }}
            >
              {savingPaySchedule ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </>)}

      {/* Section 3 — Security */}
      {sectionLabel('Security')}
      {sectionCard(<>
        {row('PIN', hasPinCookie ? 'Change' : 'Set up', () => setChangePinOpen(true), true)}
      </>)}

      {/* Section 4 — This month */}
      {sectionLabel('This month')}
      {sectionCard(<>
        {row(
          'Monthly income',
          monthlyTotal ? fmt(monthlyTotal, currency) : 'Not set',
          () => setIncomeSheetOpen(true),
          true,
        )}
      </>)}

      {/* Section 5 — Account */}
      {sectionLabel('Account')}
      {sectionCard(<>
        <button
          onClick={async () => {
            await clearPinVerified()
            await supabase.auth.signOut()
            window.location.href = '/login'
          }}
          style={{
            width: '100%', textAlign: 'left', background: 'none', border: 'none',
            borderBottom: `1px solid ${T.border}`, padding: '14px 16px',
            cursor: 'pointer', fontSize: 15, color: T.text1, boxSizing: 'border-box',
          }}
        >
          Sign out
        </button>

        {deleteStep === 'idle' ? (
          <button
            onClick={() => setDeleteStep('confirm')}
            style={{
              width: '100%', textAlign: 'left', background: 'none', border: 'none',
              padding: '14px 16px', cursor: 'pointer', fontSize: 15, color: '#D93025',
              boxSizing: 'border-box',
            }}
          >
            Delete account
          </button>
        ) : (
          <div style={{ padding: '16px' }}>
            <p style={{ margin: '0 0 12px', fontSize: 14, color: T.text2, lineHeight: 1.6 }}>
              This permanently deletes your account and all your data. There is no undo.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setDeleteStep('idle')}
                style={{
                  flex: 1, height: 44, borderRadius: 12,
                  background: T.pageBg, border: `1px solid ${T.border}`,
                  fontSize: 14, fontWeight: 500, color: T.text2, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                style={{
                  flex: 1, height: 44, borderRadius: 12,
                  background: '#D93025', border: 'none',
                  fontSize: 14, fontWeight: 600, color: '#fff',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.7 : 1,
                }}
              >
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          </div>
        )}
      </>)}

    </div>
  )

  return (
    <>
      {isDesktop ? (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <SideNav />
          <main style={{ flex: 1 }}>{content}</main>
        </div>
      ) : (
        <div style={{ minHeight: '100vh', background: T.pageBg, paddingBottom: 88 }}>
          <main>{content}</main>
          <BottomNav />
        </div>
      )}

      <AddIncomeSheet
        open={incomeSheetOpen}
        onClose={() => setIncomeSheetOpen(false)}
        onSave={handleIncomeSave}
        currency={currency}
        isDesktop={isDesktop}
      />

      <ChangePinSheet
        open={changePinOpen}
        onClose={() => setChangePinOpen(false)}
        onSaved={() => toast(hasPinCookie ? 'PIN updated' : 'PIN set up')}
      />
    </>
  )
}
