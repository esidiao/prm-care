import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * POST /api/interactions/save
 * Persiste uma consulta de interações no prontuário (opcionalmente vinculada a paciente).
 * Body: { drugs: string[], patientId?: string, globalRisk?: string, globalLabel?: string, interactions: any[] }
 */
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const drugs: string[] = Array.isArray(body?.drugs) ? body.drugs.filter((d: unknown) => typeof d === 'string') : []
  const interactions: Array<{ severity?: string }> = Array.isArray(body?.interactions) ? body.interactions : []
  if (drugs.length < 2) return NextResponse.json({ error: 'Consulta inválida.' }, { status: 400 })

  // SECURITY: se vincular paciente, garantir que pertence ao usuário (evita IDOR)
  let patientId: string | null = null
  if (body?.patientId) {
    const p = await prisma.patient.findFirst({ where: { id: body.patientId, userId: session.user.id }, select: { id: true } })
    if (!p) return NextResponse.json({ error: 'Paciente não encontrado.' }, { status: 404 })
    patientId = p.id
  }

  const query = await prisma.ddiQuery.create({
    data: {
      userId: session.user.id,
      patientId,
      inputDrugs: drugs,
      globalRisk: body?.globalRisk ?? null,
      count: interactions.length,
    },
  })
  if (interactions.length > 0) {
    await prisma.ddiResult.createMany({
      data: interactions.map((it) => ({ queryId: query.id, severity: it.severity ?? 'minor', payload: it as object })),
    })
  }
  // Trilha de auditoria (sem PII de paciente)
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: 'DDI_CHECK_SAVED', resource: 'interactions', details: { queryId: query.id, count: interactions.length, globalRisk: body?.globalRisk ?? null } },
  }).catch(() => null)

  return NextResponse.json({ id: query.id })
}
