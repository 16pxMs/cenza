// ─────────────────────────────────────────────────────────────
// Sheet — Bottom drawer on mobile, centered modal on desktop
// Controlled via open prop. Backdrop click closes.
// Animations: slide-up (mobile), fade+scale (desktop)
// ─────────────────────────────────────────────────────────────
'use client'
import { useEffect } from 'react'
import './Sheet.css'
import { IconChevronX } from '@/components/ui/Icons'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  isDesktop?: boolean
}

export function Sheet({ open, onClose, title, children, isDesktop }: Props) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className={`sheet-backdrop${isDesktop ? ' sheet-backdrop--desktop' : ''}`}>
      <div className="sheet-overlay" onClick={onClose} />
      <div className={`sheet-panel${isDesktop ? ' sheet-panel--desktop' : ''}`}>
        {!isDesktop && (
          <div className="sheet-handle">
            <div className="sheet-handle__bar" />
          </div>
        )}
        <div className={`sheet-header${isDesktop ? ' sheet-header--desktop' : ''}`}>
          <h2 className="sheet-title">{title}</h2>
          <button className="sheet-close" onClick={onClose}>
            <IconChevronX size={16} color="var(--text-2)" />
          </button>
        </div>
        <div className={`sheet-body${isDesktop ? ' sheet-body--desktop' : ''}`}>
          {children}
        </div>
      </div>
    </div>
  )
}
