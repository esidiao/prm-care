import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { KnowledgeStatus } from '@prisma/client'
import { explainInteractions, type DdiInputInteraction } from '@/lib/ai-ddi'
import { enrichWithFDA } from '@/lib/drug-lookup-service'
import { rerank } from '@/lib/embeddings'

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Recupera trechos de fontes REAIS (protocolos validados + chunks curados) para os medicamentos. */
async function retrieveContext(drugNames: string[]): Promise<{ citation: string; content: string }[]> {
  const drugs = drugNames.map(norm)
  const out: { citation: string; content: string }[] = []
  // 1) Protocolos institucionais validados (corpus real cadastrado pela equipe)
  const kb = await prisma.knowledgeBase.findMany({
    where: { status: KnowledgeStatus.VALIDATED },
    select: { title: true, content: true, drugNames: true }, orderBy: { updatedAt: 'desc' }, take: 30,
  }).catch(() => [])
  for (const e of kb) {
    const hay = norm(`${e.title} ${(e.drugNames || []).join(' ')} ${e.content}`)
    if (drugs.some(d => d && hay.includes(d))) out.push({ citation: `Protocolo institucional: ${e.title}`, content: e.content.slice(0, 600) })
  }
  // 2) Chunks curados (ddi_rag_chunks) — vazio até a curadoria; pronto para uso
  const chunks = await prisma.ddiRagChunk.findMany({ where: { drugRefs: { hasSome: drugNames } }, take: 6 }).catch(() => [])
  if (chunks.length) {
    const srcs = await prisma.ddiSource.findMany({ where: { id: { in: chunks.map(c => c.sourceId) } }, select: { id: true, citation: true } })
    const byId = new Map(srcs.map(s => [s.id, s.citation]))
    for (const c of chunks) out.push({ citation: byId.get(c.sourceId) || 'Fonte clínica', content: c.content.slice(0, 600) })
  }
  // 3) openFDA — bulas FDA (fonte pública, já integrada): trechos reais de interação
  try {
    const fda = await enrichWithFDA(drugNames)
    for (const d of fda.directInteractions.slice(0, 6)) {
      out.push({ citation: `Bula FDA (openFDA): ${d.drugA} × ${d.drugB}`, content: d.context.slice(0, 600) })
    }
  } catch { /* openFDA indisponível — segue sem */ }
  return out
}

/**
 * POST /api/interactions/explain
 * Enriquece (organiza/explica) interações JÁ identificadas pelo motor determinístico.
 * A IA não cria interações — guardrail no serviço descarta qualquer par não fornecido.
 * Body: { interactions: DdiInputInteraction[], context?: {...} }
 */
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!process.env.GROQ_API_KEY) return NextResponse.json({ error: 'IA não configurada.' }, { status: 503 })

  const b = await req.json().catch(() => ({}))
  const interactions: DdiInputInteraction[] = Array.isArray(b?.interactions) ? b.interactions : []
  if (interactions.length === 0) return NextResponse.json({ explanations: [] })

  const drugNames = Array.from(new Set(interactions.flatMap(i => i.drugs)))
  const candidates = await retrieveContext(drugNames)
  // Rerank semântico (Hugging Face, custo zero) — prioriza os trechos mais relevantes
  const queryText = interactions.map(i => `${i.drugs.join(' + ')}: ${i.clinicalEffect}`).join('; ')
  const chunks = await rerank(queryText, candidates, 5)

  const result = await explainInteractions(interactions, b?.context, chunks)
  if (!result) return NextResponse.json({ explanations: [], sourcesUsed: [], error: 'IA indisponível no momento.' }, { status: 200 })

  await prisma.auditLog.create({
    data: {
      userId: session.user.id, action: 'DDI_AI_EXPLAIN', resource: 'interactions',
      details: { model: result.model, count: result.items.length, sources: result.sourcesUsed.length },
    },
  }).catch(() => null)

  return NextResponse.json({ explanations: result.items, sourcesUsed: result.sourcesUsed, model: result.model })
}
