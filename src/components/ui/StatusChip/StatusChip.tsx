import styles from './StatusChip.module.css'

type StatusChipVariant = 'neutral' | 'success'

interface Props {
  label: string
  variant?: StatusChipVariant
  className?: string
}

export function StatusChip({ label, variant = 'neutral', className }: Props) {
  return (
    <span
      className={[styles.chip, styles[variant], className ?? ''].filter(Boolean).join(' ')}
    >
      {label}
    </span>
  )
}
