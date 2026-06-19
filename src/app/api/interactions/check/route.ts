import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { checkInteractions } from '@/lib/prm-engine'

const ADVISORY =
  'Esta consulta é apoio à decisão clínica e não substitui a avaliação individualizada. ' +
  'A conduta final cabe ao farmacêutico responsável, considerando paciente, dose, via, ' +
  'duração, comorbidades, exames e contexto clínico. Ausência de evidência não significa ausência de risco.'

/**
 * POST /api/interactions/check
 * Body: { drugs: string[] | { activeName: string }[] }
 * Cruza os medicamentos pela base determinística (motor) e retorna as interações + risco global.
 */
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const drugs: string[] = Array.isArray(body?.drugs)
    ? body.drugs.map((d: unknown) => (typeof d === 'string' ? d : (d as { activeName?: string })?.activeName)).filter(Boolean)
    : []

  if (drugs.length < 2) {
    return NextResponse.json({ error: 'Informe ao menos 2 medicamentos para verificar interações.' }, { status: 400 })
  }

  const c = body?.context || {}
  const context = {
    age: typeof c.age === 'number' ? c.age : (c.age ? Number(c.age) : null),
    tfg: typeof c.tfg === 'number' ? c.tfg : (c.tfg ? Number(c.tfg) : null),
    pregnant: !!c.pregnant,
  }
  const { interactions, globalRisk, globalLabel } = checkInteractions(drugs, context)

  return NextResponse.json({
    drugs,
    count: interactions.length,
    notFound: interactions.length === 0,
    globalRisk,
    globalLabel,
    interactions,
    advisory: ADVISORY,
  })
}
