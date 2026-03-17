'use client'
import styles from './ProgressBar.module.css'

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  step: number
  total: number
}

export function ProgressBar({ step, total, className, ...props }: Props) {
  const percent = total > 0 ? Math.min(100, Math.max(0, (step / total) * 100)) : 0

  return (
    <div
      className={`${styles.track} ${className ?? ''}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={step}
      {...props}
    >
      <div className={styles.bar}>
        <div className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
