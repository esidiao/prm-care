/**
 * PRM Care — Serviço de Análise com Google Gemini (IA)
 *
 * Utiliza o modelo gemini-1.5-flash (gratuito: 15 req/min, 1M tokens/dia)
 * para análise farmacoterapêutica complementar às regras clínicas locais.
 *
 * Para ativar: defina GEMINI_API_KEY no .env e no Vercel.
 */

import type { PatientContext, PRMFindingResult } from '@/types'
import { PRMCategory, RiskLevel } from '@prisma/client'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

interface GeminiPRM {
  titulo: string
  categoria: 'NECESSITY' | 'EFFECTIVENESS' | 'SAFETY' | 'ADHERENCE'
  risco: 'URGENT' | 'HIGH' | 'MODERATE' | 'LOW'
  descricao: string
  evidencia: string
  conduta_farmaceutica: string
  orientacao_paciente: string
  monitoramento: string
  prazo_intervencao: string
  necessita_prescritor: boolean
}

function buildPrompt(context: PatientContext): string {
  const meds = context.medications.map(m =>
    `- ${m.activeIngredient}${m.tradeName ? ` (${m.tradeName})` : ''}${m.dose ? ` ${m.dose}${m.doseUnit || ''}` : ''}${m.frequency ? ` | ${m.frequency}` : ''}${m.indication ? ` | Indicação: ${m.indication}` : ''}${m.isSelfMedication ? ' | AUTOMEDICAÇÃO' : ''}`
  ).join('\n')

  const diagnoses = context.diagnoses.map(d => d.name).join(', ') || 'Não informados'
  const comorbidities = context.comorbidities.map((c: any) => c.name).join(', ') || 'Não informadas'
  const allergies = context.allergies.map((a: any) => `${a.substance}${a.reaction ? ` (${a.reaction})` : ''}`).join(', ') || 'Nenhuma'
  const labs = context.labResults.length > 0
    ? context.labResults.map(l => `${l.examName}: ${l.value}${l.unit || ''}${l.isAbnormal ? ' ⚠️ ALTERADO' : ''}`).join(', ')
    : 'Não disponíveis'

  return `Você é um farmacêutico clínico especialista em seguimento farmacoterapêutico pelo Método Dáder.

Analise o perfil farmacoterapêutico abaixo e identifique APENAS os Problemas Relacionados a Medicamentos (PRMs) que uma análise automatizada de regras simples NÃO detectaria, como:
- Interações incomuns ou de terceira geração
- Inadequação de dose para o perfil clínico específico
- Medicamentos inapropriados para condições não listadas nos critérios de Beers/STOPP
- Inconsistências terapêuticas (ex: medicamento para sintoma que deveria ter tratamento causal)
- Risco de cascata de prescrição (efeito adverso tratado como nova doença)
- Duração inapropriada de uso
- Problemas de efetividade específicos ao diagnóstico
- Qualquer outro PRM clinicamente relevante

PERFIL DO PACIENTE:
- Idade: ${context.age ? `${context.age} anos` : 'Não informada'}
- Sexo: ${context.sex || 'Não informado'}
- Peso: ${context.weight ? `${context.weight} kg` : 'Não informado'} | Altura: ${context.height ? `${context.height} cm` : 'Não informada'}
- Gestante: ${context.isPregnant ? `Sim${context.gestationalAge ? ` (${context.gestationalAge} semanas)` : ''}` : 'Não'}
- Lactante: ${context.isLactating ? 'Sim' : 'Não'}
- Idoso (≥60 anos): ${context.isElderly ? 'Sim' : 'Não'}
- Função renal: ${context.renalFunction || 'Não informada'}${context.creatinineClearance ? ` (ClCr: ${context.creatinineClearance} mL/min)` : ''}
- Função hepática: ${context.hepaticFunction || 'Não informada'}
- Diagnósticos: ${diagnoses}
- Comorbidades: ${comorbidities}
- Alergias: ${allergies}
- Exames laboratoriais: ${labs}
- Queixa principal: ${context.chiefComplaint || 'Não informada'}
- História clínica: ${context.clinicalHistory || 'Não informada'}

MEDICAMENTOS EM USO (${context.medications.length}):
${meds}

INSTRUÇÕES DE RESPOSTA:
Responda EXCLUSIVAMENTE em JSON válido, sem texto antes ou depois, no formato:
{
  "prms": [
    {
      "titulo": "título conciso do PRM",
      "categoria": "NECESSITY" | "EFFECTIVENESS" | "SAFETY" | "ADHERENCE",
      "risco": "URGENT" | "HIGH" | "MODERATE" | "LOW",
      "descricao": "descrição clara do problema (2-3 frases)",
      "evidencia": "embasamento clínico e farmacológico",
      "conduta_farmaceutica": "conduta específica e acionável para o farmacêutico",
      "orientacao_paciente": "orientação clara para o paciente",
      "monitoramento": "parâmetros e frequência de monitoramento",
      "prazo_intervencao": "Imediato | 24-48h | Próxima consulta | 7 dias | 30 dias",
      "necessita_prescritor": true | false
    }
  ],
  "observacao_geral": "comentário geral sobre o perfil farmacoterapêutico (opcional, 1-2 frases)"
}

Se não identificar PRMs adicionais além dos que regras básicas detectariam, retorne: {"prms": [], "observacao_geral": "Nenhum PRM adicional identificado além dos detectáveis por regras clínicas básicas."}

Seja preciso, baseado em evidências e use terminologia farmacêutica clínica em português brasileiro.`
}

