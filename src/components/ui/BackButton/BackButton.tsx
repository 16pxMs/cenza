'use client'
import './BackButton.css'
export function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button className="back-btn" onClick={onBack}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Back
    </button>
  )
}
