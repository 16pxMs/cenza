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
import { formatAmount } from '@/lib/formatting/amount'
import { ALL_CURRENCIES } from '@/lib/locale'
import type { SettingsPageData } from '@/lib/loaders/settings'
import type { AmountFormatPreference } from '@/lib/formatting/amount'
import { deleteAccountPermanently, saveAmountFormatPreference, savePaySchedule } from './actions'

// All visual values flow through CSS tokens — see src/styles/tokens.css.
// Type scale on this surface: --text-lg (avatar), --text-base (labels & values),
// --text-sm (supporting copy & chips), --text-xs (eyebrows & hints).
// Weights: regular for body, medium for labels, semibold for names & active states.
const T = {
  pageBg: 'var(--page-bg)',
  white: 'var(--white)',
  border: 'var(--border)',
  text1: 'var(--text-1)',
  text2: 'var(--text-2)',
  text3: 'var(--text-3)',
  textMuted: 'var(--text-muted)',
  brandDark: 'var(--brand-dark)',
  brandMid: 'var(--brand-mid)',
  brandTint: 'color-mix(in srgb, var(--brand-dark) 6%, transparent)',
  textInverse: 'var(--text-inverse)',
  redLight: 'var(--red-light)',
  redBorder: 'var(--red-border)',
  redDark: 'var(--red-dark)',
} as const

const PAY_DAYS = Array.from({ length: 31 }, (_, i) => i + 1)
const MONTHLY_DAYS = PAY_DAYS
const AMOUNT_FORMAT_OPTIONS: Array<{
  value: AmountFormatPreference
  label: string
  description: string
}> = [
  { value: 'smart', label: 'Smart', description: 'Balanced for readability' },
  { value: 'full', label: 'Full', description: 'Show exact amounts' },
  { value: 'short', label: 'Short', description: 'Use K/M abbreviations' },
]

function amountFormatExample(value: AmountFormatPreference, currency: string) {
  switch (value) {
    case 'smart':
      return {
        primary: `${formatAmount(338500, { currency, preference: 'smart', context: 'summary' })} in summaries · ${formatAmount(338500, { currency, preference: 'smart', context: 'detail' })} in detail`,
      }
    case 'full':
      return {
        primary: `${formatAmount(338500, { currency, preference: 'full', context: 'summary' })} everywhere`,
      }
    case 'short':
      return {
        primary: `${formatAmount(338500, { currency, preference: 'short', context: 'summary' })} across the app`,
      }
    default:
      return {
        primary: `${formatAmount(338500, { currency, preference: 'smart', context: 'summary' })} in summaries · ${formatAmount(338500, { currency, preference: 'smart', context: 'detail' })} in detail`,
      }
  }
}

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

