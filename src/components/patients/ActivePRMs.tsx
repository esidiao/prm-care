'use client'
import { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, CheckCircle2, Circle, Loader2,
  ChevronDown, ChevronUp, MessageSquare, X,
  Filter, ShieldAlert, Calendar, Sparkles,
} from 'lucide-react'

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface ActiveFinding {
  id: string
  title: string
  description: string
  category: string
  riskLevel: string
  pharmacistConduct: string
  interventionDeadline: string | null
  needsPrescriberContact: boolean
  needsReferral: boolean
  resolvedNotes: string | null
  analysisId: string
  analysisDate: string
}

interface Props {
  findings: ActiveFinding[]
  patientName: string
}

// ── Config ───────────────────────────────────────────────────────────────────

const RISK_ORDER = ['URGENT', 'HIGH', 'MODERATE', 'LOW']

const RISK_CONFIG: Record<string, {
  label: string; border: string; header: string
  badge: string; dot: string; icon: string
}> = {
  URGENT:   { label: 'Urgente',  border: 'border-l-red-500',    header: 'bg-red-50',    badge: 'bg-red-100 text-red-700',    dot: 'bg-red-500',    icon: '🔴' },
  HIGH:     { label: 'Alto',     border: 'border-l-orange-500', header: 'bg-orange-50', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', icon: '🟠' },
  MODERATE: { label: 'Moderado', border: 'border-l-yellow-500', header: 'bg-yellow-50', badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400', icon: '🟡' },
  LOW:      { label: 'Baixo',    border: 'border-l-green-500',  header: 'bg-green-50',  badge: 'bg-green-100 text-green-700',  dot: 'bg-green-500',  icon: '🟢' },
}

const CATEGORY_LABELS: Record<string, string> = {
  NECESSITY: 'Necessidade', EFFECTIVENESS: 'Efetividade',
  SAFETY: 'Segurança',      ADHERENCE: 'Adesão',
}

// ── Componente principal ──────────────────────────────────────────────────────

export function ActivePRMs({ findings: initial, patientName }: Props) {
  const [findings, setFindings]     = useState<ActiveFinding[]>(initial)
  const [expandedIds, setExpanded]  = useState<Set<string>>(
    new Set(initial.filter(f => f.riskLevel === 'URGENT').map(f => f.id))
  )
  const [noteOpen, setNoteOpen]     = useState<Set<string>>(new Set())
  const [notes, setNotes]           = useState<Record<string, string>>({})
  const [loadingId, setLoadingId]   = useState<string | null>(null)
  const [aiLoadingId, setAiLoading] = useState<string | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [filterRisk, setFilterRisk] = useState<string[]>([])
  const [filterCat, setFilterCat]   = useState<string[]>([])
  const [, startTransition]         = useTransition()

  // Filtered + sorted
  const filtered = useMemo(() =>
    findings
      .filter(f => filterRisk.length === 0 || filterRisk.includes(f.riskLevel))
      .filter(f => filterCat.length === 0  || filterCat.includes(f.category))
      .sort((a, b) => RISK_ORDER.indexOf(a.riskLevel) - RISK_ORDER.indexOf(b.riskLevel)),
    [findings, filterRisk, filterCat]
  )

  // Group by risk level for summary chips
  const byCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const f of findings) c[f.riskLevel] = (c[f.riskLevel] || 0) + 1
    return c
  }, [findings])

  const toggle = (id: string, set: Set<string>): Set<string> => {
    const n = new Set(set); n.has(id) ? n.delete(id) : n.add(id); return n
  }

  const toggleFilter = <T extends string>(list: T[], set: (v: T[]) => void, v: T) =>
    set(list.includes(v) ? list.filter(x => x !== v) : [...list, v])

  // Marcar como resolvido
  const resolve = async (finding: ActiveFinding) => {
    setLoadingId(finding.id)
    setError(null)
    const resolvedNotes = notes[finding.id] || ''
    try {
      const res = await fetch(`/api/analysis/${finding.analysisId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ findingId: finding.id, isResolved: true, resolvedNotes }),
      })
      if (!res.ok) throw new Error()
      startTransition(() => {
        setFindings(prev => prev.filter(f => f.id !== finding.id))
        setNoteOpen(prev => { const n = new Set(prev); n.delete(finding.id); return n })
      })
    } catch {
      setError('Erro ao resolver PRM. Tente novamente.')
    } finally {
      setLoadingId(null)
    }
  }

  // Sugerir conduta com IA
  const suggestAI = async (finding: ActiveFinding) => {
    setAiLoading(finding.id)
    try {
      const res = await fetch(`/api/analysis/${finding.analysisId}/suggest-resolution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ findingId: finding.id }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data.suggestion) {
        setNotes(prev => ({ ...prev, [finding.id]: data.suggestion }))
        setNoteOpen(prev => { const n = new Set(prev); n.add(finding.id); return n })
      }
    } catch {
      setError('IA indisponível. Tente novamente.')
    } finally {
      setAiLoading(null)
    }
  }

  if (findings.length === 0) return null

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-5 py-4 bg-gradient-to-r from-red-50 to-orange-50">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-red-600 flex-shrink-0" />
          <div>
            <h2 className="font-semibold text-gray-900 text-sm">
              PRMs em aberto
              <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">
                {findings.length}
              </span>
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Problemas não resolvidos de todas as análises de {patientName}
            </p>
          </div>
        </div>

        {/* Risk summary chips */}
        <div className="hidden sm:flex items-center gap-1.5 flex-wrap justify-end">
          {RISK_ORDER.filter(r => byCounts[r]).map(r => {
            const cfg = RISK_CONFIG[r]
            return (
              <button
                key={r}
                onClick={() => toggleFilter(filterRisk, setFilterRisk, r)}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold border transition-all ${
                  filterRisk.includes(r)
                    ? `${cfg.badge} border-current`
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                {byCounts[r]} {cfg.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Category filter */}
      {(filterRisk.length > 0 || filterCat.length > 0) && (
        <div className="flex items-center gap-2 px-5 py-2.5 bg-gray-50 border-b text-xs">
          <Filter className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-gray-500">Filtros ativos:</span>
          {filterRisk.map(r => (
            <button key={r} onClick={() => setFilterRisk(prev => prev.filter(x => x !== r))}
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 ${RISK_CONFIG[r]?.badge ?? ''}`}>
              {RISK_CONFIG[r]?.label} <X className="h-2.5 w-2.5" />
            </button>
          ))}
          {filterCat.map(c => (
            <button key={c} onClick={() => setFilterCat(prev => prev.filter(x => x !== c))}
              className="flex items-center gap-1 rounded-full px-2 py-0.5 bg-blue-100 text-blue-700">
              {CATEGORY_LABELS[c]} <X className="h-2.5 w-2.5" />
            </button>
          ))}
          <button onClick={() => { setFilterRisk([]); setFilterCat([]) }}
            className="ml-auto text-gray-400 hover:text-gray-600">Limpar</button>
        </div>
      )}

      {/* Category quick filter */}
      <div className="flex gap-1.5 px-5 py-2.5 border-b bg-white overflow-x-auto">
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
          const count = findings.filter(f => f.category === key).length
          if (!count) return null
          const active = filterCat.includes(key)
          return (
            <button key={key} onClick={() => toggleFilter(filterCat, setFilterCat, key)}
              className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium border transition-all ${
                active ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }`}>
              {label} ({count})
            </button>
          )
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-5 mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700 flex items-center gap-2">
          <X className="h-4 w-4 flex-shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">×</button>
        </div>
      )}

      {/* Findings list */}
      <div className="divide-y divide-gray-50">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">Nenhum PRM corresponde aos filtros.</p>
        ) : filtered.map(finding => {
          const cfg     = RISK_CONFIG[finding.riskLevel] ?? RISK_CONFIG.LOW
          const isOpen  = expandedIds.has(finding.id)
          const isNote  = noteOpen.has(finding.id)
          const loading = loadingId === finding.id
          const cleanTitle = finding.title.replace(/^\[IA\]\s*/i, '')
          const isAI    = finding.title.startsWith('[IA]')

          return (
            <div key={finding.id} className={`border-l-4 ${cfg.border}`}>
              {/* Card header */}
              <div className="px-5 py-3.5 bg-white">
                <div className="flex items-start gap-3">
                  {/* Resolve button */}
                  <button
                    onClick={() => resolve(finding)}
                    disabled={!!loading}
                    className="mt-0.5 flex-shrink-0 transition-transform hover:scale-110 disabled:opacity-50"
                    title="Marcar como resolvido"
                  >
                    {loading
                      ? <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
                      : <Circle className="h-5 w-5 text-gray-300 hover:text-green-400" />
                    }
                  </button>

                  <div className="flex-1 min-w-0">
                    {/* Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cfg.badge}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                      <span className="rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-[11px]">
                        {CATEGORY_LABELS[finding.category] || finding.category}
                      </span>
                      {isAI && (
                        <span className="rounded-full bg-purple-100 text-purple-600 px-1.5 py-0.5 text-[10px] font-medium">IA</span>
                      )}
                      {finding.needsPrescriberContact && (
                        <span className="rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-[11px]">📞 Contato prescritor</span>
                      )}
                      {finding.needsReferral && (
                        <span className="rounded-full bg-red-50 text-red-700 px-2 py-0.5 text-[11px]">🏥 Encaminhamento</span>
                      )}
                      {finding.interventionDeadline && (
                        <span className="rounded-full bg-gray-50 text-gray-600 px-2 py-0.5 text-[11px]">⏰ {finding.interventionDeadline}</span>
                      )}
                    </div>

                    {/* Title */}
                    <p className="text-sm font-semibold text-gray-900">{cleanTitle}</p>

                    {/* Conduct preview (collapsed) */}
                    {!isOpen && finding.pharmacistConduct && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                        💊 {finding.pharmacistConduct}
                      </p>
                    )}

                    {/* Source analysis */}
                    <Link href={`/analysis/${finding.analysisId}`}
                      className="inline-flex items-center gap-1 text-[10px] text-gray-400 hover:text-[#1e3a5f] mt-0.5 transition-colors">
                      <Calendar className="h-3 w-3" />
                      Análise de {new Date(finding.analysisDate).toLocaleDateString('pt-BR')}
                    </Link>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setNoteOpen(prev => toggle(finding.id, prev))}
                      className={`rounded-lg p-1.5 border text-xs transition-colors ${
                        isNote ? 'border-blue-300 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                      }`}
                      title="Adicionar nota de resolução"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setExpanded(prev => toggle(finding.id, prev))}
                      className="rounded-lg p-1.5 border border-gray-200 text-gray-400 hover:bg-gray-50 transition-colors"
                    >
                      {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Nota inline */}
                {isNote && (
                  <div className="mt-3 ml-8 space-y-2">
                    <textarea
                      value={notes[finding.id] ?? ''}
                      onChange={e => setNotes(prev => ({ ...prev, [finding.id]: e.target.value }))}
                      placeholder="Descreva a conduta tomada…"
                      rows={2}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 placeholder-gray-400 focus:border-[#1e3a5f] focus:outline-none resize-none"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => suggestAI(finding)}
                        disabled={aiLoadingId === finding.id}
                        className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-50 transition-colors"
                      >
                        {aiLoadingId === finding.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Sparkles className="h-3 w-3" />
                        }
                        {aiLoadingId === finding.id ? 'Gerando…' : 'Sugerir com IA'}
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setNoteOpen(prev => { const n = new Set(prev); n.delete(finding.id); return n })}
                          className="px-3 py-1 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => resolve(finding)}
                          disabled={!!loading}
                          className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                          Marcar resolvido
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <div className={`px-5 py-3 border-t ${cfg.header}/40 space-y-2`}>
                  <p className="text-xs text-gray-600 leading-relaxed">{finding.description}</p>
                  {finding.pharmacistConduct && (
                    <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                      <p className="text-[10px] font-bold text-green-700 uppercase tracking-wide mb-0.5">💊 Conduta farmacêutica</p>
                      <p className="text-xs text-gray-700">{finding.pharmacistConduct}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="border-t bg-gray-50 px-5 py-3 flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {filtered.length} PRM{filtered.length !== 1 ? 's' : ''} em aberto
          {filterRisk.length > 0 || filterCat.length > 0 ? ' (filtrado)' : ''}
        </p>
        <p className="text-[10px] text-gray-400">
          Clique em ○ para marcar como resolvido
        </p>
      </div>
    </div>
  )
}
