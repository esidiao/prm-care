'use client'
import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!mounted) {
    return <div className="h-8 w-8 rounded-lg border border-gray-200 bg-gray-50" />
  }

  const options = [
    { value: 'light', label: 'Claro', icon: Sun },
    { value: 'dark', label: 'Escuro', icon: Moon },
    { value: 'system', label: 'Sistema', icon: Monitor },
  ]

  const CurrentIcon = resolvedTheme === 'dark' ? Moon : Sun

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Alternar tema"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
      >
        <CurrentIcon className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-36 rounded-xl border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-700 dark:bg-gray-800">
          {options.map(opt => {
            const Icon = opt.icon
            const active = theme === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => { setTheme(opt.value); setOpen(false) }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                {opt.label}
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-500" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
