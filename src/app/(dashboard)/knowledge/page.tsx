'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  BookOpen, Plus, Search, X, ChevronDown, ChevronUp,
  AlertTriangle, Pill, Shield, Clock, FileText, Activity,
  Loader2, CheckCircle2, ExternalLink, Tag, Trash2,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Entry {
  id: string
  title: string
  type: string
  content: string
  summary: string | null
  source: string
  sourceUrl: string | null
  tags: string[]
  drugNames: string[]
  icd10Codes: string[]
  observations: string | null
  status: string
  createdAt: string
  createdBy: { name: string | null; email: string }
}

// ── Config ───────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { label: string; icon: React.FC<{ className?: string }>; color: string; bg: string }> = {
  INTERACTION:      { label: 'Interação',         icon: AlertTriangle, color: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800' },
  CONTRAINDICATION: { label: 'Contraindicação',   icon: Shield,        color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800' },
  DOSAGE:           { label: 'Posologia',          icon: Pill,          color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800' },
  HEALTH_ALERT:     { label: 'Alerta de saúde',   icon: Activity,      color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800' },
  PROTOCOL:         { label: 'Protocolo',          icon: FileText,      color: 'text-teal-600',   bg: 'bg-teal-50 dark:bg-teal-950 border-teal-200 dark:border-teal-800' },
  PACKAGE_INSERT:   { label: 'Bula',               icon: FileText,      color: 'text-gray-600',   bg: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700' },
  GUIDELINE:        { label: 'Diretriz clínica',   icon: BookOpen,      color: 'text-emerald-600',bg: 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800' },
  ADVERSE_REACTION: { label: 'Reação adversa',    icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING:   { label: 'Pendente',  color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  VALIDATED: { label: 'Validado',  color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  EXPIRED:   { label: 'Expirado',  color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
  ARCHIVED:  { label: 'Arquivado', color: 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500' },
}

// ── New Entry Form ────────────────────────────────────────────────────────────

function NewEntryForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [title, setTitle] = useState('')
  const [type, setType] = useState('INTERACTION')
  const [content, setContent] = useState('')
  const [summary, setSummary] = useState('')
  const [source, setSource] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [drugNamesRaw, setDrugNamesRaw] = useState('')
  const [tagsRaw, setTagsRaw] = useState('')
  const [observations, setObservations] = useState('')

  const reset = () => {
    setTitle(''); setType('INTERACTION'); setContent(''); setSummary('')
    setSource(''); setSourceUrl(''); setDrugNamesRaw(''); setTagsRaw('')
    setObservations(''); setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim() || !source.trim()) {
      setError('Título, conteúdo e fonte são obrigatórios.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, type, content, summary: summary || undefined,
          source, sourceUrl: sourceUrl || undefined,
          drugNames: drugNamesRaw.split(',').map(s => s.trim()).filter(Boolean),
          tags: tagsRaw.split(',').map(s => s.trim()).filter(Boolean),
          observations: observations || undefined,
        }),
      })
      if (!res.ok) throw new Error()
      reset()
      setOpen(false)
      onCreated()
    } catch {
      setError('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded-lg bg-[#1e3a5f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#16304f] transition-colors shadow-sm"
      >
        <Plus className="h-4 w-4" />
        Nova entrada
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-6 py-4">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-[#1e3a5f] dark:text-blue-400" />
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Nova entrada na base de conhecimento</h2>
              </div>
              <button onClick={() => { setOpen(false); reset() }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Título *</label>
                  <input
                    value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="Ex: Interação Warfarina + AAS"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Tipo *</label>
                  <select
                    value={type} onChange={e => setType(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
                  >
                    {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Resumo (exibido na listagem)</label>
                <input
                  value={summary} onChange={e => setSummary(e.target.value)}
                  placeholder="Uma linha descrevendo o conteúdo…"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Conteúdo clínico *</label>
                <textarea
                  value={content} onChange={e => setContent(e.target.value)}
                  placeholder="Descreva a interação, contraindicação, protocolo ou alerta com detalhes clínicos relevantes…"
                  rows={5}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Fonte *</label>
                  <input
                    value={source} onChange={e => setSource(e.target.value)}
                    placeholder="Ex: Micromedex, UpToDate, ANVISA"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">URL da fonte</label>
                  <input
                    value={sourceUrl} onChange={e => setSourceUrl(e.target.value)}
                    placeholder="https://…"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Medicamentos envolvidos</label>
                  <input
                    value={drugNamesRaw} onChange={e => setDrugNamesRaw(e.target.value)}
                    placeholder="Warfarina, AAS, Metformina…"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Separados por vírgula</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Tags</label>
                  <input
                    value={tagsRaw} onChange={e => setTagsRaw(e.target.value)}
                    placeholder="anticoagulante, idoso, renal…"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Separadas por vírgula</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Observações adicionais</label>
                <textarea
                  value={observations} onChange={e => setObservations(e.target.value)}
                  placeholder="Notas clínicas, contexto de uso, população-alvo…"
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f] resize-none"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </form>

            <div className="flex justify-end gap-3 border-t border-gray-100 dark:border-gray-800 px-6 py-4">
              <button onClick={() => { setOpen(false); reset() }} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleSubmit as never}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#1e3a5f] rounded-lg hover:bg-[#16304f] disabled:opacity-60 transition-colors"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {saving ? 'Salvando…' : 'Salvar entrada'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Entry Card ────────────────────────────────────────────────────────────────

function EntryCard({ entry, onDelete }: { entry: Entry; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const cfg = TYPE_CONFIG[entry.type] ?? TYPE_CONFIG.PROTOCOL
  const statusCfg = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.PENDING
  const Icon = cfg.icon

  const handleDelete = async () => {
    if (!confirm(`Excluir "${entry.title}"?`)) return
    setDeleting(true)
    await fetch(`/api/knowledge/${entry.id}`, { method: 'DELETE' }).catch(() => {})
    onDelete(entry.id)
  }

  return (
    <div className={`rounded-xl border overflow-hidden bg-white dark:bg-gray-800 shadow-sm ${cfg.bg}`}>
      {/* Header */}
      <div
        className="flex items-start gap-3 px-4 py-3.5 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${cfg.bg}`}>
          <Icon className={`h-4 w-4 ${cfg.color}`} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
            <span className={`text-[10px] font-medium ${cfg.color}`}>{cfg.label}</span>
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug">
            {entry.title}
          </h3>
          {entry.summary && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{entry.summary}</p>
          )}

          {/* Drug pills */}
          {entry.drugNames.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {entry.drugNames.slice(0, 4).map(d => (
                <span key={d} className="flex items-center gap-0.5 rounded-full bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900 px-2 py-0.5 text-[10px] text-blue-700 dark:text-blue-300">
                  <Pill className="h-2.5 w-2.5" /> {d}
                </span>
              ))}
              {entry.drugNames.length > 4 && (
                <span className="text-[10px] text-gray-400">+{entry.drugNames.length - 4}</span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] text-gray-400 dark:text-gray-500 hidden sm:block">
            {new Date(entry.createdAt).toLocaleDateString('pt-BR')}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-4 space-y-3 bg-white dark:bg-gray-800">
          <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-3">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">📋 Conteúdo clínico</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
              {entry.content}
            </p>
          </div>

          {entry.observations && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-900 p-3">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">💡 Observações</p>
              <p className="text-sm text-amber-800 dark:text-amber-200">{entry.observations}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Fonte: <strong className="text-gray-700 dark:text-gray-300">{entry.source}</strong>
              </span>
              {entry.sourceUrl && (
                <a
                  href={entry.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-0.5 text-xs text-[#1e3a5f] dark:text-blue-400 hover:underline"
                >
                  Acessar <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {entry.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {entry.tags.map(t => (
                    <span key={t} className="flex items-center gap-0.5 rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-[10px] text-gray-600 dark:text-gray-400">
                      <Tag className="h-2.5 w-2.5" /> {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 disabled:opacity-50 transition-colors"
            >
              {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              Excluir
            </button>
          </div>

          <p className="text-[10px] text-gray-400 dark:text-gray-600">
            Adicionado por {entry.createdBy.name || entry.createdBy.email} em {new Date(entry.createdAt).toLocaleString('pt-BR')}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function KnowledgePage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const [q, setQ] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('VALIDATED')
  const [debouncedQ, setDebouncedQ] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 350)
    return () => clearTimeout(t)
  }, [q])

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page),
      ...(debouncedQ && { q: debouncedQ }),
      ...(filterType && { type: filterType }),
      ...(filterStatus && { status: filterStatus }),
    })
    fetch(`/api/knowledge?${params}`)
      .then(r => r.json())
      .then(data => {
        setEntries(data.entries ?? [])
        setTotal(data.total ?? 0)
        setPages(data.pages ?? 1)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page, debouncedQ, filterType, filterStatus])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [debouncedQ, filterType, filterStatus])

  const removeEntry = (id: string) => setEntries(prev => prev.filter(e => e.id !== id))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Base de conhecimento clínico</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Interações, contraindicações, protocolos e alertas farmacêuticos
          </p>
        </div>
        <NewEntryForm onCreated={load} />
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(TYPE_CONFIG).slice(0, 4).map(([key, cfg]) => {
          const Icon = cfg.icon
          return (
            <button
              key={key}
              onClick={() => setFilterType(filterType === key ? '' : key)}
              className={`flex items-center gap-2 rounded-xl border p-3 text-left transition-all ${
                filterType === key
                  ? `${cfg.bg} border-current shadow-sm`
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className={`h-4 w-4 flex-shrink-0 ${cfg.color}`} />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{cfg.label}</span>
            </button>
          )
        })}
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar por título, conteúdo ou medicamento…"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-9 pr-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
          />
          {q && (
            <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 focus:border-[#1e3a5f] focus:outline-none"
        >
          <option value="">Todos os tipos</option>
          {Object.entries(TYPE_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 focus:border-[#1e3a5f] focus:outline-none"
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Results */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {loading ? 'Carregando…' : `${total} entrada${total !== 1 ? 's' : ''} encontrada${total !== 1 ? 's' : ''}`}
          </p>
          {filterType || filterStatus || debouncedQ ? (
            <button
              onClick={() => { setQ(''); setFilterType(''); setFilterStatus('VALIDATED') }}
              className="text-xs text-[#1e3a5f] dark:text-blue-400 hover:underline"
            >
              Limpar filtros
            </button>
          ) : null}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-gray-300 dark:text-gray-600" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 dark:border-gray-700 py-16 text-center">
            <BookOpen className="h-10 w-10 text-gray-200 dark:text-gray-700 mb-3" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Nenhuma entrada encontrada</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {debouncedQ ? 'Tente outros termos de busca' : 'Clique em "Nova entrada" para começar'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map(entry => (
              <EntryCard key={entry.id} entry={entry} onDelete={removeEntry} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← Anterior
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {page} de {pages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Próxima →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
