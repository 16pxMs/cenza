'use client'
import './ProgressBar.css'
export function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="progress-track">
      <div className="progress-track__bar">
        <div className="progress-track__fill" style={{ width: `${(step / total) * 100}%` }} />
      </div>
    </div>
  )
}
