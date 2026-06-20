/**
 * Camada de IA EXPLICADORA para o módulo de Interações.
 * Recebe interações JÁ identificadas pelo motor determinístico e apenas as
 * ORGANIZA/ENRIQUECE (evidência, sinais de alerta, alternativas, monitorização,
 * mensagem ao paciente). NUNCA inventa interações: guardrail filtra qualquer item
 * cujo par não esteja no conjunto de entrada.
 */
import { callGroqWithRetry } from './gemini-service'
import { z } from 'zod'

export interface DdiInputInteraction {
  drugs: [string, string]
  severityLabel: string
  mechanism: string
  clinicalEffect: string
  management: string
  /** Origem do par: presente => base externa DDInter (sem evidência graduada própria). */
  source?: string
}
export interface DdiExplanation {
  pair: string
  evidenceLevel: string
  warningSigns: string
  alternatives: string
  monitoring: string
  patientMessage: string
}

const ItemSchema = z.object({
  pair: z.string(),
  evidenceLevel: z.string().optional().default(''),
  warningSigns: z.string().optional().default(''),
  alternatives: z.string().optional().default(''),
  monitoring: z.string().optional().default(''),
  patientMessage: z.string().optional().default(''),
})
const RespSchema = z.object({ items: z.array(ItemSchema).optional().default([]) })

const SYSTEM = `Você é farmacêutico clínico sênior. Sua tarefa é ORGANIZAR e ENRIQUECER interações
medicamentosas JÁ IDENTIFICADAS por um motor determinístico. VOCÊ NÃO PODE INVENTAR, INFERIR
NEM ADICIONAR qualquer interação que não esteja na lista fornecida.
Cada interação traz mecanismo/efeito/conduta já apurados — USE-OS como âncora factual e seja
COERENTE com eles (não contradiga o mecanismo informado).
Para CADA interação fornecida (e SOMENTE essas), produza, com base em conhecimento consolidado:
- evidenceLevel: nível de evidência (Alta | Moderada | Baixa | Teórica). CALIBRE pela origem:
  • Pares com "fonte: DDInter" provêm de base computacional/literatura SEM evidência clínica graduada
    própria — NUNCA classifique como "Alta"; use "Moderada" quando o mecanismo for farmacologia
    bem estabelecida, ou "Teórica/Baixa" quando o efeito for apenas potencial.
  • Pares SEM fonte externa (curadoria interna) podem ser "Alta/Moderada" conforme o consenso.
- warningSigns: sinais/sintomas de alerta a observar;
- alternatives: alternativas terapêuticas possíveis (ou "—" se não houver clara);
- monitoring: parâmetros laboratoriais/clínicos a monitorar;
- patientMessage: orientação simplificada ao paciente, sem jargão, sem alarmismo.
Use o MESMO identificador "pair" recebido. Linguagem técnica nos campos clínicos.
FONTES: você PODE referenciar os TRECHOS DE FONTES fornecidos (cite o título do protocolo
no campo pertinente); NUNCA invente referências/fontes que não estejam na lista fornecida.
Responda EXCLUSIVAMENTE em JSON: {"items":[{"pair","evidenceLevel","warningSigns",
"alternatives","monitoring","patientMessage"}]}.`

function extractJson(raw: string): string {
  let s = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const i = s.indexOf('{'), j = s.lastIndexOf('}')
  if (i >= 0 && j > i) s = s.slice(i, j + 1)
  return s
}

export async function explainInteractions(
  interactions: DdiInputInteraction[],
  context?: { age?: number; isPregnant?: boolean; renal?: string; hepatic?: string },
  chunks?: { citation: string; content: string }[],
): Promise<{ items: DdiExplanation[]; model: string; sourcesUsed: string[] } | null> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey || interactions.length === 0) return null

  const allowed = new Set(interactions.map(i => i.drugs.join(' + ').toLowerCase()))
  const sources = (chunks || []).slice(0, 6)
  const userPrompt = [
    context && Object.keys(context).length ? `CONTEXTO DO PACIENTE: ${JSON.stringify(context)}` : '',
    'INTERAÇÕES IDENTIFICADAS (organize/enriqueça SOMENTE estas; "pair" deve ser reusado igual):',
    JSON.stringify(interactions.map(i => ({ pair: i.drugs.join(' + '), gravidade: i.severityLabel, mecanismo: i.mechanism, efeito: i.clinicalEffect, conduta: i.management, fonte: i.source || 'curadoria interna' }))),
    sources.length ? `\nTRECHOS DE FONTES (cite o título quando pertinente; NÃO invente outras fontes):\n${sources.map((c, i) => `[${i + 1}] ${c.citation}: ${c.content}`).join('\n')}` : '',
  ].filter(Boolean).join('\n')

  const groq = await callGroqWithRetry(
    apiKey,
    [{ role: 'system', content: SYSTEM }, { role: 'user', content: userPrompt }],
    { temperature: 0.1, maxTokens: 3500, json: true, timeoutMs: 45000 },
  )
  if (!groq) return null

  try {
    const parsed = RespSchema.safeParse(JSON.parse(extractJson(groq.text) || '{}'))
    if (!parsed.success) return null
    // GUARDRAIL: só mantém itens cujo par foi realmente fornecido (anti-alucinação)
    const items = parsed.data.items.filter(it => allowed.has((it.pair || '').toLowerCase()))
    return { items, model: groq.model, sourcesUsed: sources.map(c => c.citation) }
  } catch {
    return null
  }
}
