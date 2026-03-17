// ─────────────────────────────────────────────────────────────
// /onboarding — 4-step onboarding flow
// Steps: Currency → Month Start → Goals → Done
// On finish: upserts user_profiles, redirects to /app
// Name is pulled from Google OAuth metadata automatically
// ─────────────────────────────────────────────────────────────
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  IconGoalCar, IconGoalHome, IconGoalTravel,
  IconGoalEducation, IconGoalBusiness, IconGoalFamily, IconGoalOther,
  IconBadge
} from '@/components/ui/Icons'
import styles from './onboarding.module.css'

const T = {
  brand: '#EADFF4', brandMid: '#C9AEE8', brandDeep: '#9B6FCC', brandDark: '#5C3489',
  pageBg: '#FAFAF8', white: '#FFFFFF', border: '#EDE8F5', borderStrong: '#D5CDED',
  text1: '#1A1025', text2: '#4A3B66', text3: '#8B7BA8', textMuted: '#B8AECE',
  greenBorder: '#BBF7D0', greenDark: '#15803D',
}

const CURATED_CURRENCIES = [
  { code: 'KES', name: 'Kenyan Shilling', flag: '🇰🇪' },
  { code: 'NGN', name: 'Nigerian Naira', flag: '🇳🇬' },
  { code: 'ZAR', name: 'South African Rand', flag: '🇿🇦' },
  { code: 'USD', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'GBP', name: 'British Pound', flag: '🇬🇧' },
  { code: 'EUR', name: 'Euro', flag: '🇪🇺' },
  { code: 'AED', name: 'UAE Dirham', flag: '🇦🇪' },
]

const ALL_CURRENCIES = [
  ...CURATED_CURRENCIES,
  { code: 'AUD', name: 'Australian Dollar', flag: '🇦🇺' },
  { code: 'CAD', name: 'Canadian Dollar', flag: '🇨🇦' },
  { code: 'CHF', name: 'Swiss Franc', flag: '🇨🇭' },
  { code: 'CNY', name: 'Chinese Yuan', flag: '🇨🇳' },
  { code: 'INR', name: 'Indian Rupee', flag: '🇮🇳' },
  { code: 'JPY', name: 'Japanese Yen', flag: '🇯🇵' },
  { code: 'BRL', name: 'Brazilian Real', flag: '🇧🇷' },
  { code: 'MXN', name: 'Mexican Peso', flag: '🇲🇽' },
  { code: 'SGD', name: 'Singapore Dollar', flag: '🇸🇬' },
  { code: 'HKD', name: 'Hong Kong Dollar', flag: '🇭🇰' },
  { code: 'SEK', name: 'Swedish Krona', flag: '🇸🇪' },
  { code: 'NOK', name: 'Norwegian Krone', flag: '🇳🇴' },
  { code: 'ZMW', name: 'Zambian Kwacha', flag: '🇿🇲' },
  { code: 'BWP', name: 'Botswana Pula', flag: '🇧🇼' },
  { code: 'XOF', name: 'West African CFA Franc', flag: '🌍' },
  { code: 'XAF', name: 'Central African CFA', flag: '🌍' },
  { code: 'MAD', name: 'Moroccan Dirham', flag: '🇲🇦' },
  { code: 'EGP', name: 'Egyptian Pound', flag: '🇪🇬' },
  { code: 'PKR', name: 'Pakistani Rupee', flag: '🇵🇰' },
  { code: 'PHP', name: 'Philippine Peso', flag: '🇵🇭' },
  { code: 'IDR', name: 'Indonesian Rupiah', flag: '🇮🇩' },
  { code: 'MYR', name: 'Malaysian Ringgit', flag: '🇲🇾' },
  { code: 'THB', name: 'Thai Baht', flag: '🇹🇭' },
  { code: 'KRW', name: 'South Korean Won', flag: '🇰🇷' },
  { code: 'TRY', name: 'Turkish Lira', flag: '🇹🇷' },
  { code: 'SAR', name: 'Saudi Riyal', flag: '🇸🇦' },
  { code: 'QAR', name: 'Qatari Riyal', flag: '🇶🇦' },
  { code: 'KWD', name: 'Kuwaiti Dinar', flag: '🇰🇼' },
  { code: 'NZD', name: 'New Zealand Dollar', flag: '🇳🇿' },
  { code: 'PLN', name: 'Polish Zloty', flag: '🇵🇱' },
  { code: 'HUF', name: 'Hungarian Forint', flag: '🇭🇺' },
  { code: 'DKK', name: 'Danish Krone', flag: '🇩🇰' },
  { code: 'ILS', name: 'Israeli Shekel', flag: '🇮🇱' },
]

