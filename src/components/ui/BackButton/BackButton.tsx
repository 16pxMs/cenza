'use client'
import { IconBack } from '@/components/ui/Icons'
import styles from './BackButton.module.css'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export function BackButton({ className, children, ...props }: Props) {
  return (
    <button
      type="button"
      className={`${styles.backBtn} ${className ?? ''}`}
      {...props}
    >
      <IconBack size={18} />
      {children ? <span>{children}</span> : null}
    </button>
  )
}
