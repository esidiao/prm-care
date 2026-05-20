import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

// ── DELETE /api/patients/[id]/scales/[assessmentId] ───────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; assessmentId: string } },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const assessment = await prisma.scaleAssessment.findFirst({
    where: { id: params.assessmentId, patientId: params.id, userId: session.user.id },
  })
  if (!assessment) return NextResponse.json({ error: 'Avaliação não encontrada' }, { status: 404 })

  await prisma.scaleAssessment.delete({ where: { id: params.assessmentId } })
  return NextResponse.json({ success: true })
}
