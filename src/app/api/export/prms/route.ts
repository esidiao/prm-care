import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logAudit, getClientIp } from '@/lib/audit'

// ── Helpers ────────────────────────────────────────────────────────────────────

function esc(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) return ''
  const str = String(val)
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function row(cells: (string | number | boolean | null | undefined)[]): string {
  return cells.map(esc).join(',')
}

const RISK_LABELS: Record<string, string> = {
  URGENT: 'Urgente',
  HIGH: 'Alto',
  MODERATE: 'Moderado',
  LOW: 'Baixo',
}

const CATEGORY_LABELS: Record<string, string> = {
  NECESSITY: 'Necessidade',
  EFFECTIVENESS: 'Efetividade',
  SAFETY: 'Segurança',
  ADHERENCE: 'Adesão',
}

// ── GET /api/export/prms?patientId=xxx ────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  await logAudit({
    userId:    session.user.id,
    action:    'EXPORT_PRMS',
    resource:  'prm_findings',
    ipAddress: getClientIp(req),
    details:   { format: 'csv' },
  })


  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get('patientId') // optional filter

  // Build where clause — always scoped to user via analysis.userId
  const whereAnalysis = patientId
    ? { userId: session.user.id, patientId }
    : { userId: session.user.id }

  const analyses = await prisma.pRMAnalysis.findMany({
    where: whereAnalysis,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      patient: {
        select: { code: true, name: true },
      },
      findings: {
        orderBy: [{ riskLevel: 'asc' }, { category: 'asc' }],
        select: {
          id: true,
          title: true,
          category: true,
          riskLevel: true,
          description: true,
          potentialImpact: true,
          clinicalEvidence: true,
          pharmacistConduct: true,
          patientGuidance: true,
          monitoring: true,
          interventionDeadline: true,
          needsPrescriberContact: true,
          isResolved: true,
          resolvedAt: true,
          resolvedNotes: true,
        },
      },
    },
  })

  const headers = [
    'ID Análise',
    'Data Análise',
    'Código Paciente',
    'Nome Paciente',
    'ID PRM',
    'Título do PRM',
    'Categoria',
    'Nível de Risco',
    'Descrição',
    'Impacto Potencial',
    'Evidência Clínica',
    'Conduta Farmacêutica',
    'Orientação ao Paciente',
    'Monitoramento',
    'Prazo de Intervenção',
    'Necessita Prescritor',
    'Resolvido',
    'Data Resolução',
    'Notas de Resolução',
  ]

  const lines: string[] = [headers.map(esc).join(',')]

  for (const analysis of analyses) {
    if (analysis.findings.length === 0) continue
    for (const f of analysis.findings) {
      lines.push(row([
        analysis.id,
        analysis.createdAt.toISOString().slice(0, 10),
        analysis.patient.code,
        analysis.patient.name ?? '',
        f.id,
        f.title,
        CATEGORY_LABELS[f.category] ?? f.category,
        RISK_LABELS[f.riskLevel] ?? f.riskLevel,
        f.description,
        f.potentialImpact ?? '',
        f.clinicalEvidence ?? '',
        f.pharmacistConduct ?? '',
        f.patientGuidance ?? '',
        f.monitoring ?? '',
        f.interventionDeadline ?? '',
        f.needsPrescriberContact ? 'Sim' : 'Não',
        f.isResolved ? 'Sim' : 'Não',
        f.resolvedAt ? f.resolvedAt.toISOString().slice(0, 10) : '',
        f.resolvedNotes ?? '',
      ]))
    }
  }

  const csv = '﻿' + lines.join('\r\n')
  const date = new Date().toISOString().slice(0, 10)
  const suffix = patientId ? `_paciente` : '_todos'

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="prms${suffix}_${date}.csv"`,
    },
  })
}
