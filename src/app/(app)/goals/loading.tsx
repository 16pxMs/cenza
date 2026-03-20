// Goals page loading skeleton
export default function Loading() {
  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8', padding: '24px 20px', paddingBottom: 100 }}>
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

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div className="sk" style={{ height: 26, width: 80 }} />
        <div className="sk" style={{ width: 40, height: 40, borderRadius: 20 }} />
      </div>

      {/* Goal cards */}
      {[1, 2, 3].map(i => (
        <div key={i} style={{ background: '#fff', border: '1px solid #ede8f5', borderRadius: 16, padding: '18px 16px', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <div className="sk" style={{ height: 15, width: 120, marginBottom: 8 }} />
              <div className="sk" style={{ height: 11, width: 80 }} />
            </div>
            <div className="sk" style={{ height: 22, width: 70 }} />
          </div>
          <div className="sk" style={{ height: 6, width: '100%', borderRadius: 99, marginBottom: 8 }} />
          <div className="sk" style={{ height: 11, width: 100 }} />
        </div>
      ))}
    </div>
  )
}
