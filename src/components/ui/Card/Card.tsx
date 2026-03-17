'use client'
import styles from './Card.module.css'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  padded?: boolean
  clickable?: boolean
  selected?: boolean
}

export function Card({ children, padded = true, clickable, selected, className, ...props }: CardProps) {
  const cx = [
    styles.card,
    padded    ? styles.cardPadded    : '',
    clickable ? styles.cardClickable : '',
    selected  ? styles.cardSelected  : '',
    className ?? '',
  ].filter(Boolean).join(' ')

  return (
    <div className={cx} {...props}>
      {children}
    </div>
  )
}

interface SectionHeaderProps {
  title: string
  action?: string
  onAction?: () => void
}

export function SectionHeader({ title, action, onAction }: SectionHeaderProps) {
  return (
    <div className={styles.sectionHeader}>
      <p className={styles.sectionHeaderTitle}>{title}</p>
      {action && (
        <button type="button" className={styles.sectionHeaderAction} onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  )
}