// ── Step 1: Currency ──────────────────────────────────────────
function OnboardingCurrency({ onNext, onBack, data, setData }: any) {
  const [query, setQuery] = useState('')
  const isSearching = query.trim().length > 0
  const list = isSearching
    ? ALL_CURRENCIES.filter(c =>
        c.code.toLowerCase().includes(query.toLowerCase()) ||
        c.name.toLowerCase().includes(query.toLowerCase())
      )
    : CURATED_CURRENCIES
  const selected = data.currency

  return (
    <div className={styles.pageWrapper} style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      background: T.pageBg, maxWidth: 480, margin: '0 auto',
    }}>
      <div className={styles.content}>
        <div style={{ height: 3, background: T.border, borderRadius: 99, overflow: 'hidden', marginBottom: 32, marginTop: 12 }}>
          <div style={{ height: '100%', width: '33%', background: T.brandDeep, borderRadius: 99 }} />
        </div>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer',
          color: T.text3, fontSize: 14, fontFamily: 'var(--font-sans)',
          textAlign: 'left', padding: '4px 0', marginBottom: 20 }}>← Back</button>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 700,
          color: T.text1, margin: '0 0 8px', lineHeight: 1.2 }}>
          What currency <br />are you paid in?
        </h1>
        <p style={{ fontSize: 14, color: T.text3, margin: '0 0 20px',
          fontFamily: 'var(--font-sans)', lineHeight: 1.6 }}>
          Pick the currency your day to day life runs on, not where you live.
        </p>

        {/* Search bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: T.white, border: `1.5px solid ${query ? T.brandDeep : T.border}`,
          borderRadius: 14, padding: '0 12px', height: 52, marginBottom: 20,
        }}>
          <span style={{ fontSize: 16, color: query ? T.brandDeep : T.textMuted, flexShrink: 0 }}></span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search currency, e.g. USD, Euro, Naira..."
            style={{
              flex: 1, border: 'none', background: 'transparent',
              fontSize: 14, color: T.text1, outline: 'none',
              fontFamily: 'var(--font-sans)',
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: T.textMuted, fontSize: 20, padding: 0, lineHeight: 1,
            }}>×</button>
          )}
        </div>

        {/* Section label */}
        <p style={{ fontSize: 11, fontWeight: 700, color: T.textMuted,
          letterSpacing: 1.2, textTransform: 'uppercase' as const,
          margin: '0 0 12px', fontFamily: 'var(--font-sans)' }}>
          {isSearching ? `${list.length} result${list.length !== 1 ? 's' : ''}` : 'Common currencies'}
        </p>

        {/* Currency list */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
          {list.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0',
              color: T.textMuted, fontSize: 14, fontFamily: 'var(--font-sans)' }}>
              No results for "{query}"
            </div>
          )}
          {list.map(c => {
            const sel = selected === c.code
            return (
              <button key={c.code} onClick={() => setData((d: any) => ({ ...d, currency: c.code }))}
                style={{
                  background: sel ? T.brand + '88' : T.white,
                  border: `${sel ? 2 : 1.5}px solid ${sel ? T.brandDeep : T.border}`,
                  borderRadius: 10, padding: '8px 14px',
                  cursor: 'pointer',
                  textAlign: 'left', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10,
                }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: T.brand + '55', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, flexShrink: 0,
                }}>
                  <span style={{ fontSize: 14 }}>{c.flag}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: T.text1, fontFamily: 'var(--font-sans)' }}>
                    {c.code}
                  </div>
                  <div style={{ fontSize: 13, color: T.text3, fontFamily: 'var(--font-sans)' }}>
                    {c.name}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div style={{ flex: 1, minHeight: 24 }} />
      </div>
      <div className={styles.ctaArea}>
        <button onClick={onNext} disabled={!selected} style={{
          width: '100%', height: 52, borderRadius: 14,
          background: selected ? T.brandDark : T.textMuted,
          border: 'none', color: '#fff', fontSize: 15, fontWeight: 600,
          fontFamily: 'var(--font-sans)', cursor: selected ? 'pointer' : 'default',
          opacity: selected ? 1 : 0.45, flexShrink: 0,
        }}>
          {selected ? `Continue with ${selected}` : 'Continue'}
        </button>
      </div>
    </div>
  )
}

