'use client'
import { useEffect, useRef, useState } from 'react'
import { signOut } from 'next-auth/react'
import { Clock, LogOut } from 'lucide-react'

const IDLE_MINUTES = 30   // warn after 30 min of inactivity
const WARN_SECONDS = 60   // give 60s to react before logout

const EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']

export function IdleTimeout() {
  const [showWarning, setShowWarning] = useState(false)
  const [countdown, setCountdown]     = useState(WARN_SECONDS)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const resetIdle = () => {
    if (showWarning) return // don't reset if we're already in warning state
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => {
      setShowWarning(true)
      setCountdown(WARN_SECONDS)
    }, IDLE_MINUTES * 60 * 1000)
  }

  // Start countdown when warning appears
  useEffect(() => {
    if (!showWarning) return
    warnTimer.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(warnTimer.current!)
          signOut({ callbackUrl: '/login?reason=idle' })
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => { if (warnTimer.current) clearInterval(warnTimer.current) }
  }, [showWarning])

  // Register activity listeners
  useEffect(() => {
    EVENTS.forEach(e => window.addEventListener(e, resetIdle, { passive: true }))
    resetIdle() // start the first timer
    return () => {
      EVENTS.forEach(e => window.removeEventListener(e, resetIdle))
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stayActive = () => {
    setShowWarning(false)
    if (warnTimer.current) clearInterval(warnTimer.current)
    resetIdle()
  }

  if (!showWarning) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <Clock className="h-7 w-7 text-amber-600" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">Sessão inativa</h3>
          <p className="text-sm text-gray-500 mt-1">
            Por segurança, você será desconectado em
          </p>
          <p className="text-4xl font-bold text-amber-600 mt-2 tabular-nums">{countdown}s</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <LogOut className="h-4 w-4" /> Sair agora
          </button>
          <button
            onClick={stayActive}
            className="flex-1 rounded-xl bg-[#1e3a5f] py-2.5 text-sm font-semibold text-white hover:bg-[#162d4a] transition-colors"
          >
            Continuar
          </button>
        </div>
        <p className="text-[10px] text-gray-400">
          Proteção de dados clínicos sensíveis (LGPD)
        </p>
      </div>
    </div>
  )
}