export async function analyzeWithGemini(context: PatientContext): Promise<{
  findings: PRMFindingResult[]
  observacaoGeral: string
  success: boolean
  error?: string
}> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return { findings: [], observacaoGeral: '', success: false, error: 'GEMINI_API_KEY não configurada' }
  }

  try {
    const prompt = buildPrompt(context)

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        ],
      }),
      signal: AbortSignal.timeout(30000), // 30 segundos de timeout
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[GEMINI] Erro HTTP:', response.status, errorText)
      return { findings: [], observacaoGeral: '', success: false, error: `Erro HTTP ${response.status}` }
    }

    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text

    if (!text) {
      return { findings: [], observacaoGeral: '', success: false, error: 'Resposta vazia do Gemini' }
    }

    let parsed: { prms: GeminiPRM[]; observacao_geral?: string }
    try {
      // Remove markdown code blocks se presentes
      const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      parsed = JSON.parse(cleanText)
    } catch {
      console.error('[GEMINI] Erro ao parsear JSON:', text.substring(0, 500))
      return { findings: [], observacaoGeral: '', success: false, error: 'Resposta inválida do Gemini' }
    }

    const findings: PRMFindingResult[] = (parsed.prms || []).map((prm: GeminiPRM) => ({
      category: (PRMCategory[prm.categoria] || PRMCategory.SAFETY) as PRMCategory,
      riskLevel: (RiskLevel[prm.risco] || RiskLevel.MODERATE) as RiskLevel,
      title: `[IA] ${prm.titulo}`,
      description: prm.descricao,
      clinicalEvidence: prm.evidencia,
      potentialImpact: prm.descricao,
      pharmacistConduct: prm.conduta_farmaceutica,
      patientGuidance: prm.orientacao_paciente,
      needsReferral: prm.risco === 'URGENT',
      needsPrescriberContact: prm.necessita_prescritor,
      monitoring: prm.monitoramento,
      reevaluationPeriod: prm.prazo_intervencao,
      confidenceLevel: 'moderate' as const,
      validationNote: 'Análise gerada por Inteligência Artificial (Google Gemini). Deve ser obrigatoriamente validada pelo farmacêutico antes de qualquer intervenção.',
      interventionDeadline: prm.prazo_intervencao,
    }))

    return {
      findings,
      observacaoGeral: parsed.observacao_geral || '',
      success: true,
    }
  } catch (err: any) {
    console.error('[GEMINI] Erro na análise:', err)
    return { findings: [], observacaoGeral: '', success: false, error: err.message || 'Erro desconhecido' }
  }
}
