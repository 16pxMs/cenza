'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/context/UserContext'
import { useToast } from '@/lib/context/ToastContext'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { AppSubpageHeader } from '@/components/layout/AppSubpageHeader/AppSubpageHeader'
import { AppSubpageLayout } from '@/components/layout/AppSubpageLayout/AppSubpageLayout'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { PrimaryBtn, SecondaryBtn } from '@/components/ui/Button/Button'
import { SettingsRow } from '@/components/ui/SettingsRow/SettingsRow'
import { ChangePinSheet } from '@/components/flows/pin/ChangePinSheet'
import { clearPinDeviceState } from '@/lib/actions/pin'
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

const PAY_DAYS = Array.from({ length: 31 }, (_, i) => i + 1)
const MONTHLY_DAYS = PAY_DAYS

function ordinal(day: number): string {
  if (day % 10 === 1 && day % 100 !== 11) return `${day}st`
  if (day % 10 === 2 && day % 100 !== 12) return `${day}nd`
  if (day % 10 === 3 && day % 100 !== 13) return `${day}rd`
  return `${day}th`
}

function normalizeScheduleDays(type: 'monthly' | 'twice_monthly', days: number[]) {
  if (type === 'monthly') return [days[0] ?? 1]

  const first = Math.min(days[0] ?? 1, 30)
  const secondBase = days[1] ?? Math.max(first + 1, 15)
  const second = Math.max(first + 1, Math.min(secondBase, 31))
  return [first, second]
}

function formatScheduleValue(type: 'monthly' | 'twice_monthly' | null, days: number[]) {
  if (!type || days.length === 0) return 'Not set'
  if (type === 'monthly') return `Monthly · ${ordinal(days[0] ?? 1)}`
  return `Twice a month · ${ordinal(days[0] ?? 1)} & ${ordinal(days[1] ?? days[0] ?? 1)}`
}

