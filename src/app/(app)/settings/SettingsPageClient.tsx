'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/context/UserContext'
import { useToast } from '@/lib/context/ToastContext'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { PrimaryBtn, SecondaryBtn } from '@/components/ui/Button/Button'
import { ChangePinSheet } from '@/components/flows/pin/ChangePinSheet'
import { clearPinDeviceState } from '@/lib/actions/pin'
import { IconBack } from '@/components/ui/Icons'
import { fmt } from '@/lib/finance'
import { CURATED_CURRENCIES, ALL_CURRENCIES } from '@/lib/locale'
import type { SettingsPageData } from '@/lib/loaders/settings'
import { deleteAccountData, saveCurrency, savePaySchedule } from './actions'

const T = {
  pageBg: '#F8F9FA',
  white: '#FFFFFF',
  border: '#E4E7EC',
  text1: '#101828',
  text2: '#475467',
  text3: '#667085',
  textMuted: '#98A2B3',
  brandDark: '#5C3489',
}

const PAY_DAYS = Array.from({ length: 28 }, (_, i) => i + 1)
const MONTHLY_DAYS = PAY_DAYS

export default function SettingsPageClient({ data }: { data: SettingsPageData }) {
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()
  const { isDesktop } = useBreakpoint()
  const { refreshProfile } = useUser()

  const [currency, setCurrency] = useState(data.currency)
  const [changePinOpen, setChangePinOpen] = useState(false)
  const hasPinCookie = typeof document !== 'undefined' &&
    document.cookie.split(';').some(cookie => cookie.trim().startsWith('cenza-has-pin=1'))

  const [showCurrency, setShowCurrency] = useState(false)
  const [currencyQuery, setCurrencyQuery] = useState('')
  const [savingCurrency, setSavingCurrency] = useState(false)

  const [showPaySchedule, setShowPaySchedule] = useState(false)
  const [scheduleType, setScheduleType] = useState<'monthly' | 'twice_monthly'>(data.payScheduleType)
  const [scheduleDays, setScheduleDays] = useState<number[]>(data.payScheduleDays)
  const [savingPaySchedule, setSavingPaySchedule] = useState(false)

  const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm'>('idle')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const currencyMeta = ALL_CURRENCIES.find(item => item.code === currency)
  const initial = (data.name || '?')[0].toUpperCase()
  const isSearching = currencyQuery.trim().length > 0
  const currencyList = isSearching
    ? ALL_CURRENCIES.filter(item =>
        item.code.toLowerCase().includes(currencyQuery.toLowerCase()) ||
        item.name.toLowerCase().includes(currencyQuery.toLowerCase())
      )
    : CURATED_CURRENCIES

  const persistCurrency = async (code: string) => {
    try {
      setSavingCurrency(true)
      await saveCurrency(code)
      await refreshProfile()
      setCurrency(code)
      setShowCurrency(false)
      setCurrencyQuery('')
      toast('Currency updated')
    } catch {
      toast('Failed to update currency. Please try again.')
    } finally {
      setSavingCurrency(false)
    }
  }

  const persistPaySchedule = async () => {
    try {
      setSavingPaySchedule(true)
      await savePaySchedule(scheduleType, scheduleDays)
      await refreshProfile()
      setShowPaySchedule(false)
      toast('Pay schedule saved')
    } catch {
      toast('Failed to save pay schedule. Please try again.')
    } finally {
      setSavingPaySchedule(false)
    }
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    setDeleteError(null)

    try {
      await deleteAccountData()
      await clearPinDeviceState({ forgetDevice: true })
      await supabase.auth.signOut()
      window.location.href = '/login?tab=login'
    } catch {
      setDeleteError('Failed to delete account data. Please try again.')
      setDeleting(false)
    }
  }

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

  const content = (
    <div style={{ padding: isDesktop ? '40px 32px' : '24px 16px', maxWidth: 560 }}>
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

      {sectionLabel('Profile')}
      {sectionCard(<>
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
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: T.text1 }}>{data.name}</p>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: T.text3 }}>{data.email}</p>
          </div>
        </div>
        {row('Sign-in method', 'Google', undefined, true)}
      </>)}

      {sectionLabel('Preferences')}
      {sectionCard(<>
        {row(
          'Currency',
          currencyMeta ? `${currencyMeta.flag}  ${currency}` : currency,
          () => setShowCurrency(value => !value),
        )}
        {showCurrency && (
          <div style={{ padding: '0 16px 16px', borderBottom: `1px solid ${T.border}` }}>
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
                onChange={event => setCurrencyQuery(event.target.value)}
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
              ) : currencyList.map((item, index) => {
                const selected = currency === item.code
                return (
                  <button
                    key={item.code}
                    onClick={() => !savingCurrency && persistCurrency(item.code)}
                    style={{
                      width: '100%', textAlign: 'left', cursor: 'pointer',
                      background: selected ? '#F3EDFB' : 'transparent',
                      border: 'none',
                      borderBottom: index === currencyList.length - 1 ? 'none' : `1px solid #F2F4F7`,
                      padding: '11px 14px',
                      display: 'flex', alignItems: 'center', gap: 12,
                      boxSizing: 'border-box',
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{item.flag}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.text1 }}>{item.code}</div>
                      <div style={{ fontSize: 12, color: T.text3 }}>{item.name}</div>
                    </div>
                    {selected && <CheckCircle2 size={20} color={T.brandDark} fill={T.brandDark} strokeWidth={2} />}
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
          () => setShowPaySchedule(value => !value),
          !showPaySchedule,
        )}
        {showPaySchedule && (
          <div style={{ padding: '12px 16px 16px' }}>
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

            {scheduleType === 'monthly' && (
              <>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: T.textMuted }}>Pay day</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 16 }}>
                  {MONTHLY_DAYS.map(day => {
                    const selected = scheduleDays[0] === day
                    return (
                      <button
                        key={day}
                        onClick={() => setScheduleDays([day])}
                        style={{
                          height: 40, borderRadius: 10,
                          background: selected ? T.brandDark : T.pageBg,
                          border: `1px solid ${selected ? T.brandDark : T.border}`,
                          color: selected ? '#fff' : T.text2,
                          fontSize: 13, fontWeight: selected ? 600 : 400,
                          cursor: 'pointer',
                        }}
                      >
                        {day}
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
                  {[1, 2, 3].map(day => {
                    const selected = scheduleDays[0] === day
                    return (
                      <button
                        key={day}
                        onClick={() => setScheduleDays([day, scheduleDays[1] ?? 15])}
                        style={{
                          flex: 1, height: 44, borderRadius: 10,
                          background: selected ? T.brandDark : T.pageBg,
                          border: `1px solid ${selected ? T.brandDark : T.border}`,
                          color: selected ? '#fff' : T.text2,
                          fontSize: 15, fontWeight: selected ? 600 : 400,
                          cursor: 'pointer',
                        }}
                      >
                        {day}
                      </button>
                    )
                  })}
                </div>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: T.textMuted }}>Second pay day</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 16 }}>
                  {MONTHLY_DAYS.filter(day => day > (scheduleDays[0] ?? 1)).map(day => {
                    const selected = scheduleDays[1] === day
                    return (
                      <button
                        key={day}
                        onClick={() => setScheduleDays([scheduleDays[0] ?? 1, day])}
                        style={{
                          height: 40, borderRadius: 10,
                          background: selected ? T.brandDark : T.pageBg,
                          border: `1px solid ${selected ? T.brandDark : T.border}`,
                          color: selected ? '#fff' : T.text2,
                          fontSize: 13, fontWeight: selected ? 600 : 400,
                          cursor: 'pointer',
                        }}
                      >
                        {day}
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            <button
              onClick={persistPaySchedule}
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

      {sectionLabel('Security')}
      {sectionCard(<>
        <p style={{
          margin: 0,
          padding: '14px 16px 0',
          fontSize: 13,
          color: T.text3,
          lineHeight: 1.6,
        }}>
          PIN unlocks Cenza on this device. Google is still used to reconnect or recover your account.
        </p>
        {row('PIN', hasPinCookie ? 'Change' : 'Set up', () => setChangePinOpen(true), true)}
      </>)}

      {sectionLabel('This month')}
      {sectionCard(<>
        {row(
          'Monthly income',
          data.monthlyTotal ? fmt(data.monthlyTotal, currency) : 'Not set',
          () => router.push('/income/new?returnTo=/settings'),
          true,
        )}
      </>)}

      {sectionLabel('Account')}
      {sectionCard(<>
        <p style={{
          margin: 0,
          padding: '14px 16px 0',
          fontSize: 13,
          color: T.text3,
          lineHeight: 1.6,
        }}>
          Signing out removes this device from quick re-entry. The next login will start with Google reconnect.
        </p>
        <button
          onClick={async () => {
            await clearPinDeviceState({ forgetDevice: true })
            await supabase.auth.signOut()
            window.location.href = '/login?tab=login'
          }}
          style={{
            width: '100%', textAlign: 'left', background: 'none', border: 'none',
            borderBottom: `1px solid ${T.border}`, padding: '14px 16px',
            cursor: 'pointer', fontSize: 15, color: T.text1, boxSizing: 'border-box',
          }}
        >
          Sign out on this device
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
            {deleteError && (
              <p style={{
                margin: '0 0 12px', padding: '10px 14px', borderRadius: 10,
                background: '#FEF2F2', border: '1px solid #FECACA',
                fontSize: 13, color: '#D93025', lineHeight: 1.5,
              }}>
                {deleteError}
              </p>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <SecondaryBtn
                size="md"
                onClick={() => { setDeleteStep('idle'); setDeleteError(null) }}
                style={{
                  flex: 1,
                  borderColor: 'var(--border)',
                  color: T.text2,
                }}
              >
                Cancel
              </SecondaryBtn>
              <PrimaryBtn
                size="md"
                onClick={handleDeleteAccount}
                disabled={deleting}
                style={{
                  flex: 1,
                  background: 'var(--red-dark)',
                  color: 'var(--text-inverse)',
                  opacity: deleting ? 0.7 : 1,
                }}
              >
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </PrimaryBtn>
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
      <ChangePinSheet
        open={changePinOpen}
        onClose={() => setChangePinOpen(false)}
        onSaved={() => toast(hasPinCookie ? 'PIN updated' : 'PIN set up')}
      />
    </>
  )
}
