'use client'
import './Card.css'

interface CardProps {
  children: React.ReactNode
  padded?: boolean
  clickable?: boolean
  selected?: boolean
  style?: React.CSSProperties
  onClick?: () => void
}

export function Card({ children, padded = true, clickable, selected, style, onClick }: CardProps) {
  return (
    <div
      className={[
        'card',
        padded ? 'card--padded' : '',
        clickable ? 'card--clickable' : '',
        selected ? 'card--selected' : '',
      ].filter(Boolean).join(' ')}
      style={style}
      onClick={onClick}
    >
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
    <div className="section-header">
      <p className="section-header__title">{title}</p>
      {action && <button className="section-header__action" onClick={onAction}>{action}</button>}
    </div>
  )
}
