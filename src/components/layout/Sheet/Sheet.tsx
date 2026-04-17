// ─────────────────────────────────────────────────────────────
// Sheet — Bottom drawer on mobile, centered modal on desktop
// Controlled via open prop. Backdrop click closes.
// Animations: slide-up (mobile), fade+scale (desktop)
// ─────────────────────────────────────────────────────────────
'use client'
import { useEffect } from 'react'
import styles from './Sheet.module.css'
import { IconChevronX } from '@/components/ui/Icons'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  isDesktop?: boolean
  hideHeader?: boolean
  bodyPadding?: 'default' | 'none'
  variant?: 'default' | 'bottom'
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  hideHeader = false,
  bodyPadding = 'default',
  variant = 'default',
}: Props) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className={`${styles.backdrop} ${variant === 'bottom' ? styles.backdropBottom : ''}`}>
      <div className={styles.overlay} onClick={onClose} />
      <div className={`${styles.panel} ${variant === 'bottom' ? styles.panelBottom : ''}`}>
        <div className={`${styles.handle} ${variant === 'bottom' ? styles.handleBottom : ''}`}>
          <div className={styles.handleBar} />
        </div>
        {!hideHeader && (
          <div className={styles.header}>
            <h2 className={styles.title}>{title}</h2>
            <button type="button" className={styles.close} onClick={onClose}>
              <IconChevronX size={16} color="var(--text-2)" />
            </button>
          </div>
        )}
        <div className={`${styles.body} ${bodyPadding === 'none' ? styles.bodyNoPad : ''}`}>
          {children}
        </div>
      </div>
    </div>
  )
}
