'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Bell, X, AlertTriangle, Clock, CalendarCheck, ExternalLink } from 'lucide-react'

interface Alert {
  id: string
  type: 'PRM_UNRESOLVED' | 'REVIEW_OVERDUE' | 'REVIEW_TODAY'
  severity: 'urgent' | 'high' | 'warning' | 'info'
  title: string
  description: string
  patientName: string
  patientId: string
  href: string
}

const SEVERITY_STYLES: Record<string, { icon: string; row: string }> = {
  urgent: {
    icon: 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300',
    row: 'border-l-2 border-red-400',
  },
  high: {
    icon: 'text-orange-600 bg-orange-100 dark:bg-orange-900 dark:text-orange-300',
    row: 'border-l-2 border-orange-400',
  },
  warning: {
    icon: 'text-amber-600 bg-amber-100 dark:bg-amber-900 dark:text-amber-300',
    row: 'border-l-2 border-amber-400',
  },
  info: {
    icon: 'text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-300',
    row: 'border-l-2 border-blue-400',
  },
}

const TYPE_ICONS: Record<string, React.FC<{ className?: string }>> = {
  PRM_UNRESOLVED: AlertTriangle,
  REVIEW_OVERDUE: Clock,
  REVIEW_TODAY: CalendarCheck,
}

const GROUP_LABELS: Record<string, string> = {
  PRM_UNRESOLVED: '⚠️ PRMs não resolvidos',
  REVIEW_OVERDUE: '🕐 Revisões atrasadas',
  REVIEW_TODAY: '📅 Revisões de hoje',
}

const POLL_INTERVAL = 60_000
const DISMISSED_KEY = 'prm-dismissed-alerts'

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function saveDismissed(set: Set<string>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set].slice(-200)))
  } catch {}
}

export function AlertBadge() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDismissed(getDismissed())
  }, [])

  useEffect(() => {
    const load = () => {
      fetch('/api/notifications')
        .then((r) => (r.ok ? r.json() : { alerts: [] }))
        .then((data) => setAlerts(data.alerts ?? []))
        .catch(() => {})
    }
    load()
    const interval = setInterval(load, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const visible = alerts.filter((a) => !dismissed.has(a.id))
  const urgentCount = visible.filter((a) => a.severity === 'urgent' || a.severity === 'high').length

  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev)
      next.add(id)
      saveDismissed(next)
      return next
    })
  }

  const dismissAll = () => {
    setDismissed((prev) => {
      const next = new Set(prev)
      visible.forEach((a) => next.add(a.id))
      saveDismissed(next)
      return next
    })
    setOpen(false)
  }

  // Group by type
  const TYPE_ORDER = ['PRM_UNRESOLVED', 'REVIEW_OVERDUE', 'REVIEW_TODAY']
  const groups: Record<string, Alert[]> = {}
  for (const a of visible) {
    if (!groups[a.type]) groups[a.type] = []
    groups[a.type].push(a)
  }

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`relative flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
          open
            ? 'border-[#1e3a5f] bg-[#1e3a5f]/10 text-[#1e3a5f] dark:border-blue-400 dark:text-blue-400'
            : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
        }`}
        aria-label="Alertas"
      >
        <Bell className="h-4 w-4" />
        {visible.length > 0 && (
          <span
            className={`absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white ring-1 ring-white dark:ring-gray-900 ${
              urgentCount > 0 ? 'bg-red-500 animate-pulse' : 'bg-amber-500'
            }`}
          >
            {visible.length > 9 ? '9+' : visible.length}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-4 py-3 bg-white dark:bg-gray-900">
            <div className="flex items-center gap-2">
              <Bell className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Alertas clínicos
              </p>
              {visible.length > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white ${
                  urgentCount > 0 ? 'bg-red-500' : 'bg-amber-500'
                }`}>
                  {visible.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {visible.length > 0 && (
                <button
                  onClick={dismissAll}
                  className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors whitespace-nowrap"
                >
                  Limpar todos
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="max-h-[420px] overflow-y-auto">
            {visible.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900 mb-3">
                  <Bell className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Tudo em dia!</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Nenhum alerta pendente no momento</p>
              </div>
            ) : (
              <div>
                {TYPE_ORDER.filter((t) => groups[t]?.length).map((type) => {
                  const items = groups[type]
                  const Icon = TYPE_ICONS[type] ?? Bell
                  return (
                    <div key={type}>
                      <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/60 sticky top-0">
                        {GROUP_LABELS[type]} ({items.length})
                      </p>
                      {items.map((alert) => {
                        const style = SEVERITY_STYLES[alert.severity]
                        return (
                          <div
                            key={alert.id}
                            className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors group ${style.row}`}
                          >
                            <div className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${style.icon}`}>
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-snug">
                                {alert.title}
                              </p>
                              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                {alert.description}
                              </p>
                              <div className="flex items-center justify-between mt-1.5">
                                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 truncate max-w-[130px]">
                                  👤 {alert.patientName}
                                </span>
                                <Link
                                  href={alert.href}
                                  onClick={() => setOpen(false)}
                                  className="flex items-center gap-0.5 text-[10px] font-semibold text-[#1e3a5f] dark:text-blue-400 hover:underline shrink-0"
                                >
                                  Ver <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
                                </Link>
                              </div>
                            </div>
                            <button
                              onClick={() => dismiss(alert.id)}
                              className="mt-0.5 flex-shrink-0 text-gray-200 dark:text-gray-700 hover:text-gray-400 dark:hover:text-gray-500 transition-colors opacity-0 group-hover:opacity-100"
                              title="Dispensar"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {visible.length > 0 && (
            <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-2.5 bg-gray-50/50 dark:bg-gray-800/30">
              <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center">
                Alertas atualizados automaticamente a cada minuto
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
