/**
 * IA-4 (cache) + IA-5 (trilha) — suporte de IA do PRM Care.
 *
 * - Cache do resultado complementar da IA por hash do contexto clínico: evita
 *   reprocessar no Groq pacientes com o MESMO quadro (TTL 24h). O motor de regras
 *   determinístico sempre roda fresco — só a parte de IA é cacheada.
 * - Trilha estruturada (prm_ai_analysis_logs): modelo, hash do prompt (sem PII),
 *   status, latência e tokens. Auditoria/observabilidade LGPD.
 */
import crypto from 'crypto'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import type { PatientContext, PRMFindingResult } from '@/types'

const TTL_MS = 24 * 60 * 60 * 1000 // 24h

/** Hash determinístico apenas dos campos clinicamente relevantes para a IA. */
export function hashContext(context: PatientContext): string {
  const norm = {
    age: context.age ?? null,
    sex: context.sex ?? null,
    pregnant: context.isPregnant,
    lactating: context.isLactating,
    elderly: context.isElderly,
    renal: context.renalFunction ?? null,
    crcl: context.creatinineClearance ?? null,
    hepatic: context.hepaticFunction ?? null,
    comorbidities: (context.comorbidities ?? []).map(c => c.name).sort(),
    diagnoses: (context.diagnoses ?? []).map(d => d.name).sort(),
    meds: (context.medications ?? [])
      .map(m => `${m.activeIngredient}|${m.dose ?? ''}${m.doseUnit ?? ''}|${m.frequency ?? ''}|${m.route}`)
      .sort(),
    labs: (context.labResults ?? []).map(l => `${l.examName}:${l.value}`).sort(),
  }
  return crypto.createHash('sha256').update(JSON.stringify(norm)).digest('hex')
}

export type CachedAi = { findings: PRMFindingResult[]; observacaoGeral: string; model: string }

export async function getCachedAi(hash: string): Promise<CachedAi | null> {
  try {
    const row = await prisma.aiAnalysisCache.findUnique({ where: { hash } })
    if (!row) return null
    if (Date.now() - row.createdAt.getTime() > TTL_MS) return null
    await prisma.aiAnalysisCache.update({ where: { hash }, data: { hits: { increment: 1 } } }).catch(() => null)
    const payload = row.payload as { findings?: PRMFindingResult[]; observacaoGeral?: string }
    return { findings: payload.findings ?? [], observacaoGeral: payload.observacaoGeral ?? '', model: row.model }
  } catch {
    return null
  }
}

export async function setCachedAi(
  hash: string,
  payload: { findings: PRMFindingResult[]; observacaoGeral: string },
  model: string,
): Promise<void> {
  try {
    const json = payload as unknown as Prisma.InputJsonValue
    await prisma.aiAnalysisCache.upsert({
      where: { hash },
      update: { payload: json, model, createdAt: new Date() },
      create: { hash, payload: json, model },
    })
  } catch (e) {
    console.warn('[AI-CACHE] falha ao gravar:', e instanceof Error ? e.message : e)
  }
}

export async function logAi(entry: {
  userId?: string | null
  analysisId?: string | null
  model: string
  promptHash: string
  status: 'SUCCESS' | 'FAILED' | 'CACHED' | 'FALLBACK'
  latencyMs?: number
  inputTokens?: number
  outputTokens?: number
  error?: string
}): Promise<void> {
  try {
    await prisma.aiAnalysisLog.create({
      data: {
        userId: entry.userId ?? null,
        analysisId: entry.analysisId ?? null,
        model: entry.model,
        promptHash: entry.promptHash,
        status: entry.status,
        latencyMs: entry.latencyMs ?? null,
        inputTokens: entry.inputTokens ?? null,
        outputTokens: entry.outputTokens ?? null,
        error: entry.error ?? null,
      },
    })
  } catch (e) {
    console.warn('[AI-LOG] falha ao registrar:', e instanceof Error ? e.message : e)
  }
}
