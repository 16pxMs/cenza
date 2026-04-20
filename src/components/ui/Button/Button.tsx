'use client'

import Link from 'next/link'
import styles from './Button.module.css'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

interface LinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  children: React.ReactNode
  href: string
  size?: Props['size']
}

function sizeClass(size: Props['size']) {
  switch (size) {
    case 'sm':
      return styles.btnSizeSm
    case 'md':
      return styles.btnSizeMd
    case 'lg':
    default:
      return styles.btnSizeLg
  }
}

export function PrimaryBtn({ children, className, size = 'lg', ...props }: Props) {
  return (
    <button
      type="button"
      className={`${styles.btnBase} ${styles.btnPrimary} ${sizeClass(size)} ${className ?? ''}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function PrimaryLink({ children, href, className, size = 'lg', ...props }: LinkProps) {
  return (
    <Link
      href={href}
      className={`${styles.btnBase} ${styles.btnPrimary} ${sizeClass(size)} ${className ?? ''}`}
      {...props}
    >
      {children}
    </Link>
  )
}

export function SecondaryBtn({ children, className, size = 'md', ...props }: Props) {
  return (
    <button
      type="button"
      className={`${styles.btnBase} ${styles.btnSecondary} ${sizeClass(size)} ${className ?? ''}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function TertiaryBtn({ children, className, size = 'md', ...props }: Props) {
  return (
    <button
      type="button"
      className={`${styles.btnBase} ${styles.btnTertiary} ${sizeClass(size)} ${className ?? ''}`}
      {...props}
    >
      {children}
    </button>
  )
}
