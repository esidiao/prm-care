import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, AlertTriangle, CheckCircle, FileText,
  User, Pill, Activity, Printer, Send, ChevronDown, ChevronUp
} from 'lucide-react'
import { formatDateTime, RISK_LEVEL_CONFIG, PRM_CATEGORY_LABELS } from '@/lib/utils'
import { RiskLevel, PRMCategory } from '@prisma/client'
import { FindingsPanel } from '@/components/analysis/FindingsPanel'
import { AnalysisComparison } from '@/components/analysis/AnalysisComparison'
import { PgxAlerts } from '@/components/pgx/PgxAlerts'
import { LabTrends } from '@/components/analysis/LabTrends'
import { SoapRecord } from '@/components/analysis/SoapRecord'

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
          labResults: { orderBy: { collectedAt: 'desc' }, take: 40 },
        },
      },
      findings: {
        orderBy: [{ riskLevel: 'asc' }, { category: 'asc' }],
      },
      soapRecord: { include: { attestedBy: { select: { name: true, crfNumber: true } } } },
      report: true,
    },
  })

  if (!analysis) notFound()

  // Fetch previous analysis for same patient (for comparison)
  const previousAnalysis = await prisma.pRMAnalysis.findFirst({
    where: {
      patientId: analysis.patientId,
      userId: session.user.id,
      id: { not: analysis.id },
      status: 'COMPLETED',
    },
    orderBy: { createdAt: 'desc' },
    include: {
      findings: { select: { id: true, title: true, riskLevel: true, category: true, isResolved: true } },
    },
  }).catch(() => null)

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
        <Link href={`/patients/${analysis.patientId}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Paciente
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Resultado da Análise PRM</h1>
          <p className="text-muted-foreground text-sm">{formatDateTime(analysis.createdAt)} · Paciente: {analysis.patient.name || analysis.patient.code}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Carta para o médico — acesso rápido e visível */}
          <Link href={`/patients/${analysis.patientId}/referral`}
            className="flex items-center gap-2 rounded-lg border border-teal-600 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-100 transition-colors">
            <Send className="h-4 w-4" /> Carta ao Médico
          </Link>
          {!analysis.report ? (
            <Link href={`/reports/new?analysisId=${analysis.id}`}
              className="flex items-center gap-2 rounded-lg border border-brand-800 px-4 py-2 text-sm font-medium text-brand-800 hover:bg-[#eff6ff] transition-colors">
              <FileText className="h-4 w-4" /> Gerar Relatório
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
          { label: 'Total de PRMs', value: analysis.totalPRMs, color: 'text-foreground' },
          { label: 'Urgentes', value: analysis.urgentPRMs, color: analysis.urgentPRMs > 0 ? 'text-red-600' : 'text-muted-foreground' },
          { label: 'Alto risco', value: analysis.highRiskPRMs, color: analysis.highRiskPRMs > 0 ? 'text-orange-600' : 'text-muted-foreground' },
          { label: 'Moderados', value: analysis.moderatePRMs, color: analysis.moderatePRMs > 0 ? 'text-yellow-600' : 'text-muted-foreground' },
        ].map((s, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 shadow-sm text-center">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-brand-800" />
          <h2 className="font-semibold text-foreground">Resumo clínico</h2>
        </div>
        {/* Split summary into sentences for readability */}
        <div className="space-y-1.5">
          {(analysis.summary ?? '').split(/(?<=[.!?])\s+/).filter(Boolean).map((sentence, i) => (
            <p key={i} className="text-sm text-foreground leading-relaxed flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-brand-800/30 flex-shrink-0" />
              {sentence}
            </p>
          ))}
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-amber-600" />
          <span>Análise baseada nos dados informados. Valide com exame clínico e dados complementares antes de intervir.</span>
        </div>
      </div>

      {/* Comparação com análise anterior */}
      {previousAnalysis && (
        <AnalysisComparison
          currentAnalysisId={analysis.id}
          previousAnalysis={{
            id: previousAnalysis.id,
            createdAt: previousAnalysis.createdAt.toISOString(),
            totalPRMs: previousAnalysis.totalPRMs,
            urgentPRMs: previousAnalysis.urgentPRMs,
            highRiskPRMs: previousAnalysis.highRiskPRMs,
            findings: previousAnalysis.findings.map(f => ({
              id: f.id,
              title: f.title,
              riskLevel: f.riskLevel,
              category: f.category,
              isResolved: f.isResolved,
            })),
          }}
          currentFindings={analysis.findings.map(f => ({
            id: f.id,
            title: f.title,
            riskLevel: f.riskLevel,
            category: f.category,
            isResolved: f.isResolved,
          }))}
        />
      )}

      {/* PRM Findings — painel interativo com filtros e resolução inline */}
      <FindingsPanel
        findings={analysis.findings.map(f => ({
          ...f,
          resolvedAt: f.resolvedAt?.toISOString() ?? null,
        }))}
        analysisId={analysis.id}
        totalPRMs={analysis.totalPRMs}
      />

      {/* Monitoramento temporal de exames — piora/tendência entre medidas recentes */}
      <LabTrends labs={analysis.patient.labResults.map(l => ({ examName: l.examName, value: l.value, collectedAt: l.collectedAt?.toISOString() ?? null }))} />

      {/* Farmacogenômica (CPIC) — derivada automaticamente dos medicamentos */}
      <PgxAlerts drugs={analysis.patient.medications.map(m => m.activeIngredient)} />

      {/* SOAP — registro clínico revisável pelo farmacêutico */}
      {analysis.soapRecord && (
        <SoapRecord
          analysisId={analysis.id}
          soap={{
            subjective: analysis.soapRecord.subjective,
            objective: analysis.soapRecord.objective,
            assessment: analysis.soapRecord.assessment,
            plan: analysis.soapRecord.plan,
            createdAt: analysis.soapRecord.createdAt.toISOString(),
            updatedAt: analysis.soapRecord.updatedAt.toISOString(),
            attestedAt: analysis.soapRecord.attestedAt?.toISOString() ?? null,
            attestedBy: analysis.soapRecord.attestedBy
              ? { name: analysis.soapRecord.attestedBy.name, crfNumber: analysis.soapRecord.attestedBy.crfNumber }
              : null,
          }}
        />
      )}

      {/* Footer disclaimer */}
      <div className="rounded-xl border border-border bg-muted p-5 text-xs text-muted-foreground space-y-1">
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
