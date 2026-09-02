import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { writeLimiter } from '@/lib/rate-limit'
import prisma from '@/lib/prisma'
import { logAudit, getClientIp } from '@/lib/audit'
import { z } from 'zod'

/**
 * PATCH /api/analysis/[id]/soap
 *
 * O registro SOAP nasce de `generateSOAP()` no motor determinístico e é gravado
 * junto com a análise. Até aqui era write-once: o farmacêutico via o texto e não
 * tinha como corrigi-lo.
 *
 * A Resolução CFF nº 751/2022 exige que o registro do atendimento seja do
 * farmacêutico — com avaliação e plano de cuidado próprios. Um texto gerado por
 * máquina que o profissional não pode revisar não cumpre esse papel. Esta rota
 * devolve a autoria a ele.
 *
 * Salvar a revisão registra o atesto: `attestedById` + `attestedAt` gravam qual
 * farmacêutico assumiu aquele texto como seu e quando — é o que dá identificação
 * ao registro, como a norma exige. Enquanto ninguém salvar, os dois ficam nulos e
 * o texto continua sendo apenas a sugestão do motor.
 */

// Tetos por seção. O SOAP entra em PDF e em relatório impresso; texto sem limite
// quebra a paginação e vira vetor de armazenamento abusivo.
const MAX_SECTION_LEN = 5000

const soapSchema = z.object({
  subjective: z.string().max(MAX_SECTION_LEN, `Seção S excede ${MAX_SECTION_LEN} caracteres`),
  objective:  z.string().max(MAX_SECTION_LEN, `Seção O excede ${MAX_SECTION_LEN} caracteres`),
  assessment: z.string().max(MAX_SECTION_LEN, `Seção A excede ${MAX_SECTION_LEN} caracteres`),
  plan:       z.string().max(MAX_SECTION_LEN, `Seção P excede ${MAX_SECTION_LEN} caracteres`),
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

  // SECURITY: a análise precisa ser do próprio usuário (evita IDOR pelo id da análise)
  const analysis = await prisma.pRMAnalysis.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { id: true, patientId: true, soapRecord: { select: { id: true } } },
  })
  if (!analysis) return NextResponse.json({ error: 'Análise não encontrada' }, { status: 404 })

  const parsed = soapSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const data = {
    subjective: parsed.data.subjective.trim(),
    objective:  parsed.data.objective.trim(),
    assessment: parsed.data.assessment.trim(),
    plan:       parsed.data.plan.trim(),
    // Quem salva é quem assume o registro. A rota já garantiu que a análise é
    // deste usuário, então não há como atestar em nome de outro farmacêutico.
    attestedById: session.user.id,
    attestedAt:   new Date(),
  }

  try {
    // Upsert e não update: análises antigas podem ter ficado sem SOAP se o motor
    // devolveu a sugestão vazia por dados insuficientes.
    const soap = await prisma.sOAPRecord.upsert({
      where: { analysisId: analysis.id },
      update: data,
      create: { analysisId: analysis.id, patientId: analysis.patientId, ...data },
      select: {
        id: true, subjective: true, objective: true, assessment: true, plan: true,
        createdAt: true, updatedAt: true, attestedAt: true,
        attestedBy: { select: { name: true, crfNumber: true } },
      },
    })

    // O registro clínico revisado é documento — a alteração precisa deixar rastro.
    await logAudit({
      userId:     session.user.id,
      action:     'UPDATE_SOAP',
      resource:   'soap_record',
      resourceId: soap.id,
      ipAddress:  getClientIp(req),
      details:    { analysisId: analysis.id, patientId: analysis.patientId },
    })

    return NextResponse.json({ success: true, data: soap })
  } catch (err) {
    console.error('[SOAP_PATCH]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro ao salvar o registro SOAP' }, { status: 500 })
  }
}
