/**
 * PRM Care — Serviço de Análise com IA (Groq — gratuito)
 *
 * Utiliza o modelo llama-3.3-70b via Groq API
 * Gratuito: 14.400 requisições/dia, sem cartão de crédito.
 *
 * Para ativar: defina GROQ_API_KEY no .env e no Vercel.
 * Obter chave em: https://console.groq.com/keys
 */

import type { PatientContext, PRMFindingResult } from '@/types'
import { PRMCategory, RiskLevel } from '@prisma/client'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

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

Analise o perfil abaixo e identifique APENAS PRMs que uma análise de regras simples NÃO detectaria, como:
- Interações incomuns ou de terceira geração não cobertas por listas padrão
- Inadequação de dose para o perfil clínico específico
- Cascata de prescrição (efeito adverso tratado como nova doença)
- Duração inapropriada de uso
- Problemas de efetividade específicos ao diagnóstico
- Qualquer outro PRM clinicamente relevante não óbvio

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

Responda EXCLUSIVAMENTE em JSON válido, sem texto antes ou depois:
{
  "prms": [
    {
      "titulo": "título conciso do PRM",
      "categoria": "NECESSITY" ou "EFFECTIVENESS" ou "SAFETY" ou "ADHERENCE",
      "risco": "URGENT" ou "HIGH" ou "MODERATE" ou "LOW",
      "descricao": "descrição clara do problema (2-3 frases)",
      "evidencia": "embasamento clínico e farmacológico",
      "conduta_farmaceutica": "conduta específica e acionável",
      "orientacao_paciente": "orientação clara ao paciente",
      "monitoramento": "parâmetros e frequência",
      "prazo_intervencao": "Imediato ou 24-48h ou Próxima consulta ou 7 dias ou 30 dias",
      "necessita_prescritor": true ou false
    }
  ],
  "observacao_geral": "comentário geral (1-2 frases)"
}

Se não identificar PRMs adicionais, retorne: {"prms":[],"observacao_geral":"Nenhum PRM adicional identificado."}`
}

export async function analyzeWithGemini(context: PatientContext): Promise<{
  findings: PRMFindingResult[]
  observacaoGeral: string
  success: boolean
  error?: string
}> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return { findings: [], observacaoGeral: '', success: false, error: 'GROQ_API_KEY não configurada' }
  }

  try {
    const prompt = buildPrompt(context)

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[GROQ] Erro HTTP:', response.status, errorText)
      return { findings: [], observacaoGeral: '', success: false, error: `Erro HTTP ${response.status}` }
    }

    const data = await response.json()
    const text = data?.choices?.[0]?.message?.content

    if (!text) {
      return { findings: [], observacaoGeral: '', success: false, error: 'Resposta vazia do Groq' }
    }

    let parsed: { prms: GeminiPRM[]; observacao_geral?: string }
    try {
      const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      parsed = JSON.parse(cleanText)
    } catch {
      console.error('[GROQ] Erro ao parsear JSON:', text.substring(0, 500))
      return { findings: [], observacaoGeral: '', success: false, error: 'Resposta inválida do Groq' }
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
      validationNote: 'Análise gerada por Inteligência Artificial (Groq/Llama). Deve ser obrigatoriamente validada pelo farmacêutico antes de qualquer intervenção.',
      interventionDeadline: prm.prazo_intervencao,
    }))

    return {
      findings,
      observacaoGeral: parsed.observacao_geral || '',
      success: true,
    }
  } catch (err: any) {
    console.error('[GROQ] Erro na análise:', err)
    return { findings: [], observacaoGeral: '', success: false, error: err.message || 'Erro desconhecido' }
  }
}
