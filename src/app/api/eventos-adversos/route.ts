import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { writeLimiter } from '@/lib/rate-limit'
import prisma from '@/lib/prisma'
import { logAudit, getClientIp } from '@/lib/audit'
import { z } from 'zod'

/**
 * Suspeita de reação adversa a medicamento (lacuna 10).
 *
 * GET  — lista do farmacêutico, NÃO NOTIFICADAS primeiro: a pendência é o ponto.
 * POST — registra a suspeita no prontuário.
 *
 * Não submete ao VigiMed: não há API pública para notificação por profissional.
 * O envio é manual pelo formulário aberto da ANVISA, e o protocolo volta para cá
 * pelo PATCH em /api/eventos-adversos/[id].
 */

const GRAVIDADES = ['NAO_GRAVE', 'OBITO', 'AMEACA_VIDA', 'HOSPITALIZACAO',
  'INCAPACIDADE', 'ANOMALIA_CONGENITA', 'CLINICAMENTE_RELEVANTE'] as const
const DESFECHOS = ['RECUPERADO', 'RECUPERANDO', 'NAO_RECUPERADO', 'SEQUELA',
  'OBITO', 'DESCONHECIDO'] as const
const ACOES = ['SUSPENSO', 'DOSE_REDUZIDA', 'DOSE_AUMENTADA', 'MANTIDO', 'DESCONHECIDO'] as const
const REEXPOSICOES = ['REAPARECEU', 'NAO_REAPARECEU', 'NAO_APLICA', 'DESCONHECIDO'] as const

// Os mesmos valores estão em CHECK no banco. A duplicação é deliberada: a UI
// rejeita cedo com mensagem em português, o banco rejeita qualquer outro caminho.
const criarSchema = z.object({
  patientId: z.string().min(1, 'Paciente obrigatório'),
  medicamentos: z.string().trim().min(1, 'Informe o medicamento suspeito').max(2000),
  reacao: z.string().trim().min(1, 'Descreva a reação observada').max(5000),
  dataInicio: z.string().min(1, 'Data de início obrigatória'),
  dataFim: z.string().optional().nullable(),
  gravidade: z.enum(GRAVIDADES),
  desfecho: z.enum(DESFECHOS),
  acaoTomada: z.enum(ACOES),
  reexposicao: z.enum(REEXPOSICOES).default('NAO_APLICA'),
  historicoRelevante: z.string().trim().max(3000).optional().nullable(),
  observacoes: z.string().trim().max(3000).optional().nullable(),
})

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const eventos = await prisma.adverseEventReport.findMany({
    where: { userId: session.user.id },
    // Não notificadas primeiro; entre elas, a mais antiga na frente — é a que
    // está esperando há mais tempo.
    orderBy: [{ notificadoEm: { sort: 'asc', nulls: 'first' } }, { dataInicio: 'asc' }],
    select: {
      id: true, medicamentos: true, reacao: true, dataInicio: true,
      gravidade: true, desfecho: true, notificadoEm: true, protocoloVigimed: true,
      patient: { select: { id: true, code: true } },
    },
    take: 200,
  })

  return NextResponse.json({ eventos })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await writeLimiter(session.user.id)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Muitas operações em pouco tempo. Aguarde alguns instantes.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    )
  }

  const parsed = criarSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.issues }, { status: 400 })
  }
  const d = parsed.data

  // SECURITY: o paciente precisa ser do próprio farmacêutico (evita IDOR)
  const paciente = await prisma.patient.findFirst({
    where: { id: d.patientId, userId: session.user.id },
    select: { id: true },
  })
  if (!paciente) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })

  const dataInicio = new Date(d.dataInicio)
  if (Number.isNaN(dataInicio.getTime())) {
    return NextResponse.json({ error: 'Data de início inválida' }, { status: 400 })
  }
  const dataFim = d.dataFim ? new Date(d.dataFim) : null
  if (dataFim && Number.isNaN(dataFim.getTime())) {
    return NextResponse.json({ error: 'Data de término inválida' }, { status: 400 })
  }
  if (dataFim && dataFim < dataInicio) {
    return NextResponse.json({ error: 'A data de término não pode ser anterior ao início' }, { status: 400 })
  }

  try {
    const evento = await prisma.adverseEventReport.create({
      data: {
        patientId: d.patientId,
        userId: session.user.id,
        medicamentos: d.medicamentos,
        reacao: d.reacao,
        dataInicio,
        dataFim,
        gravidade: d.gravidade,
        desfecho: d.desfecho,
        acaoTomada: d.acaoTomada,
        reexposicao: d.reexposicao,
        historicoRelevante: d.historicoRelevante || null,
        observacoes: d.observacoes || null,
      },
      select: { id: true },
    })

    await logAudit({
      userId: session.user.id,
      action: 'CREATE_ADVERSE_EVENT',
      resource: 'adverse_event_report',
      resourceId: evento.id,
      ipAddress: getClientIp(req),
      details: { patientId: d.patientId, gravidade: d.gravidade },
    })

    return NextResponse.json({ success: true, data: evento }, { status: 201 })
  } catch (err) {
    console.error('[ADVERSE_EVENT_POST]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro ao registrar a suspeita' }, { status: 500 })
  }
}
