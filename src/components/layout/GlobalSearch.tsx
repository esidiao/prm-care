'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Users, FileText, Pill, Loader2, X, AlertTriangle, AlertCircle, Info } from 'lucide-react'

interface PatientResult {
  id: string
  name: string | null
  code: string
  age: number | null
  sex: string | null
  lastAnalysis: { urgentPRMs: number; highRiskPRMs: number; totalPRMs: number } | null
}

interface PRMResult {
  id: string
  title: string
  riskLevel: string
  category: string
  analysisId: string
  analysis: { patient: { name: string | null; code: string } }
}

interface MedResult {
  id: string
  activeIngredient: string
  tradeName: string | null
  dose: number | null
  doseUnit: string | null
  patientId: string
  patient: { name: string | null; code: string }
}

interface SearchResults {
  patients: PatientResult[]
  prms: PRMResult[]
  medications: MedResult[]
}

const RISK_ICONS: Record<string, React.ReactNode> = {
  URGENT: <AlertTriangle className="h-3 w-3 text-red-500" />,
  HIGH: <AlertCircle className="h-3 w-3 text-orange-500" />,
  MODERATE: <Info className="h-3 w-3 text-yellow-500" />,
  LOW: <Info className="h-3 w-3 text-blue-400" />,
}

const RISK_LABELS: Record<string, string> = {
  URGENT: 'Urgente',
  HIGH: 'Alto',
  MODERATE: 'Moderado',
  LOW: 'Baixo',
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ── Results dropdown (shared between desktop & mobile modal) ──────────────────

function SearchDropdown({
  query,
  results,
  loading,
  onNavigate,
  onClear,
  inputRef,
  onFocus,
  mobile = false,
}: {
  query: string
  results: SearchResults | null
  loading: boolean
  onNavigate: (path: string) => void
  onClear: () => void
  inputRef: React.RefObject<HTMLInputElement>
  onFocus?: () => void
  mobile?: boolean
}) {
  const hasResults = results && (
    results.patients.length > 0 || results.prms.length > 0 || results.medications.length > 0
  )
  const showDropdown = query.length >= 2

  return (
    <div className={mobile ? 'flex flex-col h-full' : 'relative'}>
      {/* Input */}
      <div className={`relative flex items-center ${mobile ? 'shrink-0' : ''}`}>
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onClear !== undefined && void 0} /* handled by parent */
          onFocus={onFocus}
          placeholder="Buscar paciente, PRM, medicamento…"
          className={`${mobile ? 'h-11 text-base' : 'h-9 text-sm'} w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-8 text-gray-700 placeholder:text-gray-400 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-500 dark:focus:border-blue-500 dark:focus:bg-gray-800 dark:focus:ring-blue-500/20`}
          autoFocus={mobile}
        />
        {loading && (
          <Loader2 className="pointer-events-none absolute right-3 h-3.5 w-3.5 animate-spin text-gray-400" />
        )}
        {!loading && query && (
          <button
            onClick={onClear}
            className="absolute right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-gray-300 transition-colors"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        )}
        {!mobile && !loading && !query && (
          <kbd className="pointer-events-none absolute right-2.5 hidden rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 lg:block">
            ⌘K
          </kbd>
        )}
      </div>

      {/* Results */}
      {showDropdown && (
        <div
          className={
            mobile
              ? 'mt-3 flex-1 overflow-y-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
              : 'absolute left-0 right-0 top-full z-50 mt-1.5 max-h-[480px] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800'
          }
        >
          {!hasResults ? (
            <div className="flex flex-col items-center py-10 text-center">
              <Search className="h-8 w-8 text-gray-200 dark:text-gray-600 mb-2" />
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Nenhum resultado para <strong>&quot;{query}&quot;</strong>
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {results!.patients.length > 0 && (
                <section className="p-2">
                  <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                    <Users className="h-3 w-3" /> Pacientes
                  </p>
                  {results!.patients.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onNavigate(`/patients/${p.id}`)}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    >
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#1e3a5f]/10 text-xs font-bold text-[#1e3a5f]">
                        {(p.name || p.code).slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{p.name || p.code}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {p.code}{p.age ? ` · ${p.age} anos` : ''}{p.sex === 'MALE' ? ' · M' : p.sex === 'FEMALE' ? ' · F' : ''}
                        </p>
                      </div>
                      {p.lastAnalysis?.urgentPRMs ? (
                        <span className="flex-shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                          {p.lastAnalysis.urgentPRMs} urg.
                        </span>
                      ) : p.lastAnalysis?.highRiskPRMs ? (
                        <span className="flex-shrink-0 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">
                          {p.lastAnalysis.highRiskPRMs} alto
                        </span>
                      ) : null}
                    </button>
                  ))}
                </section>
              )}

              {results!.prms.length > 0 && (
                <section className="p-2">
                  <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                    <FileText className="h-3 w-3" /> PRMs em aberto
                  </p>
                  {results!.prms.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => onNavigate(`/analysis/${f.analysisId}`)}
                      className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    >
                      <span className="mt-0.5 flex-shrink-0">{RISK_ICONS[f.riskLevel]}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{f.title}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                          {RISK_LABELS[f.riskLevel]} · {f.analysis.patient.name || f.analysis.patient.code}
                        </p>
                      </div>
                    </button>
                  ))}
                </section>
              )}

              {results!.medications.length > 0 && (
                <section className="p-2">
                  <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                    <Pill className="h-3 w-3" /> Medicamentos
                  </p>
                  {results!.medications.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => onNavigate(`/patients/${m.patientId}`)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    >
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-900/30">
                        <Pill className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                          {m.activeIngredient}
                          {m.tradeName ? <span className="ml-1 text-gray-400">({m.tradeName})</span> : null}
                          {m.dose ? <span className="ml-1 text-gray-500 text-xs">{m.dose}{m.doseUnit}</span> : null}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{m.patient.name || m.patient.code}</p>
                      </div>
                    </button>
                  ))}
                </section>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export function GlobalSearch({ mobileIconOnly = false }: { mobileIconOnly?: boolean }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)          // desktop dropdown
  const [modalOpen, setModalOpen] = useState(false) // mobile full-screen
  const debouncedQuery = useDebounce(query, 300)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch
  useEffect(() => {
    if (debouncedQuery.length < 2) { setResults(null); setOpen(false); return }
    setLoading(true)
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then((data: SearchResults) => { setResults(data); setOpen(true) })
      .catch(() => setResults(null))
      .finally(() => setLoading(false))
  }, [debouncedQuery])

  // Close on outside click (desktop)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setModalOpen(true)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape') { setOpen(false); setModalOpen(false); inputRef.current?.blur() }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Prevent body scroll when modal open
  useEffect(() => {
    if (modalOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [modalOpen])

  const navigate = useCallback((path: string) => {
    setOpen(false); setModalOpen(false); setQuery(''); router.push(path)
  }, [router])

  const clear = useCallback(() => { setQuery(''); setResults(null); setOpen(false) }, [])

  // Mobile icon-only button
  if (mobileIconOnly) {
    return (
      <>
        <button
          onClick={() => setModalOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
          aria-label="Buscar"
        >
          <Search className="h-4 w-4" />
        </button>

        {/* Mobile modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-900 p-4 sm:hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Buscar</h2>
              <button
                onClick={() => { setModalOpen(false); setQuery(''); setResults(null) }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="relative flex items-center mb-3">
              <Search className="pointer-events-none absolute left-3 h-4 w-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar paciente, PRM, medicamento…"
                autoFocus
                className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-9 text-base text-gray-700 placeholder:text-gray-400 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-500"
              />
              {loading && <Loader2 className="pointer-events-none absolute right-3 h-4 w-4 animate-spin text-gray-400" />}
              {!loading && query && (
                <button onClick={clear} className="absolute right-3 flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-gray-500">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {query.length >= 2 && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {!results || (!results.patients.length && !results.prms.length && !results.medications.length) ? (
                    <div className="flex flex-col items-center py-10 text-center">
                      <Search className="h-8 w-8 text-gray-200 dark:text-gray-600 mb-2" />
                      <p className="text-sm text-gray-400">Nenhum resultado para <strong>&quot;{query}&quot;</strong></p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {results.patients.map((p) => (
                        <button key={p.id} onClick={() => navigate(`/patients/${p.id}`)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#1e3a5f]/10 text-xs font-bold text-[#1e3a5f]">
                            {(p.name || p.code).slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-gray-800 dark:text-gray-100">{p.name || p.code}</p>
                            <p className="text-xs text-gray-400">{p.code}{p.age ? ` · ${p.age} anos` : ''}</p>
                          </div>
                        </button>
                      ))}
                      {results.prms.map((f) => (
                        <button key={f.id} onClick={() => navigate(`/analysis/${f.analysisId}`)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                          <span className="flex-shrink-0">{RISK_ICONS[f.riskLevel]}</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-gray-800 dark:text-gray-100">{f.title}</p>
                            <p className="text-xs text-gray-400">{f.analysis.patient.name || f.analysis.patient.code}</p>
                          </div>
                        </button>
                      ))}
                      {results.medications.map((m) => (
                        <button key={m.id} onClick={() => navigate(`/patients/${m.patientId}`)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-emerald-50">
                            <Pill className="h-4 w-4 text-emerald-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-gray-800 dark:text-gray-100">{m.activeIngredient}</p>
                            <p className="text-xs text-gray-400">{m.patient.name || m.patient.code}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </>
    )
  }

  // Desktop inline search
  return (
    <div ref={containerRef} className="relative w-64 lg:w-80">
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results && query.length >= 2) setOpen(true) }}
          placeholder="Buscar paciente, PRM, medicamento…"
          className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-8 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-500 dark:focus:border-blue-500 dark:focus:bg-gray-800 dark:focus:ring-blue-500/20"
        />
        {loading && <Loader2 className="pointer-events-none absolute right-3 h-3.5 w-3.5 animate-spin text-gray-400" />}
        {!loading && query && (
          <button onClick={clear} className="absolute right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-gray-300 transition-colors">
            <X className="h-2.5 w-2.5" />
          </button>
        )}
        {!loading && !query && (
          <kbd className="pointer-events-none absolute right-2.5 hidden rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 lg:block">⌘K</kbd>
        )}
      </div>

      {open && results && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-[480px] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800">
          {!(results.patients.length || results.prms.length || results.medications.length) ? (
            <div className="flex flex-col items-center py-10 text-center">
              <Search className="h-8 w-8 text-gray-200 dark:text-gray-600 mb-2" />
              <p className="text-sm text-gray-400">Nenhum resultado para <strong>&quot;{query}&quot;</strong></p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {results.patients.map((p) => (
                <button key={p.id} onClick={() => navigate(`/patients/${p.id}`)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#1e3a5f]/10 text-xs font-bold text-[#1e3a5f]">
                    {(p.name || p.code).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{p.name || p.code}</p>
                    <p className="text-xs text-gray-400">{p.code}{p.age ? ` · ${p.age} anos` : ''}</p>
                  </div>
                  {p.lastAnalysis?.urgentPRMs ? (
                    <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">{p.lastAnalysis.urgentPRMs} urg.</span>
                  ) : p.lastAnalysis?.highRiskPRMs ? (
                    <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">{p.lastAnalysis.highRiskPRMs} alto</span>
                  ) : null}
                </button>
              ))}
              {results.prms.map((f) => (
                <button key={f.id} onClick={() => navigate(`/analysis/${f.analysisId}`)}
                  className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                  <span className="mt-0.5 flex-shrink-0">{RISK_ICONS[f.riskLevel]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{f.title}</p>
                    <p className="text-xs text-gray-400 truncate">{RISK_LABELS[f.riskLevel]} · {f.analysis.patient.name || f.analysis.patient.code}</p>
                  </div>
                </button>
              ))}
              {results.medications.map((m) => (
                <button key={m.id} onClick={() => navigate(`/patients/${m.patientId}`)}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-900/30">
                    <Pill className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                      {m.activeIngredient}{m.tradeName ? <span className="ml-1 text-gray-400">({m.tradeName})</span> : null}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{m.patient.name || m.patient.code}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
