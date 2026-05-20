'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Bell, AlertTriangle } from 'lucide-react'

interface AlertCounts {
  urgent: number
  high: number
  total: number
}

export function AlertBadge() {
  const [counts, setCounts] = useState<AlertCounts | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // Initial fetch
    fetch('/api/alerts/count')
      .then((r) => r.json())
      .then((data: AlertCounts) => setCounts(data))
      .catch(() => {})

    // Poll every 2 minutes
    const interval = setInterval(() => {
      fetch('/api/alerts/count')
        .then((r) => r.json())
        .then((data: AlertCounts) => setCounts(data))
        .catch(() => {})
    }, 120_000)

    return () => clearInterval(interval)
  }, [])

  const hasAlerts = counts && counts.total > 0

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
        aria-label="Alertas"
      >
        <Bell className="h-4 w-4" />
        {hasAlerts && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-gray-900">
            {counts.total > 9 ? '9+' : counts.total}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Alertas clínicos</h3>
              {hasAlerts && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                  {counts.total} pendente{counts.total > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="p-3 space-y-2">
              {!counts || counts.total === 0 ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 mb-2">
                    <Bell className="h-5 w-5 text-green-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Sem alertas pendentes</p>
                  <p className="text-xs text-gray-400 mt-0.5">Todos os PRMs críticos estão resolvidos</p>
                </div>
              ) : (
                <>
                  {counts.urgent > 0 && (
                    <div className="flex items-center gap-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 px-3 py-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900 flex-shrink-0">
                        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                          {counts.urgent} PRM{counts.urgent > 1 ? 's' : ''} urgente{counts.urgent > 1 ? 's' : ''}
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400">Intervenção imediata necessária</p>
                      </div>
                    </div>
                  )}
                  {counts.high > 0 && (
                    <div className="flex items-center gap-3 rounded-lg bg-orange-50 dark:bg-orange-950 border border-orange-100 dark:border-orange-900 px-3 py-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900 flex-shrink-0">
                        <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">
                          {counts.high} PRM{counts.high > 1 ? 's' : ''} de alto risco
                        </p>
                        <p className="text-xs text-orange-600 dark:text-orange-400">Monitoramento prioritário</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="border-t border-gray-100 dark:border-gray-700 p-3">
              <Link
                href="/patients?filter=urgent"
                onClick={() => setOpen(false)}
                className="block w-full rounded-lg bg-[#1e3a5f] px-3 py-2 text-center text-sm font-medium text-white hover:bg-[#162d4a] transition-colors"
              >
                Ver pacientes com PRMs críticos
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
