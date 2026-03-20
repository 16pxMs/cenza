// Overview loading skeleton
export default function Loading() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', padding: '40px 20px', paddingBottom: 100 }}>
      <style>{`
        @keyframes shimmer {
          0%   { backgroundPosition: -400px 0 }
          100% { backgroundPosition: 400px 0 }
        }
        .sk {
          background: linear-gradient(90deg, #ede8f5 25%, #f5f0fa 50%, #ede8f5 75%);
          background-size: 800px 100%;
          animation: shimmer 1.4s infinite linear;
          border-radius: 8px;
        }
      `}</style>

      {/* Greeting */}
      <div className="sk" style={{ height: 14, width: 100, marginBottom: 8 }} />
      <div className="sk" style={{ height: 28, width: 200, marginBottom: 32 }} />

      {/* Main card */}
      <div style={{ background: '#fff', border: '1px solid #ede8f5', borderRadius: 20, padding: 24, marginBottom: 12 }}>
        <div className="sk" style={{ height: 11, width: 80, marginBottom: 16 }} />
        <div className="sk" style={{ height: 48, width: 160, marginBottom: 20 }} />
        <div className="sk" style={{ height: 6, width: '100%', borderRadius: 99, marginBottom: 10 }} />
        <div className="sk" style={{ height: 11, width: 140, marginBottom: 28 }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="sk" style={{ height: 52, flex: 1, borderRadius: 14 }} />
          <div className="sk" style={{ height: 52, flex: 1, borderRadius: 14 }} />
        </div>
      </div>

      {/* Goals section */}
      <div style={{ background: '#fff', border: '1px solid #ede8f5', borderRadius: 20, padding: 24, marginBottom: 12 }}>
        <div className="sk" style={{ height: 11, width: 60, marginBottom: 20 }} />
        {[1, 2].map(i => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="sk" style={{ width: 36, height: 36, borderRadius: 10 }} />
              <div>
                <div className="sk" style={{ height: 12, width: 90, marginBottom: 6 }} />
                <div className="sk" style={{ height: 10, width: 60 }} />
              </div>
            </div>
            <div className="sk" style={{ height: 12, width: 50 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
