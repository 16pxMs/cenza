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
import styles from './onboarding.module.css'

const T = {
  brand: '#EADFF4', brandDeep: '#9B6FCC', brandDark: '#5C3489',
  pageBg: '#FAFAF8', white: '#FFFFFF',
  text1: 'var(--text-1)', text3: 'var(--text-3)', textMuted: 'var(--text-muted)',
}

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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: T.pageBg, maxWidth: 480, margin: '0 auto' }}>
      <div className={styles.content}>
        <h1 style={{ fontSize: 28, color: T.text1, margin: '0 0 8px', lineHeight: 1.2 }}>
          What currency<br />are you paid in?
        </h1>
        <p style={{ fontSize: 14, color: T.text3, margin: '0 0 20px', lineHeight: 1.6 }}>
          Pick the currency your day to day life runs on, not where you live.
        </p>

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: T.white,
          border: query ? '2px solid var(--border-focus)' : '1px solid var(--border)',
          borderRadius: 14, padding: '0 12px', height: 52, marginBottom: 20,
        }}>
          <span style={{ fontSize: 16, color: query ? T.brandDeep : T.textMuted, flexShrink: 0 }}>🔍</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search currency, e.g. USD, Euro, Naira..."
            style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 14, color: T.text1, outline: 'none' }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
              <IconChevronX size={16} color={T.textMuted} />
            </button>
          )}
        </div>

        {/* Section label */}
        <p style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: 1.2, textTransform: 'uppercase', margin: '0 0 12px' }}>
          {isSearching ? `${list.length} result${list.length !== 1 ? 's' : ''}` : 'Common currencies'}
        </p>

        {/* List */}
        <div style={{ display: 'grid', gap: 10 }}>
          {list.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: T.textMuted, fontSize: 14 }}>
              No results for "{query}"
            </div>
          )}
          {list.map(c => {
            const sel = currency === c.code
            return (
              <button key={c.code} onClick={() => setCurrency(c.code)} style={{
                background: sel ? T.brand + '88' : T.white,
                border: sel ? '2px solid var(--border-focus)' : '1px solid var(--border)',
                borderRadius: 10, padding: '8px 14px',
                cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: T.brand + '55', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 14 }}>{c.flag}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: T.text1 }}>{c.code}</span>
                <span style={{ fontSize: 13, color: T.text3 }}>{c.name}</span>
              </button>
            )
          })}
        </div>

        <div style={{ flex: 1, minHeight: 24 }} />
      </div>

      <div className={styles.ctaArea}>
        <button onClick={handleFinish} disabled={!currency || saving} style={{
          width: '100%', height: 52, borderRadius: 14,
          background: currency ? T.brandDark : T.textMuted,
          border: 'none', color: '#fff', fontSize: 15, fontWeight: 600,
          cursor: currency && !saving ? 'pointer' : 'default',
          opacity: currency && !saving ? 1 : 0.45,
        }}>
          {saving ? 'Saving...' : currency ? `Continue with ${currency}` : 'Continue'}
        </button>
      </div>
    </div>
  )
}
