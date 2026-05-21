import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import { FlaskConical, ArrowRight, AlertTriangle, CheckCircle2, Clock, Filter } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

const RISK_CONFIG: Record<string, { label: string; dot: string }> = {
  URGENT: { label: 'Urgente', dot: 'bg-red-500' },
  HIGH:   { label: 'Alto',    dot: 'bg-orange-500' },
  MODERATE: { label: 'Moderado', dot: 'bg-yellow-500' },
  LOW:    { label: 'Baixo',   dot: 'bg-green-500' },
}

export default async function AnalysesHistoryPage({
  searchParams,
}: {
  searchParams: { page?: string; patient?: string; risk?: string; resolved?: string }
}) {
  const session = await getSession()
  if (!session) return null

  const page = Math.max(1, Number(searchParams.page ?? '1'))
  const limit = 20
  const patientFilter = searchParams.patient ?? ''
  const riskFilter = searchParams.risk ?? ''
  const resolvedFilter = searchParams.resolved ?? ''

  const where: Record<string, unknown> = { userId: session.user.id }
  if (patientFilter) {
    where.patient = {
      OR: [
        { name: { contains: patientFilter, mode: 'insensitive' } },
        { code: { contains: patientFilter, mode: 'insensitive' } },
      ],
    }
  }
  if (riskFilter === 'urgent') where.urgentPRMs = { gt: 0 }
  else if (riskFilter === 'high') where.highRiskPRMs = { gt: 0 }

  const [analyses, total, stats] = await Promise.all([
    prisma.pRMAnalysis.findMany({
      where,
      include: {
        patient: { select: { id: true, name: true, code: true } },
        findings: {
          select: { isResolved: true, riskLevel: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }).catch(() => []),
    prisma.pRMAnalysis.count({ where }).catch(() => 0),
    prisma.pRMAnalysis.aggregate({
      where: { userId: session.user.id },
      _sum: { totalPRMs: true, urgentPRMs: true },
      _count: { id: true },
    }).catch(() => null),
  ])

  const pages = Math.max(1, Math.ceil(total / limit))

  const buildUrl = (params: Record<string, string | number>) => {
    const p = new URLSearchParams({
      ...(patientFilter && { patient: patientFilter }),
      ...(riskFilter && { risk: riskFilter }),
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    })
    return `/analyses?${p}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Histórico de Análises PRM</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {total} análise{total !== 1 ? 's' : ''} realizadas no total
          </p>
        </div>
        <Link href="/analysis/new"
          className="flex items-center gap-2 rounded-lg bg-[#1e3a5f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#16304f] transition-colors shadow-sm">
          <FlaskConical className="h-4 w-4" /> Nova análise
        </Link>
      </div>

      {/* Stats strip */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total de análises', value: stats._count.id, icon: FlaskConical, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950' },
            { label: 'PRMs identificados', value: stats._sum.totalPRMs ?? 0, icon: AlertTriangle, color: 'text-orange-600 bg-orange-50 dark:bg-orange-950' },
            { label: 'PRMs urgentes', value: stats._sum.urgentPRMs ?? 0, icon: AlertTriangle, color: 'text-red-600 bg-red-50 dark:bg-red-950' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm text-center">
              <div className={`mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Filtros:</span>
        </div>
        <form className="flex flex-wrap gap-3 flex-1" method="GET" action="/analyses">
          <input
            name="patient"
            defaultValue={patientFilter}
            placeholder="Buscar paciente…"
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:border-[#1e3a5f] focus:outline-none flex-1 min-w-[160px]"
          />
          <select name="risk" defaultValue={riskFilter}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 focus:border-[#1e3a5f] focus:outline-none">
            <option value="">Todos os riscos</option>
            <option value="urgent">Com PRMs urgentes</option>
            <option value="high">Com PRMs alto risco</option>
          </select>
          <button type="submit"
            className="rounded-lg bg-[#1e3a5f] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#16304f] transition-colors">
            Filtrar
          </button>
          {(patientFilter || riskFilter) && (
            <Link href="/analyses" className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-1.5 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Limpar
            </Link>
          )}
        </form>
      </div>

      {/* Export button */}
      <div className="flex justify-end">
        <a href="/api/export/prms"
          className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          ⬇️ Exportar PRMs (CSV)
        </a>
      </div>

      {/* Table */}
      {analyses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 dark:border-gray-700 py-16 text-center">
          <FlaskConical className="h-10 w-10 text-gray-200 dark:text-gray-700 mb-3" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Nenhuma análise encontrada</p>
          <Link href="/analysis/new" className="mt-4 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-medium text-white hover:bg-[#16304f] transition-colors">
            Iniciar primeira análise
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Data</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Paciente</th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">PRMs</th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">Urgentes</th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">Altos</th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">Resolução</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {analyses.map((analysis) => {
                  const resolved = analysis.findings.filter(f => f.isResolved).length
                  const total = analysis.findings.length
                  const pct = total > 0 ? Math.round((resolved / total) * 100) : null

                  return (
                    <tr key={analysis.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors group">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {formatDateTime(analysis.createdAt)}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Link href={`/patients/${analysis.patient.id}`}
                          className="font-medium text-gray-900 dark:text-gray-100 hover:text-[#1e3a5f] dark:hover:text-blue-400 transition-colors">
                          {analysis.patient.name || analysis.patient.code}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300">
                          {analysis.totalPRMs}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {analysis.urgentPRMs > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                            {analysis.urgentPRMs}
                          </span>
                        ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {analysis.highRiskPRMs > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-900 px-2 py-0.5 text-xs font-semibold text-orange-700 dark:text-orange-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                            {analysis.highRiskPRMs}
                          </span>
                        ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {pct !== null ? (
                          <div className="flex items-center justify-center gap-2">
                            <div className="h-1.5 w-16 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">{pct}%</span>
                          </div>
                        ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link href={`/analysis/${analysis.id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#1e3a5f] dark:text-blue-400 hover:underline opacity-0 group-hover:opacity-100 transition-opacity">
                          Ver <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 px-5 py-3.5 bg-gray-50/50 dark:bg-gray-800/50">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Página {page} de {pages} · {total} registros
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={buildUrl({ page: page - 1 })}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    ← Anterior
                  </Link>
                )}
                {page < pages && (
                  <Link href={buildUrl({ page: page + 1 })}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    Próxima →
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
