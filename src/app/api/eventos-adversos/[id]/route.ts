import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { writeLimiter } from '@/lib/rate-limit'
import prisma from '@/lib/prisma'
import { logAudit, getClientIp } from '@/lib/audit'
import { z } from 'zod'

/**
 * PATCH /api/eventos-adversos/[id] — registra que a notificação foi enviada.
 *
 * O sistema não submete ao VigiMed; o farmacêutico envia pelo formulário da
 * ANVISA e traz o protocolo de volta. Sem esse registro, "notifiquei?" só se
 * responde pela memória — e é justamente a pergunta que uma inspeção faz.
 */

const patchSchema = z.object({
  notificado: z.boolean(),
  protocoloVigimed: z.string().trim().max(120).optional().nullable(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await writeLimiter(session.user.id)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Muitas operações em pouco tempo. Aguarde alguns instantes.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    )
  }

  // SECURITY: o registro precisa ser do próprio farmacêutico
  const existente = await prisma.adverseEventReport.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { id: true, notificadoEm: true },
  })
  if (!existente) return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 })

  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.issues }, { status: 400 })
  }

  try {
    const atualizado = await prisma.adverseEventReport.update({
      where: { id: existente.id },
      data: parsed.data.notificado
        ? {
            // Preserva a data original numa reedição: o que importa é quando foi
            // notificado, não quando alguém mexeu no campo depois.
            notificadoEm: existente.notificadoEm ?? new Date(),
            protocoloVigimed: parsed.data.protocoloVigimed || null,
          }
        : { notificadoEm: null, protocoloVigimed: null },
      select: { id: true, notificadoEm: true, protocoloVigimed: true },
    })

    await logAudit({
      userId: session.user.id,
      action: parsed.data.notificado ? 'ADVERSE_EVENT_NOTIFIED' : 'ADVERSE_EVENT_UNNOTIFIED',
      resource: 'adverse_event_report',
      resourceId: existente.id,
      ipAddress: getClientIp(req),
      details: { protocolo: parsed.data.protocoloVigimed ?? null },
    })

    return NextResponse.json({ success: true, data: atualizado })
  } catch (err) {
    console.error('[ADVERSE_EVENT_PATCH]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro ao atualizar o registro' }, { status: 500 })
  }
}
