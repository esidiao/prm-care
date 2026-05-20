import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FlaskConical, History } from 'lucide-react'
import { PatientTimeline } from '@/components/patients/PatientTimeline'

export default async function PatientHistoryPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return null

  const patient = await prisma.patient.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { id: true, name: true, code: true },
  })

  if (!patient) notFound()

  // Busca TODAS as análises (sem limite) com todos os findings
  const rawAnalyses = await prisma.pRMAnalysis.findMany({
    where: { patientId: params.id, userId: session.user.id },
    include: {
      findings: {
        select: {
          id: true,
          title: true,
          category: true,
          riskLevel: true,
          isResolved: true,
          description: true,
        },
        orderBy: [{ riskLevel: 'asc' }, { category: 'asc' }],
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Serializar para o client component (Date → string, Enum → string)
  const analyses = rawAnalyses.map(a => ({
    id: a.id,
    createdAt: a.createdAt.toISOString(),
    totalPRMs: a.totalPRMs,
    urgentPRMs: a.urgentPRMs,
    highRiskPRMs: a.highRiskPRMs,
    moderatePRMs: a.moderatePRMs,
    lowPRMs: a.findings.filter(f => f.riskLevel === 'LOW').length,
    resolvedPRMs: a.findings.filter(f => f.isResolved).length,
    findings: a.findings.map(f => ({
      id: f.id,
      title: f.title,
      category: f.category as string,
      riskLevel: f.riskLevel as string,
      isResolved: f.isResolved,
      description: f.description,
    })),
  }))

  const patientLabel = patient.name || patient.code

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/patients" className="hover:text-gray-700">Pacientes</Link>
        <span>/</span>
        <Link href={`/patients/${patient.id}`} className="hover:text-gray-700">{patientLabel}</Link>
        <span>/</span>
        <span className="text-gray-800 font-medium">Histórico</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1e3a5f]/10">
            <History className="h-5 w-5 text-[#1e3a5f]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Histórico de análises</h1>
            <p className="text-sm text-gray-500">{patientLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/patients/${patient.id}`}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <Link href={`/analysis/new?patientId=${patient.id}`}
            className="flex items-center gap-2 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-medium text-white hover:bg-[#162d4a] transition-colors">
            <FlaskConical className="h-4 w-4" /> Nova análise
          </Link>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <PatientTimeline analyses={analyses} patientId={patient.id} />
      </div>
    </div>
  )
}
