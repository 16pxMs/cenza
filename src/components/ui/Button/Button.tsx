'use client'

import styles from './Button.module.css'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
}

export function PrimaryBtn({ children, className, ...props }: Props) {
  return (
    <button
      type="button"
      className={`${styles.btnPrimary} ${className ?? ''}`}
      {...props}
    >
      {children}
    </button>
  )
}
