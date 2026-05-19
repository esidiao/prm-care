import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import { FileText, Download, Plus, Printer, Calendar } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

const REPORT_TYPE_LABELS: Record<string, string> = {
  SIMPLE: 'Simples',
  COMPLETE: 'Completo',
  SOAP: 'SOAP',
  INSTITUTIONAL: 'Institucional',
}

export default async function ReportsPage() {
  const session = await getSession()
  if (!session) return null

  const reports = await prisma.report.findMany({
    where: { userId: session.user.id },
    include: {
      analysis: {
        include: { patient: { select: { code: true, name: true } } },
      },
    },
    orderBy: { generatedAt: 'desc' },
    take: 30,
  })

  const pendingAnalyses = await prisma.pRMAnalysis.findMany({
    where: { userId: session.user.id, report: null, status: 'COMPLETED' },
    include: { patient: { select: { code: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {reports.length} relatório{reports.length !== 1 ? 's' : ''} gerado{reports.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/analysis/new" className="btn-primary">
          <Plus className="h-4 w-4" /> Nova análise
        </Link>
      </div>

      {/* Pending analyses */}
      {pendingAnalyses.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
          <h3 className="mb-3 text-sm font-semibold text-blue-800">
            Análises prontas para gerar relatório
          </h3>
          <div className="space-y-2">
            {pendingAnalyses.map((analysis) => (
              <div key={analysis.id}
                className="flex items-center justify-between rounded-lg border border-blue-100 bg-white px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {analysis.patient.name || analysis.patient.code}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatDateTime(analysis.createdAt)} · {analysis.totalPRMs} PRM(s)
                  </p>
                </div>
                <Link href={`/reports/new?analysisId=${analysis.id}`} className="btn-primary text-xs px-3 py-1.5">
                  <Printer className="h-3.5 w-3.5" /> Gerar PDF
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reports list */}
      {reports.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 mb-4">
            <FileText className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-700">Nenhum relatório gerado</h3>
          <p className="mt-1 text-sm text-gray-400 max-w-xs">
            Realize uma análise e gere o relatório em PDF para download
          </p>
          <Link href="/analysis/new" className="btn-primary mt-6">
            <Plus className="h-4 w-4" /> Nova análise
          </Link>
        </div>
      ) : (
        <div className="card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header-cell">Paciente</th>
                <th className="table-header-cell">Tipo</th>
                <th className="table-header-cell">Gerado em</th>
                <th className="table-header-cell">Tokens</th>
                <th className="table-header-cell w-32"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {reports.map((report) => {
                const initials = (report.analysis.patient.name || report.analysis.patient.code).slice(0, 2).toUpperCase()
                return (
                  <tr key={report.id} className="hover:bg-gray-50/70 transition-colors group">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-orange-50 text-xs font-bold text-orange-700">
                          {initials}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {report.analysis.patient.name || report.analysis.patient.code}
                          </p>
                          {report.isAnonymized && (
                            <span className="text-xs text-gray-400">Anonimizado</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 border border-blue-100">
                        {REPORT_TYPE_LABELS[report.type] || report.type}
                      </span>
                    </td>
                    <td className="table-cell text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        {formatDateTime(report.generatedAt)}
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        {report.tokensConsumed} tk
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link href={`/analysis/${report.analysisId}`}
                          className="text-xs font-medium text-[#1e3a5f] hover:underline">
                          Ver análise
                        </Link>
                        <a href={`/api/reports/${report.id}/download`}
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
