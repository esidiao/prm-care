/**
 * PRM Care — Guardrails da saída da IA (anti-alucinação)
 *
 * Camada de SEGURANÇA pura (sem rede) aplicada aos PRMs sugeridos pela IA antes
 * de mesclá-los aos achados do motor determinístico:
 *  - remove duplicatas internas (mesmo título);
 *  - sinaliza para verificação humana os achados que NÃO referenciam nenhum
 *    medicamento real do paciente (provável alucinação) — exceto PRMs de
 *    NECESSIDADE, que legitimamente citam medicamentos AUSENTes (terapia faltante).
 *
 * Política: NUNCA descartar silenciosamente um achado clínico — em caso de
 * suspeita, rebaixa a confiança e anota, deixando a decisão ao farmacêutico.
 */
import type { PatientContext, PRMFindingResult } from '@/types'

const STOPWORDS = new Set([
  'de', 'da', 'do', 'a', 'o', 'e', 'em', 'com', 'para', 'por', 'uso', 'dose',
  'mg', 'ml', 'risco', 'paciente', 'medicamento', 'medicamentos', 'ia',
])

function tokenize(s: string): string[] {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 4 && !STOPWORDS.has(t))
}

/** Conjunto de tokens dos medicamentos reais do paciente (princípio ativo + nome comercial). */
function patientDrugTokens(context: PatientContext): Set<string> {
  const set = new Set<string>()
  for (const m of context.medications ?? []) {
    for (const t of tokenize(m.activeIngredient ?? '')) set.add(t)
    for (const t of tokenize(m.tradeName ?? '')) set.add(t)
  }
  return set
}

export type GuardrailResult = {
  findings: PRMFindingResult[]
  flagged: number   // achados rebaixados por não referenciar a lista do paciente
  deduped: number   // duplicatas internas removidas
}

/**
 * Higieniza os achados da IA. `context` é a lista clínica real do paciente.
 */
export function sanitizeAiFindings(
  findings: PRMFindingResult[],
  context: PatientContext,
): GuardrailResult {
  const drugTokens = patientDrugTokens(context)
  const seen = new Set<string>()
  const out: PRMFindingResult[] = []
  let flagged = 0
  let deduped = 0

  for (const f of findings) {
    if (!f?.title || !f?.description) continue

    // Dedupe interno por título normalizado
    const key = tokenize(f.title).join(' ')
    if (key && seen.has(key)) { deduped++; continue }
    if (key) seen.add(key)

    // PRMs de necessidade podem (devem) citar terapia ausente — não checar
    const isNecessity = String(f.category) === 'NECESSITY'

    if (!isNecessity && drugTokens.size > 0) {
      const refTokens = tokenize(f.title).concat(tokenize(f.description))
      const referenciaPaciente = refTokens.some(t => drugTokens.has(t))
      if (!referenciaPaciente) {
        // Não referencia nenhum medicamento do paciente → rebaixa e sinaliza
        flagged++
        out.push({
          ...f,
          title: f.title.startsWith('⚠️') ? f.title : `⚠️ ${f.title}`,
          confidenceLevel: 'low',
          validationNote:
            'ATENÇÃO: este achado da IA não referencia explicitamente nenhum medicamento da lista do paciente — ' +
            'possível alucinação. Verifique cuidadosamente antes de validar. ' +
            (f.validationNote ?? ''),
        })
        continue
      }
    }

    out.push(f)
  }

  return { findings: out, flagged, deduped }
}
