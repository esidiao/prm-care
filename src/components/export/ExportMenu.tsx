'use client'
import { useState, useRef, useEffect } from 'react'
import { Download, FileText, Users, ChevronDown, Loader2 } from 'lucide-react'

interface ExportMenuProps {
  /** If provided, PRMs export will be filtered to this patient */
  patientId?: string
  /** Which exports to show: 'all' | 'patients-only' | 'prms-only' */
  mode?: 'all' | 'patients-only' | 'prms-only'
  /** Visual variant */
  variant?: 'button' | 'icon'
}

type ExportStatus = 'idle' | 'loading' | 'done' | 'error'

export function ExportMenu({ patientId, mode = 'all', variant = 'button' }: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<Record<string, ExportStatus>>({})
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function triggerDownload(url: string, key: string) {
    setStatus(s => ({ ...s, [key]: 'loading' }))
    setOpen(false)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename="?([^";\n]+)"?/)
      const filename = match?.[1] ?? `export_${key}.csv`
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = filename
      a.click()
      URL.revokeObjectURL(objectUrl)
      setStatus(s => ({ ...s, [key]: 'done' }))
      setTimeout(() => setStatus(s => ({ ...s, [key]: 'idle' })), 3000)
    } catch {
      setStatus(s => ({ ...s, [key]: 'error' }))
      setTimeout(() => setStatus(s => ({ ...s, [key]: 'idle' })), 4000)
    }
  }

  const options: { key: string; label: string; sublabel: string; icon: React.ReactNode; url: string }[] = []

  if (mode !== 'prms-only') {
    options.push({
      key: 'patients',
      label: 'Lista de pacientes',
      sublabel: 'Nome, idade, diagnósticos, PRMs recentes',
      icon: <Users className="h-4 w-4 text-blue-600" />,
      url: '/api/export/patients',
    })
  }

  if (mode !== 'patients-only') {
    options.push({
      key: 'prms',
      label: patientId ? 'PRMs deste paciente' : 'Todos os PRMs',
      sublabel: 'Título, categoria, risco, conduta, resolução',
      icon: <FileText className="h-4 w-4 text-emerald-600" />,
      url: patientId ? `/api/export/prms?patientId=${patientId}` : '/api/export/prms',
    })
  }

  const anyLoading = Object.values(status).some(s => s === 'loading')

  if (variant === 'icon') {
    return (
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(o => !o)}
          title="Exportar dados"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors shadow-sm"
          disabled={anyLoading}
        >
          {anyLoading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Download className="h-4 w-4" />}
        </button>
        {open && <DropdownPanel options={options} status={status} onSelect={triggerDownload} />}
      </div>
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={anyLoading}
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-600 shadow-sm hover:border-gray-300 hover:text-gray-800 transition-colors disabled:opacity-60"
      >
        {anyLoading
          ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          : <Download className="h-4 w-4" />}
        Exportar
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <DropdownPanel options={options} status={status} onSelect={triggerDownload} />}
    </div>
  )
}

function DropdownPanel({
  options,
  status,
  onSelect,
}: {
  options: { key: string; label: string; sublabel: string; icon: React.ReactNode; url: string }[]
  status: Record<string, ExportStatus>
  onSelect: (url: string, key: string) => void
}) {
  return (
    <div className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-gray-200 bg-white shadow-xl">
      <div className="border-b border-gray-100 px-4 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Exportar como CSV</p>
      </div>
      <div className="p-1.5 space-y-0.5">
        {options.map(opt => {
          const s = status[opt.key] ?? 'idle'
          return (
            <button
              key={opt.key}
              onClick={() => onSelect(opt.url, opt.key)}
              disabled={s === 'loading'}
              className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-gray-100">
                {s === 'loading' ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" /> : opt.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800">{opt.label}</p>
                <p className="text-xs text-gray-400 leading-tight mt-0.5">{opt.sublabel}</p>
              </div>
              {s === 'done' && <span className="text-[10px] font-medium text-emerald-600 mt-1 flex-shrink-0">✓ baixado</span>}
              {s === 'error' && <span className="text-[10px] font-medium text-red-500 mt-1 flex-shrink-0">erro</span>}
            </button>
          )
        })}
      </div>
      <div className="border-t border-gray-100 px-4 py-2 text-[10px] text-gray-400">
        Arquivos CSV compatíveis com Excel, Google Planilhas e LibreOffice
      </div>
    </div>
  )
}
