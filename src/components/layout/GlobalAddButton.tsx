'use client'

import { useRouter } from 'next/navigation'
import { IconPlus } from '@/components/ui/Icons'

interface Props {
  returnTo: string
}

export function GlobalAddButton({ returnTo }: Props) {
  const router = useRouter()

  return (
    <button
      type="button"
      aria-label="Add expense"
      onClick={() => router.push(`/log/new?returnTo=${encodeURIComponent(returnTo)}`)}
      style={{
        position: 'fixed',
        right: 20,
        bottom: 'calc(var(--bottom-nav-height, 0px) + 20px)',
        width: 56,
        height: 56,
        borderRadius: 999,
        border: 'none',
        background: 'var(--brand-dark)',
        color: 'var(--text-inverse)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 10px 24px rgba(0,0,0,0.16)',
        cursor: 'pointer',
        zIndex: 45,
      }}
    >
      <IconPlus size={22} color="currentColor" />
    </button>
  )
}
