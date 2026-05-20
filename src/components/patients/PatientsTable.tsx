'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  FlaskConical, Calendar, Search, X, SlidersHorizontal,
  AlertTriangle, AlertCircle, CheckCircle, Filter
} from 'lucide-react'
import { formatDate, calculateAge } from '@/lib/utils'
import { ExportMenu } from '@/components/export/ExportMenu'

// ── Types (mirror what the server passes) ────────────────────────────────────

interface PatientRow {
  id: string
  code: string
  name: string | null
  sex: string | null
  age: number | null
  dateOfBirth: Date | null
  weight: number | null
  height: number | null
  updatedAt: Date
  _count: { analyses: number }
  analyses: {
    createdAt: Date
    urgentPRMs: number
    highRiskPRMs: number
    totalPRMs: number
  }[]
}

type RiskFilter = 'all' | 'urgent' | 'high' | 'any_prm' | 'no_analysis'
type ActivityFilter = 'all' | 'recent' | 'stale_30' | 'stale_90' | 'never'

const RISK_LABELS: Record<RiskFilter, string> = {
  all: 'Todos',
  urgent: 'Com urgente',
  high: 'Alto risco',
  any_prm: 'Com PRMs',
  no_analysis: 'Sem análise',
}

const ACTIVITY_LABELS: Record<ActivityFilter, string> = {
  all: 'Qualquer data',
  recent: 'Últimos 7 dias',
  stale_30: 'Há >30 dias',
  stale_90: 'Há >90 dias',
  never: 'Nunca analisado',
}

