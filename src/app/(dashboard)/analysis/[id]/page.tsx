import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, AlertTriangle, CheckCircle, FileText,
  User, Pill, Activity, BookOpen, Printer
} from 'lucide-react'
import { formatDateTime, RISK_LEVEL_CONFIG, PRM_CATEGORY_LABELS } from '@/lib/utils'
import { RiskLevel, PRMCategory } from '@prisma/client'

export default async function AnalysisResultPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return null

  const analysis = await prisma.pRMAnalysis.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: {
      patient: {
        include: {
          comorbidities: true,
          allergies: true,
          diagnoses: true,
          medications: { where: { isActive: true } },
        },
      },
      findings: {
        orderBy: [{ riskLevel: 'asc' }, { category: 'asc' }],
      },
      soapRecord: true,
      report: true,
    },
  })

  if (!analysis) notFound()

  const urgentFindings = analysis.findings.filter(f => f.riskLevel === RiskLevel.URGENT)
  const highFindings = analysis.findings.filter(f => f.riskLevel === RiskLevel.HIGH)
  const moderateFindings = analysis.findings.filter(f => f.riskLevel === RiskLevel.MODERATE)
  const lowFindings = analysis.findings.filter(f => f.riskLevel === RiskLevel.LOW)

  const riskBadge = (level: RiskLevel) => {
    const cfg = RISK_LEVEL_CONFIG[level]
    return <span className={`${cfg.badge} inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium`}>{cfg.label}</span>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/patients/${analysis.patientId}`} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Paciente
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Resultado da Análise PRM</h1>
          <p className="text-gray-500 text-sm">{formatDateTime(analysis.createdAt)} · Paciente: {analysis.patient.name || analysis.patient.code}</p>
        </div>
        <div className="flex gap-2">
          {!analysis.report ? (
            <Link href={`/reports/new?analysisId=${analysis.id}`}
              className="flex items-center gap-2 rounded-lg border border-[#1e3a5f] px-4 py-2 text-sm font-medium text-[#1e3a5f] hover:bg-[#eff6ff] transition-colors">
              <FileText className="h-4 w-4" /> Gerar relatório PDF
            </Link>
          ) : (
            <a href={`/api/reports/${analysis.report.id}/download`}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors">
              <Printer className="h-4 w-4" /> Baixar PDF
            </a>
          )}
        </div>
      </div>

      {/* Urgent alert */}
      {urgentFindings.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border-2 border-red-300 bg-red-50 p-5">
          <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-800 text-lg">⚠️ {urgentFindings.length} PRM(s) URGENTE(s) identificado(s)</p>
            <p className="text-sm text-red-700 mt-1">Requerem intervenção imediata (até 24h). Avalie necessidade de encaminhamento.</p>
            <ul className="mt-2 space-y-1">
              {urgentFindings.map(f => (
                <li key={f.id} className="text-sm font-medium text-red-700">• {f.title}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {[
          { label: 'Total de PRMs', value: analysis.totalPRMs, color: 'text-gray-900' },
          { label: 'Urgentes', value: analysis.urgentPRMs, color: analysis.urgentPRMs > 0 ? 'text-red-600' : 'text-gray-400' },
          { label: 'Alto risco', value: analysis.highRiskPRMs, color: analysis.highRiskPRMs > 0 ? 'text-orange-600' : 'text-gray-400' },
          { label: 'Moderados', value: analysis.moderatePRMs, color: analysis.moderatePRMs > 0 ? 'text-yellow-600' : 'text-gray-400' },
        ].map((s, i) => (
          <div key={i} className="rounded-xl border bg-white p-5 shadow-sm text-center">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900 mb-2">Resumo clínico</h2>
        <p className="text-sm text-gray-700 leading-relaxed">{analysis.summary}</p>
        <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          <strong>Aviso:</strong> Esta análise é baseada nos dados informados e deve ser validada por profissional habilitado.
          Dados incompletos podem limitar as conclusões.
        </div>
      </div>

      {/* PRM Findings */}
      {analysis.findings.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center shadow-sm">
          <CheckCircle className="mx-auto mb-3 h-12 w-12 text-green-400" />
          <p className="font-semibold text-gray-700">Nenhum PRM identificado com os dados informados</p>
          <p className="text-sm text-gray-400 mt-1">Isso não exclui a existência de problemas não detectáveis com os dados disponíveis.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Problemas identificados ({analysis.totalPRMs})</h2>
          {[
            { level: RiskLevel.URGENT, findings: urgentFindings },
            { level: RiskLevel.HIGH, findings: highFindings },
            { level: RiskLevel.MODERATE, findings: moderateFindings },
            { level: RiskLevel.LOW, findings: lowFindings },
          ].filter(g => g.findings.length > 0).map(({ level, findings }) => (
            <div key={level} className={`rounded-xl border-l-4 ${
              level === RiskLevel.URGENT ? 'border-l-red-500 bg-red-50 border border-red-200' :
              level === RiskLevel.HIGH ? 'border-l-orange-500 bg-orange-50 border border-orange-200' :
              level === RiskLevel.MODERATE ? 'border-l-yellow-500 bg-yellow-50 border border-yellow-200' :
              'border-l-green-500 bg-green-50 border border-green-200'
            } p-0 overflow-hidden shadow-sm`}>
              <div className={`px-5 py-3 font-semibold flex items-center justify-between ${
                level === RiskLevel.URGENT ? 'bg-red-100 text-red-800' :
                level === RiskLevel.HIGH ? 'bg-orange-100 text-orange-800' :
                level === RiskLevel.MODERATE ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}>
                <span>{RISK_LEVEL_CONFIG[level].label}</span>
                <span className="text-sm font-normal">{findings.length} PRM(s)</span>
              </div>
              <div className="divide-y">
                {findings.map((finding) => (
                  <div key={finding.id} className="bg-white p-5 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          {riskBadge(finding.riskLevel)}
                          <span className="text-xs rounded-full bg-gray-100 px-2.5 py-0.5 text-gray-600">
                            {PRM_CATEGORY_LABELS[finding.category]}
                          </span>
                          <span className={`text-xs rounded-full px-2.5 py-0.5 ${
                            finding.confidenceLevel === 'high' ? 'bg-green-50 text-green-700' :
                            finding.confidenceLevel === 'moderate' ? 'bg-yellow-50 text-yellow-700' :
                            'bg-gray-50 text-gray-600'
                          }`}>
                            Confiança: {finding.confidenceLevel === 'high' ? 'Alta' : finding.confidenceLevel === 'moderate' ? 'Moderada' : 'Baixa'}
                          </span>
                        </div>
                        <h3 className="font-semibold text-gray-900">{finding.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{finding.description}</p>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 text-sm">
                      <div className="rounded-lg bg-blue-50 p-3">
                        <p className="text-xs font-semibold text-blue-700 mb-1">📋 Evidência clínica</p>
                        <p className="text-gray-700">{finding.clinicalEvidence}</p>
                      </div>
                      <div className="rounded-lg bg-orange-50 p-3">
                        <p className="text-xs font-semibold text-orange-700 mb-1">⚠️ Impacto potencial</p>
                        <p className="text-gray-700">{finding.potentialImpact}</p>
                      </div>
                      <div className="rounded-lg bg-green-50 p-3">
                        <p className="text-xs font-semibold text-green-700 mb-1">💊 Conduta farmacêutica</p>
                        <p className="text-gray-700">{finding.pharmacistConduct}</p>
                      </div>
                      <div className="rounded-lg bg-purple-50 p-3">
                        <p className="text-xs font-semibold text-purple-700 mb-1">🗣 Orientação ao paciente</p>
                        <p className="text-gray-700">{finding.patientGuidance}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 text-xs">
                      {finding.needsPrescriberContact && (
                        <span className="flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700">
                          📞 Contato com prescritor recomendado
                        </span>
                      )}
                      {finding.needsReferral && (
                        <span className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-red-700">
                          🏥 Encaminhamento recomendado
                        </span>
                      )}
                      {finding.interventionDeadline && (
                        <span className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-gray-600">
                          ⏱ Prazo: {finding.interventionDeadline}
                        </span>
                      )}
                      {finding.reevaluationPeriod && (
                        <span className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-gray-600">
                          🔄 Reavaliação: {finding.reevaluationPeriod}
                        </span>
                      )}
                    </div>

                    {finding.monitoring && (
                      <div className="rounded-lg border border-gray-200 p-3 text-xs text-gray-600">
                        <span className="font-semibold text-gray-800">Monitoramento: </span>{finding.monitoring}
                      </div>
                    )}

                    <div className="rounded-lg border border-amber-100 bg-amber-50 p-2.5 text-xs text-amber-700">
                      <strong>Nota de validação:</strong> {finding.validationNote}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SOAP */}
      {analysis.soapRecord && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b bg-[#1e3a5f] px-5 py-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> Registro SOAP
            </h2>
          </div>
          <div className="grid gap-0 divide-y md:grid-cols-1">
            {[
              { label: 'S — Subjetivo', content: analysis.soapRecord.subjective, color: 'bg-blue-50', labelColor: 'text-blue-800' },
              { label: 'O — Objetivo', content: analysis.soapRecord.objective, color: 'bg-gray-50', labelColor: 'text-gray-800' },
              { label: 'A — Avaliação', content: analysis.soapRecord.assessment, color: 'bg-yellow-50', labelColor: 'text-yellow-800' },
              { label: 'P — Plano', content: analysis.soapRecord.plan, color: 'bg-green-50', labelColor: 'text-green-800' },
            ].map(({ label, content, color, labelColor }) => (
              <div key={label} className={`${color} p-5`}>
                <p className={`text-sm font-bold mb-2 ${labelColor}`}>{label}</p>
                <p className="text-sm text-gray-700 whitespace-pre-line">{content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer disclaimer */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-xs text-gray-500 space-y-1">
        <p><strong>Limitações desta análise:</strong></p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>As análises são baseadas exclusivamente nos dados informados.</li>
          <li>Dados incompletos podem gerar conclusões limitadas.</li>
          <li>Recomendações devem ser validadas por profissional habilitado.</li>
          <li>Não interrompa, substitua ou ajuste medicamentos sem orientação profissional.</li>
          <li>Em sinais de urgência, encaminhe imediatamente para atendimento de saúde.</li>
        </ul>
        <p className="pt-1">Análise gerada em {formatDateTime(analysis.createdAt)} · PRM Care</p>
      </div>
    </div>
  )
}
