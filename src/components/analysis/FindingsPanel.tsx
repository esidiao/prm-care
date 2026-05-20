'use client'
import { useState, useTransition, useMemo } from 'react'
import {
  CheckCircle2, Circle, ChevronDown, ChevronUp,
  Filter, SlidersHorizontal, MessageSquare, X,
  Phone, Building2, Clock, RefreshCw, Loader2, Sparkles
} from 'lucide-react'

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Finding {
  id: string
  title: string
  description: string
  category: string
  riskLevel: string
  clinicalEvidence: string
  potentialImpact: string
  pharmacistConduct: string
  patientGuidance: string
  monitoring: string | null
  validationNote: string
  confidenceLevel: string
  interventionDeadline: string | null
  reevaluationPeriod: string | null
  needsPrescriberContact: boolean
  needsReferral: boolean
  isResolved: boolean
  resolvedNotes: string | null
  resolvedAt: string | null
}

interface Props {
  findings: Finding[]
  analysisId: string
  totalPRMs: number
}

// ── Config de estilos ─────────────────────────────────────────────────────────

const RISK_CONFIG: Record<string, { label: string; border: string; header: string; text: string; badge: string; dot: string }> = {
  URGENT:   { label: 'Urgente',   border: 'border-red-200 border-l-red-500',    header: 'bg-red-100 text-red-800',    text: 'text-red-700',    badge: 'bg-red-100 text-red-700',    dot: 'bg-red-500' },
  HIGH:     { label: 'Alto',      border: 'border-orange-200 border-l-orange-500', header: 'bg-orange-100 text-orange-800', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  MODERATE: { label: 'Moderado',  border: 'border-yellow-200 border-l-yellow-500', header: 'bg-yellow-100 text-yellow-800', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400' },
  LOW:      { label: 'Baixo',     border: 'border-green-200 border-l-green-500',  header: 'bg-green-100 text-green-800',  text: 'text-green-700',  badge: 'bg-green-100 text-green-700',  dot: 'bg-green-500' },
}

const CATEGORY_LABELS: Record<string, string> = {
  NECESSITY:     'Necessidade',
  EFFECTIVENESS: 'Efetividade',
  SAFETY:        'Segurança',
  ADHERENCE:     'Adesão',
}

const RISK_ORDER = ['URGENT', 'HIGH', 'MODERATE', 'LOW']

// ── Componente principal ──────────────────────────────────────────────────────

export function FindingsPanel({ findings: initialFindings, analysisId, totalPRMs }: Props) {
  const [findings, setFindings] = useState<Finding[]>(initialFindings)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    // Expandir urgentes e altos automaticamente
    new Set(initialFindings.filter(f => f.riskLevel === 'URGENT' || f.riskLevel === 'HIGH').map(f => f.id))
  )
  const [resolveNotes, setResolveNotes]   = useState<Record<string, string>>({})
  const [notesOpen, setNotesOpen]         = useState<Set<string>>(new Set())
  const [pending, startTransition]        = useTransition()
  const [loadingId, setLoadingId]         = useState<string | null>(null)
  const [error, setError]                 = useState<string | null>(null)
  const [aiLoadingId, setAiLoadingId]     = useState<string | null>(null)

  // Filtros
  const [filterRisk, setFilterRisk]       = useState<string[]>([])
  const [filterCat, setFilterCat]         = useState<string[]>([])
  const [filterResolved, setFilterResolved] = useState<'all' | 'pending' | 'resolved'>('all')
  const [showFilters, setShowFilters]     = useState(false)

  // ── Filtrar e ordenar ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return findings
      .filter(f => filterRisk.length === 0 || filterRisk.includes(f.riskLevel))
      .filter(f => filterCat.length === 0 || filterCat.includes(f.category))
      .filter(f =>
        filterResolved === 'all' ? true :
        filterResolved === 'resolved' ? f.isResolved :
        !f.isResolved
      )
      .sort((a, b) => RISK_ORDER.indexOf(a.riskLevel) - RISK_ORDER.indexOf(b.riskLevel))
  }, [findings, filterRisk, filterCat, filterResolved])

  const resolvedCount = findings.filter(f => f.isResolved).length
  const pendingCount  = findings.length - resolvedCount

  // ── Toggle expand ────────────────────────────────────────────────────────
  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const expandAll   = () => setExpandedIds(new Set(findings.map(f => f.id)))
  const collapseAll = () => setExpandedIds(new Set())

  // ── Marcar como resolvido / pendente ────────────────────────────────────
  const toggleResolve = async (finding: Finding) => {
    setLoadingId(finding.id)
    setError(null)
    const newResolved = !finding.isResolved
    const notes = resolveNotes[finding.id] || finding.resolvedNotes || ''

    try {
      const res = await fetch(`/api/analysis/${analysisId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          findingId: finding.id,
          isResolved: newResolved,
          resolvedNotes: newResolved ? notes : null,
        }),
      })
      if (!res.ok) throw new Error('Erro ao atualizar')

      startTransition(() => {
        setFindings(prev =>
          prev.map(f =>
            f.id === finding.id
              ? { ...f, isResolved: newResolved, resolvedNotes: newResolved ? notes : null, resolvedAt: newResolved ? new Date().toISOString() : null }
              : f
          )
        )
        if (newResolved) {
          setNotesOpen(prev => { const n = new Set(prev); n.delete(finding.id); return n })
        }
      })
    } catch (e: any) {
      setError('Não foi possível atualizar. Tente novamente.')
    } finally {
      setLoadingId(null)
    }
  }

  // ── Toggle notas ─────────────────────────────────────────────────────────
  const toggleNotes = (id: string) => {
    setNotesOpen(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  // ── Sugerir resolução com IA ─────────────────────────────────────────────
  const suggestResolution = async (findingId: string) => {
    setAiLoadingId(findingId)
    try {
      const res = await fetch(`/api/analysis/${analysisId}/suggest-resolution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ findingId }),
      })
      if (!res.ok) throw new Error('Erro')
      const data = await res.json()
      if (data.suggestion) {
        setResolveNotes(prev => ({ ...prev, [findingId]: data.suggestion }))
        setNotesOpen(prev => { const n = new Set(prev); n.add(findingId); return n })
      }
    } catch {
      setError('Não foi possível gerar sugestão de IA. Tente novamente.')
    } finally {
      setAiLoadingId(null)
    }
  }

  // ── Toggle filtro ─────────────────────────────────────────────────────────
  const toggleFilter = <T extends string>(list: T[], setList: (v: T[]) => void, value: T) => {
    setList(list.includes(value) ? list.filter(v => v !== value) : [...list, value])
  }

  const activeFilters = filterRisk.length + filterCat.length + (filterResolved !== 'all' ? 1 : 0)

  if (findings.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center shadow-sm">
        <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-400" />
        <p className="font-semibold text-gray-700">Nenhum PRM identificado</p>
        <p className="text-sm text-gray-400 mt-1">Isso não exclui problemas não detectáveis com os dados disponíveis.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Barra de controles */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-900">
            PRMs identificados
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({filtered.length} de {findings.length})
            </span>
          </h2>
          {/* Resumo resolução */}
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs font-medium">
              {resolvedCount} resolvido{resolvedCount !== 1 ? 's' : ''}
            </span>
            {pendingCount > 0 && (
              <span className="rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-xs font-medium">
                {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Expandir/Colapsar */}
          <button onClick={expandAll} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 transition-colors">
            Expandir todos
          </button>
          <button onClick={collapseAll} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 transition-colors">
            Colapsar todos
          </button>

          {/* Botão filtros */}
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              showFilters || activeFilters > 0
                ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtros
            {activeFilters > 0 && (
              <span className="rounded-full bg-white/30 px-1.5 text-[10px] font-bold">{activeFilters}</span>
            )}
          </button>
        </div>
      </div>

      {/* Painel de filtros */}
      {showFilters && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-blue-900">Filtrar PRMs</p>
            {activeFilters > 0 && (
              <button
                onClick={() => { setFilterRisk([]); setFilterCat([]); setFilterResolved('all') }}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Limpar filtros
              </button>
            )}
          </div>

          {/* Filtro por risco */}
          <div>
            <p className="text-[10px] font-semibold text-blue-700 mb-1.5 uppercase tracking-wide">Nível de risco</p>
            <div className="flex flex-wrap gap-2">
              {RISK_ORDER.map(level => {
                const cfg = RISK_CONFIG[level]
                const active = filterRisk.includes(level)
                return (
                  <button key={level} onClick={() => toggleFilter(filterRisk, setFilterRisk, level)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      active ? `${cfg.badge} border-current` : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}>
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Filtro por categoria */}
          <div>
            <p className="text-[10px] font-semibold text-blue-700 mb-1.5 uppercase tracking-wide">Categoria</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
                const active = filterCat.includes(key)
                return (
                  <button key={key} onClick={() => toggleFilter(filterCat, setFilterCat, key)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      active ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}>
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Filtro por status */}
          <div>
            <p className="text-[10px] font-semibold text-blue-700 mb-1.5 uppercase tracking-wide">Status</p>
            <div className="flex gap-2">
              {([['all', 'Todos'], ['pending', 'Pendentes'], ['resolved', 'Resolvidos']] as const).map(([val, label]) => (
                <button key={val} onClick={() => setFilterResolved(val)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                    filterResolved === val ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Erro global */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <X className="h-4 w-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      {/* Sem resultados de filtro */}
      {filtered.length === 0 && (
        <div className="rounded-xl border bg-white p-8 text-center">
          <Filter className="mx-auto h-8 w-8 text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">Nenhum PRM corresponde aos filtros selecionados.</p>
          <button onClick={() => { setFilterRisk([]); setFilterCat([]); setFilterResolved('all') }}
            className="mt-3 text-xs text-[#1e3a5f] hover:underline">
            Limpar filtros
          </button>
        </div>
      )}

      {/* Lista de findings */}
      {filtered.map((finding) => {
        const cfg     = RISK_CONFIG[finding.riskLevel] || RISK_CONFIG.LOW
        const isOpen  = expandedIds.has(finding.id)
        const isLoading = loadingId === finding.id
        const noteOpen  = notesOpen.has(finding.id)

        return (
          <div key={finding.id}
            className={`rounded-xl border-l-4 border shadow-sm overflow-hidden transition-all duration-200 ${cfg.border} ${
              finding.isResolved ? 'opacity-70' : ''
            }`}
          >
            {/* Card header — sempre visível */}
            <div className="bg-white px-5 py-4">
              <div className="flex items-start gap-3">
                {/* Botão de resolução */}
                <button
                  onClick={() => toggleResolve(finding)}
                  disabled={isLoading}
                  className="mt-0.5 flex-shrink-0 transition-transform hover:scale-110 disabled:opacity-50"
                  title={finding.isResolved ? 'Marcar como pendente' : 'Marcar como resolvido'}
                >
                  {isLoading
                    ? <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
                    : finding.isResolved
                      ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                      : <Circle className="h-5 w-5 text-gray-300 hover:text-green-400" />
                  }
                </button>

                <div className="flex-1 min-w-0">
                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                    <span className="rounded-full bg-gray-100 text-gray-600 px-2.5 py-0.5 text-xs">
                      {CATEGORY_LABELS[finding.category] || finding.category}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs ${
                      finding.confidenceLevel === 'high' ? 'bg-green-50 text-green-700' :
                      finding.confidenceLevel === 'moderate' ? 'bg-yellow-50 text-yellow-700' :
                      'bg-gray-50 text-gray-500'
                    }`}>
                      Confiança: {finding.confidenceLevel === 'high' ? 'Alta' : finding.confidenceLevel === 'moderate' ? 'Moderada' : 'Baixa'}
                    </span>
                    {finding.isResolved && (
                      <span className="rounded-full bg-green-100 text-green-700 px-2.5 py-0.5 text-xs font-semibold">
                        ✓ Resolvido
                      </span>
                    )}
                  </div>

                  {/* Título */}
                  <h3 className={`font-semibold text-gray-900 ${finding.isResolved ? 'line-through text-gray-400' : ''}`}>
                    {finding.title}
                  </h3>

                  {/* Descrição curta */}
                  {!isOpen && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{finding.description}</p>
                  )}

                  {/* Notas de resolução */}
                  {finding.isResolved && finding.resolvedNotes && (
                    <p className="text-xs text-green-700 mt-1 bg-green-50 rounded px-2 py-1">
                      📝 {finding.resolvedNotes}
                    </p>
                  )}
                </div>

                {/* Ações do lado direito */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Botão notas */}
                  {!finding.isResolved && (
                    <button
                      onClick={() => toggleNotes(finding.id)}
                      className={`rounded-lg p-1.5 border transition-colors text-xs ${
                        noteOpen ? 'border-blue-300 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                      }`}
                      title="Adicionar nota de resolução"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {/* Expandir/colapsar */}
                  <button
                    onClick={() => toggleExpand(finding.id)}
                    className="rounded-lg p-1.5 border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
                    title={isOpen ? 'Colapsar' : 'Expandir detalhes'}
                  >
                    {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Campo de nota inline */}
              {noteOpen && !finding.isResolved && (
                <div className="mt-3 ml-8 space-y-2">
                  <div className="relative">
                    <textarea
                      value={resolveNotes[finding.id] ?? finding.resolvedNotes ?? ''}
                      onChange={e => setResolveNotes(prev => ({ ...prev, [finding.id]: e.target.value }))}
                      placeholder="Descreva a conduta tomada, ajuste de dose, substituto prescrito, orientação fornecida…"
                      rows={3}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 placeholder-gray-400 focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f] resize-none"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => suggestResolution(finding.id)}
                      disabled={aiLoadingId === finding.id}
                      className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-50 transition-colors"
                      title="Gerar sugestão de conduta com IA"
                    >
                      {aiLoadingId === finding.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Sparkles className="h-3 w-3" />
                      }
                      {aiLoadingId === finding.id ? 'Gerando…' : 'Sugerir com IA'}
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleNotes(finding.id)}
                        className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => toggleResolve(finding)}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                        Marcar como resolvido
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Detalhes expandidos */}
            {isOpen && (
              <div className="border-t border-gray-100 bg-white px-5 py-4 space-y-4">
                <p className="text-sm text-gray-600">{finding.description}</p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-blue-50 p-3">
                    <p className="text-xs font-semibold text-blue-700 mb-1">📋 Evidência clínica</p>
                    <p className="text-sm text-gray-700">{finding.clinicalEvidence}</p>
                  </div>
                  <div className="rounded-lg bg-orange-50 p-3">
                    <p className="text-xs font-semibold text-orange-700 mb-1">⚠️ Impacto potencial</p>
                    <p className="text-sm text-gray-700">{finding.potentialImpact}</p>
                  </div>
                  <div className="rounded-lg bg-green-50 p-3">
                    <p className="text-xs font-semibold text-green-700 mb-1">💊 Conduta farmacêutica</p>
                    <p className="text-sm text-gray-700">{finding.pharmacistConduct}</p>
                  </div>
                  <div className="rounded-lg bg-purple-50 p-3">
                    <p className="text-xs font-semibold text-purple-700 mb-1">🗣 Orientação ao paciente</p>
                    <p className="text-sm text-gray-700">{finding.patientGuidance}</p>
                  </div>
                </div>

                {/* Tags de ação */}
                <div className="flex flex-wrap gap-2 text-xs">
                  {finding.needsPrescriberContact && (
                    <span className="flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700">
                      <Phone className="h-3 w-3" /> Contato com prescritor
                    </span>
                  )}
                  {finding.needsReferral && (
                    <span className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-red-700">
                      <Building2 className="h-3 w-3" /> Encaminhamento
                    </span>
                  )}
                  {finding.interventionDeadline && (
                    <span className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-gray-600">
                      <Clock className="h-3 w-3" /> Prazo: {finding.interventionDeadline}
                    </span>
                  )}
                  {finding.reevaluationPeriod && (
                    <span className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-gray-600">
                      <RefreshCw className="h-3 w-3" /> Reavaliação: {finding.reevaluationPeriod}
                    </span>
                  )}
                </div>

                {finding.monitoring && (
                  <div className="rounded-lg border border-gray-200 p-3 text-xs text-gray-600">
                    <span className="font-semibold text-gray-800">Monitoramento: </span>
                    {finding.monitoring}
                  </div>
                )}

                <div className="rounded-lg border border-amber-100 bg-amber-50 p-2.5 text-xs text-amber-700">
                  <strong>Nota de validação:</strong> {finding.validationNote}
                </div>

                {/* Nota de resolução quando expandido */}
                {finding.isResolved && finding.resolvedNotes && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs">
                    <p className="font-semibold text-green-700 mb-1">✓ Resolução registrada</p>
                    <p className="text-green-800">{finding.resolvedNotes}</p>
                    {finding.resolvedAt && (
                      <p className="text-green-600 mt-1">
                        {new Date(finding.resolvedAt).toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
