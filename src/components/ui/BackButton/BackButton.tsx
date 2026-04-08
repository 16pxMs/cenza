'use client'
import styles from './BackButton.module.css'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export function BackButton({ className, children, ...props }: Props) {
  return (
    <button
      type="button"
      className={`${styles.backBtn} ${className ?? ''}`}
      {...props}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {children ? <span>{children}</span> : null}
    </button>
  )
}