function daysSince(date: Date): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PatientsTable({ patients }: { patients: PatientRow[] }) {
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all')
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all')
  const [showFilters, setShowFilters] = useState(false)

  const filtered = useMemo(() => {
    return patients.filter(p => {
      // Text search
      const term = search.toLowerCase()
      if (term) {
        const name = (p.name || '').toLowerCase()
        const code = p.code.toLowerCase()
        if (!name.includes(term) && !code.includes(term)) return false
      }

      // Risk filter
      const last = p.analyses[0]
      if (riskFilter === 'urgent' && !last?.urgentPRMs) return false
      if (riskFilter === 'high' && !last?.highRiskPRMs) return false
      if (riskFilter === 'any_prm' && !last?.totalPRMs) return false
      if (riskFilter === 'no_analysis' && p._count.analyses > 0) return false

      // Activity filter
      if (activityFilter === 'never' && p._count.analyses > 0) return false
      if (activityFilter === 'recent') {
        if (!last || daysSince(last.createdAt) > 7) return false
      }
      if (activityFilter === 'stale_30') {
        if (!last || daysSince(last.createdAt) <= 30) return false
      }
      if (activityFilter === 'stale_90') {
        if (!last || daysSince(last.createdAt) <= 90) return false
      }

      return true
    })
  }, [patients, search, riskFilter, activityFilter])

  const hasActiveFilters = riskFilter !== 'all' || activityFilter !== 'all'

  function clearFilters() {
    setRiskFilter('all')
    setActivityFilter('all')
  }

  return (
    <div className="space-y-4">
      {/* Search + filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Text search */}
        <div className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filtrar por nome ou código…"
            className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-8 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-gray-300">
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(s => !s)}
          className={`flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${
            hasActiveFilters
              ? 'border-blue-300 bg-blue-50 text-blue-700'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtros
          {hasActiveFilters && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
              {[riskFilter !== 'all', activityFilter !== 'all'].filter(Boolean).length}
            </span>
          )}
        </button>

        {/* Export */}
        <ExportMenu mode="all" />

        {/* Results count */}
        <span className="ml-auto text-xs text-gray-400">
          {filtered.length} de {patients.length} paciente{patients.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <Filter className="h-3 w-3" /> Filtros avançados
            </p>
            {hasActiveFilters && (
              <button onClick={clearFilters}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">
                Limpar filtros
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Risk filter */}
            <div>
              <p className="mb-1.5 text-xs font-medium text-gray-600">Nível de risco (última análise)</p>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(RISK_LABELS) as RiskFilter[]).map(k => (
                  <button key={k} onClick={() => setRiskFilter(k)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      riskFilter === k
                        ? k === 'urgent' ? 'bg-red-100 text-red-700 ring-1 ring-red-300'
                          : k === 'high' ? 'bg-orange-100 text-orange-700 ring-1 ring-orange-300'
                          : 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                        : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}>
                    {RISK_LABELS[k]}
                  </button>
                ))}
              </div>
            </div>

            {/* Activity filter */}
            <div>
              <p className="mb-1.5 text-xs font-medium text-gray-600">Última análise</p>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(ACTIVITY_LABELS) as ActivityFilter[]).map(k => (
                  <button key={k} onClick={() => setActivityFilter(k)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      activityFilter === k
                        ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                        : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}>
                    {ACTIVITY_LABELS[k]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center">
          <p className="text-sm font-medium text-gray-500">Nenhum paciente encontrado com os filtros atuais.</p>
          <button onClick={() => { setSearch(''); clearFilters() }}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium">
            Limpar filtros
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header-cell">Paciente</th>
                <th className="table-header-cell">Idade / Sexo</th>
                <th className="table-header-cell">Análises</th>
                <th className="table-header-cell">Última análise</th>
                <th className="table-header-cell">Alertas</th>
                <th className="table-header-cell w-36"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((patient) => {
                const age = patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : patient.age
                const lastAnalysis = patient.analyses[0]
                const sexLabel = patient.sex === 'MALE' ? 'M' : patient.sex === 'FEMALE' ? 'F' : patient.sex ? 'Outro' : null
                const initials = (patient.name || patient.code).slice(0, 2).toUpperCase()
                const days = lastAnalysis ? daysSince(lastAnalysis.createdAt) : null
                const isStale = days !== null && days > 30

                return (
                  <tr key={patient.id} className="hover:bg-gray-50/70 transition-colors group">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#1e3a5f]/10 text-xs font-bold text-[#1e3a5f]">
                          {initials}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{patient.name || patient.code}</p>
                          {patient.name && <p className="text-xs text-gray-400">{patient.code}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="table-cell text-gray-600">
                      {age ? `${age} anos` : '—'}
                      {sexLabel && <span className="ml-1.5 inline-flex items-center rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">{sexLabel}</span>}
                    </td>
                    <td className="table-cell">
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                        {patient._count.analyses}
                      </span>
                    </td>
                    <td className="table-cell text-gray-500">
                      {lastAnalysis ? (
                        <div className={`flex items-center gap-1.5 ${isStale ? 'text-amber-600' : ''}`}>
                          <Calendar className="h-3.5 w-3.5 text-gray-400" />
                          <span>{formatDate(lastAnalysis.createdAt)}</span>
                          {isStale && (
                            <span className="text-[10px] text-amber-500 font-medium">({days}d)</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <div className="flex flex-wrap gap-1">
                        {lastAnalysis?.urgentPRMs ? (
                          <span className="risk-badge-urgent flex items-center gap-0.5">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {lastAnalysis.urgentPRMs} urgente
                          </span>
                        ) : null}
                        {lastAnalysis?.highRiskPRMs ? (
                          <span className="risk-badge-high flex items-center gap-0.5">
                            <AlertCircle className="h-2.5 w-2.5" />
                            {lastAnalysis.highRiskPRMs} alto
                          </span>
                        ) : null}
                        {!lastAnalysis?.urgentPRMs && !lastAnalysis?.highRiskPRMs && lastAnalysis?.totalPRMs ? (
                          <span className="risk-badge-low">{lastAnalysis.totalPRMs} PRM</span>
                        ) : null}
                        {lastAnalysis && !lastAnalysis.totalPRMs ? (
                          <span className="flex items-center gap-0.5 text-xs text-emerald-600">
                            <CheckCircle className="h-3 w-3" /> Sem PRMs
                          </span>
                        ) : null}
                        {!lastAnalysis && <span className="text-xs text-gray-400">Sem análise</span>}
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link href={`/patients/${patient.id}`}
                          className="btn-secondary px-3 py-1.5 text-xs">
                          Ver perfil
                        </Link>
                        <Link href={`/analysis/new?patientId=${patient.id}`}
                          className="btn-primary px-3 py-1.5 text-xs">
                          <FlaskConical className="h-3 w-3" /> Analisar
                        </Link>
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
