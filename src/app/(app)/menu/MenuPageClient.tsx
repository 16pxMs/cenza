'use client'

import { ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { IconGoals, IconSettings, IconSpend, IconTarget } from '@/components/ui/Icons'

const MENU_SECTIONS = [
  {
    title: 'Money',
    items: [
      { href: '/history/debt', label: 'Things to pay', Icon: IconSpend },
      { href: '/history', label: 'Recap', Icon: IconSpend },
    ],
  },
  {
    title: 'Planning',
    items: [
      { href: '/goals', label: 'Goals', Icon: IconGoals },
      { href: '/targets', label: 'Targets', Icon: IconTarget },
    ],
  },
  {
    title: 'System',
    items: [
      { href: '/settings', label: 'Settings', Icon: IconSettings },
    ],
  },
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
        padding: '20px 16px 96px',
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <p
          style={{
            margin: '0 0 4px',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-muted)',
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
          }}
        >
          Navigation
        </p>
        <h1
          style={{
            margin: 0,
            fontSize: 'clamp(28px, 5vw, 36px)',
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            color: 'var(--text-1)',
          }}
        >
          Menu
        </h1>
      </div>

      <div style={{ display: 'grid', gap: 20 }}>
        {MENU_SECTIONS.map((section) => (
          <section key={section.title}>
            <p
              style={{
                margin: '0 0 10px',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-muted)',
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
              }}
            >
              {section.title}
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              {section.items.map((item) => (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => router.push(item.href)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    padding: '16px',
                    borderRadius: 16,
                    border: '1px solid var(--border)',
                    background: 'var(--white)',
                    color: 'var(--text-1)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <item.Icon size={18} color="var(--text-2)" />
                  <span style={{ flex: 1, fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)' }}>
                    {item.label}
                  </span>
                  <ChevronRight size={16} color="var(--text-muted)" strokeWidth={2.2} />
                </button>
              ))}
            </div>
          </section>
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
    <div style={{ minHeight: '100vh', paddingBottom: 88 }}>
      <main>{content}</main>
      <BottomNav />
    </div>
  )
}
