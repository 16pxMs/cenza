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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/login" style={{
            fontSize: 13, color: '#1a1a1a', fontWeight: 500,
            textDecoration: 'none',
            padding: '8px 16px', borderRadius: 10,
            border: '1px solid #e0e0e0',
            letterSpacing: '-0.1px',
          }}>
            Sign in
          </Link>
          <Link href="/login" style={{
            fontSize: 13, color: '#fff', fontWeight: 600,
            textDecoration: 'none',
            padding: '8px 16px', borderRadius: 10,
            background: '#1a1a1a',
            letterSpacing: '-0.1px',
          }}>
            Try Cenza
          </Link>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{
        maxWidth: 520,
        margin: '0 auto',
        padding: '48px 24px 100px',
      }}>

        {/* Hook — leads the page */}
        <div style={{ marginBottom: 56 }}>
          <p style={{
            margin: '0 0 28px',
            fontSize: 22, fontWeight: 600,
            color: '#1a1a1a', letterSpacing: '-0.4px', lineHeight: 1.4,
          }}>
            If you're here, you probably feel it too.
          </p>
          <div style={{
            fontSize: 17, lineHeight: 1.9,
            color: '#555',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <p style={{ margin: 0 }}>Something about your money doesn't add up.</p>
            <p style={{ margin: 0 }}>You just can't see why.</p>
            <p style={{ margin: 0 }}>Month after month, the same feeling.</p>
          </div>
        </div>

        {/* The note */}
        <div style={{
          fontSize: 17, lineHeight: 1.85,
          color: '#555',
          marginBottom: 64,
          display: 'flex', flexDirection: 'column', gap: 20,
        }}>
          <p style={{ margin: 0 }}>That's where I was.</p>
          <p style={{ margin: 0, color: '#1a1a1a', fontWeight: 500 }}>I'm Michael. I built Cenza.</p>
          <p style={{ margin: 0 }}>
            For a long time, I knew I wasn't great with money.
            I'm still not great, but I understand it a lot better now.
          </p>
          <p style={{ margin: 0 }}>
            Before, I couldn't tell you where my money was going. Not in a way I could act on.
          </p>
          <p style={{ margin: 0 }}>
            So I built a small tool for myself. Nothing fancy. Just enough to see what was really happening.
          </p>
          <p style={{ margin: 0 }}>
            A few months later, things started to change.
            Not overnight.
            But I could finally see the gaps. And once I could see them, I could do something about them.
          </p>
          <p style={{ margin: 0 }}>
            Cenza is a rebuild of that tool. Same idea. Just done properly this time.
          </p>
          <p style={{ margin: 0 }}>
            I'm a product designer, so I cared about how it feels as much as how it works.
            It's simple, fast, and built to give you clarity without getting in your way.
          </p>
          <p style={{ margin: 0 }}>If you're in that same place I was, try it.</p>
          <p style={{ margin: 0 }}>And if you have thoughts, you can reach me from inside the app.</p>
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