function formatScheduleSentence(type: 'monthly' | 'twice_monthly' | null, days: number[]) {
  if (!type || days.length === 0) return 'Choose when you usually get paid.'
  if (type === 'monthly') return `You get paid monthly on the ${ordinal(days[0] ?? 1)}.`
  return `You get paid twice a month on the ${ordinal(days[0] ?? 1)} and ${ordinal(days[1] ?? days[0] ?? 1)}.`
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
    normalizeScheduleDays(data.payScheduleType ?? 'monthly', data.payScheduleDays.length > 0 ? data.payScheduleDays : [1])
  )
  const [scheduleConfigured, setScheduleConfigured] = useState(
    !!data.payScheduleType && data.payScheduleDays.length > 0
  )
  const [activePayDaySlot, setActivePayDaySlot] = useState<'first' | 'second'>('first')
  const [savingPaySchedule, setSavingPaySchedule] = useState(false)

  const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm'>('idle')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const currencyMeta = ALL_CURRENCIES.find(item => item.code === currency)
  const initial = (data.name || '?')[0].toUpperCase()
  const initialScheduleType = data.payScheduleType ?? 'monthly'
  const initialScheduleDays = normalizeScheduleDays(
    initialScheduleType,
    data.payScheduleDays.length > 0 ? data.payScheduleDays : [1]
  )
  const payScheduleDirty =
    scheduleType !== initialScheduleType ||
    scheduleDays.join(',') !== initialScheduleDays.join(',')

  const openPaySchedule = () => {
    setScheduleType(initialScheduleType)
    setScheduleDays(initialScheduleDays)
    setActivePayDaySlot('first')
    setShowPaySchedule(true)
  }

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

  const sectionCard = (children: React.ReactNode) => (
    <div style={{
      background: 'var(--white)',
      border: 'var(--border-width) solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      marginBottom: 'var(--space-lg)',
    }}>
      {children}
    </div>
  )

  const sectionLabel = (text: string) => (
    <p style={{
      margin: '0 0 var(--space-xs)',
      fontSize: 'var(--text-xs)',
      fontWeight: 'var(--weight-semibold)',
      color: 'var(--text-muted)',
      textTransform: 'uppercase',
      letterSpacing: '0.07em',
    }}>
      {text}
    </p>
  )

  const content = (
    <AppSubpageLayout maxWidth={560}>
      <AppSubpageHeader title="Settings" backHref="/menu" ariaLabel="Back to More" />

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
        <SettingsRow label="Sign-in method" value="Google" valueTone="default" isLast />
      </>)}

      {sectionLabel('Preferences')}
      {sectionCard(<>
        <SettingsRow
          label="Currency"
          value={currencyMeta ? `${currencyMeta.flag}  ${currency}` : currency}
          supportingText="Locked after onboarding to keep totals consistent."
          valueTone="default"
          isLast
        />
      </>)}

      {sectionLabel('Income')}
      {sectionCard(<>
        <SettingsRow
          label="Income"
          value={data.monthlyTotal ? fmt(data.monthlyTotal, currency) : 'Not set'}
          supportingText={formatScheduleValue(
            scheduleConfigured ? initialScheduleType : null,
            scheduleConfigured ? initialScheduleDays : []
          ).replace('Monthly ·', 'Paid monthly ·').replace('Twice a month ·', 'Paid twice a month ·')}
          onClick={() => router.push('/income/new?returnTo=/settings')}
          isLast
        />
      </>)}

      {sectionLabel('Security')}
      {sectionCard(<>
        <SettingsRow
          label="PIN"
          value={hasPinCookie ? 'Change' : 'Set up'}
          supportingText="Unlocks Cenza on this device. Google still reconnects your account."
          onClick={() => setChangePinOpen(true)}
          isLast
        />
      </>)}

      {sectionLabel('Account')}
      {sectionCard(<>
        <SettingsRow
          label="Sign out"
          supportingText="Ends this session. This device will still be recognized next time."
          onClick={async () => {
            await clearPinDeviceState()
            await supabase.auth.signOut()
            window.location.href = '/login?tab=login'
          }}
        />

        {deleteStep === 'idle' ? (
          <SettingsRow
            label="Delete account"
            destructive
            onClick={() => setDeleteStep('confirm')}
            isLast
          />
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
    </AppSubpageLayout>
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
      <Sheet
        open={showPaySchedule}
        onClose={() => setShowPaySchedule(false)}
        title="Pay schedule"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <p style={{ margin: '0 0 6px', fontSize: 14, color: T.text1, fontWeight: 600 }}>
              {formatScheduleSentence(scheduleType, scheduleDays)}
            </p>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: T.text3 }}>
              Use the days you usually receive income so reminders and monthly check-ins show up at the right time.
            </p>
          </div>

          <div style={{
            display: 'flex',
            gap: 8,
            background: T.pageBg,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            padding: 4,
          }}>
            {(['monthly', 'twice_monthly'] as const).map(type => (
              <button
                key={type}
                onClick={() => {
                  const nextType = type
                  const nextDays = normalizeScheduleDays(
                    nextType,
                    nextType === 'monthly'
                      ? [scheduleDays[0] ?? 1]
                      : [Math.min(scheduleDays[0] ?? 1, 30), Math.max((scheduleDays[1] ?? 15), Math.min(scheduleDays[0] ?? 1, 30) + 1)]
                  )
                  setScheduleType(nextType)
                  setScheduleDays(nextDays)
                  setActivePayDaySlot('first')
                }}
                style={{
                  flex: 1,
                  height: 36,
                  borderRadius: 9,
                  background: scheduleType === type ? T.white : 'transparent',
                  border: scheduleType === type ? `1px solid ${T.border}` : 'none',
                  color: scheduleType === type ? T.text1 : T.textMuted,
                  fontSize: 13,
                  fontWeight: scheduleType === type ? 600 : 400,
                  cursor: 'pointer',
                  boxShadow: scheduleType === type ? '0 1px 3px rgba(0,0,0,0.07)' : 'none',
                }}
              >
                {type === 'monthly' ? 'Monthly' : 'Twice a month'}
              </button>
            ))}
          </div>

          {scheduleType === 'monthly' ? (
            <>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: T.text1 }}>
                  Choose your pay day
                </p>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: T.text3 }}>
                  Pick the day you usually get paid each month.
                </p>
              </div>
              <button
                type="button"
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: T.white,
                  border: `1px solid ${T.border}`,
                  borderRadius: 14,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'default',
                }}
              >
                <span style={{ fontSize: 14, color: T.text2 }}>Pay day</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: T.text1 }}>{ordinal(scheduleDays[0] ?? 1)}</span>
              </button>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
                {MONTHLY_DAYS.map(day => {
                  const selected = scheduleDays[0] === day
                  return (
                    <button
                      key={day}
                      onClick={() => setScheduleDays([day])}
                      style={{
                        height: 40,
                        borderRadius: 10,
                        background: selected ? T.brandDark : T.pageBg,
                        border: `1px solid ${selected ? T.brandDark : T.border}`,
                        color: selected ? '#fff' : T.text2,
                        fontSize: 13,
                        fontWeight: selected ? 600 : 400,
                        cursor: 'pointer',
                      }}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: T.text1 }}>
                  Choose your pay days
                </p>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: T.text3 }}>
                  Pick the first pay day, then the second one later in the month.
                </p>
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {([
                  { id: 'first', label: 'First pay day', value: scheduleDays[0] ?? 1 },
                  { id: 'second', label: 'Second pay day', value: scheduleDays[1] ?? Math.max((scheduleDays[0] ?? 1) + 1, 15) },
                ] as const).map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActivePayDaySlot(item.id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: activePayDaySlot === item.id ? 'rgba(92, 52, 137, 0.06)' : T.white,
                      border: `1px solid ${activePayDaySlot === item.id ? '#C7B3E6' : T.border}`,
                      borderRadius: 14,
                      padding: '14px 16px 15px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: activePayDaySlot === item.id ? T.text1 : T.text2,
                      }}>
                        {item.label}
                      </span>
                      <span style={{ fontSize: 13, color: T.text3 }}>
                        {activePayDaySlot === item.id
                          ? 'Now choose the day below.'
                          : `Currently ${ordinal(item.value)}.`}
                      </span>
                    </div>
                    <span style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: activePayDaySlot === item.id ? T.brandDark : T.text1,
                    }}>
                      {ordinal(item.value)}
                    </span>
                  </button>
                ))}
              </div>
              <div>
                <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: T.text1 }}>
                  {activePayDaySlot === 'first' ? 'Select first pay day' : 'Select second pay day'}
                </p>
                <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: T.textMuted }}>
                  {activePayDaySlot === 'first'
                    ? 'Your first pay day should come earlier in the month.'
                    : 'Your second pay day should come after the first one.'}
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
                {MONTHLY_DAYS.filter(day => activePayDaySlot === 'first' ? day < (scheduleDays[1] ?? 32) : day > (scheduleDays[0] ?? 0)).map(day => {
                  const selected = activePayDaySlot === 'first' ? scheduleDays[0] === day : scheduleDays[1] === day
                  return (
                    <button
                      key={day}
                      onClick={() => {
                        if (activePayDaySlot === 'first') {
                          const nextFirst = Math.min(day, (scheduleDays[1] ?? 31) - 1)
                          setScheduleDays([nextFirst, Math.max(scheduleDays[1] ?? 15, nextFirst + 1)])
                        } else {
                          const nextSecond = Math.max(day, (scheduleDays[0] ?? 1) + 1)
                          setScheduleDays([scheduleDays[0] ?? 1, nextSecond])
                        }
                      }}
                      style={{
                        height: 40,
                        borderRadius: 10,
                        background: selected ? T.brandDark : T.pageBg,
                        border: `1px solid ${selected ? T.brandDark : T.border}`,
                        color: selected ? '#fff' : T.text2,
                        fontSize: 13,
                        fontWeight: selected ? 600 : 400,
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

          {payScheduleDirty && (
            <PrimaryBtn
              size="md"
              onClick={persistPaySchedule}
              disabled={savingPaySchedule}
              style={{
                width: '100%',
                opacity: savingPaySchedule ? 0.7 : 1,
              }}
            >
              {savingPaySchedule ? 'Saving…' : 'Save'}
            </PrimaryBtn>
          )}
        </div>
      </Sheet>
    </>
  )
}
