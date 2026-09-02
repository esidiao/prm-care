import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { writeLimiter } from '@/lib/rate-limit'
import prisma from '@/lib/prisma'
import { z } from 'zod'

// Os limites abaixo existem porque `interactions` vai para uma coluna JSON sem
// teto no banco: sem eles, um cliente pode gravar payloads arbitrariamente
// grandes. Os valores cobrem com folga a consulta mais extensa da UI.
const SEVERITIES = ['contraindicated', 'major', 'moderate', 'minor'] as const

const saveSchema = z.object({
  drugs: z.array(z.string().trim().min(1).max(200)).min(2, 'Informe ao menos dois medicamentos.').max(50),
  patientId: z.string().optional(),
  globalRisk: z.string().max(50).optional(),
  interactions: z.array(
    z.object({ severity: z.enum(SEVERITIES).optional() }).passthrough(),
  ).max(500).default([]),
})

/**
 * POST /api/interactions/save
 * Persiste uma consulta de interações no prontuário (opcionalmente vinculada a paciente).
 * Body: { drugs: string[], patientId?: string, globalRisk?: string, globalLabel?: string, interactions: any[] }
 */
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await writeLimiter(session.user.id)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Muitas operações em pouco tempo. Aguarde alguns instantes.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    )
  }

  const body = await req.json().catch(() => ({}))
  const parsed = saveSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Consulta inválida.', details: parsed.error.errors },
      { status: 400 },
    )
  }
  const { drugs, interactions, globalRisk } = parsed.data

  // SECURITY: se vincular paciente, garantir que pertence ao usuário (evita IDOR)
  let patientId: string | null = null
  if (parsed.data.patientId) {
    const p = await prisma.patient.findFirst({ where: { id: parsed.data.patientId, userId: session.user.id }, select: { id: true } })
    if (!p) return NextResponse.json({ error: 'Paciente não encontrado.' }, { status: 404 })
    patientId = p.id
  }

  // Atomicidade: a consulta e seus resultados são gravados juntos ou não são gravados
  const query = await prisma.$transaction(async (tx) => {
    const q = await tx.ddiQuery.create({
      data: {
        userId: session.user.id,
        patientId,
        inputDrugs: drugs,
        globalRisk: globalRisk ?? null,
        count: interactions.length,
      },
    })
    if (interactions.length > 0) {
      await tx.ddiResult.createMany({
        data: interactions.map((it) => ({ queryId: q.id, severity: it.severity ?? 'minor', payload: it as object })),
      })
    }
    return q
  })
  // Trilha de auditoria (sem PII de paciente)
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: 'DDI_CHECK_SAVED', resource: 'interactions', details: { queryId: query.id, count: interactions.length, globalRisk: globalRisk ?? null } },
  }).catch(() => null)

  return NextResponse.json({ id: query.id })
}
