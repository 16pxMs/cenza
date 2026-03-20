// ─────────────────────────────────────────────────────────────
// /onboarding — Currency picker
// Only step needed upfront. Name pulled from Google OAuth.
// Goals, fixed costs, budgets are set from the overview.
// On finish: upserts user_profiles, redirects to /
// ─────────────────────────────────────────────────────────────
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { IconChevronX } from '@/components/ui/Icons'
import { CheckCircle2 } from 'lucide-react'
import styles from './onboarding.module.css'


const CURATED_CURRENCIES = [
  { code: 'KES', name: 'Kenyan Shilling',    flag: '🇰🇪' },
  { code: 'NGN', name: 'Nigerian Naira',     flag: '🇳🇬' },
  { code: 'ZAR', name: 'South African Rand', flag: '🇿🇦' },
  { code: 'USD', name: 'US Dollar',          flag: '🇺🇸' },
  { code: 'GBP', name: 'British Pound',      flag: '🇬🇧' },
  { code: 'EUR', name: 'Euro',               flag: '🇪🇺' },
  { code: 'AED', name: 'UAE Dirham',         flag: '🇦🇪' },
]

const ALL_CURRENCIES = [
  ...CURATED_CURRENCIES,
  { code: 'AUD', name: 'Australian Dollar',       flag: '🇦🇺' },
  { code: 'CAD', name: 'Canadian Dollar',         flag: '🇨🇦' },
  { code: 'CHF', name: 'Swiss Franc',             flag: '🇨🇭' },
  { code: 'CNY', name: 'Chinese Yuan',            flag: '🇨🇳' },
  { code: 'INR', name: 'Indian Rupee',            flag: '🇮🇳' },
  { code: 'JPY', name: 'Japanese Yen',            flag: '🇯🇵' },
  { code: 'BRL', name: 'Brazilian Real',          flag: '🇧🇷' },
  { code: 'MXN', name: 'Mexican Peso',            flag: '🇲🇽' },
  { code: 'SGD', name: 'Singapore Dollar',        flag: '🇸🇬' },
  { code: 'HKD', name: 'Hong Kong Dollar',        flag: '🇭🇰' },
  { code: 'SEK', name: 'Swedish Krona',           flag: '🇸🇪' },
  { code: 'NOK', name: 'Norwegian Krone',         flag: '🇳🇴' },
  { code: 'ZMW', name: 'Zambian Kwacha',          flag: '🇿🇲' },
  { code: 'BWP', name: 'Botswana Pula',           flag: '🇧🇼' },
  { code: 'XOF', name: 'West African CFA Franc',  flag: '🌍' },
  { code: 'XAF', name: 'Central African CFA',     flag: '🌍' },
  { code: 'MAD', name: 'Moroccan Dirham',         flag: '🇲🇦' },
  { code: 'EGP', name: 'Egyptian Pound',          flag: '🇪🇬' },
  { code: 'PKR', name: 'Pakistani Rupee',         flag: '🇵🇰' },
  { code: 'PHP', name: 'Philippine Peso',         flag: '🇵🇭' },
  { code: 'IDR', name: 'Indonesian Rupiah',       flag: '🇮🇩' },
  { code: 'MYR', name: 'Malaysian Ringgit',       flag: '🇲🇾' },
  { code: 'THB', name: 'Thai Baht',               flag: '🇹🇭' },
  { code: 'KRW', name: 'South Korean Won',        flag: '🇰🇷' },
  { code: 'TRY', name: 'Turkish Lira',            flag: '🇹🇷' },
  { code: 'SAR', name: 'Saudi Riyal',             flag: '🇸🇦' },
  { code: 'QAR', name: 'Qatari Riyal',            flag: '🇶🇦' },
  { code: 'KWD', name: 'Kuwaiti Dinar',           flag: '🇰🇼' },
  { code: 'NZD', name: 'New Zealand Dollar',      flag: '🇳🇿' },
  { code: 'PLN', name: 'Polish Zloty',            flag: '🇵🇱' },
  { code: 'HUF', name: 'Hungarian Forint',        flag: '🇭🇺' },
  { code: 'DKK', name: 'Danish Krone',            flag: '🇩🇰' },
  { code: 'ILS', name: 'Israeli Shekel',          flag: '🇮🇱' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [currency, setCurrency] = useState('')
  const [query, setQuery]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [name, setName]         = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const n = user.user_metadata?.full_name?.split(' ')[0]
        || user.email?.split('@')[0]
        || 'there'
      setName(n)
    })
  }, [])

  const handleFinish = async () => {
    if (!currency || saving) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await (supabase.from('user_profiles') as any).upsert({
        id:                  user.id,
        name,
        currency,
        month_start:         'first',
        custom_day:          null,
        goals:               [],
        onboarding_complete: true,
      })
      if (error) throw error
      router.push('/')
    } catch (err) {
      console.error('Onboarding save error:', err)
      setSaving(false)
    }
  }

  const isSearching = query.trim().length > 0
  const list = isSearching
    ? ALL_CURRENCIES.filter(c =>
        c.code.toLowerCase().includes(query.toLowerCase()) ||
        c.name.toLowerCase().includes(query.toLowerCase())
      )
    : CURATED_CURRENCIES

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#F8F9FA', maxWidth: 480, margin: '0 auto' }}>
      <div className={styles.content} style={{ paddingTop: 52 }}>

        {/* Warm greeting */}
        {name && (
          <p style={{ fontSize: 15, color: '#9B72CC', fontWeight: 500, margin: '0 0 20px' }}>
            Hi, {name}.
          </p>
        )}

        {/* Heading */}
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#101828', margin: '0 0 10px', lineHeight: 1.25, letterSpacing: -0.4 }}>
          What's your main currency?
        </h1>
        <p style={{ fontSize: 15, color: '#667085', margin: '0 0 32px', lineHeight: 1.65 }}>
          Pick the currency your life actually runs on, not just where you live.
        </p>

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#fff',
          border: query ? '1.5px solid #9B72CC' : '1px solid #E4E7EC',
          borderRadius: 14, padding: '0 14px', height: 50, marginBottom: 24,
          boxShadow: query ? '0 0 0 3px rgba(155,114,204,0.12)' : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="7" cy="7" r="5" stroke={query ? '#9B72CC' : '#98A2B3'} strokeWidth="1.5"/>
            <path d="M11 11l2.5 2.5" stroke={query ? '#9B72CC' : '#98A2B3'} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search, e.g. USD, Naira, Pound…"
            style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 14, color: '#101828', outline: 'none' }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
              <IconChevronX size={15} color="#98A2B3" />
            </button>
          )}
        </div>

        {/* Section label */}
        {!isSearching && (
          <p style={{ fontSize: 12, fontWeight: 600, color: '#98A2B3', margin: '0 0 10px', letterSpacing: 0 }}>
            Common currencies
          </p>
        )}
        {isSearching && list.length > 0 && (
          <p style={{ fontSize: 12, color: '#98A2B3', margin: '0 0 10px' }}>
            {list.length} result{list.length !== 1 ? 's' : ''}
          </p>
        )}

        {/* Grouped list — iOS Settings style */}
        {list.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#98A2B3', fontSize: 14 }}>
            No results for "{query}"
          </div>
        ) : (
          <div style={{
            background: '#fff',
            border: '1px solid #E4E7EC',
            borderRadius: 16,
            overflow: 'hidden',
          }}>
            {list.map((c, index) => {
              const sel = currency === c.code
              const isLast = index === list.length - 1
              return (
                <button
                  key={c.code}
                  onClick={() => setCurrency(c.code)}
                  style={{
                    width: '100%',
                    background: sel ? '#F3EDFB' : 'transparent',
                    border: 'none',
                    borderBottom: isLast ? 'none' : '1px solid #F2F4F7',
                    padding: '12px 16px',
                    cursor: 'pointer', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 12,
                    boxSizing: 'border-box',
                    transition: 'background 0.1s',
                  } as React.CSSProperties}
                >
                  {/* Flag */}
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                    background: sel ? '#EADFF4' : '#F2F4F7',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20,
                  }}>
                    {c.flag}
                  </div>

                  {/* Code + name */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#101828', lineHeight: 1.3 }}>{c.code}</div>
                    <div style={{ fontSize: 12, color: '#667085', marginTop: 1 }}>{c.name}</div>
                  </div>

                  {/* Checkmark */}
                  {sel && <CheckCircle2 size={22} color="#5C3489" fill="#5C3489" strokeWidth={2} style={{ flexShrink: 0 }} />}
                </button>
              )
            })}
          </div>
        )}

        <div style={{ flex: 1, minHeight: 24 }} />
      </div>

      <div className={styles.ctaArea}>
        <button
          onClick={handleFinish}
          disabled={!currency || saving}
          style={{
            width: '100%', height: 56, borderRadius: 16,
            background: currency ? '#5C3489' : '#E4E7EC',
            border: 'none', color: currency ? '#fff' : '#98A2B3',
            fontSize: 16, fontWeight: 600,
            cursor: currency && !saving ? 'pointer' : 'default',
            transition: 'background 0.15s, color 0.15s',
            letterSpacing: -0.1,
          }}
        >
          {saving ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </div>
  )
}
