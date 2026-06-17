import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { callGroqWithRetry } from '@/lib/gemini-service'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) {
    return NextResponse.json({ error: 'IA não configurada. Defina GROQ_API_KEY.' }, { status: 503 })
  }

  const body = await req.json()
  const { findingId } = body as { findingId: string }

  const analysis = await prisma.pRMAnalysis.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: {
      patient: { select: { name: true, code: true, age: true, sex: true } },
    },
  })
  if (!analysis) return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })

  const finding = await prisma.pRMFinding.findFirst({
    where: { id: findingId, analysisId: params.id },
    include: { medication: { select: { activeIngredient: true, dose: true, doseUnit: true, frequency: true } } },
  })
  if (!finding) return NextResponse.json({ error: 'Finding not found' }, { status: 404 })

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
