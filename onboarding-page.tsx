'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const T = {
  brand:       '#EADFF4',
  brandMid:    '#C9AEE8',
  brandDeep:   '#9B6FCC',
  brandDark:   '#5C3489',
  pageBg:      '#FAFAF8',
  white:       '#FFFFFF',
  border:      '#EDE8F5',
  borderStrong:'#D5CDED',
  text1:       '#1A1025',
  text2:       '#4A3B66',
  text3:       '#8B7BA8',
  textMuted:   '#B8AECE',
  greenBorder: '#BBF7D0',
  greenDark:   '#15803D',
}

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ padding: '16px 28px 0' }}>
      <div style={{ height: 3, background: T.border, borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(step / total) * 100}%`, background: T.brandDeep, borderRadius: 99, transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)' }} />
      </div>
    </div>
  )
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: T.text3, padding: '4px 0', fontSize: 14, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
      Back
    </button>
  )
}

function PrimaryBtn({ children, onClick, disabled, style = {} }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; style?: React.CSSProperties }) {
  return (
    <button onClick={disabled ? undefined : onClick} style={{ width: '100%', height: 52, borderRadius: 14, background: disabled ? T.textMuted : T.brandDark, border: 'none', cursor: disabled ? 'default' : 'pointer', color: '#fff', fontSize: 15, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", letterSpacing: 0.2, transition: 'all 0.2s ease', opacity: disabled ? 0.45 : 1, ...style }}>
      {children}
    </button>
  )
}

function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: T.brand + '44', border: `1px solid ${T.brandMid}66`, borderRadius: 12, padding: '11px 14px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>💡</span>
      <p style={{ margin: 0, fontSize: 12.5, color: T.brandDark, lineHeight: 1.55, fontStyle: 'italic' }}>{children}</p>
    </div>
  )
}

function ScreenCurrency({ onNext, data, setData }: any) {
  const currencies = [
    { code: 'KES', flag: '🇰🇪', name: 'Kenyan Shilling' },
    { code: 'NGN', flag: '🇳🇬', name: 'Nigerian Naira' },
    { code: 'USD', flag: '🇺🇸', name: 'US Dollar' },
  ]
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '12px 28px 32px' }}>
      <ProgressBar step={1} total={3} />
      <div style={{ marginTop: 32 }}>
        <h1 style={{ fontFamily: "'Lora', serif", fontSize: 26, fontWeight: 600, color: T.text1, margin: '0 0 6px', lineHeight: 1.25 }}>What do you earn<br />and spend in?</h1>
        <p style={{ fontSize: 13.5, color: T.text3, margin: 0, lineHeight: 1.6 }}>Pick the currency your day-to-day life runs on.</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 28 }}>
        {currencies.map(c => {
          const selected = data.currency === c.code
          return (
            <button key={c.code} onClick={() => setData((d: any) => ({ ...d, currency: c.code }))} style={{ background: selected ? T.brand + '55' : T.white, border: `${selected ? 2 : 1.5}px solid ${selected ? T.brandDeep : T.border}`, borderRadius: 16, padding: '16px 18px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14, transition: 'all 0.2s ease' }}>
              <span style={{ fontSize: 30 }}>{c.flag}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: T.text1, fontFamily: "'DM Sans', sans-serif" }}>{c.code}</div>
                <div style={{ fontSize: 12.5, color: T.text3, marginTop: 2 }}>{c.name}</div>
              </div>
              {selected && <div style={{ width: 22, height: 22, borderRadius: '50%', background: T.brandDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4.5L4 7.5L10 1.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></div>}
            </button>
          )
        })}
      </div>
      <div style={{ marginTop: 20 }}><TipBox>You can earn in USD and still track in KES or NGN — just pick the one you budget in day to day.</TipBox></div>
      <div style={{ flex: 1 }} />
      <div style={{ paddingTop: 24 }}><PrimaryBtn onClick={onNext} disabled={!data.currency}>Continue</PrimaryBtn></div>
    </div>
  )
}

function ScreenMonthStart({ onNext, onBack, data, setData }: any) {
  const options = [
    { value: '1st', label: '1st', sub: 'Most common' },
    { value: '15th', label: '15th', sub: 'Mid-month payroll' },
    { value: '25th', label: '25th', sub: 'End-of-month pay' },
    { value: 'custom', label: 'Custom', sub: 'Pick your date' },
  ]
  const isCustom = data.monthStart === 'custom'
  const customDay = data.customDay || null
  const suffix = (d: number) => d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'
  const days = Array.from({ length: 31 }, (_, i) => i + 1)
  const canContinue = data.monthStart && (data.monthStart !== 'custom' || customDay)
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '12px 28px 32px' }}>
      <ProgressBar step={2} total={3} />
      <div style={{ marginTop: 20 }}><BackButton onBack={onBack} /></div>
      <div style={{ marginTop: 20 }}>
        <h1 style={{ fontFamily: "'Lora', serif", fontSize: 26, fontWeight: 600, color: T.text1, margin: '0 0 6px', lineHeight: 1.25 }}>When does your<br />month start?</h1>
        <p style={{ fontSize: 13.5, color: T.text3, margin: 0, lineHeight: 1.6 }}>Your month starts when your money arrives — not on the 1st.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 24 }}>
        {options.map(o => {
          const selected = data.monthStart === o.value
          return (
            <button key={o.value} onClick={() => setData((d: any) => ({ ...d, monthStart: o.value, customDay: null }))} style={{ background: selected ? T.brand + '55' : T.white, border: `${selected ? 2 : 1.5}px solid ${selected ? T.brandDeep : T.border}`, borderRadius: 16, padding: '18px 16px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s ease' }}>
              <div style={{ fontSize: 22, fontFamily: "'Lora', serif", fontWeight: 600, color: selected ? T.brandDark : T.text1 }}>{o.label}</div>
              <div style={{ fontSize: 12, color: T.text3, marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>{o.sub}</div>
            </button>
          )
        })}
      </div>
      {isCustom && (
        <div style={{ marginTop: 14, background: T.brand + '33', border: `1.5px solid ${T.brandMid}88`, borderRadius: 16, padding: '16px 14px 14px' }}>
          <p style={{ margin: '0 0 12px', fontSize: 12.5, fontWeight: 600, color: T.brandDark, letterSpacing: 0.3, textTransform: 'uppercase' }}>Choose the day</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
            {days.map(d => {
              const sel = customDay === d
              return <button key={d} onClick={() => setData((dd: any) => ({ ...dd, customDay: d }))} style={{ height: 34, borderRadius: 8, background: sel ? T.brandDeep : T.white, border: `1.5px solid ${sel ? T.brandDeep : T.border}`, color: sel ? '#fff' : T.text2, fontSize: 12.5, fontWeight: sel ? 600 : 400, fontFamily: "'DM Sans', sans-serif", cursor: 'pointer', padding: 0, transition: 'all 0.15s ease' }}>{d}</button>
            })}
          </div>
          {customDay && <p style={{ margin: '12px 0 0', fontSize: 13, color: T.brandDark, fontStyle: 'italic', textAlign: 'center' }}>Your month starts on the <strong>{customDay}{suffix(customDay)}</strong></p>}
        </div>
      )}
      <div style={{ flex: 1 }} />
      <div style={{ paddingTop: 24 }}><PrimaryBtn onClick={onNext} disabled={!canContinue}>Continue</PrimaryBtn></div>
    </div>
  )
}

function ScreenGoals({ onNext, onBack, data, setData }: any) {
  const goals = [
    { id: 'car', icon: '🚗', label: 'Car' },
    { id: 'home', icon: '🏠', label: 'Home' },
    { id: 'travel', icon: '✈️', label: 'Travel' },
    { id: 'education', icon: '📚', label: 'Education' },
    { id: 'business', icon: '💼', label: 'Business' },
    { id: 'family', icon: '👨‍👩‍👧', label: 'Family' },
    { id: 'other', icon: '⭐', label: 'Other' },
  ]
  const toggleGoal = (id: string) => {
    const current: string[] = data.goals || []
    const next = current.includes(id) ? current.filter((g: string) => g !== id) : [...current, id]
    setData((d: any) => ({ ...d, goals: next }))
  }
  const selectedGoals: string[] = data.goals || []
  const efSelected = selectedGoals.includes('emergency')
  const count = selectedGoals.length
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '12px 28px 24px' }}>
      <ProgressBar step={3} total={3} />
      <div style={{ marginTop: 20 }}><BackButton onBack={onBack} /></div>
      <div style={{ marginTop: 20 }}>
        <h1 style={{ fontFamily: "'Lora', serif", fontSize: 26, fontWeight: 600, color: T.text1, margin: '0 0 4px', lineHeight: 1.25 }}>What are you saving towards?</h1>
        <p style={{ fontSize: 13, color: T.text3, margin: 0, fontStyle: 'italic' }}>You don&apos;t need to know the numbers yet.</p>
      </div>
      <div style={{ marginTop: 18 }}>
        <button onClick={() => toggleGoal('emergency')} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', background: efSelected ? T.brand + '33' : T.white, border: `${efSelected ? 2 : 1.5}px solid ${efSelected ? T.brandDeep : T.border}`, borderRadius: 16, marginBottom: 10, overflow: 'hidden', padding: 0, transition: 'all 0.2s ease' }}>
          <div style={{ padding: '16px 16px 14px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text1, fontFamily: "'DM Sans', sans-serif", marginBottom: 5 }}>Emergency Fund</div>
              <div style={{ fontSize: 12.5, color: T.text2, lineHeight: 1.55 }}>Start here before any other goal — this helps you track what you have.</div>
            </div>
            <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, marginTop: 2, background: efSelected ? T.brandDeep : 'transparent', border: `2px solid ${efSelected ? T.brandDeep : T.borderStrong}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' }}>
              {efSelected && <svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4.5L4 7.5L10 1.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
          </div>
          <div style={{ background: '#DCFCE7', borderTop: `1px solid ${T.greenBorder}`, padding: '10px 16px' }}>
            <p style={{ margin: 0, fontSize: 12.5, color: T.greenDark, lineHeight: 1.55 }}>One bad month doesn&apos;t send you into debt.</p>
          </div>
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {goals.map(g => {
            const sel = selectedGoals.includes(g.id)
            return (
              <button key={g.id} onClick={() => toggleGoal(g.id)} style={{ background: sel ? T.brand + '55' : T.white, border: `${sel ? 2 : 1.5}px solid ${sel ? T.brandDeep : T.border}`, borderRadius: 14, padding: '14px 12px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.2s ease', position: 'relative' }}>
                <span style={{ fontSize: 20 }}>{g.icon}</span>
                <span style={{ fontSize: 13.5, fontWeight: 500, color: T.text1, fontFamily: "'DM Sans', sans-serif" }}>{g.label}</span>
                {sel && <div style={{ position: 'absolute', top: 8, right: 8, width: 16, height: 16, borderRadius: '50%', background: T.brandDeep, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="8" height="7" viewBox="0 0 8 7" fill="none"><path d="M1 3.5L3 5.5L7 1.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg></div>}
              </button>
            )
          })}
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ paddingTop: 16 }}>
        <PrimaryBtn onClick={onNext} disabled={count === 0}>{count === 0 ? 'Select at least one goal' : `Continue with ${count} goal${count > 1 ? 's' : ''}`}</PrimaryBtn>
      </div>
    </div>
  )
}

function ScreenDone({ onFinish, data, saving }: any) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t) }, [])
  const suffix = (d: number) => d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'
  const monthDisplay = data.monthStart === 'custom' && data.customDay ? `The ${data.customDay}${suffix(data.customDay)}` : data.monthStart ? `The ${data.monthStart}` : '—'
  const goalLabels: Record<string, string> = { emergency: 'Emergency Fund', car: 'Car', home: 'Home', travel: 'Travel', education: 'Education', business: 'Business', family: 'Family', other: 'Other' }
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '20px 28px 36px', background: T.pageBg }}>
      <div style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'scale(1)' : 'scale(0.95)', transition: 'all 0.5s cubic-bezier(0.175,0.885,0.32,1.275) 0.1s', textAlign: 'center', marginTop: 48 }}>
        <h1 style={{ fontFamily: "'Lora', serif", fontSize: 26, fontWeight: 600, color: T.text1, margin: '0 0 8px', lineHeight: 1.25 }}>
          You&apos;re all set, <span style={{ color: T.brandDeep, fontStyle: 'italic' }}>{data.name || 'there'}!</span>
        </h1>
        <p style={{ fontSize: 14, color: T.text2, margin: 0, lineHeight: 1.6 }}>Your first month is a blank slate.<br />Start by adding your income.</p>
      </div>
      <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10, opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(16px)', transition: 'all 0.5s ease 0.3s' }}>
        <div style={{ background: T.white, border: `1.5px solid ${T.border}`, borderRadius: 14, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: 999, background: T.brand + '55', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.brandDeep} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v2m0 8v2M9 9h4a2 2 0 010 4H9a2 2 0 000 4h6"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.text3, textTransform: 'uppercase', letterSpacing: 1 }}>Currency</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.text1, marginTop: 2 }}>{data.currency || '—'}</div>
          </div>
        </div>
        <div style={{ background: T.white, border: `1.5px solid ${T.border}`, borderRadius: 14, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: 999, background: T.brand + '55', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.brandDeep} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.text3, textTransform: 'uppercase', letterSpacing: 1 }}>Month starts</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.text1, marginTop: 2 }}>{monthDisplay}</div>
          </div>
        </div>
        <div style={{ background: T.white, border: `1.5px solid ${T.border}`, borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 999, background: T.brand + '55', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.brandDeep} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.text3, textTransform: 'uppercase', letterSpacing: 1 }}>Your goals</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {(data.goals || []).map((g: string) => (
              <span key={g} style={{ background: T.brand + '55', color: T.brandDark, border: `1px solid ${T.brandMid}`, borderRadius: 99, padding: '4px 12px', fontSize: 12.5, fontWeight: 500 }}>{goalLabels[g]}</span>
            ))}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 16, opacity: mounted ? 1 : 0, transition: 'opacity 0.4s ease 0.5s' }}>
        <p style={{ textAlign: 'center', fontSize: 12.5, color: T.brandDeep, fontStyle: 'italic', margin: 0 }}>✦ The app learns as you go.</p>
      </div>
      <div style={{ flex: 1 }} />
      <PrimaryBtn onClick={onFinish} disabled={saving} style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(8px)', transition: 'all 0.4s ease 0.6s' }}>
        {saving ? 'Saving...' : 'Go to my overview'}
      </PrimaryBtn>
    </div>
  )
}

function AnimatedScreen({ children, id }: { children: React.ReactNode; id: number }) {
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
      router.push('/app')
    } catch (err) {
      console.error('Save error:', err)
      setSaving(false)
    }
  }

  const screens = [
    <ScreenCurrency key="currency" onNext={next} data={data} setData={setData} />,
    <ScreenMonthStart key="month" onNext={next} onBack={back} data={data} setData={setData} />,
    <ScreenGoals key="goals" onNext={next} onBack={back} data={data} setData={setData} />,
    <ScreenDone key="done" onFinish={handleFinish} data={data} saving={saving} />,
  ]

  return (
    <div style={{ minHeight: '100vh', background: T.pageBg, fontFamily: "'DM Sans', sans-serif", maxWidth: 480, margin: '0 auto' }}>
      <AnimatedScreen key={step} id={step}>{screens[step]}</AnimatedScreen>
    </div>
  )
}
