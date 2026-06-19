import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * POST /api/reconciliation
 * Persiste uma conciliação (snapshot dos medicamentos + notas clínicas).
 * Body: { patientId, source?, snapshot, riscos?, intervencoes?, orientacoes?, recomendacoes?, plano? }
 */
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const b = await req.json().catch(() => ({}))
  if (!b?.patientId) return NextResponse.json({ error: 'Paciente obrigatório.' }, { status: 400 })

  // SECURITY: paciente deve pertencer ao usuário (evita IDOR)
  const patient = await prisma.patient.findFirst({ where: { id: b.patientId, userId: session.user.id }, select: { id: true } })
  if (!patient) return NextResponse.json({ error: 'Paciente não encontrado.' }, { status: 404 })

  const rec = await prisma.reconciliation.create({
    data: {
      patientId: patient.id,
      userId: session.user.id,
      source: typeof b.source === 'string' ? b.source : null,
      snapshot: (b.snapshot ?? {}) as object,
      riscos: b.riscos ?? null,
      intervencoes: b.intervencoes ?? null,
      orientacoes: b.orientacoes ?? null,
      recomendacoes: b.recomendacoes ?? null,
      plano: b.plano ?? null,
    },
  })
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: 'RECON_CREATED', resource: 'reconciliation', resourceId: rec.id, details: { patientId: patient.id } },
  }).catch(() => null)

  return NextResponse.json({ id: rec.id })
}
