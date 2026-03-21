import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

const PREVIEW_CATEGORIES = [
  { emoji: '🛒', label: 'Groceries',   spent: 420,  budget: 500  },
  { emoji: '🚌', label: 'Transport',   spent: 150,  budget: 300  },
  { emoji: '🍽️', label: 'Eating out', spent: 510,  budget: 400  },
]

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--white)', fontFamily: 'var(--font-sans)' }}>

      <style>{`
        .landing-topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          max-width: 560px;
          margin: 0 auto;
        }
        .landing-hero {
          display: flex;
          flex-direction: column-reverse;
          max-width: 560px;
          margin: 0 auto;
          padding: 48px 24px 100px;
        }
        .landing-preview-col { margin-bottom: 48px; }
        .hook-headline {
          font-size: 26px;
          font-weight: 700;
          color: var(--text-1);
          letter-spacing: -0.6px;
          line-height: 1.25;
          margin: 0 0 20px;
          font-family: var(--font-display);
        }
        .hook-lines {
          font-size: 18px;
          line-height: 1.8;
          color: var(--text-1);
          font-weight: 500;
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .hook-cta {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 24px;
          font-size: 14px;
          font-weight: 500;
          color: var(--brand-dark);
          text-decoration: none;
          letter-spacing: -0.1px;
        }
        .story-divider {
          width: 32px;
          height: 1px;
          background: var(--border-strong);
          margin: 40px 0;
        }
        .preview-label {
          font-size: 11px;
          font-weight: 500;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 0 0 20px;
        }
        @media (min-width: 1024px) {
          .landing-topbar {
            max-width: 1160px;
            padding: 24px 60px;
          }
          .landing-hero {
            flex-direction: row;
            align-items: flex-start;
            max-width: 1160px;
            padding: 80px 60px 120px;
            gap: 100px;
          }
          .landing-copy { order: 1; flex: 1; max-width: 500px; }
          .landing-preview-col {
            order: 2;
            flex-shrink: 0;
            width: 360px;
            margin-bottom: 0;
            margin-top: 8px;
            position: sticky;
            top: 80px;
          }
          .hook-headline { font-size: 36px; margin-bottom: 24px; }
          .hook-lines { font-size: 20px; }
          .preview-label { display: none; }
        }
      `}</style>

      {/* ── Top bar ── */}
      <div className="landing-topbar">
        <span style={{
          fontSize: 15, fontWeight: 700, color: 'var(--text-1)',
          letterSpacing: '-0.3px',
        }}>
          Cenza
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/login" style={{
            fontSize: 13, color: 'var(--text-1)', fontWeight: 500,
            textDecoration: 'none', padding: '8px 16px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-strong)',
            letterSpacing: '-0.1px',
          }}>
            Sign in
          </Link>
          <Link href="/login" style={{
            fontSize: 13, color: 'var(--text-inverse)', fontWeight: 600,
            textDecoration: 'none', padding: '8px 16px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--brand-dark)',
            letterSpacing: '-0.1px',
          }}>
            Try Cenza
          </Link>
        </div>
      </div>

      {/* ── Hero ── */}
      <div className="landing-hero">

        {/* Left: copy */}
        <div className="landing-copy">

          {/* Hook */}
          <div>
            <p className="hook-headline">
              If you're here, you probably feel it too.
            </p>
            <div className="hook-lines">
              <p style={{ margin: 0 }}>Your money leaves.</p>
              <p style={{ margin: 0 }}>You're not sure where it goes.</p>
              <p style={{ margin: 0 }}>And at the end of the month, you're not sure why.</p>
              <p style={{ margin: 0 }}>Month after month, the same feeling.</p>
            </div>
            {/* Early CTA — for people who get it immediately */}
            <Link href="/login" className="hook-cta">
              Sound familiar? Try it free <ArrowRight size={14} />
            </Link>
          </div>

          {/* Divider — signals shift from feeling to story */}
          <div className="story-divider" />

          {/* Story */}
          <div style={{
            fontSize: 16, lineHeight: 1.85,
            color: 'var(--text-2)',
            display: 'flex', flexDirection: 'column', gap: 18,
            marginBottom: 52,
          }}>
            <p style={{ margin: 0 }}>That's where I was.</p>
            <p style={{ margin: 0, color: 'var(--text-1)', fontWeight: 500 }}>I'm Michael. I built Cenza.</p>
            <p style={{ margin: 0 }}>
              For a long time I had a quiet unease about money. Not a crisis.
              Just a quiet feeling that something wasn't adding up.
            </p>
            <p style={{ margin: 0 }}>
              The problem wasn't that I was spending too much.
              It was that I couldn't see clearly enough to know either way.
            </p>
            <p style={{ margin: 0 }}>
              So I built a small tool. Just to see where it was going.
            </p>
            <p style={{ margin: 0 }}>
              What I found wasn't as bad as I feared. I was overspending in two categories,
              consistently, without noticing. Seeing it was enough. The next month I naturally
              spent less. I didn't budget harder. I just knew.
            </p>
            <p style={{ margin: 0 }}>
              I also saw I could build a real emergency fund on what I was already earning.
              I just couldn't see it before. That one realization did more for my anxiety
              than any budgeting advice ever had.
            </p>
            <p style={{ margin: 0, color: 'var(--text-1)', fontWeight: 500 }}>
              Most of us aren't bad with money. We just can't see it clearly enough to act on it.
            </p>
            <p style={{ margin: 0 }}>
              Cenza fixes that. It shows you where your money goes, helps you set a budget
              that makes sense, and tells you when something's off.
            </p>
            <p style={{ margin: 0 }}>If you recognize that feeling, this is for you.</p>
          </div>

          {/* CTA */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
            <Link href="/login" style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              height: 52, padding: '0 32px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--brand-dark)', color: 'var(--text-inverse)',
              fontSize: 15, fontWeight: 600, textDecoration: 'none',
              letterSpacing: '-0.2px',
            }}>
              Try Cenza, it's free
            </Link>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Free. No card, no catch.</p>
          </div>
        </div>

        {/* Right: app preview */}
        <div className="landing-preview-col">
          <div style={{
            background: 'var(--grey-100)',
            borderRadius: 28,
            padding: 12,
            boxShadow: 'var(--shadow-lg)',
          }}>
            {/* Overview card */}
            <div style={{ background: 'var(--white)', borderRadius: 'var(--radius-xl)', marginBottom: 8, overflow: 'hidden' }}>
              <div style={{ padding: '18px 18px 14px' }}>
                <p style={{
                  margin: '0 0 4px', fontSize: 10, fontWeight: 500,
                  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px',
                }}>
                  Remaining this month
                </p>
                <p style={{
                  margin: '0 0 14px',
                  fontSize: 30, fontWeight: 700, letterSpacing: '-1px', lineHeight: 1,
                  color: 'var(--text-1)', fontFamily: 'var(--font-display)',
                }}>
                  $3,240
                </p>
                <div style={{ height: 3, background: 'var(--grey-200)', borderRadius: 99, marginBottom: 6 }}>
                  <div style={{ height: '100%', width: '42%', background: 'var(--green)', borderRadius: 99 }} />
                </div>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
                  $2,340 spent of $5,580
                </p>
              </div>
            </div>

            {/* Budget breakdown */}
            <div style={{ background: 'var(--white)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px 9px', borderBottom: '1px solid var(--border-subtle)' }}>
                <p style={{
                  margin: 0, fontSize: 10, fontWeight: 500,
                  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px',
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
                    background: over ? 'var(--red-light)' : 'transparent',
                    borderBottom: i < PREVIEW_CATEGORIES.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12 }}>{cat.emoji}</span>
                        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-1)' }}>{cat.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {over && (
                          <span style={{
                            fontSize: 10, fontWeight: 600,
                            color: 'var(--red-dark)',
                            background: 'var(--red-border)',
                            borderRadius: 99, padding: '1px 7px',
                          }}>
                            over
                          </span>
                        )}
                        <span style={{ fontSize: 11, fontWeight: 600, color: over ? 'var(--red)' : 'var(--text-1)' }}>
                          ${cat.spent}
                          <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> / ${cat.budget}</span>
                        </span>
                      </div>
                    </div>
                    <div style={{ height: 2.5, background: 'var(--grey-200)', borderRadius: 99 }}>
                      <div style={{
                        height: '100%', width: `${pct}%`,
                        background: over ? 'var(--red)' : pct > 75 ? 'var(--amber)' : 'var(--green)',
                        borderRadius: 99,
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
