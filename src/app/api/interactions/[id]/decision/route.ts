import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * POST /api/interactions/[id]/decision
 * Registra/atualiza a decisão clínica do farmacêutico para uma consulta salva.
 * Body: { note?: string, intervened?: boolean, contactedMD?: boolean, outcome?: string }
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // SECURITY: a consulta deve pertencer ao usuário
  const query = await prisma.ddiQuery.findFirst({ where: { id: params.id, userId: session.user.id }, select: { id: true } })
  if (!query) return NextResponse.json({ error: 'Consulta não encontrada.' }, { status: 404 })

  const b = await req.json().catch(() => ({}))
  const data = {
    note: typeof b?.note === 'string' ? b.note : null,
    intervened: !!b?.intervened,
    contactedMD: !!b?.contactedMD,
    outcome: typeof b?.outcome === 'string' ? b.outcome : null,
  }

  const decision = await prisma.ddiDecision.upsert({
    where: { queryId: query.id },
    update: data,
    create: { queryId: query.id, ...data },
  })

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: 'DDI_DECISION', resource: 'interactions', details: { queryId: query.id, intervened: data.intervened, contactedMD: data.contactedMD } },
  }).catch(() => null)

  return NextResponse.json({ ok: true, id: decision.id })
}
