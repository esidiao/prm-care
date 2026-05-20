'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Download, Search, X, FileText, Calendar, SlidersHorizontal,
  Printer, ShieldAlert, CheckCircle2, Coins, ArrowRight, Filter
} from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { ExportMenu } from '@/components/export/ExportMenu'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ReportRow {
  id: string
  analysisId: string
  type: string
  tokensConsumed: number
  isAnonymized: boolean
  generatedAt: Date
  analysis: {
    id: string
    totalPRMs: number
    urgentPRMs: number
    highRiskPRMs: number
    createdAt: Date
    patient: { code: string; name: string | null }
  }
}

interface PendingAnalysis {
  id: string
  totalPRMs: number
  urgentPRMs: number
  createdAt: Date
  patient: { code: string; name: string | null }
}

interface Props {
  reports: ReportRow[]
  pendingAnalyses: PendingAnalysis[]
  stats: {
    total: number
    thisMonth: number
    totalTokens: number
    pendingCount: number
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  SIMPLE: 'Simples',
  COMPLETE: 'Completo',
  SOAP: 'SOAP',
  INSTITUTIONAL: 'Institucional',
}

const TYPE_COLORS: Record<string, string> = {
  SIMPLE: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  COMPLETE: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  SOAP: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  INSTITUTIONAL: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
}

type DateFilter = 'all' | 'today' | 'week' | 'month' | 'quarter'
const DATE_LABELS: Record<DateFilter, string> = {
  all: 'Qualquer data',
  today: 'Hoje',
  week: 'Esta semana',
  month: 'Este mês',
  quarter: 'Últimos 90 dias',
}

function withinRange(date: Date, filter: DateFilter): boolean {
  if (filter === 'all') return true
  const d = new Date(date)
  const now = new Date()
  if (filter === 'today') {
    return d.toDateString() === now.toDateString()
  }
  const days = filter === 'week' ? 7 : filter === 'month' ? 30 : 90
  return (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24) <= days
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, color, sub,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  color: string
  sub?: string
}) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{value}</p>
          {sub && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{sub}</p>}
        </div>
        <div className={`rounded-xl p-2.5 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ReportsTable({ reports, pendingAnalyses, stats }: Props) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [showFilters, setShowFilters] = useState(false)

  const filtered = useMemo(() => {
    return reports.filter(r => {
      // Text search — patient name or code
      const term = search.toLowerCase()
      if (term) {
        const name = (r.analysis.patient.name || '').toLowerCase()
        const code = r.analysis.patient.code.toLowerCase()
        if (!name.includes(term) && !code.includes(term)) return false
      }
      // Type
      if (typeFilter !== 'all' && r.type !== typeFilter) return false
      // Date
      if (!withinRange(r.generatedAt, dateFilter)) return false
      return true
    })
  }, [reports, search, typeFilter, dateFilter])

  const hasFilters = typeFilter !== 'all' || dateFilter !== 'all'

  const types = Array.from(new Set(reports.map(r => r.type)))

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={FileText} label="Total de relatórios" value={stats.total}
          color="bg-orange-50 dark:bg-orange-900/20" sub={`${stats.thisMonth} este mês`} />
        <StatCard icon={Calendar} label="Gerados este mês" value={stats.thisMonth}
          color="bg-blue-50 dark:bg-blue-900/20" />
        <StatCard icon={Coins} label="Tokens consumidos" value={stats.totalTokens}
          color="bg-violet-50 dark:bg-violet-900/20" sub="em relatórios" />
        <StatCard icon={Printer} label="Aguardando relatório" value={stats.pendingCount}
          color={stats.pendingCount > 0 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-green-50 dark:bg-green-900/20'}
          sub={stats.pendingCount > 0 ? 'análises concluídas' : 'tudo em dia'} />
      </div>

      {/* Pending analyses */}
      {pendingAnalyses.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-950/30">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300">
              {pendingAnalyses.length} análise{pendingAnalyses.length > 1 ? 's' : ''} pronta{pendingAnalyses.length > 1 ? 's' : ''} para gerar relatório
            </h3>
          </div>
          <div className="space-y-2">
            {pendingAnalyses.map(a => (
              <div key={a.id}
                className="flex items-center justify-between rounded-lg border border-blue-100 bg-white px-4 py-3 dark:border-blue-800 dark:bg-gray-800">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {a.patient.name || a.patient.code}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {formatDateTime(a.createdAt)} · {a.totalPRMs} PRM(s)
                    {a.urgentPRMs > 0 && (
                      <span className="ml-1.5 inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                        {a.urgentPRMs} urgente
                      </span>
                    )}
                  </p>
                </div>
                <Link href={`/reports/new?analysisId=${a.id}`}
                  className="btn-primary text-xs px-3 py-1.5 ml-3 flex-shrink-0">
                  <Printer className="h-3.5 w-3.5" /> Gerar PDF
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter + search bar */}
      {reports.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-48">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filtrar por paciente…"
                className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-8 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-500"
              />
              {search && (
                <button onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-400">
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(s => !s)}
              className={`flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${
                hasFilters
                  ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtros
              {hasFilters && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
                  {[typeFilter !== 'all', dateFilter !== 'all'].filter(Boolean).length}
                </span>
              )}
            </button>

            <ExportMenu mode="prms-only" variant="icon" />

            <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
              {filtered.length} de {reports.length} relatório{reports.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3 dark:border-gray-700 dark:bg-gray-800/50">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                  <Filter className="h-3 w-3" /> Filtros
                </p>
                {hasFilters && (
                  <button onClick={() => { setTypeFilter('all'); setDateFilter('all') }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium dark:text-blue-400">
                    Limpar filtros
                  </button>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Type */}
                <div>
                  <p className="mb-1.5 text-xs font-medium text-gray-600 dark:text-gray-400">Tipo de relatório</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(['all', ...types] as string[]).map(t => (
                      <button key={t} onClick={() => setTypeFilter(t)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          typeFilter === t
                            ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300 dark:bg-blue-900/40 dark:text-blue-300'
                            : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                        {t === 'all' ? 'Todos' : (TYPE_LABELS[t] ?? t)}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Date */}
                <div>
                  <p className="mb-1.5 text-xs font-medium text-gray-600 dark:text-gray-400">Período</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(DATE_LABELS) as DateFilter[]).map(d => (
                      <button key={d} onClick={() => setDateFilter(d)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          dateFilter === d
                            ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300 dark:bg-blue-900/40 dark:text-blue-300'
                            : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                        {DATE_LABELS[d]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      {reports.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-700 mb-4">
            <FileText className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-700 dark:text-gray-200">Nenhum relatório gerado</h3>
          <p className="mt-1 text-sm text-gray-400 dark:text-gray-500 max-w-xs">
            Realize uma análise e gere o relatório em PDF para download
          </p>
          <Link href="/analysis/new" className="btn-primary mt-6">
            <Printer className="h-4 w-4" /> Nova análise
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card py-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Nenhum relatório corresponde aos filtros.
          </p>
          <button onClick={() => { setSearch(''); setTypeFilter('all'); setDateFilter('all') }}
            className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400">
            Limpar filtros
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="table-header-cell">Paciente</th>
                <th className="table-header-cell">Tipo</th>
                <th className="table-header-cell">PRMs</th>
                <th className="table-header-cell">Gerado em</th>
                <th className="table-header-cell">Tokens</th>
                <th className="table-header-cell w-36"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {filtered.map(r => {
                const label = r.analysis.patient.name || r.analysis.patient.code
                const initials = label.slice(0, 2).toUpperCase()
                return (
                  <tr key={r.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-700/40 transition-colors group">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-orange-50 text-xs font-bold text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                          {initials}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{label}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">{r.analysis.patient.code}</p>
                          {r.isAnonymized && (
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">Anonimizado</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border border-transparent ${TYPE_COLORS[r.type] ?? 'bg-gray-100 text-gray-700'}`}>
                        {TYPE_LABELS[r.type] ?? r.type}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex flex-wrap gap-1">
                        {r.analysis.urgentPRMs > 0 && (
                          <span className="risk-badge-urgent">{r.analysis.urgentPRMs} urg.</span>
                        )}
                        {r.analysis.highRiskPRMs > 0 && (
                          <span className="risk-badge-high">{r.analysis.highRiskPRMs} alto</span>
                        )}
                        {!r.analysis.urgentPRMs && !r.analysis.highRiskPRMs && r.analysis.totalPRMs > 0 && (
                          <span className="risk-badge-low">{r.analysis.totalPRMs} PRM</span>
                        )}
                        {r.analysis.totalPRMs === 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" /> Sem PRMs
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="table-cell text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        {formatDateTime(r.generatedAt)}
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300">
                        <Coins className="h-2.5 w-2.5" />
                        {r.tokensConsumed}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link href={`/analysis/${r.analysisId}`}
                          className="flex items-center gap-1 text-xs font-medium text-[#1e3a5f] hover:underline dark:text-blue-400">
                          Análise <ArrowRight className="h-3 w-3" />
                        </Link>
                        <a href={`/api/reports/${r.id}/download`}
                          className="btn-secondary px-3 py-1.5 text-xs">
                          <Download className="h-3 w-3" /> PDF
                        </a>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
