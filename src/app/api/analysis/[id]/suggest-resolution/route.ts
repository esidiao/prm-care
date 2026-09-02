import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { callGroqWithRetry } from '@/lib/gemini-service'
import { aiSuggestLimiter } from '@/lib/rate-limit'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) {
    return NextResponse.json({ error: 'IA não configurada. Defina GROQ_API_KEY.' }, { status: 503 })
  }

  const rl = await aiSuggestLimiter(session.user.id)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Muitas sugestões de IA em pouco tempo. Aguarde alguns minutos.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    )
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 })
  }
  const { findingId } = body as { findingId: string }

  const analysis = await prisma.pRMAnalysis.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: {
      patient: { select: { name: true, code: true, age: true, sex: true } },
    },
  })
  if (!analysis) return NextResponse.json({ error: 'Análise não encontrada' }, { status: 404 })

  const finding = await prisma.pRMFinding.findFirst({
    where: { id: findingId, analysisId: params.id },
    include: { medication: { select: { activeIngredient: true, dose: true, doseUnit: true, frequency: true } } },
  })
  if (!finding) return NextResponse.json({ error: 'Achado não encontrado' }, { status: 404 })

  const patientDesc = [
    analysis.patient.age ? `${analysis.patient.age} anos` : '',
    analysis.patient.sex === 'MALE' ? 'masculino' : analysis.patient.sex === 'FEMALE' ? 'feminino' : '',
  ].filter(Boolean).join(', ')

  const prompt = `Você é um farmacêutico clínico. Gere uma nota de resolução clínica CONCISA (máximo 3 frases, tom profissional) para o seguinte PRM resolvido.

PACIENTE: ${analysis.patient.name || analysis.patient.code}${patientDesc ? ` (${patientDesc})` : ''}
PRM: ${finding.title}
CATEGORIA: ${finding.category}
RISCO: ${finding.riskLevel}
DESCRIÇÃO: ${finding.description}
CONDUTA SUGERIDA: ${finding.pharmacistConduct}
${finding.medication ? `MEDICAMENTO: ${finding.medication.activeIngredient} ${finding.medication.dose ?? ''} ${finding.medication.doseUnit ?? ''} ${finding.medication.frequency ?? ''}` : ''}

Formate como: "Conduta realizada: [descrição da ação tomada]. Paciente [orientado/encaminhado/monitorado] conforme protocolo. [Resultado esperado ou follow-up]."
Responda APENAS com a nota, sem explicações adicionais.`

  try {
    // Chamada resiliente: retry + fallback de modelo (mesmo helper da análise principal)
    const groq = await callGroqWithRetry(
      groqKey,
      [{ role: 'user', content: prompt }],
      { temperature: 0.4, maxTokens: 200, json: false, timeoutMs: 30000 },
    )

    const suggestion = groq?.text?.trim()
    if (!suggestion) throw new Error('Empty response')

    return NextResponse.json({ suggestion })
  } catch (err) {
    return NextResponse.json({ error: 'Falha ao gerar sugestão de IA.' }, { status: 500 })
  }
}
