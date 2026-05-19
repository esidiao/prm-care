import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

// GET /api/analysis/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const analysis = await prisma.pRMAnalysis.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: {
      patient: {
        include: {
          comorbidities: true,
          allergies: true,
          diagnoses: true,
          medications: { where: { isActive: true } },
          labResults: { orderBy: { collectedAt: 'desc' }, take: 20 },
        },
      },
      findings: { orderBy: [{ riskLevel: 'asc' }, { category: 'asc' }] },
      soapRecord: true,
      report: { select: { id: true, type: true, fileUrl: true, generatedAt: true } },
    },
  })

  if (!analysis) return NextResponse.json({ error: 'Análise não encontrada' }, { status: 404 })
  return NextResponse.json({ success: true, data: analysis })
}

// PATCH /api/analysis/[id] — mark finding as resolved
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const analysis = await prisma.pRMAnalysis.findFirst({ where: { id: params.id, userId: session.user.id } })
  if (!analysis) return NextResponse.json({ error: 'Análise não encontrada' }, { status: 404 })

  const { findingId, isResolved, resolvedNotes } = await req.json()

  const updated = await prisma.pRMFinding.update({
    where: { id: findingId },
    data: { isResolved, resolvedNotes, resolvedAt: isResolved ? new Date() : null },
  })

  return NextResponse.json({ success: true, data: updated })
}