// ── Step 2: Month start ───────────────────────────────────────
function OnboardingMonth({ onNext, onBack, data, setData }: any) {
  const options = [
    { value: '1st', label: '1st', sub: 'Most common' },
    { value: '15th', label: '15th', sub: 'Mid month pay' },
    { value: '25th', label: '25th', sub: 'End of month pay' },
    { value: 'custom', label: 'Custom', sub: 'Pick your date' },
  ]
  const suffix = (d: number) => d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'
  return (
    <div className={styles.pageWrapper} style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      background: T.pageBg, maxWidth: 480, margin: '0 auto',
    }}>
      <div className={styles.content}>
        <div style={{ height: 3, background: T.border, borderRadius: 99, overflow: 'hidden', marginBottom: 20, marginTop: 12 }}>
          <div style={{ height: '100%', width: '66%', background: T.brandDeep, borderRadius: 99 }} />
        </div>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.text3, fontSize: 14, fontFamily: 'var(--font-sans)', textAlign: 'left', padding: '4px 0', marginBottom: 20 }}>← Back</button>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 700, color: T.text1, margin: '0 0 8px', lineHeight: 1.2 }}>When does your<br />month start?</h1>
        <p style={{ fontSize: 14, color: T.text3, margin: '0 0 24px', fontFamily: 'var(--font-sans)', lineHeight: 1.6 }}>
          Your month starts when your money arrives, <br />not on the 1st of the calendar.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          {options.map(o => {
            const sel = data.monthStart === o.value
            return (
              <button key={o.value} onClick={() => setData((d: any) => ({ ...d, monthStart: o.value, customDay: null }))} style={{
                background: sel ? T.brand + '55' : T.white,
                border: `${sel ? 2 : 1.5}px solid ${sel ? T.brandDeep : T.border}`,
                borderRadius: 16, padding: '18px 16px', cursor: 'pointer', textAlign: 'left',
              }}>
                <div style={{ fontSize: 22, fontFamily: 'var(--font-serif)', fontWeight: 600, color: sel ? T.brandDark : T.text1 }}>{o.label}</div>
                <div style={{ fontSize: 12, color: T.text3, marginTop: 4, fontFamily: 'var(--font-sans)' }}>{o.sub}</div>
              </button>
            )
          })}
        </div>
        {/* Custom day picker */}
        {data.monthStart === 'custom' && (
          <div style={{ background: '#ffffff', border: `1.5px solid ${T.brandMid}88`, borderRadius: 16, padding: '16px 14px 14px' }}>
            <p style={{ margin: '0 0 12px', fontSize: 12.5, fontWeight: 600, color: T.brandDark, letterSpacing: 0.3, textTransform: 'uppercase' as const, fontFamily: 'var(--font-sans)' }}>Choose the day</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => {
                const sel = data.customDay === d
                return (
                  <button key={d} onClick={() => setData((dd: any) => ({ ...dd, customDay: d }))} style={{
                    height: 34, borderRadius: 8,
                    background: sel ? T.brandDeep : T.white,
                    border: `1.5px solid ${sel ? T.brandDeep : T.border}`,
                    color: sel ? '#fff' : T.text2, fontSize: 12.5,
                    fontWeight: sel ? 600 : 400, cursor: 'pointer', padding: 0,
                    fontFamily: 'var(--font-sans)',
                  }}>{d}</button>
                )
              })}
            </div>
            {data.customDay && (
              <p style={{ margin: '12px 0 0', fontSize: 13, color: T.brandDark, fontStyle: 'italic', textAlign: 'center', fontFamily: 'var(--font-sans)' }}>
                Your month starts on the <strong>{data.customDay}{suffix(data.customDay)}</strong>
              </p>
            )}
          </div>
        )}
        <div style={{ flex: 1 }} />
      </div>
      <div className={styles.ctaArea}>
        <button onClick={onNext} disabled={!data.monthStart || (data.monthStart === 'custom' && !data.customDay)} style={{
          width: '100%', height: 52, borderRadius: 14,
          background: (data.monthStart && (data.monthStart !== 'custom' || data.customDay)) ? T.brandDark : T.textMuted,
          border: 'none', color: '#fff', fontSize: 15, fontWeight: 600,
          fontFamily: 'var(--font-sans)', cursor: 'pointer',
          opacity: (data.monthStart && (data.monthStart !== 'custom' || data.customDay)) ? 1 : 0.45,
        }}>Continue</button>
      </div>
    </div>
  )
}

