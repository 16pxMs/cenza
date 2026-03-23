'use client'
export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// /onboarding/currency — Step 2: Currency confirmation
//
// Auto-detects from navigator.language.
// Detected → confirmation card + "Change it" escape hatch.
// Not detected → picker shown directly.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  detectCurrency,
  getCurrencyByCode,
  searchCurrencies,
  type CurrencyOption,
} from '@/lib/locale'
import { IconChevronX } from '@/components/ui/Icons'
import { CheckCircle2 } from 'lucide-react'
import styles from '../onboarding.module.css'

export default function OnboardingCurrencyPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [detected,   setDetected]   = useState<string | null | undefined>(undefined)
  const [showPicker, setShowPicker] = useState(false)
  const [selected,   setSelected]   = useState('')
  const [query,      setQuery]      = useState('')
  const [saving,     setSaving]     = useState(false)
  const [pickerFocused, setPickerFocused] = useState(false)

  useEffect(() => {
    const code = detectCurrency()
    setDetected(code)
    if (!code) setShowPicker(true)
  }, [])

  const saveCurrency = async (code: string) => {
    if (!code || saving) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSaving(false); return }
      await (supabase.from('user_profiles') as any)
        .update({ currency: code, onboarding_complete: true })
        .eq('id', user.id)
      router.push('/')
    } catch {
      setSaving(false)
    }
  }

  if (detected === undefined) return null

  const detectedOption: CurrencyOption | undefined =
    detected ? getCurrencyByCode(detected) : undefined

  // ── Auto-detection confirmation ────────────────────────────
  if (detectedOption && !showPicker) {
    return (
      <div className={styles.pageWrapper} style={{ minHeight: '100vh' }}>
        <div className={styles.content} style={{ paddingTop: 72 }}>

          {/* Eyebrow — purely navigational, stays muted */}
          <p style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--weight-medium)',
            color: 'var(--text-muted)',
            margin: '0 0 var(--space-lg)',
            letterSpacing: '0.01em',
          }}>
            Step 2 of 2
          </p>

          {/* Heading */}
          <h1 style={{
            fontSize: 'var(--text-3xl)',
            color: 'var(--text-1)',
            margin: '0 0 var(--space-sm)',
          }}>
            What currency do you get paid in?
          </h1>

          {/* Context: explain what the currency is actually used for */}
          <p style={{
            fontSize: 'var(--text-base)',
            color: 'var(--text-2)',
            margin: '0 0 var(--space-xxl)',
            lineHeight: 1.65,
          }}>
            We detected this from your device. We'll use it across your income, spending, and goals.
          </p>

          {/* Currency card — border, no shadow (static display card) */}
          <div style={{
            background: 'var(--white)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-lg)',
            marginBottom: 'var(--space-md)',
          }}>
            {/* Flag + code + name row */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-md)',
            }}>
              {/* Flag chip — circular, lighter tint */}
              <div style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                flexShrink: 0,
                background: 'rgba(92, 52, 137, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 26,
              }}>
                {detectedOption.flag}
              </div>

              <div>
                <p style={{
                  margin: '0 0 2px',
                  fontSize: 'var(--text-xl)',
                  fontWeight: 'var(--weight-bold)',
                  color: 'var(--text-1)',
                  letterSpacing: '-0.3px',
                }}>
                  {detectedOption.code}
                </p>
                <p style={{
                  margin: 0,
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-3)',
                }}>
                  {detectedOption.name}
                </p>
              </div>
            </div>
          </div>

          {/* Tertiary — no underline, muted color, clearly secondary */}
          <button
            onClick={() => setShowPicker(true)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 'var(--space-xs) 0',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-3)',
              fontWeight: 'var(--weight-medium)',
              textDecoration: 'none',
              fontFamily: 'inherit',
              display: 'block',
              textAlign: 'center',
              width: '100%',
            }}
          >
            Not {detectedOption.code}? Change it
          </button>

        </div>

        <div className={styles.ctaArea}>
          <button
            onClick={() => saveCurrency(detected!)}
            disabled={saving}
            style={{
              width: '100%',
              height: 56,
              borderRadius: 'var(--radius-lg)',
              background: 'var(--brand-dark)',
              border: 'none',
              color: 'var(--text-inverse)',
              fontSize: 'var(--text-base)',
              fontWeight: 'var(--weight-semibold)',
              cursor: saving ? 'default' : 'pointer',
              letterSpacing: '-0.1px',
            }}
          >
            {saving ? 'Saving…' : 'Looks right'}
          </button>
        </div>
      </div>
    )
  }

  // ── Manual picker ──────────────────────────────────────────
  const list = searchCurrencies(query)
  const isSearching = query.trim().length > 0

  return (
    <div className={styles.pageWrapper} style={{ minHeight: '100vh' }}>
      <div className={styles.content} style={{ paddingTop: 64 }}>

        {/* Back button — only when we had a detection to go back to */}
        {detectedOption && (
          <button
            onClick={() => { setShowPicker(false); setQuery(''); setSelected('') }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0 0 var(--space-lg)',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-3)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-xs)',
              fontFamily: 'inherit',
            }}
          >
            ← Back
          </button>
        )}

        <h1 style={{
          fontSize: 'var(--text-3xl)',
          color: 'var(--text-1)',
          margin: '0 0 var(--space-sm)',
        }}>
          What's your main currency?
        </h1>

        <p style={{
          fontSize: 'var(--text-base)',
          color: 'var(--text-2)',
          margin: '0 0 var(--space-xl)',
          lineHeight: 1.6,
        }}>
          Pick the currency your life actually runs on.
        </p>

        {/* Search input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'var(--white)',
          border: pickerFocused
            ? '2px solid var(--border-focus)'
            : '1.5px solid var(--border-strong)',
          borderRadius: 'var(--radius-md)',
          padding: '0 var(--space-md)',
          height: 52,
          marginBottom: 'var(--space-md)',
          boxShadow: pickerFocused ? '0 0 0 4px rgba(92, 52, 137, 0.08)' : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="7" cy="7" r="5" stroke={pickerFocused ? 'var(--brand-deep)' : 'var(--text-muted)'} strokeWidth="1.5"/>
            <path d="M11 11l2.5 2.5" stroke={pickerFocused ? 'var(--brand-deep)' : 'var(--text-muted)'} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setPickerFocused(true)}
            onBlur={() => setPickerFocused(false)}
            placeholder="Search, e.g. USD, Naira, Pound…"
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              fontSize: 'var(--text-base)',
              color: 'var(--text-1)',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
            >
              <IconChevronX size={15} color="var(--text-muted)" />
            </button>
          )}
        </div>

        {/* Section label */}
        {!isSearching && (
          <p style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--weight-semibold)',
            color: 'var(--text-muted)',
            margin: '0 0 var(--space-sm)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>
            Common currencies
          </p>
        )}
        {isSearching && list.length > 0 && (
          <p style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-3)',
            margin: '0 0 var(--space-sm)',
          }}>
            {list.length} result{list.length !== 1 ? 's' : ''}
          </p>
        )}

        {/* Currency list */}
        {list.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 0',
            color: 'var(--text-muted)',
            fontSize: 'var(--text-base)',
          }}>
            No results for "{query}"
          </div>
        ) : (
          <div style={{
            background: 'var(--white)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
          }}>
            {list.map((c, index) => {
              const sel    = selected === c.code
              const isLast = index === list.length - 1
              return (
                <button
                  key={c.code}
                  onClick={() => setSelected(c.code)}
                  style={{
                    width: '100%',
                    background: sel ? 'var(--brand)' : 'transparent',
                    border: 'none',
                    borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
                    padding: '12px var(--space-md)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-md)',
                    boxSizing: 'border-box',
                    transition: 'background 0.1s',
                  } as React.CSSProperties}
                >
                  {/* Flag chip */}
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 'var(--radius-sm)',
                    flexShrink: 0,
                    background: sel ? 'var(--brand-mid)' : 'var(--grey-100)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                  }}>
                    {c.flag}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Code — primary */}
                    <p style={{
                      margin: '0 0 1px',
                      fontSize: 'var(--text-base)',
                      fontWeight: 'var(--weight-semibold)',
                      color: 'var(--text-1)',
                    }}>
                      {c.code}
                    </p>
                    {/* Name — secondary */}
                    <p style={{
                      margin: 0,
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-3)',
                    }}>
                      {c.name}
                    </p>
                  </div>

                  {sel && (
                    <CheckCircle2
                      size={20}
                      color="var(--brand-dark)"
                      fill="var(--brand-dark)"
                      strokeWidth={2}
                      style={{ flexShrink: 0 }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        )}

        <div style={{ flex: 1, minHeight: 24 }} />
      </div>

      <div className={styles.ctaArea}>
        <button
          onClick={() => saveCurrency(selected)}
          disabled={!selected || saving}
          style={{
            width: '100%',
            height: 56,
            borderRadius: 'var(--radius-lg)',
            background: selected ? 'var(--brand-dark)' : 'var(--grey-200)',
            border: 'none',
            color: selected ? 'var(--text-inverse)' : 'var(--text-muted)',
            fontSize: 'var(--text-base)',
            fontWeight: 'var(--weight-semibold)',
            cursor: selected && !saving ? 'pointer' : 'default',
            transition: 'background 0.15s, color 0.15s',
            letterSpacing: '-0.1px',
          }}
        >
          {saving ? 'Saving…' : 'Continue →'}
        </button>
      </div>
    </div>
  )
}
