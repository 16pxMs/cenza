'use client'
// ─────────────────────────────────────────────────────────────
// SessionTimeout — Inactivity guard for all authenticated pages
//
// Flow:
//   1. Any user interaction resets the idle timer
//   2. After IDLE_MS of inactivity → show warning modal
//   3. After WARN_MS on the warning → sign out + redirect /login
//   4. Checks on tab focus (user returns to an idle tab)
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { clearPinVerified } from '@/lib/actions/pin'

const IDLE_MS  = 15 * 60 * 1000  // 15 min inactivity → show warning
const WARN_MS  = 60 * 1000        // 60 sec on warning → sign out
const LS_KEY   = 'cenza:last-active'

const ACTIVITY_EVENTS = ['click', 'keydown', 'mousemove', 'touchstart', 'scroll'] as const

export function SessionTimeout() {
  const supabase       = createClient()
  const idleTimer      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnTimer      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [warning, setWarning]       = useState(false)
  const [countdown, setCountdown]   = useState(WARN_MS / 1000)
  const countdownRef   = useRef<ReturnType<typeof setInterval> | null>(null)

  const signOut = useCallback(async () => {
    clearTimeout(idleTimer.current ?? undefined)
    clearTimeout(warnTimer.current ?? undefined)
    clearInterval(countdownRef.current ?? undefined)
    await clearPinVerified()          // clear PIN before session ends
    await supabase.auth.signOut()
    window.location.href = '/login'
  }, [supabase])

  const startWarnCountdown = useCallback(() => {
    setWarning(true)
    setCountdown(WARN_MS / 1000)

    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current ?? undefined)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    warnTimer.current = setTimeout(() => {
      signOut()
    }, WARN_MS)
  }, [signOut])

  const resetIdle = useCallback(() => {
    // Persist last-active so the tab-focus check works across tabs
    localStorage.setItem(LS_KEY, Date.now().toString())

    // Clear any existing timers
    clearTimeout(idleTimer.current ?? undefined)
    clearTimeout(warnTimer.current ?? undefined)
    clearInterval(countdownRef.current ?? undefined)

    if (warning) {
      setWarning(false)
      setCountdown(WARN_MS / 1000)
    }

    idleTimer.current = setTimeout(startWarnCountdown, IDLE_MS)
  }, [warning, startWarnCountdown])

  // Attach activity listeners
  useEffect(() => {
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, resetIdle, { passive: true }))
    resetIdle() // start the timer on mount

    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, resetIdle))
      clearTimeout(idleTimer.current ?? undefined)
      clearTimeout(warnTimer.current ?? undefined)
      clearInterval(countdownRef.current ?? undefined)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Check on tab focus — catches user returning to a long-idle tab
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return
      const last = parseInt(localStorage.getItem(LS_KEY) ?? '0', 10)
      const elapsed = Date.now() - last
      if (elapsed >= IDLE_MS + WARN_MS) {
        // Idle + warn period already elapsed — sign out immediately
        signOut()
      } else if (elapsed >= IDLE_MS && !warning) {
        // Idle period elapsed but warn not shown yet — show it
        startWarnCountdown()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [warning, signOut, startWarnCountdown])

  if (!warning) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 24px',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 20,
        padding: '32px 24px',
        maxWidth: 340,
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
      }}>
        {/* Icon */}
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: '#FEF3C7',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
          fontSize: 26,
        }}>
          ⏱
        </div>

        <h2 style={{
          margin: '0 0 8px',
          fontSize: 20, fontWeight: 700,
          color: '#101828', letterSpacing: -0.3,
        }}>
          Still there?
        </h2>

        <p style={{
          margin: '0 0 6px',
          fontSize: 14, color: '#475467', lineHeight: 1.6,
        }}>
          You've been inactive for a while.
        </p>

        <p style={{
          margin: '0 0 24px',
          fontSize: 14, color: '#667085',
        }}>
          Signing out in <strong style={{ color: '#101828' }}>{countdown}s</strong>
        </p>

        <button
          onClick={resetIdle}
          style={{
            width: '100%', height: 48, borderRadius: 14,
            background: '#5C3489', border: 'none',
            color: '#fff', fontSize: 15, fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Keep me signed in
        </button>

        <button
          onClick={signOut}
          style={{
            width: '100%', marginTop: 10, padding: '10px 0',
            background: 'none', border: 'none',
            fontSize: 14, color: '#98A2B3', cursor: 'pointer',
          }}
        >
          Sign out now
        </button>
      </div>
    </div>
  )
}
