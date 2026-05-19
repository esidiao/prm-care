import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { consumeTokens, hasEnoughTokens } from '@/lib/token-service'
import { generateReportPDF } from '@/lib/pdf-generator'
import { ReportType } from '@prisma/client'

const REPORT_COSTS: Record<ReportType, number> = {
  SIMPLE: 2,
  COMPLETE: 2,
  SOAP: 2,
  INSTITUTIONAL: 5,
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { analysisId, type = 'COMPLETE', isAnonymized = false } = await req.json()

    if (!analysisId) return NextResponse.json({ error: 'analysisId obrigatório' }, { status: 400 })

    // Verificar ownership
    const analysis = await prisma.pRMAnalysis.findFirst({
      where: { id: analysisId, userId: session.user.id },
      include: {
        patient: {
          include: {
            comorbidities: true,
            allergies: true,
            diagnoses: true,
            medications: { where: { isActive: true } },
            labResults: true,
          },
        },
        findings: { orderBy: [{ riskLevel: 'asc' }] },
        soapRecord: true,
      },
    })

    if (!analysis) return NextResponse.json({ error: 'Análise não encontrada' }, { status: 404 })

    // Verificar plano
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true, name: true, email: true, crfNumber: true, institution: true },
    })

    if (user?.plan === 'FREE') {
      return NextResponse.json(
        { error: 'Exportação de PDF não disponível no plano gratuito. Faça upgrade.' },
        { status: 403 }
      )
    }

    // Verificar relatório já existente
    const existingReport = await prisma.report.findUnique({ where: { analysisId } })
    if (existingReport) {
      return NextResponse.json({
        success: true,
        data: existingReport,
        message: 'Relatório já existente.',
      })
    }

    const reportType = type as ReportType
    const cost = REPORT_COSTS[reportType] ?? 2

    const sufficient = await hasEnoughTokens(session.user.id, cost)
    if (!sufficient) {
      return NextResponse.json({
        error: `Saldo insuficiente. Geração de relatório requer ${cost} token(s).`,
        required: cost,
      }, { status: 402 })
    }

    // Consumir tokens
    const tokenOp = await consumeTokens(
      session.user.id,
      cost,
      `Geração de relatório PDF (${reportType}) — paciente ${analysis.patient.code}`,
      analysisId,
    )
    if (!tokenOp.success) return NextResponse.json({ error: tokenOp.error }, { status: 402 })

    // Criar registro do relatório
    const report = await prisma.report.create({
      data: {
        analysisId,
        userId: session.user.id,
        type: reportType,
        tokensConsumed: cost,
        isAnonymized,
        professionalId: session.user.id,
      },
    })

    // Gerar PDF em background (não bloqueia resposta)
    generatePDFInBackground(report.id, analysis, user, isAnonymized, reportType)

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE_REPORT',
        resource: 'report',
        resourceId: report.id,
        details: { analysisId, type: reportType, cost },
      },
    })

    return NextResponse.json({ success: true, data: report }, { status: 201 })
  } catch (err: any) {
    console.error('[CREATE_REPORT]', err)
    return NextResponse.json({ error: 'Erro interno ao criar relatório.' }, { status: 500 })
  }
}

async function generatePDFInBackground(
  reportId: string,
  analysis: any,
  user: any,
  isAnonymized: boolean,
  reportType: ReportType
) {
  try {
    const pdfBuffer = await generateReportPDF({
      report: { id: reportId, type: reportType, isAnonymized, generatedAt: new Date() },
      analysis,
      patient: analysis.patient,
      findings: analysis.findings ?? [],
      soapRecord: analysis.soapRecord ?? null,
      isAnonymized,
      professionalName: user?.name || 'Farmacêutico',
      professionalCRF: user?.crfNumber || undefined,
    })

    // Salvar PDF como base64 no banco (sem storage externo)
    const base64 = pdfBuffer.toString('base64')
    await prisma.report.update({
      where: { id: reportId },
      data: { fileUrl: `data:application/pdf;base64,${base64}` },
    })
  } catch (err) {
    console.error('[PDF_GENERATION_ERROR]', err)
    // Falha silenciosa — relatório fica sem fileUrl, download fica disponível via rota on-demand
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

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

  return NextResponse.json({ success: true, data: reports })
}
