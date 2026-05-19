/**
 * PRM Care — Serviço de Análise com IA (Groq — gratuito)
 *
 * Utiliza o modelo llama-3.3-70b via Groq API
 * Gratuito: 14.400 requisições/dia, sem cartão de crédito.
 *
 * Para ativar: defina GROQ_API_KEY no .env e no Vercel.
 * Obter em: https://console.groq.com/keys
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
  impacto_potencial: string
  evidencia: string
  conduta_farmaceutica: string
  orientacao_paciente: string
  monitoramento: string
  prazo_intervencao: string
  necessita_prescritor: boolean
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é um farmacêutico clínico sênior com especialização em farmacoterapia, farmacovigilância e seguimento farmacoterapêutico pelo Método Dáder. Você tem 20 anos de experiência em análise de problemas relacionados a medicamentos (PRMs) em pacientes polimedicados, idosos, gestantes e pacientes com insuficiência renal e hepática.

Seu papel é complementar uma análise de regras clínicas já realizada por um motor de regras determinístico. O motor já verifica:
- Critérios de Beers 2023 (AGS) para idosos
- Critérios STOPP/START v3
- Interações medicamentosas de primeira e segunda geração (55+ pares conhecidos)
- Contraindicações em gestantes e lactantes
- Alertas de dose em insuficiência renal e hepática

Sua tarefa é identificar PRMs que o motor de regras NÃO detecta:

1. CASCATA DE PRESCRIÇÃO — Efeito adverso de um medicamento sendo tratado como nova doença, gerando novo medicamento desnecessário
2. INTERAÇÕES FARMACOLÓGICAS DE TERCEIRO NÍVEL — Ex: inibidores de CYP3A4 elevando níveis de estatinas, opioides, benzodiazepínicos
3. INADEQUAÇÃO DE DOSE AO PERFIL — Dose inadequada considerando o peso, idade, função orgânica e diagnóstico específico do paciente
4. MEDICAMENTO NECESSÁRIO AUSENTE — Paciente com condição que claramente indica um medicamento que não está em uso (ex: diabético sem protetor renal, hipertenso de alto risco sem estatina)
5. DUPLICIDADE TERAPÊUTICA SUTIL — Dois medicamentos da mesma classe não óbvia (ex: dois anticolinérgicos com nomes diferentes)
6. DURAÇÃO INAPROPRIADA — Medicamentos indicados apenas para uso agudo sendo usados cronicamente (IBPs, benzodiazepínicos, corticosteroides)
7. INEFETIVIDADE PROVÁVEL — Medicamento improvável de funcionar dado o diagnóstico específico (ex: antibiótico oral para infecção grave, broncodilatador sem espirometria)
8. RISCO ESPECÍFICO AO PERFIL — Interação entre medicamento e condição clínica não coberta pelas listas padrão (ex: AINE em hipertenso mal controlado, metformina em insuficiência cardíaca descompensada)
9. ADESÃO COMPROMETIDA — Regimes complexos, mais de 5 medicamentos, horários incompatíveis, custo elevado
10. PRM DE ALTA RELEVÂNCIA CLÍNICA LOCAL — Qualquer outro PRM relevante para o contexto clínico brasileiro

Seja específico, use nomes de medicamentos corretos em português brasileiro, cite evidências clínicas reais (guidelines, estudos, farmacologia básica). Não repita PRMs que são óbvios e já foram certamente detectados pelo motor de regras (como warfarina + AAS = risco de sangramento óbvio).`

// ── Few-shot examples ────────────────────────────────────────────────────────

const FEW_SHOT_EXAMPLES = `
=== EXEMPLOS DE PRMs QUE VOCÊ DEVE IDENTIFICAR ===

EXEMPLO 1 — Cascata de prescrição:
Paciente 68 anos, HAS, usando diclofenaco 50mg 2x/dia (dor lombar) + amlodipina 5mg (recentemente adicionada para PA elevada).
PRM correto a identificar:
{
  "titulo": "Cascata de prescrição: AINE causando hipertensão",
  "categoria": "SAFETY",
  "risco": "HIGH",
  "descricao": "O diclofenaco (AINE) retém sódio e água, elevando a pressão arterial. A adição recente de amlodipina sugere cascata de prescrição: o efeito adverso do AINE está sendo tratado como nova doença em vez de remover a causa.",
  "impacto_potencial": "Progressão de HAS, aumento do risco cardiovascular, uso desnecessário de anti-hipertensivo",
  "evidencia": "AINEs inibem prostaglandinas vasoreguladoras, causando retenção de sódio e redução de 3-5 mmHg na eficácia de anti-hipertensivos. Guideline ESC 2023 contraindica AINEs em HAS não controlada.",
  "conduta_farmaceutica": "Discutir com prescrito a substituição do diclofenaco por paracetamol ou fisioterapia. Reavaliar necessidade da amlodipina após suspensão do AINE.",
  "orientacao_paciente": "Informe ao médico que o anti-inflamatório pode estar elevando sua pressão. Evite AINEs como diclofenaco, ibuprofeno e naproxeno.",
  "monitoramento": "PA 2x/semana por 4 semanas após mudança terapêutica",
  "prazo_intervencao": "7 dias",
  "necessita_prescritor": true
}

EXEMPLO 2 — Medicamento necessário ausente:
Paciente 55 anos, diabetes tipo 2 há 8 anos, proteinúria +2, usando metformina + glibenclamida. Sem IECA ou BRA.
PRM correto a identificar:
{
  "titulo": "Ausência de nefroproteção em diabético com proteinúria",
  "categoria": "NECESSITY",
  "risco": "HIGH",
  "descricao": "Paciente diabético com proteinúria confirmada sem uso de IECA ou BRA. Esses medicamentos são indicados para retardar a progressão da nefropatia diabética com nível de evidência A.",
  "impacto_potencial": "Progressão acelerada para insuficiência renal crônica, risco de diálise em 5-10 anos",
  "evidencia": "ADA Standards of Care 2024 e KDIGO 2022: IECA ou BRA são obrigatórios em DM2 com proteinúria ≥30mg/g (ou albuminúria moderada). Reduzem progressão renal em 20-30%.",
  "conduta_farmaceutica": "Solicitar avaliação médica urgente para início de IECA (enalapril, ramipril) ou BRA (losartana, valsartana). Monitorar creatinina e potássio após início.",
  "orientacao_paciente": "Seu médico deve avaliar um medicamento chamado IECA ou BRA, que protege os rins em diabéticos. Isso é fundamental para evitar problemas renais futuros.",
  "monitoramento": "Creatinina, potássio e proteinúria a cada 3 meses",
  "prazo_intervencao": "Próxima consulta",
  "necessita_prescritor": true
}

EXEMPLO 3 — Interação CYP3A4:
Paciente usando sinvastatina 40mg + claritromicina (prescrita para sinusite).
PRM correto a identificar:
{
  "titulo": "Interação crítica: claritromicina eleva níveis de sinvastatina",
  "categoria": "SAFETY",
  "risco": "URGENT",
  "descricao": "Claritromicina é potente inibidor do CYP3A4, enzima responsável pelo metabolismo da sinvastatina. Co-uso pode elevar os níveis plasmáticos da sinvastatina em até 10 vezes, com risco de miopatia grave e rabdomiólise.",
  "impacto_potencial": "Rabdomiólise, insuficiência renal aguda, risco de morte",
  "evidencia": "FDA contraindica co-uso de claritromicina com sinvastatina (Drug Safety Communication 2012). Mecanismo: inibição de CYP3A4 hepático reduz clearance da sinvastatina em >75%.",
  "conduta_farmaceutica": "Suspender sinvastatina IMEDIATAMENTE durante o curso de claritromicina. Substituir antibiótico por amoxicilina ou azitromicina se possível, ou usar pravastatina/rosuvastatina (não metabolizadas por CYP3A4).",
  "orientacao_paciente": "Pare de tomar a sinvastatina enquanto estiver usando esse antibiótico. Informe seu médico e farmacêutico sobre todos os medicamentos que usa.",
  "monitoramento": "CPK e função renal imediatamente se dor muscular ou urina escura",
  "prazo_intervencao": "Imediato",
  "necessita_prescritor": true
}
=== FIM DOS EXEMPLOS ===`

// ── Build patient context string ─────────────────────────────────────────────

function buildPatientContext(context: PatientContext): string {
  const meds = context.medications.length > 0
    ? context.medications.map((m, i) =>
        `  ${i + 1}. ${m.activeIngredient}${m.tradeName ? ` (${m.tradeName})` : ''}` +
        `${m.dose ? ` — ${m.dose}${m.doseUnit || ''}` : ''}` +
        `${m.pharmaceuticalForm ? ` ${m.pharmaceuticalForm}` : ''}` +
        `${m.route ? ` | via: ${m.route}` : ''}` +
        `${m.frequency ? ` | ${m.frequency}` : ''}` +
        `${m.indication ? ` | Indicação: ${m.indication}` : ''}` +
        `${m.adherence && m.adherence !== 'UNKNOWN' ? ` | Adesão: ${m.adherence}` : ''}` +
        `${m.isSelfMedication ? ' | ⚠️ AUTOMEDICAÇÃO' : ''}` +
        `${m.adverseEffects ? ` | EA relatado: ${m.adverseEffects}` : ''}`
      ).join('\n')
    : '  Nenhum medicamento informado'

  const diagnoses = context.diagnoses.length > 0
    ? context.diagnoses.map(d => `${d.name}${(d as any).icd10Code ? ` (${(d as any).icd10Code})` : ''}${(d as any).isPrimary ? ' [PRINCIPAL]' : ''}`).join(', ')
    : 'Não informados'

  const comorbidities = context.comorbidities.length > 0
    ? context.comorbidities.map((c: any) => c.name).join(', ')
    : 'Nenhuma'

  const allergies = context.allergies.length > 0
    ? context.allergies.map((a: any) =>
        `${a.substance}${a.reaction ? ` (reação: ${a.reaction})` : ''}${a.severity ? ` [${a.severity}]` : ''}`
      ).join('; ')
    : 'Nenhuma conhecida'

  const labs = context.labResults.length > 0
    ? context.labResults.map(l =>
        `${l.examName}: ${l.value}${l.unit ? ` ${l.unit}` : ''}${l.isAbnormal ? ' ⚠️ ALTERADO' : ''}`
      ).join(' | ')
    : 'Não disponíveis'

  const renalStatus = context.renalFunction
    ? `${context.renalFunction}${context.creatinineClearance ? ` (ClCr: ${context.creatinineClearance} mL/min)` : ''}`
    : 'Não informada'

  return `=== PERFIL DO PACIENTE ===
Idade: ${context.age ? `${context.age} anos` : 'Não informada'}
Sexo biológico: ${context.sex === 'MALE' ? 'Masculino' : context.sex === 'FEMALE' ? 'Feminino' : 'Não informado'}
Peso: ${context.weight ? `${context.weight} kg` : 'Não informado'} | Altura: ${context.height ? `${context.height} cm` : 'Não informada'}
Gestante: ${context.isPregnant ? `Sim${context.gestationalAge ? ` (${context.gestationalAge} semanas)` : ''}` : 'Não'}
Lactante: ${context.isLactating ? 'Sim' : 'Não'}
Idoso (≥60 anos): ${context.isElderly ? 'Sim' : 'Não'}
Função renal: ${renalStatus}
Função hepática: ${context.hepaticFunction || 'Não informada'}

Diagnósticos: ${diagnoses}
Comorbidades: ${comorbidities}
Alergias e intolerâncias: ${allergies}
Queixa principal: ${context.chiefComplaint || 'Não informada'}
História clínica: ${context.clinicalHistory || 'Não informada'}
Exames laboratoriais: ${labs}

=== MEDICAMENTOS EM USO (${context.medications.length} no total) ===
${meds}`
}

// ── User prompt ───────────────────────────────────────────────────────────────

function buildUserPrompt(context: PatientContext): string {
  const patientContext = buildPatientContext(context)
  const medCount = context.medications.length
  const isComplex = medCount >= 5 || context.isElderly || context.isPregnant || context.isLactating

  return `${FEW_SHOT_EXAMPLES}

${patientContext}

=== SUA TAREFA ===
${isComplex ? `⚠️ ATENÇÃO: Este é um paciente COMPLEXO (${medCount} medicamentos${context.isElderly ? ', idoso' : ''}${context.isPregnant ? ', gestante' : ''}${context.isLactating ? ', lactante' : ''}). Analise com máxima atenção.` : ''}

Antes de gerar o JSON, raciocine internamente:
1. Existe alguma cascata de prescrição? (efeito adverso sendo tratado como nova doença?)
2. Há interações farmacológicas de CYP450, proteínas plasmáticas ou efeitos aditivos não óbvios?
3. Há alguma condição clínica que claramente indica um medicamento ausente?
4. Algum medicamento tem dose inadequada para o peso, idade ou função orgânica deste paciente específico?
5. Há duplicidade terapêutica sutil entre os medicamentos?
6. Algum medicamento está sendo usado cronicamente quando deveria ser apenas agudo?
7. Há riscos específicos relacionados a gestação, lactação ou idade neste perfil?

Gere de 0 a 6 PRMs. Priorize qualidade sobre quantidade. Só inclua PRMs com relevância clínica real e que o motor de regras determinístico provavelmente não detectou.

Responda EXCLUSIVAMENTE em JSON válido, sem nenhum texto antes ou depois:
{
  "raciocinio": "Breve descrição do seu raciocínio clínico (2-3 frases resumindo os principais achados)",
  "prms": [
    {
      "titulo": "título conciso e específico do PRM",
      "categoria": "NECESSITY" ou "EFFECTIVENESS" ou "SAFETY" ou "ADHERENCE",
      "risco": "URGENT" ou "HIGH" ou "MODERATE" ou "LOW",
      "descricao": "descrição clara do problema (2-4 frases com contexto clínico)",
      "impacto_potencial": "consequências clínicas se o PRM não for corrigido",
      "evidencia": "embasamento clínico: guideline ou mecanismo farmacológico ou estudo",
      "conduta_farmaceutica": "conduta específica, acionável e realista para o farmacêutico",
      "orientacao_paciente": "orientação clara e em linguagem acessível para o paciente",
      "monitoramento": "parâmetros clínicos ou laboratoriais e frequência de monitoramento",
      "prazo_intervencao": "Imediato" ou "24-48h" ou "7 dias" ou "Próxima consulta" ou "30 dias",
      "necessita_prescritor": true ou false
    }
  ],
  "observacao_geral": "comentário clínico geral sobre o perfil do paciente (1-2 frases)"
}

Se não identificar PRMs adicionais após análise cuidadosa, retorne:
{"raciocinio":"...","prms":[],"observacao_geral":"Perfil farmacoterapêutico analisado. Nenhum PRM adicional identificado além dos detectados pelo motor de regras."}`
}

// ── Main export ───────────────────────────────────────────────────────────────

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
    const userPrompt = buildUserPrompt(context)

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.15,       // mais determinístico, menos alucinação
        max_tokens: 6000,        // mais espaço para respostas detalhadas
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(45000), // 45s timeout
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

    let parsed: { prms: GeminiPRM[]; observacao_geral?: string; raciocinio?: string }
    try {
      const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      parsed = JSON.parse(cleanText)
    } catch {
      console.error('[GROQ] Erro ao parsear JSON:', text.substring(0, 500))
      return { findings: [], observacaoGeral: '', success: false, error: 'Resposta inválida do Groq' }
    }

    const findings: PRMFindingResult[] = (parsed.prms || [])
      .filter((prm: GeminiPRM) => prm.titulo && prm.descricao) // ignora PRMs vazios
      .map((prm: GeminiPRM) => ({
        category: (PRMCategory[prm.categoria] || PRMCategory.SAFETY) as PRMCategory,
        riskLevel: (RiskLevel[prm.risco] || RiskLevel.MODERATE) as RiskLevel,
        title: `[IA] ${prm.titulo}`,
        description: prm.descricao,
        clinicalEvidence: prm.evidencia,
        potentialImpact: prm.impacto_potencial || prm.descricao,
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

    if (parsed.raciocinio) {
      console.log('[GROQ] Raciocínio clínico:', parsed.raciocinio)
    }

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
