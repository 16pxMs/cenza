import type { ReactNode } from 'react'
import styles from './SettingsRow.module.css'

interface SettingsRowProps {
  label: ReactNode
  value?: ReactNode
  supportingText?: ReactNode
  onClick?: () => void
  destructive?: boolean
  isLast?: boolean
  valueTone?: 'muted' | 'default' | 'action'
  surface?: 'grouped' | 'plain'
}

export function SettingsRow({
  label,
  value,
  supportingText,
  onClick,
  destructive = false,
  isLast = false,
  valueTone = onClick ? 'action' : 'muted',
  surface = 'grouped',
}: SettingsRowProps) {
  const Component = onClick ? 'button' : 'div'
  const valueClassName = [
    styles.value,
    valueTone === 'action' ? styles.valueAction : '',
    valueTone === 'default' ? styles.valueDefault : '',
  ].filter(Boolean).join(' ')

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={[
        styles.row,
        surface === 'plain' ? styles.plain : '',
        onClick ? styles.button : styles.static,
        isLast ? styles.last : '',
      ].filter(Boolean).join(' ')}
    >
      <span className={styles.content}>
        <span className={`${styles.label} ${destructive ? styles.labelDestructive : ''}`}>
          {label}
        </span>
        {supportingText ? (
          <span className={styles.supportingText}>{supportingText}</span>
        ) : null}
      </span>
      {value != null ? <span className={valueClassName}>{value}</span> : null}
    </Component>
  )
}
