import Link from 'next/link'

// ─── Static app preview data ──────────────────────────────────
const PREVIEW_CATEGORIES = [
  { emoji: '🛒', label: 'Groceries',   spent: 4200,  budget: 5000  },
  { emoji: '🚌', label: 'Transport',   spent: 1500,  budget: 3000  },
  { emoji: '🍽️', label: 'Eating out', spent: 5100,  budget: 4000  },
]

export default function LandingPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--white)',
      fontFamily: 'var(--font-sans)',
    }}>

      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '20px 24px',
        maxWidth: 600, margin: '0 auto',
      }}>
        <span style={{
          fontSize: 17, fontWeight: 700, color: 'var(--brand-dark)',
          fontFamily: 'var(--font-display)', letterSpacing: '-0.3px',
        }}>
          Cenza
        </span>
        <Link href="/login" style={{
          fontSize: 14, color: 'var(--text-3)', fontWeight: 500,
          textDecoration: 'none',
        }}>
          Sign in
        </Link>
      </div>

      {/* ── Main content ── */}
      <div style={{
        maxWidth: 560,
        margin: '0 auto',
        padding: '32px 24px 80px',
      }}>

        {/* Avatar + identity */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: 36 }}>
          {/*
            TODO: Replace this div with:
            <Image src="/michael.jpg" alt="Michael Shumaker" width={72} height={72}
              style={{ borderRadius: '50%', objectFit: 'cover' }} />
            once a photo is available.
          */}
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'var(--brand)', border: '2px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 700, color: 'var(--brand-dark)',
            marginBottom: 14, flexShrink: 0,
          }}>
            MS
          </div>
          <p style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>
            Michael Shumaker
          </p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            Product designer
          </p>
        </div>

        {/* The note */}
        <div style={{
          fontSize: 16, lineHeight: 1.8,
          color: 'var(--text-2)',
          marginBottom: 52,
        }}>
          <p style={{ marginTop: 0 }}>
            For a long time I knew I wasn't great with money but I couldn't tell you exactly where it was going.
            Month after month, the same feeling. Something is off but I can't see it clearly enough to fix it.
          </p>
          <p>
            So I built a small tool for myself. Nothing fancy, just enough to see clearly.
            A few months later things had shifted. Not because I changed overnight,
            but because I could finally see where the gaps were.
          </p>
          <p style={{ marginBottom: 0 }}>
            Cenza is the rebuild of that tool. Same foundation, the thing that actually worked for me.
            Designed properly this time. I'm a product designer and I wanted it to feel as good as it functions.
            If you're in that same place I was, try it. And if you have thoughts, there's a way to reach me from inside the app.
          </p>
        </div>

        {/* ── App preview ── */}
        <div style={{ marginBottom: 52 }}>
          <p style={{
            margin: '0 0 16px', fontSize: 11, fontWeight: 600,
            color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px',
          }}>
            A small look inside
          </p>

          <div style={{
            background: 'var(--page-bg)',
            border: '1px solid var(--border)',
            borderRadius: 24, overflow: 'hidden',
            maxWidth: 340,
          }}>
            {/* Mini overview card */}
            <div style={{
              background: 'var(--white)', margin: 12,
              borderRadius: 18, border: '1px solid var(--border)',
              overflow: 'hidden',
            }}>
              <div style={{ padding: '18px 18px 14px' }}>
                <p style={{
                  margin: '0 0 3px', fontSize: 10, fontWeight: 600,
                  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px',
                }}>
                  Remaining this month
                </p>
                <p style={{
                  margin: '0 0 12px',
                  fontSize: 30, fontWeight: 700, letterSpacing: '-1px', lineHeight: 1,
                  color: 'var(--text-1)', fontFamily: 'var(--font-display)',
                }}>
                  KES 67,400
                </p>
                <div style={{ height: 4, background: 'var(--grey-100)', borderRadius: 99, marginBottom: 5 }}>
                  <div style={{ height: '100%', width: '42%', background: 'var(--green)', borderRadius: 99 }} />
                </div>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
                  KES 48,600 spent of KES 116,000
                </p>
              </div>
            </div>

            {/* Mini budget breakdown */}
            <div style={{
              background: 'var(--white)', margin: '0 12px 12px',
              borderRadius: 18, border: '1px solid var(--border)',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '10px 14px 8px',
                borderBottom: '1px solid var(--border-subtle)',
              }}>
                <p style={{
                  margin: 0, fontSize: 10, fontWeight: 600,
                  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px',
                }}>
                  Spending budget
                </p>
              </div>
              {PREVIEW_CATEGORIES.map((cat, i) => {
                const pct  = Math.min(100, (cat.spent / cat.budget) * 100)
                const over = cat.spent > cat.budget
                return (
                  <div key={cat.label} style={{
                    padding: '10px 14px',
                    borderBottom: i < PREVIEW_CATEGORIES.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12 }}>{cat.emoji}</span>
                        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-1)' }}>{cat.label}</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: over ? 'var(--red-dark)' : 'var(--text-1)' }}>
                        {(cat.spent / 1000).toFixed(1)}K
                        <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> / {(cat.budget / 1000).toFixed(0)}K</span>
                      </span>
                    </div>
                    <div style={{ height: 3, background: 'var(--grey-100)', borderRadius: 99 }}>
                      <div style={{
                        height: '100%', width: `${pct}%`,
                        background: over ? 'var(--red)' : pct > 75 ? '#F59E0B' : 'var(--green)',
                        borderRadius: 99,
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── CTA ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 14 }}>
          <Link href="/login" style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            height: 52, padding: '0 32px', borderRadius: 14,
            background: 'var(--brand-dark)', color: '#fff',
            fontSize: 15, fontWeight: 600, textDecoration: 'none',
            minWidth: 200,
          }}>
            Try Cenza
          </Link>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            Free to use. No card required.
          </p>
        </div>

      </div>
    </div>
  )
}
