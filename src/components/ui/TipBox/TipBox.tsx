'use client'
import './TipBox.css'
export function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="tip-box">
      <span className="tip-box__icon">💡</span>
      <p className="tip-box__text">{children}</p>
    </div>
  )
}
