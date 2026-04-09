'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { ALL_CURRENCIES } from '@/lib/locale'
import type { SettingsPageData } from '@/lib/loaders/settings'
import { deleteAccountPermanently, savePaySchedule } from './actions'

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

function ordinal(day: number): string {
  if (day % 10 === 1 && day % 100 !== 11) return `${day}st`
  if (day % 10 === 2 && day % 100 !== 12) return `${day}nd`
  if (day % 10 === 3 && day % 100 !== 13) return `${day}rd`
  return `${day}th`
}

export default function SettingsPageClient({ data }: { data: SettingsPageData }) {
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()
  const { isDesktop } = useBreakpoint()
  const { refreshProfile } = useUser()

  const currency = data.currency
  const [changePinOpen, setChangePinOpen] = useState(false)
  const hasPinCookie = typeof document !== 'undefined' &&
    document.cookie.split(';').some(cookie => cookie.trim().startsWith('cenza-has-pin=1'))

  const [showPaySchedule, setShowPaySchedule] = useState(false)
  const [scheduleType, setScheduleType] = useState<'monthly' | 'twice_monthly'>(data.payScheduleType ?? 'monthly')
  const [scheduleDays, setScheduleDays] = useState<number[]>(
    data.payScheduleDays.length > 0 ? data.payScheduleDays : [1]
  )
  const [scheduleConfigured, setScheduleConfigured] = useState(
    !!data.payScheduleType && data.payScheduleDays.length > 0
  )
  const [savingPaySchedule, setSavingPaySchedule] = useState(false)

  const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm'>('idle')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const currencyMeta = ALL_CURRENCIES.find(item => item.code === currency)
  const initial = (data.name || '?')[0].toUpperCase()

  const persistPaySchedule = async () => {
    try {
      setSavingPaySchedule(true)
      await savePaySchedule(scheduleType, scheduleDays)
      await refreshProfile()
      setShowPaySchedule(false)
      setScheduleConfigured(true)
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
      await deleteAccountPermanently()
      await supabase.auth.signOut()
      window.location.href = '/'
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Failed to fully delete your account. Please try again.'
      setDeleteError(message)
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
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            width: 44,
            height: 44,
            padding: 0,
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconBack size={18} color="var(--grey-900)" />
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
          undefined,
        )}
        <p style={{ margin: 0, padding: '0 16px 12px', fontSize: 12, color: T.textMuted, lineHeight: 1.5 }}>
          Currency is locked after onboarding to keep your totals consistent.
        </p>
        {row(
          'Pay schedule',
          scheduleConfigured
            ? (scheduleType === 'monthly'
                ? `${ordinal(scheduleDays[0] ?? 1)} of the month`
                : `${ordinal(scheduleDays[0] ?? 1)} & ${ordinal(scheduleDays[1] ?? scheduleDays[0] ?? 1)}`)
            : 'Not set',
          () => setShowPaySchedule(value => !value),
          true,
        )}
        {showPaySchedule && (
          <div style={{ padding: '12px 16px 16px', borderTop: `1px solid ${T.border}` }}>
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
          Signing out ends this session. This device will still be recognized the next time you come back.
        </p>
        <button
          onClick={async () => {
            await clearPinDeviceState()
            await supabase.auth.signOut()
            window.location.href = '/login?tab=login'
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
              This permanently deletes your Cenza account, secure login, and all your data. There is no undo.
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
