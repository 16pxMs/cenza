'use client'
import { createContext, useContext, useState, useCallback, useRef } from 'react'

export type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id:      number
  message: string
  type:    ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counter = useRef(0)

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++counter.current
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastStack toasts={toasts} />
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)

// ── Toast stack UI ─────────────────────────────────────────────
const ICONS: Record<ToastType, string> = {
  success: '✓',
  error:   '✕',
  info:    'i',
}

const COLORS: Record<ToastType, { bg: string; icon: string; border: string }> = {
  success: { bg: '#F0FDF4', icon: '#15803D', border: '#BBF7D0' },
  error:   { bg: '#FEF2F2', icon: '#DC2626', border: '#FECACA' },
  info:    { bg: '#F0F4FF', icon: '#3B5BDB', border: '#C5D0FC' },
}

function ToastStack({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null

  return (
    <>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(12px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
      <div style={{
        position: 'fixed',
        bottom: 88,   /* above BottomNav */
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'center',
        pointerEvents: 'none',
        width: '100%',
        padding: '0 16px',
        boxSizing: 'border-box',
      }}>
        {toasts.map(t => {
          const c = COLORS[t.type]
          return (
            <div
              key={t.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: c.bg,
                border: `1px solid ${c.border}`,
                borderRadius: 12,
                padding: '11px 16px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                animation: 'toastIn 0.2s ease',
                maxWidth: 360,
                width: '100%',
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: c.icon,
                color: '#fff',
                fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {ICONS[t.type]}
              </div>
              <span style={{ fontSize: 14, fontWeight: 500, color: '#101828', lineHeight: 1.4 }}>
                {t.message}
              </span>
            </div>
          )
        })}
      </div>
    </>
  )
}
