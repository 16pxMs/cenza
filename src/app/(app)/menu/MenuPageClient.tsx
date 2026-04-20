'use client'

import { useRouter } from 'next/navigation'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { IconCalendar, IconGoals, IconRecap, IconSettings } from '@/components/ui/Icons'

const DESTINATIONS = [
  { href: '/history/debt', label: 'Debts', Icon: IconCalendar },
  { href: '/history', label: 'Recap', Icon: IconRecap },
  { href: '/goals', label: 'Goals', Icon: IconGoals },
  { href: '/settings', label: 'Settings', Icon: IconSettings },
] as const

export default function MenuPageClient() {
  const router = useRouter()
  const { isDesktop } = useBreakpoint()

  const content = (
    <div
      style={{
        width: '100%',
        maxWidth: 760,
        margin: '0 auto',
        padding: isDesktop ? 'var(--space-xl) var(--space-page-desktop)' : 'var(--space-lg) var(--space-page-mobile) 160px',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-lg)',
        }}
      >
        {DESTINATIONS.map((item) => (
          <button
            key={item.href}
            type="button"
            onClick={() => router.push(item.href)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-sm)',
              padding: 'var(--space-lg) var(--space-md)',
              borderRadius: 'var(--radius-lg)',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-full)',
                background: 'var(--grey-100)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <item.Icon size={20} color="var(--text-1)" />
            </div>
            <span
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                color: 'var(--text-1)',
              }}
            >
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )

  if (isDesktop) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <SideNav />
        <main style={{ flex: 1, maxWidth: 760, margin: '0 auto' }}>{content}</main>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <main>{content}</main>
      <BottomNav />
    </div>
  )
}
