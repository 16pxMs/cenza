'use client'
import styles from './TipBox.module.css'

const ICONS: Record<Variant, string> = {
  info:    '💡',
  success: '✓',
  warning: '⚠️',
}

const VARIANT_CLASS: Record<Variant, string | undefined> = {
  info:    undefined,
  success: styles.success,
  warning: styles.warning,
}

type Variant = 'info' | 'success' | 'warning'

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  variant?: Variant
  icon?: string
}

export function TipBox({ children, variant = 'info', icon, className, ...props }: Props) {
  const cx = [styles.tipBox, VARIANT_CLASS[variant], className].filter(Boolean).join(' ')

  return (
    <div className={cx} {...props}>
      <span className={styles.tipBoxIcon}>{icon ?? ICONS[variant]}</span>
      <p className={styles.tipBoxText}>{children}</p>
    </div>
  )
}
