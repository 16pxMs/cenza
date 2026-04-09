'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import {
  detectCurrency,
  getCurrencyByCode,
  searchCurrencies,
  type CurrencyOption,
} from '@/lib/locale'
import { IconChevronX } from '@/components/ui/Icons'
import styles from './onboarding.module.css'
import { saveOnboardingCurrency } from './actions'
import { SubmitButton } from './SubmitButton'

export function CurrencyClient() {
  const [detected, setDetected] = useState<string | null | undefined>(undefined)
  const [showPicker, setShowPicker] = useState(false)
  const [selectedCode, setSelectedCode] = useState('')
  const [query, setQuery] = useState('')
  const [pickerFocused, setPickerFocused] = useState(false)

  useEffect(() => {
    const code = detectCurrency()
    setDetected(code)
    const resolvedCode = code && getCurrencyByCode(code) ? code : ''
    setSelectedCode(resolvedCode)
    if (!resolvedCode) setShowPicker(true)
  }, [])

  const selectedOption: CurrencyOption | undefined =
    selectedCode ? getCurrencyByCode(selectedCode) : undefined

  const list = useMemo(() => searchCurrencies(query), [query])

  if (detected === undefined) return null

  return (
    <div className={styles.pageWrapper} style={{ minHeight: '100vh' }}>
      <div className={styles.content} style={{ paddingTop: 72 }}>
        <p style={{
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--weight-medium)',
          color: 'var(--text-muted)',
          margin: '0 0 var(--space-lg)',
          letterSpacing: '0.01em',
        }}>
          Step 2 of 3
        </p>

        <h1 style={{
          fontSize: 'var(--text-3xl)',
          color: 'var(--text-1)',
          margin: '0 0 var(--space-sm)',
        }}>
          What currency do you get paid in?
        </h1>

        <p style={{
          fontSize: 'var(--text-base)',
          color: 'var(--text-2)',
          margin: '0 0 var(--space-xxl)',
          lineHeight: 1.65,
        }}>
          {detected ? 'We detected this from your device. You can keep it, or switch if needed.' : 'Pick the currency your life actually runs on.'}
        </p>

        <button
          type="button"
          onClick={() => setShowPicker(true)}
          style={{
            width: '100%',
            textAlign: 'left',
            background: 'var(--grey-50)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-md) var(--space-lg)',
            marginBottom: 'var(--space-lg)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
          aria-label="Change currency"
        >
          <p style={{
            margin: '0 0 var(--space-xs)',
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--weight-medium)',
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}>
            {detected ? 'Detected currency' : 'Selected currency'}
          </p>
          {selectedOption ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  flexShrink: 0,
                  background: 'var(--white)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                }}>
                  {selectedOption.flag}
                </div>

                <div>
                  <p style={{
                    margin: '0 0 2px',
                    fontSize: 'var(--text-lg)',
                    fontWeight: 'var(--weight-semibold)',
                    color: 'var(--text-1)',
                    letterSpacing: '-0.01em',
                  }}>
                    {selectedOption.code}
                  </p>
                  <p style={{
                    margin: 0,
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-3)',
                  }}>
                    {selectedOption.name}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)' }}>Change</span>
              </div>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>
              No currency selected yet.
            </p>
          )}
        </button>
      </div>

      <div className={styles.ctaArea}>
        <form action={saveOnboardingCurrency}>
          <input type="hidden" name="currency" value={selectedCode} />
          <SubmitButton idleLabel="Continue" pendingLabel="Saving…" disabled={!selectedCode} />
        </form>
      </div>

      {showPicker && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(16, 24, 40, 0.38)',
            display: 'flex',
            alignItems: 'flex-end',
            zIndex: 50,
          }}
          onClick={() => setShowPicker(false)}
        >
          <div
            onClick={event => event.stopPropagation()}
            style={{
              width: '100%',
              background: 'var(--white)',
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              border: '1px solid var(--border)',
              borderBottom: 'none',
              padding: '10px 16px 20px',
              maxHeight: '78vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 8 }}>
              <div style={{ width: 64, height: 5, borderRadius: 999, background: 'var(--grey-200)' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', color: 'var(--text-1)' }}>Choose currency</h2>
              <button
                type="button"
                onClick={() => setShowPicker(false)}
                aria-label="Close"
                style={{
                  border: 'none',
                  background: 'none',
                  color: 'var(--text-3)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <IconChevronX />
              </button>
            </div>

            <div style={{ position: 'relative', marginBottom: 12 }}>
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => setPickerFocused(true)}
                onBlur={() => setPickerFocused(false)}
                placeholder="Search currency or country"
                style={{
                  width: '100%',
                  height: 50,
                  border: pickerFocused
                    ? '2px solid var(--border-focus)'
                    : '1.5px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0 44px 0 var(--space-md)',
                  fontSize: 'var(--text-md)',
                  fontWeight: 'var(--weight-medium)',
                  color: 'var(--text-1)',
                  background: 'var(--white)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  boxShadow: pickerFocused ? '0 0 0 4px rgba(92, 52, 137, 0.08)' : 'none',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
              />

              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  style={{
                    position: 'absolute',
                    top: '50%',
                    right: 12,
                    transform: 'translateY(-50%)',
                    border: 'none',
                    background: 'none',
                    color: 'var(--text-3)',
                    cursor: 'pointer',
                    display: 'flex',
                    padding: 0,
                  }}
                >
                  <IconChevronX />
                </button>
              )}
            </div>

            <div style={{
              background: 'var(--white)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-xl)',
              overflow: 'hidden',
              overflowY: 'auto',
            }}>
              {list.length === 0 ? (
                <p style={{
                  margin: 0,
                  padding: 'var(--space-lg)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-3)',
                  textAlign: 'center',
                }}>
                  No matches found.
                </p>
              ) : (
                list.map((c, index) => {
                  const isSelected = selectedCode === c.code
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => {
                        setSelectedCode(c.code)
                        setShowPicker(false)
                        setQuery('')
                      }}
                      style={{
                        width: '100%',
                        border: 'none',
                        borderTop: index === 0 ? 'none' : '1px solid var(--border-subtle)',
                        background: isSelected ? 'rgba(92, 52, 137, 0.06)' : 'var(--white)',
                        padding: '14px 16px',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 22 }}>{c.flag}</span>
                        <div>
                          <p style={{
                            margin: '0 0 2px',
                            fontSize: 'var(--text-base)',
                            fontWeight: 'var(--weight-semibold)',
                            color: 'var(--text-1)',
                          }}>
                            {c.code}
                          </p>
                          <p style={{
                            margin: 0,
                            fontSize: 'var(--text-sm)',
                            color: 'var(--text-3)',
                          }}>
                            {c.name}
                          </p>
                        </div>
                      </div>

                      {isSelected && <CheckCircle2 size={18} color="var(--brand-dark)" />}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
