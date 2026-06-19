import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { explainInteractions, type DdiInputInteraction } from '@/lib/ai-ddi'

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

  const result = await explainInteractions(interactions, b?.context)
  if (!result) return NextResponse.json({ explanations: [], error: 'IA indisponível no momento.' }, { status: 200 })

  await prisma.auditLog.create({
    data: {
      userId: session.user.id, action: 'DDI_AI_EXPLAIN', resource: 'interactions',
      details: { model: result.model, count: result.items.length },
    },
  }).catch(() => null)

  return NextResponse.json({ explanations: result.items, model: result.model })
}
