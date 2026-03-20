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
      background: '#fff',
      fontFamily: 'var(--font-sans)',
    }}>

      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '20px 24px',
        maxWidth: 640, margin: '0 auto',
      }}>
        <span style={{
          fontSize: 13, fontWeight: 700, color: '#1a1a1a',
          letterSpacing: '2px', textTransform: 'uppercase',
        }}>
          Cenza
        </span>
        <Link href="/login" style={{
          fontSize: 13, color: '#999', fontWeight: 400,
          textDecoration: 'none',
          letterSpacing: '-0.1px',
        }}>
          Sign in
        </Link>
      </div>

      {/* ── Main content ── */}
      <div style={{
        maxWidth: 560,
        margin: '0 auto',
        padding: '48px 24px 100px',
      }}>

        {/* Identity — name leads, no avatar circle until photo is ready */}
        {/*
          TODO: When a photo is available, add above the name block:
          <Image src="/michael.jpg" alt="Michael Shumaker" width={56} height={56}
            style={{ borderRadius: '50%', objectFit: 'cover', marginBottom: 20 }} />
        */}
        <div style={{ marginBottom: 48 }}>
          <p style={{
            margin: '0 0 4px',
            fontSize: 28, fontWeight: 700,
            color: '#1a1a1a', letterSpacing: '-0.6px', lineHeight: 1.1,
          }}>
            Michael Shumaker
          </p>
          <p style={{ margin: 0, fontSize: 13, color: '#aaa', fontWeight: 400 }}>
            Product designer
          </p>
        </div>

        {/* The note */}
        <div style={{
          fontSize: 17, lineHeight: 1.85,
          color: '#444',
          marginBottom: 64,
          display: 'flex', flexDirection: 'column', gap: 24,
        }}>
          <p style={{ margin: 0 }}>
            For a long time I knew I wasn't great with money but I couldn't tell you exactly where it was going.
            Month after month, the same feeling. Something is off but I can't see it clearly enough to fix it.
          </p>
          <p style={{ margin: 0 }}>
            So I built a small tool for myself. Nothing fancy, just enough to see clearly.
            A few months later things had shifted. Not because I changed overnight,
            but because I could finally see where the gaps were.
          </p>
          <p style={{ margin: 0 }}>
            Cenza is the rebuild of that tool. Same foundation, the thing that actually worked for me.
            Designed properly this time. I'm a product designer and I wanted it to feel as good as it functions.
            If you're in that same place I was, try it. And if you have thoughts, there's a way to reach me from inside the app.
          </p>
        </div>

        {/* ── App preview ── */}
        <div style={{ marginBottom: 64 }}>
          <p style={{
            margin: '0 0 20px', fontSize: 11, fontWeight: 500,
            color: '#bbb', textTransform: 'uppercase', letterSpacing: '1px',
          }}>
            A small look inside
          </p>

          <div style={{
            background: '#f5f5f7',
            borderRadius: 28,
            padding: 12,
            maxWidth: 320,
            boxShadow: '0 2px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)',
          }}>
            {/* Mini overview card */}
            <div style={{
              background: '#fff',
              borderRadius: 20,
              marginBottom: 8,
              overflow: 'hidden',
            }}>
              <div style={{ padding: '18px 18px 14px' }}>
                <p style={{
                  margin: '0 0 4px', fontSize: 10, fontWeight: 500,
                  color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.8px',
                }}>
                  Remaining this month
                </p>
                <p style={{
                  margin: '0 0 14px',
                  fontSize: 30, fontWeight: 700, letterSpacing: '-1px', lineHeight: 1,
                  color: '#1a1a1a', fontFamily: 'var(--font-display)',
                }}>
                  KES 67,400
                </p>
                <div style={{ height: 3, background: '#efefef', borderRadius: 99, marginBottom: 6 }}>
                  <div style={{ height: '100%', width: '42%', background: '#34C759', borderRadius: 99 }} />
                </div>
                <p style={{ margin: 0, fontSize: 11, color: '#aaa' }}>
                  KES 48,600 spent of KES 116,000
                </p>
              </div>
            </div>

            {/* Mini budget breakdown */}
            <div style={{
              background: '#fff',
              borderRadius: 20,
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '10px 14px 9px',
                borderBottom: '1px solid #f0f0f0',
              }}>
                <p style={{
                  margin: 0, fontSize: 10, fontWeight: 500,
                  color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.8px',
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
                    borderBottom: i < PREVIEW_CATEGORIES.length - 1 ? '1px solid #f5f5f5' : 'none',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12 }}>{cat.emoji}</span>
                        <span style={{ fontSize: 11, fontWeight: 500, color: '#1a1a1a' }}>{cat.label}</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: over ? '#FF3B30' : '#1a1a1a' }}>
                        {(cat.spent / 1000).toFixed(1)}K
                        <span style={{ fontWeight: 400, color: '#bbb' }}> / {(cat.budget / 1000).toFixed(0)}K</span>
                      </span>
                    </div>
                    <div style={{ height: 2.5, background: '#efefef', borderRadius: 99 }}>
                      <div style={{
                        height: '100%', width: `${pct}%`,
                        background: over ? '#FF3B30' : pct > 75 ? '#FF9500' : '#34C759',
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
          <Link href="/login" style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            height: 50, padding: '0 28px', borderRadius: 14,
            background: '#1a1a1a', color: '#fff',
            fontSize: 15, fontWeight: 600, textDecoration: 'none',
            letterSpacing: '-0.2px',
          }}>
            Try Cenza
          </Link>
          <p style={{ margin: 0, fontSize: 13, color: '#bbb' }}>
            Free to use. No card required.
          </p>
        </div>

      </div>
    </div>
  )
}