function amountFormatLabel(value: AmountFormatPreference) {
  return AMOUNT_FORMAT_OPTIONS.find((option) => option.value === value)?.label ?? 'Smart'
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
  const [showAmountFormat, setShowAmountFormat] = useState(false)
  const [savedAmountFormatPreference, setSavedAmountFormatPreference] = useState<AmountFormatPreference>(data.amountFormatPreference)
  const [amountFormatPreference, setAmountFormatPreference] = useState<AmountFormatPreference>(data.amountFormatPreference)
  const [savingAmountFormat, setSavingAmountFormat] = useState(false)

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
  const amountFormatDirty = amountFormatPreference !== savedAmountFormatPreference

  const openPaySchedule = () => {
    setScheduleType(initialScheduleType)
    setScheduleDays(initialScheduleDays)
    setActivePayDaySlot('first')
    setShowPaySchedule(true)
  }

  const openAmountFormat = () => {
    setAmountFormatPreference(savedAmountFormatPreference)
    setShowAmountFormat(true)
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
          padding: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
          borderBottom: `var(--border-width) solid var(--border-subtle)`,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: T.brandDark, color: T.textInverse,
            fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-medium)', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {initial}
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', color: T.text1 }}>{data.name}</p>
            <p style={{ margin: '2px 0 0', fontSize: 'var(--text-sm)', color: T.text3 }}>{data.email}</p>
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
        />
        <SettingsRow
          label="Amount format"
          value={amountFormatLabel(amountFormatPreference)}
          supportingText={AMOUNT_FORMAT_OPTIONS.find((option) => option.value === amountFormatPreference)?.description}
          onClick={openAmountFormat}
          isLast
        />
      </>)}

      {sectionLabel('Income')}
      {sectionCard(<>
        <SettingsRow
          label="Usual income"
          value={data.monthlyTotal
            ? formatAmount(data.monthlyTotal, {
              currency,
              preference: amountFormatPreference,
              context: 'summary',
            })
            : 'Not set'}
          supportingText={`${formatScheduleValue(
            scheduleConfigured ? initialScheduleType : null,
            scheduleConfigured ? initialScheduleDays : []
          ).replace('Monthly ·', 'Paid monthly ·').replace('Twice a month ·', 'Paid twice a month ·')} · Future planning only`}
          onClick={() => router.push('/income/new?returnTo=/settings&mode=edit')}
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
          <div style={{ padding: 'var(--space-md)' }}>
            <p style={{ margin: '0 0 var(--space-sm)', fontSize: 'var(--text-sm)', color: T.text2, lineHeight: 1.55 }}>
              This permanently deletes your Cenza account, secure login, and all your data. There is no undo.
            </p>
            {deleteError && (
              <p style={{
                margin: '0 0 var(--space-sm)', padding: 'var(--space-sm) var(--space-md)', borderRadius: 'var(--radius-sm)',
                background: T.redLight, border: `var(--border-width) solid ${T.redBorder}`,
                fontSize: 'var(--text-sm)', color: T.redDark, lineHeight: 1.5,
              }}>
                {deleteError}
              </p>
            )}
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <SecondaryBtn
                size="md"
                onClick={() => { setDeleteStep('idle'); setDeleteError(null) }}
                style={{
                  flex: 1,
                  borderColor: T.border,
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
                  background: T.redDark,
                  color: T.textInverse,
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div>
            <p style={{ margin: '0 0 var(--space-xs)', fontSize: 'var(--text-base)', color: T.text1, fontWeight: 'var(--weight-medium)' }}>
              {formatScheduleSentence(scheduleType, scheduleDays)}
            </p>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', lineHeight: 1.55, color: T.text3 }}>
              Use the days you usually receive income so reminders and monthly check-ins show up at the right time.
            </p>
          </div>

          <div style={{
            display: 'flex',
            gap: 'var(--space-sm)',
            background: T.pageBg,
            border: `var(--border-width) solid ${T.border}`,
            borderRadius: 'var(--radius-md)',
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
                  borderRadius: 'var(--radius-sm)',
                  background: scheduleType === type ? T.white : 'transparent',
                  border: scheduleType === type ? `var(--border-width) solid ${T.border}` : 'none',
                  color: scheduleType === type ? T.text1 : T.textMuted,
                  fontSize: 'var(--text-sm)',
                  fontWeight: scheduleType === type ? 'var(--weight-semibold)' : 'var(--weight-regular)',
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
                <p style={{ margin: '0 0 var(--space-xs)', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', color: T.text1 }}>
                  Choose your pay day
                </p>
                <p style={{ margin: 0, fontSize: 'var(--text-sm)', lineHeight: 1.55, color: T.text3 }}>
                  Pick the day you usually get paid each month.
                </p>
              </div>
              <button
                type="button"
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: T.white,
                  border: `var(--border-width) solid ${T.border}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'default',
                }}
              >
                <span style={{ fontSize: 'var(--text-sm)', color: T.text3 }}>Pay day</span>
                <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: T.text1 }}>{ordinal(scheduleDays[0] ?? 1)}</span>
              </button>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 'var(--space-sm)' }}>
                {MONTHLY_DAYS.map(day => {
                  const selected = scheduleDays[0] === day
                  return (
                    <button
                      key={day}
                      onClick={() => setScheduleDays([day])}
                      style={{
                        height: 40,
                        borderRadius: 'var(--radius-sm)',
                        background: selected ? T.brandDark : T.pageBg,
                        border: `var(--border-width) solid ${selected ? T.brandDark : T.border}`,
                        color: selected ? T.textInverse : T.text2,
                        fontSize: 'var(--text-sm)',
                        fontWeight: selected ? 'var(--weight-semibold)' : 'var(--weight-regular)',
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
                <p style={{ margin: '0 0 var(--space-xs)', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', color: T.text1 }}>
                  Choose your pay days
                </p>
                <p style={{ margin: 0, fontSize: 'var(--text-sm)', lineHeight: 1.55, color: T.text3 }}>
                  Pick the first pay day, then the second one later in the month.
                </p>
              </div>
              <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
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
                      background: activePayDaySlot === item.id ? T.brandTint : T.white,
                      border: `var(--border-width) solid ${activePayDaySlot === item.id ? T.brandMid : T.border}`,
                      borderRadius: 'var(--radius-md)',
                      padding: '14px 16px 15px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{
                        fontSize: 'var(--text-base)',
                        fontWeight: 'var(--weight-medium)',
                        color: activePayDaySlot === item.id ? T.text1 : T.text2,
                      }}>
                        {item.label}
                      </span>
                      <span style={{ fontSize: 'var(--text-sm)', color: T.text3 }}>
                        {activePayDaySlot === item.id
                          ? 'Now choose the day below.'
                          : `Currently ${ordinal(item.value)}.`}
                      </span>
                    </div>
                    <span style={{
                      fontSize: 'var(--text-base)',
                      fontWeight: 'var(--weight-semibold)',
                      color: activePayDaySlot === item.id ? T.brandDark : T.text1,
                    }}>
                      {ordinal(item.value)}
                    </span>
                  </button>
                ))}
              </div>
              <div>
                <p style={{ margin: '0 0 var(--space-xs)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: T.text1 }}>
                  {activePayDaySlot === 'first' ? 'Select first pay day' : 'Select second pay day'}
                </p>
                <p style={{ margin: 0, fontSize: 'var(--text-xs)', lineHeight: 1.5, color: T.textMuted }}>
                  {activePayDaySlot === 'first'
                    ? 'Your first pay day should come earlier in the month.'
                    : 'Your second pay day should come after the first one.'}
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 'var(--space-sm)' }}>
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
                        borderRadius: 'var(--radius-sm)',
                        background: selected ? T.brandDark : T.pageBg,
                        border: `var(--border-width) solid ${selected ? T.brandDark : T.border}`,
                        color: selected ? T.textInverse : T.text2,
                        fontSize: 'var(--text-sm)',
                        fontWeight: selected ? 'var(--weight-semibold)' : 'var(--weight-regular)',
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

      <Sheet
        open={showAmountFormat}
        onClose={() => {
          setAmountFormatPreference(savedAmountFormatPreference)
          setShowAmountFormat(false)
        }}
        title="Amount format"
      >
        <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: T.text3, lineHeight: 1.5 }}>
            Choose how money appears across the app.
          </p>

          <div style={{
            display: 'grid',
            border: `var(--border-width) solid ${T.border}`,
            borderRadius: 'var(--radius-card)',
            overflow: 'hidden',
            background: T.white,
          }}>
            {AMOUNT_FORMAT_OPTIONS.map((option) => {
              const selected = amountFormatPreference === option.value
              const example = amountFormatExample(option.value, currency)
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setAmountFormatPreference(option.value)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 'var(--space-md)',
                    padding: '14px 16px',
                    borderRadius: 0,
                    border: 'none',
                    borderTop: option.value === AMOUNT_FORMAT_OPTIONS[0].value ? 'none' : `var(--border-width) solid var(--border-subtle)`,
                    background: T.white,
                    cursor: 'pointer',
                    textAlign: 'left',
                    boxShadow: 'none',
                  }}
                >
                  <span style={{ display: 'grid', gap: 4, flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-md)' }}>
                      <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', color: T.text1 }}>
                        {option.label}
                      </span>
                      <span
                        aria-hidden
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          border: `var(--border-width) solid ${selected ? T.brandDark : T.border}`,
                          background: selected ? T.brandDark : 'transparent',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      />
                    </span>
                    <span style={{ fontSize: 'var(--text-sm)', color: T.text3, lineHeight: 1.45 }}>
                      {option.description}
                    </span>
                    <span style={{
                      fontSize: 'var(--text-xs)',
                      color: T.textMuted,
                      lineHeight: 1.45,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {example.primary}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          <PrimaryBtn
            size="lg"
            onClick={async () => {
              if (!amountFormatDirty || savingAmountFormat) return
              try {
                setSavingAmountFormat(true)
                const savedPreference = await saveAmountFormatPreference(amountFormatPreference)
                await refreshProfile()
                setSavedAmountFormatPreference(savedPreference)
                setAmountFormatPreference(savedPreference)
                setShowAmountFormat(false)
                router.refresh()
                toast('Amount format saved')
              } catch {
                setAmountFormatPreference(savedAmountFormatPreference)
                toast('Failed to save amount format. Please try again.', 'error')
              } finally {
                setSavingAmountFormat(false)
              }
            }}
            disabled={savingAmountFormat || !amountFormatDirty}
          >
            {savingAmountFormat ? 'Saving…' : amountFormatDirty ? 'Save amount format' : 'Amount format saved'}
          </PrimaryBtn>
        </div>
      </Sheet>
    </>
  )
}
