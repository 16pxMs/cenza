'use client'

import styles from './SingleSelectChip.module.css'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  selected?: boolean
  fill?: boolean
}

export function SingleSelectChip({
  label,
  selected = false,
  fill = false,
  className,
  type,
  ...props
}: Props) {
  return (
    <button
      type={type ?? 'button'}
      className={[
        styles.chip,
        selected ? styles.chipSelected : '',
        fill ? styles.chipFill : '',
        className ?? '',
      ].filter(Boolean).join(' ')}
      {...props}
    >
      {label}
    </button>
  )
}
