import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { generateReportPDF } from '@/lib/pdf-generator'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const report = await prisma.report.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: {
      analysis: {
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
      },
    },
  })

  if (!report) {
    return NextResponse.json({ error: 'Relatório não encontrado' }, { status: 404 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, crfNumber: true, institution: true },
  })

  try {
    // Se já existe fileUrl como base64, decodificar e servir
    if (report.fileUrl?.startsWith('data:application/pdf;base64,')) {
      const base64Data = report.fileUrl.replace('data:application/pdf;base64,', '')
      const pdfBuffer = Buffer.from(base64Data, 'base64')
      return servePDF(pdfBuffer, report.id)
    }

    // Gerar PDF on-demand
    const pdfBuffer = await generateReportPDF({
      report: {
        id: report.id,
        type: report.type,
        isAnonymized: report.isAnonymized,
        generatedAt: report.generatedAt,
      },
      analysis: report.analysis,
      patient: report.analysis.patient,
      findings: report.analysis.findings ?? [],
      soapRecord: report.analysis.soapRecord ?? null,
      isAnonymized: report.isAnonymized,
      professionalName: user?.name || 'Farmacêutico',
      professionalCRF: user?.crfNumber || undefined,
    })

    // Cachear para próximas requisições
    const base64 = pdfBuffer.toString('base64')
    await prisma.report.update({
      where: { id: report.id },
      data: { fileUrl: `data:application/pdf;base64,${base64}` },
    }).catch(() => {}) // falha silenciosa no cache

    return servePDF(pdfBuffer, report.id)
  } catch (err) {
    console.error('[DOWNLOAD_REPORT]', err)
    return NextResponse.json(
      { error: 'Erro ao gerar PDF. Tente novamente.' },
      { status: 500 }
    )
  }
}

function servePDF(buffer: Buffer, reportId: string): NextResponse {
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="relatorio-prm-${reportId.slice(0, 8)}.pdf"`,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