// ── Step 3: Goals ─────────────────────────────────────────────
function OnboardingGoals({ onNext, onBack, data, setData }: any) {
  const [otherModalOpen, setOtherModalOpen] = useState(false)
  const [otherInput, setOtherInput] = useState('')
  const [otherLabel, setOtherLabel] = useState('')
  const goals = [
    { id: 'car',       Icon: IconGoalCar,       label: 'Car'       },
    { id: 'home',      Icon: IconGoalHome,      label: 'Home'      },
    { id: 'travel',    Icon: IconGoalTravel,    label: 'Travel'    },
    { id: 'education', Icon: IconGoalEducation, label: 'Education' },
    { id: 'business',  Icon: IconGoalBusiness,  label: 'Business'  },
    { id: 'family',    Icon: IconGoalFamily,    label: 'Family'    },
  ]
  const toggle = (id: string) => {
    const cur: string[] = data.goals || []
    setData((d: any) => ({ ...d, goals: cur.includes(id) ? cur.filter((g: string) => g !== id) : [...cur, id] }))
  }
  const selected: string[] = data.goals || []
  const efSel = selected.includes('emergency')

  const GoalCard = ({ id, Icon, label, fullWidth = false }: { id: string; Icon: any; label: string; fullWidth?: boolean }) => {
    const sel = selected.includes(id)
    return (
      <button onClick={() => toggle(id)} style={{
        background: sel ? T.brand + '55' : T.white,
        border: `${sel ? 2 : 1.5}px solid ${sel ? T.brandDeep : T.border}`,
        borderRadius: 14, padding: '14px 14px', cursor: 'pointer',
        textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12,
        gridColumn: fullWidth ? 'span 2' : undefined,
      }}>
        <IconBadge size={38} bg={sel ? 'color-mix(in srgb, var(--brand-mid) 30%, transparent)' : 'color-mix(in srgb, var(--border) 50%, transparent)'} radius={999}>
          <Icon size={18} color={sel ? 'var(--brand-dark)' : 'var(--text-3)'} />
        </IconBadge>
        <span style={{ fontSize: 14, fontWeight: 500, color: T.text1, fontFamily: 'var(--font-sans)' }}>{label}</span>
      </button>
    )
  }

  return (
    <div className={styles.pageWrapper} style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      background: T.pageBg, maxWidth: 480, margin: '0 auto',
    }}>
      <div className={styles.content}>
        <div style={{ height: 3, background: T.border, borderRadius: 99, overflow: 'hidden', marginBottom: 20, marginTop: 12 }}>
          <div style={{ height: '100%', width: '100%', background: T.brandDeep, borderRadius: 99 }} />
        </div>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.text3, fontSize: 14, fontFamily: 'var(--font-sans)', textAlign: 'left', padding: '4px 0', marginBottom: 20 }}>← Back</button>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 700, color: T.text1, margin: '0 0 6px', lineHeight: 1.2 }}>What are you saving towards?</h1>
        <p style={{ fontSize: 14, color: T.text3, margin: '0 0 20px', fontStyle: 'italic', fontFamily: 'var(--font-sans)' }}>You don&apos;t need to know the numbers yet.</p>

        {/* Emergency fund featured card */}
        <button onClick={() => toggle('emergency')} style={{
          width: '100%', textAlign: 'left', cursor: 'pointer',
          background: efSel ? T.brand + '33' : T.white,
          border: `${efSel ? 2 : 1.5}px solid ${efSel ? T.brandDeep : T.border}`,
          borderRadius: 16, marginBottom: 12, padding: 0,
        }}>
          <div style={{ padding: '18px 18px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: T.text1, fontFamily: 'var(--font-serif)', marginBottom: 6 }}>Emergency Fund</div>
              <div style={{ fontSize: 13.5, color: T.text2, lineHeight: 1.55, fontFamily: 'var(--font-sans)' }}>
                Start here before any other goal, even if you already have one, we helps you track what you have.
              </div>
            </div>
            <div style={{
              width: 24, height: 24, borderRadius: '50%', flexShrink: 0, marginTop: 2,
              background: efSel ? T.brandDeep : 'transparent',
              border: `2px solid ${efSel ? T.brandDeep : T.borderStrong}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {efSel && <svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4.5L4 7.5L10 1.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
          </div>
          <div style={{ background: '#DCFCE7', borderTop: '1px solid #BBF7D0', padding: '10px 18px', borderRadius: '0 0 14px 14px' }}>
            <p style={{ margin: 0, fontSize: 13.5, color: '#15803D', lineHeight: 1.55, fontFamily: 'var(--font-sans)' }}>
              Having an emergency fund means one bad month doesn&apos;t send you into debt.
            </p>
          </div>
        </button>

        {/* 2-col grid + Other full width */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          {goals.map(g => <GoalCard key={g.id} id={g.id} Icon={g.Icon} label={g.label} />)}
          <button onClick={() => selected.includes('other') ? (toggle('other'), setOtherLabel('')) : setOtherModalOpen(true)}
            style={{
              background: selected.includes('other') ? T.brand + '55' : T.white,
              border: `${selected.includes('other') ? 2 : 1.5}px solid ${selected.includes('other') ? T.brandDeep : T.border}`,
              borderRadius: 14, padding: '14px 14px', cursor: 'pointer',
              textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12,
              gridColumn: 'span 2',
            }}>
            <IconBadge size={38} bg={selected.includes('other') ? 'color-mix(in srgb, var(--brand-mid) 30%, transparent)' : 'color-mix(in srgb, var(--border) 50%, transparent)'} radius={10}>
              <IconGoalOther size={18} color={selected.includes('other') ? 'var(--brand-dark)' : 'var(--text-3)'} />
            </IconBadge>
            <span style={{ fontSize: 14, fontWeight: 500, color: T.text1, fontFamily: 'var(--font-sans)' }}>
              {otherLabel || 'Other'}
            </span>
          </button>
        </div>

        <div style={{ flex: 1 }} />
      </div>

      <div className={styles.ctaArea}>
        <button onClick={onNext} disabled={selected.length === 0} style={{
          width: '100%', height: 52, borderRadius: 14,
          background: selected.length > 0 ? T.brandDark : T.textMuted,
          border: 'none', color: '#fff', fontSize: 15, fontWeight: 600,
          fontFamily: 'var(--font-sans)', cursor: selected.length > 0 ? 'pointer' : 'default',
          marginBottom: 4, opacity: selected.length > 0 ? 1 : 0.45,
        }}>
          {selected.length === 0 ? 'Select at least one goal' : `Continue with ${selected.length} goal${selected.length > 1 ? 's' : ''}`}
        </button>
        <button onClick={() => { setData((d: any) => ({ ...d, goals: [] })); onNext() }} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: T.text3, fontSize: 13, fontFamily: 'var(--font-sans)',
          marginTop: 10, textAlign: 'center', width: '100%', padding: '4px 0',
        }}>
          I&apos;ll set my goals later
        </button>
      </div>

      {/* Other goal modal */}
      {otherModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999,
          background: 'rgba(18,13,30,0.5)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }} onClick={() => setOtherModalOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: T.white, borderRadius: '20px 20px 0 0',
            padding: '24px 20px 40px', width: '100%', maxWidth: 480,
          }}>
            <div style={{ width: 36, height: 4, borderRadius: 99,
              background: T.border, margin: '0 auto 24px' }} />
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700,
              color: T.text1, margin: '0 0 6px' }}>What are you saving for?</h2>
            <p style={{ fontSize: 13, color: T.text3, margin: '0 0 20px',
              fontFamily: 'var(--font-sans)' }}>Give your goal a name so we can track it.</p>
            <input
              autoFocus
              value={otherInput}
              onChange={e => setOtherInput(e.target.value)}
              placeholder="e.g. Wedding, Laptop, Holiday..."
              style={{
                width: '100%', height: 48, borderRadius: 12,
                border: `1.5px solid ${otherInput ? T.brandDeep : T.border}`,
                padding: '0 14px', fontSize: 15, color: T.text1,
                fontFamily: 'var(--font-sans)', outline: 'none',
                boxSizing: 'border-box', background: T.pageBg,
              }}
            />
            <button
              onClick={() => {
                if (otherInput.trim()) {
                  setOtherLabel(otherInput.trim())
                  if (!selected.includes('other')) toggle('other')
                  setOtherModalOpen(false)
                  setOtherInput('')
                }
              }}
              disabled={!otherInput.trim()}
              style={{
                width: '100%', height: 52, borderRadius: 14, marginTop: 16,
                background: otherInput.trim() ? T.brandDark : T.textMuted,
                border: 'none', color: '#fff', fontSize: 15, fontWeight: 600,
                fontFamily: 'var(--font-sans)', cursor: otherInput.trim() ? 'pointer' : 'default',
                opacity: otherInput.trim() ? 1 : 0.45,
              }}>
              Add goal
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Step 4: Done ──────────────────────────────────────────────
function OnboardingDone({ onFinish, data, saving }: any) {
  const goalLabels: Record<string, string> = {
    emergency: 'Emergency Fund', car: 'Car', home: 'Home',
    travel: 'Travel', education: 'Education', business: 'Business',
    family: 'Family', other: 'Other',
  }
  return (
    <div className={styles.pageWrapper} style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      background: T.pageBg, maxWidth: 480, margin: '0 auto',
    }}>
      <div className={styles.content}>
        <div style={{ textAlign: 'center', marginTop: 48, marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 600, color: T.text1, margin: '0 0 8px' }}>
            You&apos;re all set,{' '}
            <span style={{ color: T.brandDeep, fontStyle: 'italic' }}>{data.name || 'there'}!</span>
          </h1>
          <p style={{ fontSize: 14, color: T.text2, margin: 0, lineHeight: 1.6, fontFamily: 'var(--font-sans)' }}>
            Your first month is a blank slate.<br />Start by adding your income.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ background: T.white, border: `1.5px solid ${T.border}`, borderRadius: 14, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 36, height: 36, borderRadius: 999, background: T.brand + '55', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💱</div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.text3, textTransform: 'uppercase' as const, letterSpacing: 1, fontFamily: 'var(--font-sans)' }}>Currency</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.text1, marginTop: 2, fontFamily: 'var(--font-sans)' }}>{data.currency || '—'}</div>
            </div>
          </div>
          <div style={{ background: T.white, border: `1.5px solid ${T.border}`, borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.text3, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8, fontFamily: 'var(--font-sans)' }}>Your Goals</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {(data.goals || []).map((g: string) => (
                <span key={g} style={{ background: T.brand + '55', color: T.brandDark, border: `1px solid ${T.brandMid}`, borderRadius: 99, padding: '4px 12px', fontSize: 12.5, fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  {goalLabels[g]}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div style={{ flex: 1 }} />
      </div>
      <div className={styles.ctaArea}>
        <button onClick={onFinish} disabled={saving} style={{
          width: '100%', height: 52, borderRadius: 14,
          background: T.brandDark, border: 'none', color: '#fff',
          fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-sans)',
          cursor: saving ? 'default' : 'pointer',
          opacity: saving ? 0.6 : 1,
        }}>
          {saving ? 'Saving...' : 'Go to my overview'}
        </button>
      </div>
    </div>
  )
}

function AnimatedScreen({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { const t = requestAnimationFrame(() => setVisible(true)); return () => cancelAnimationFrame(t) }, [])
  return (
    <div style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateX(0)' : 'translateX(22px)', transition: 'opacity 0.28s ease, transform 0.28s cubic-bezier(0.4,0,0.2,1)' }}>
      {children}
    </div>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<{ name?: string; currency?: string; monthStart?: string; customDay?: number | null; goals?: string[] }>({})

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const name = user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'there'
        setData(d => ({ ...d, name }))
      }
    })
  }, [])

  const next = () => setStep(s => s + 1)
  const back = () => setStep(s => Math.max(s - 1, 0))

  const handleFinish = async () => {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const monthStartVal = data.monthStart === '1st' ? 'first' : 'custom'
      const customDayVal = data.monthStart === 'custom' ? data.customDay : null
      const { error } = await supabase.from('user_profiles').upsert({
        id: user.id,
        name: data.name || user.email?.split('@')[0] || 'there',
        currency: data.currency || 'KES',
        month_start: monthStartVal,
        custom_day: customDayVal ?? null,
        goals: data.goals || [],
        onboarding_complete: true,
      })
      if (error) throw error
      router.push('/')
    } catch (err) {
      console.error('Save error:', err)
      setSaving(false)
    }
  }

  const screens = [
    <OnboardingCurrency key="currency" onNext={next} onBack={() => router.push('/login')} data={data} setData={setData} />,
    <OnboardingMonth key="month" onNext={next} onBack={back} data={data} setData={setData} />,
    <OnboardingGoals key="goals" onNext={next} onBack={back} data={data} setData={setData} />,
    <OnboardingDone key="done" onFinish={handleFinish} data={data} saving={saving} />,
  ]

  return (
    <div style={{ minHeight: '100vh', background: T.pageBg, maxWidth: 480, margin: '0 auto', position: 'relative' }}>
      <AnimatedScreen key={step}>{screens[step]}</AnimatedScreen>
    </div>
  )
}
