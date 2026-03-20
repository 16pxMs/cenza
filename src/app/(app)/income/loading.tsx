// Plan page loading skeleton
export default function Loading() {
  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8', padding: '24px 16px', paddingBottom: 100 }}>
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
      <div className="sk" style={{ height: 28, width: 120, marginBottom: 6 }} />
      <div className="sk" style={{ height: 14, width: 100, marginBottom: 28 }} />

      {/* Income card */}
      <div style={{ background: '#fff', border: '1px solid #ede8f5', borderRadius: 16, overflow: 'hidden', marginBottom: 12 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #ede8f5' }}>
          <div className="sk" style={{ height: 11, width: 60 }} />
        </div>
        <div style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="sk" style={{ height: 14, width: 60 }} />
            <div className="sk" style={{ height: 14, width: 90 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid #ede8f5' }}>
            <div className="sk" style={{ height: 11, width: 40 }} />
            <div className="sk" style={{ height: 18, width: 100 }} />
          </div>
        </div>
      </div>

      {/* Fixed expenses card */}
      <div style={{ background: '#fff', border: '1px solid #ede8f5', borderRadius: 16, overflow: 'hidden', marginBottom: 12 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #ede8f5' }}>
          <div className="sk" style={{ height: 11, width: 110 }} />
        </div>
        <div style={{ padding: '8px 0' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #ede8f5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="sk" style={{ width: 24, height: 24, borderRadius: 6 }} />
                <div className="sk" style={{ height: 13, width: 70 }} />
              </div>
              <div className="sk" style={{ height: 13, width: 70 }} />
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px' }}>
            <div className="sk" style={{ height: 11, width: 40 }} />
            <div className="sk" style={{ height: 18, width: 90 }} />
          </div>
        </div>
      </div>

      {/* Available card */}
      <div className="sk" style={{ height: 72, borderRadius: 16, marginBottom: 12 }} />
    </div>
  )
}
