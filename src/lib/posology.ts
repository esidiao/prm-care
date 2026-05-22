/**
 * Posology engine — interpreta frequências e gera horários + alertas clínicos.
 */

// ── Faixas horárias ────────────────────────────────────────────────────────────

export const TIME_SLOTS = [
  { id: 't06', label: '6h',  period: 'Madrugada', icon: '🌙' },
  { id: 't07', label: '7h',  period: 'Madrugada', icon: '🌙' },
  { id: 't08', label: '8h',  period: 'Manhã',     icon: '🌅' },
  { id: 't10', label: '10h', period: 'Manhã',     icon: '🌅' },
  { id: 't12', label: '12h', period: 'Almoço',    icon: '☀️' },
  { id: 't14', label: '14h', period: 'Tarde',     icon: '🌤️' },
  { id: 't18', label: '18h', period: 'Jantar',    icon: '🌇' },
  { id: 't20', label: '20h', period: 'Noite',     icon: '🌙' },
  { id: 't22', label: '22h', period: 'Dormir',    icon: '😴' },
]

export type TimeSlotId = typeof TIME_SLOTS[number]['id']

// ── Tipo de horário resolvido ─────────────────────────────────────────────────

export interface ResolvedSchedule {
  slots: TimeSlotId[]      // quais faixas o medicamento aparece
  timing: string           // descrição textual (ex: "com alimento")
  isVariable: boolean      // horário flexível / a critério médico
}

// ── Parser principal ──────────────────────────────────────────────────────────

/**
 * Resolve o horário de um medicamento a partir dos campos disponíveis.
 * Prioridade: schedule > frequencyHours > frequency (string)
 */
export function resolveSchedule(med: {
  schedule?: string | null
  frequencyHours?: number | null
  frequency?: string | null
}): ResolvedSchedule {

  // 1. Campo `schedule` explícito (ex: "8h, 14h, 22h")
  if (med.schedule?.trim()) {
    const slots = parseScheduleString(med.schedule)
    if (slots.length > 0) {
      return { slots, timing: '', isVariable: false }
    }
  }

  // 2. Intervalo em horas
  if (med.frequencyHours && med.frequencyHours > 0) {
    return { slots: slotsByInterval(med.frequencyHours), timing: `a cada ${med.frequencyHours}h`, isVariable: false }
  }

  // 3. Texto de frequência
  if (med.frequency) {
    return parseFrequencyText(med.frequency)
  }

  return { slots: [], timing: 'Horário não informado', isVariable: true }
}

/** Converte "8h, 14h, 22h" → ['t08','t14','t22'] */
function parseScheduleString(raw: string): TimeSlotId[] {
  const ids = new Set<TimeSlotId>()
  const matches = raw.match(/\d{1,2}h?/gi) ?? []
  for (const m of matches) {
    const h = parseInt(m)
    const slot = nearestSlot(h)
    if (slot) ids.add(slot)
  }
  return Array.from(ids)
}

/** Mapeia hora inteira para o slot mais próximo */
function nearestSlot(hour: number): TimeSlotId | null {
  const map: Record<number, TimeSlotId> = {
    0: 't06', 1: 't06', 2: 't06', 3: 't06', 4: 't06', 5: 't06',
    6: 't06', 7: 't07', 8: 't08', 9: 't08', 10: 't10',
    11: 't12', 12: 't12', 13: 't12', 14: 't14', 15: 't14',
    16: 't18', 17: 't18', 18: 't18', 19: 't20', 20: 't20',
    21: 't22', 22: 't22', 23: 't22',
  }
  return map[hour] ?? null
}

/** Distribui doses com base no intervalo em horas */
function slotsByInterval(hours: number): TimeSlotId[] {
  // Inicia às 8h e distribui pelo dia
  const startHour = 8
  const result: TimeSlotId[] = []
  let h = startHour
  while (h < 32) { // até 8h do dia seguinte para cobrir intervalos longos
    const slot = nearestSlot(h % 24)
    if (slot && !result.includes(slot)) result.push(slot)
    h += hours
    if (result.length >= Math.round(24 / hours)) break
  }
  return result
}

/** Interpreta string de frequência em português/inglês */
function parseFrequencyText(freq: string): ResolvedSchedule {
  const f = freq.toLowerCase().trim()

  // Jejum / antes das refeições
  if (/jejum|antes.*refeição|antes.*café|pré.?prandial/i.test(f))
    return { slots: ['t07'], timing: 'Em jejum — 30 min antes do café', isVariable: false }

  // Ao deitar / noite
  if (/deitar|dormir|noite|ao\s+deitar|bedtime/i.test(f))
    return { slots: ['t22'], timing: 'Ao deitar', isVariable: false }

  // Com refeições / pós-prandial
  if (/refeição|refeic|com.*comida|aliment|pós.?prandial|with\s+food/i.test(f))
    return { slots: ['t08', 't12', 't18'], timing: 'Com as refeições', isVariable: false }

  // 1x ao dia / once daily / 1 vez
  if (/^1\s*[xv×]|uma\s+vez|once\s+daily|1\s+vez/i.test(f))
    return { slots: ['t08'], timing: '1× ao dia', isVariable: false }

  // 2x ao dia / twice daily
  if (/^2\s*[xv×]|duas?\s+vezes|twice\s+daily|bid|2\s+vezes/i.test(f))
    return { slots: ['t08', 't20'], timing: '2× ao dia', isVariable: false }

  // 3x ao dia / three times
  if (/^3\s*[xv×]|três\s+vezes|three\s+times|tid|3\s+vezes/i.test(f))
    return { slots: ['t08', 't14', 't20'], timing: '3× ao dia', isVariable: false }

  // 4x ao dia / four times / qid
  if (/^4\s*[xv×]|quatro\s+vezes|four\s+times|qid|4\s+vezes/i.test(f))
    return { slots: ['t08', 't12', 't18', 't22'], timing: '4× ao dia', isVariable: false }

  // 5x ao dia
  if (/^5\s*[xv×]|cinco\s+vezes|5\s+vezes/i.test(f))
    return { slots: ['t06', 't08', 't12', 't18', 't22'], timing: '5× ao dia', isVariable: false }

  // A cada X horas
  const eachMatch = f.match(/cada\s+(\d+)\s*h/i) ?? f.match(/q\.?\s*(\d+)\s*h/i)
  if (eachMatch) {
    const h = parseInt(eachMatch[1])
    return { slots: slotsByInterval(h), timing: `a cada ${h}h`, isVariable: false }
  }

  // Semanal / semana
  if (/semanal|1\s*[xv×]\s*semana|weekly/i.test(f))
    return { slots: ['t08'], timing: '1× por semana', isVariable: true }

  // Quinzenal / mensal
  if (/quinzenal|mensal|monthly/i.test(f))
    return { slots: ['t08'], timing: freq, isVariable: true }

  // Conforme necessário / SOS
  if (/necessário|sos|prn|se\s+necessário/i.test(f))
    return { slots: [], timing: 'Se necessário (SOS)', isVariable: true }

  // Fallback: tenta extrair número de vezes
  const nMatch = f.match(/(\d+)\s*[xv×]/i)
  if (nMatch) {
    const n = parseInt(nMatch[1])
    return { slots: slotsByInterval(Math.round(24 / n)), timing: `${n}× ao dia`, isVariable: false }
  }

  return { slots: ['t08'], timing: freq, isVariable: false }
}

// ── Alertas clínicos ──────────────────────────────────────────────────────────

export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface PosologyAlert {
  medicationName: string
  severity: AlertSeverity
  type: 'timing' | 'food' | 'high_risk' | 'interaction' | 'adherence' | 'renal' | 'hepatic'
  message: string
  recommendation: string
}

interface MedInput {
  activeIngredient: string
  tradeName?: string | null
  frequency?: string | null
  schedule?: string | null
  dose?: number | null
  doseUnit?: string | null
  adherence?: string | null
  route?: string | null
}

interface PatientContext {
  renalFunction?: string | null
  hepaticFunction?: string | null
  isElderly?: boolean
  isPregnant?: boolean
}

/**
 * Gera alertas posológicos para a lista de medicamentos do paciente.
 */
export function generatePosologyAlerts(meds: MedInput[], patient: PatientContext): PosologyAlert[] {
  const alerts: PosologyAlert[] = []

  for (const med of meds) {
    const name = med.activeIngredient.toLowerCase()
    const displayName = med.tradeName ? `${med.activeIngredient} (${med.tradeName})` : med.activeIngredient

    // ── Alertas de horário / alimento ──────────────────────────────────────

    // IBPs / Inibidores de bomba de prótons
    if (/omeprazol|pantoprazol|esomeprazol|lansoprazol|rabeprazol/i.test(name)) {
      alerts.push({
        medicationName: displayName, severity: 'warning', type: 'timing',
        message: 'Tomar 30–60 min ANTES da primeira refeição do dia.',
        recommendation: 'Horário ideal: 7h (em jejum). Eficácia reduzida se tomado com alimento.',
      })
    }

    // Bisfosfonatos
    if (/alendronato|risedronato|ibandronato|zoledronato/i.test(name)) {
      alerts.push({
        medicationName: displayName, severity: 'critical', type: 'timing',
        message: 'Tomar em jejum com copo cheio de água. Permanecer ERETO por 30 min.',
        recommendation: 'Não deitar após tomar. Não comer por 30 min. Evitar cálcio e antiácidos.',
      })
    }

    // Levotiroxina
    if (/levotiroxina|l-tiroxina/i.test(name)) {
      alerts.push({
        medicationName: displayName, severity: 'critical', type: 'food',
        message: 'Tomar em jejum rigoroso, 30–60 min antes do café da manhã.',
        recommendation: 'Não tomar com cálcio, ferro ou antiácidos (intervalo mínimo 4h). Horário fixo todo dia.',
      })
    }

    // Metformina
    if (/metformina/i.test(name)) {
      alerts.push({
        medicationName: displayName, severity: 'info', type: 'food',
        message: 'Tomar COM alimento para reduzir desconforto gastrointestinal.',
        recommendation: 'Dividir doses às refeições principais quando em esquema 2× ou 3× ao dia.',
      })
    }

    // Sulfonilureias
    if (/glibenclamida|glipizida|gliclazida|glimepirida/i.test(name)) {
      alerts.push({
        medicationName: displayName, severity: 'warning', type: 'timing',
        message: 'Tomar 30 min ANTES das refeições.',
        recommendation: 'Monitorar hipoglicemia especialmente em idosos e pacientes com insuficiência renal.',
      })
    }

    // Estatinas (sinvastatina e lovastatina = noite; outras = qualquer hora)
    if (/sinvastatina|lovastatina/i.test(name)) {
      alerts.push({
        medicationName: displayName, severity: 'info', type: 'timing',
        message: 'Tomar preferencialmente À NOITE (maior síntese de colesterol ocorre à noite).',
        recommendation: 'Horário ideal: 22h. Sinvastatina tem interação com toranja (grapefruit).',
      })
    }
    if (/atorvastatina|rosuvastatina|fluvastatina|pravastatina/i.test(name)) {
      alerts.push({
        medicationName: displayName, severity: 'info', type: 'timing',
        message: 'Pode ser tomada em qualquer horário. Manter horário fixo.',
        recommendation: 'Atorvastatina: evitar toranja. Rosuvastatina: tomar 2h antes de antiácidos.',
      })
    }

    // Anticoagulantes
    if (/varfarina|warfarina/i.test(name)) {
      alerts.push({
        medicationName: displayName, severity: 'critical', type: 'high_risk',
        message: '⚠️ MEDICAMENTO DE ALTA VIGILÂNCIA — Tomar no mesmo horário todos os dias.',
        recommendation: 'Manter ingestão consistente de vitamina K. Monitorar INR regularmente. Checar interações a cada nova prescrição.',
      })
    }
    if (/rivaroxabana|apixabana|dabigatrana|edoxabana/i.test(name)) {
      alerts.push({
        medicationName: displayName, severity: 'critical', type: 'high_risk',
        message: '⚠️ ANTICOAGULANTE ORAL — Não interromper sem orientação médica.',
        recommendation: 'Rivaroxabana 15/20mg: tomar COM alimento. Dabigatrana: não abrir cápsula.',
      })
    }

    // Digoxina
    if (/digoxina/i.test(name)) {
      alerts.push({
        medicationName: displayName, severity: 'critical', type: 'high_risk',
        message: '⚠️ MARGEM TERAPÊUTICA ESTREITA — Monitorar FC e nível sérico.',
        recommendation: 'Tomar no mesmo horário. Evitar com antiarrítmicos. Monitorar K⁺ sérico.',
      })
    }

    // Insulina
    if (/insulina/i.test(name)) {
      alerts.push({
        medicationName: displayName, severity: 'critical', type: 'timing',
        message: '⚠️ Timing crítico conforme tipo: Regular = 30 min antes; Análogos ultrarrápidos = imediatamente antes ou com refeição.',
        recommendation: 'Rodízio de sítios de aplicação. Armazenar frasco aberto em temperatura ambiente (28 dias max.).',
      })
    }

    // Ferro
    if (/sulfato\s*ferroso|ferro|fumarato\s*ferroso|gluconato\s*ferroso/i.test(name)) {
      alerts.push({
        medicationName: displayName, severity: 'warning', type: 'food',
        message: 'Tomar entre as refeições (1h antes ou 2h após) com suco de laranja (vitamina C).',
        recommendation: 'Não tomar com cálcio, laticínios, chá, café ou leite — reduzem absorção em até 60%.',
      })
    }

    // Cálcio
    if (/carbonato\s*de\s*cálcio|cálcio|calcium\s*carbonate/i.test(name)) {
      alerts.push({
        medicationName: displayName, severity: 'info', type: 'food',
        message: 'Carbonato de cálcio: tomar COM alimento (precisa de ácido gástrico).',
        recommendation: 'Citrato de cálcio pode ser tomado sem alimento. Dividir doses (max 500mg por vez).',
      })
    }

    // Diuréticos
    if (/furosemida|hidroclorotiazida|espironolactona|indapamida|torasemida/i.test(name)) {
      if (!/espironolactona/i.test(name)) {
        alerts.push({
          medicationName: displayName, severity: 'warning', type: 'timing',
          message: 'Tomar pela MANHÃ para evitar noctúria.',
          recommendation: 'Furosemida 2× ao dia: 8h e 14h (nunca após 16h). Monitorar K⁺, Na⁺ e creatinina.',
        })
      }
    }

    // Antibióticos — espaçamento uniforme
    if (/amoxicilina|ampicilina|azitromicina|claritromicina|ciprofloxacino|levofloxacino|metronidazol|cefalexina|ceftriaxona/i.test(name)) {
      const sched = resolveSchedule(med)
      if (sched.slots.length >= 2) {
        alerts.push({
          medicationName: displayName, severity: 'warning', type: 'timing',
          message: 'Espaçar doses uniformemente a cada intervalo fixo para manter nível sérico constante.',
          recommendation: `${sched.slots.length} doses/dia → intervalos de ${Math.round(24 / sched.slots.length)}h. Completar curso completo.`,
        })
      }
      if (/azitromicina/i.test(name)) {
        alerts.push({
          medicationName: displayName, severity: 'info', type: 'food',
          message: 'Azitromicina: pode ser tomada com ou sem alimento.',
          recommendation: 'Tomada em jejum aumenta absorção. Ciprofloxacino: não tomar com laticínios ou antiácidos.',
        })
      }
    }

    // Antiepilépticos / Anticonvulsivantes
    if (/fenitoína|carbamazepina|valproato|ácido\s*valproico|levetiracetam|lamotrigina/i.test(name)) {
      alerts.push({
        medicationName: displayName, severity: 'critical', type: 'adherence',
        message: '⚠️ Não pular doses — risco de convulsões. Manter horários rigorosamente fixos.',
        recommendation: 'Valproato: tomar com alimento. Monitorar nível sérico periodicamente.',
      })
    }

    // Anti-hipertensivos — consistência
    if (/losartana|enalapril|captopril|ramipril|amlodipino|anlodipino|nifedipino|propranolol|atenolol|carvedilol|bisoprolol|metoprolol/i.test(name)) {
      alerts.push({
        medicationName: displayName, severity: 'info', type: 'timing',
        message: 'Manter horário fixo todos os dias para controle estável da PA.',
        recommendation: 'Captopril: tomar em jejum (30 min antes das refeições) para melhor absorção.',
      })
    }

    // Corticosteroides
    if (/prednisona|prednisolona|dexametasona|hidrocortisona|betametasona/i.test(name)) {
      alerts.push({
        medicationName: displayName, severity: 'warning', type: 'timing',
        message: 'Tomar pela MANHÃ com alimento, preferencialmente entre 7h–8h.',
        recommendation: 'Simula o pico fisiológico do cortisol. Não interromper abruptamente.',
      })
    }

    // AINES / Ibuprofeno / Diclofenaco
    if (/ibuprofeno|diclofenaco|naproxeno|nimesulida|cetoprofeno|meloxicam|celecoxibe/i.test(name)) {
      alerts.push({
        medicationName: displayName, severity: 'warning', type: 'food',
        message: 'Tomar COM alimento ou leite para proteger mucosa gástrica.',
        recommendation: 'Evitar uso prolongado. Associar protetor gástrico (IBP) em idosos ou uso > 5 dias.',
      })
    }

    // Baixa adesão documentada
    if (med.adherence === 'POOR' || med.adherence === 'MODERATE') {
      alerts.push({
        medicationName: displayName, severity: 'warning', type: 'adherence',
        message: `Adesão documentada: ${med.adherence === 'POOR' ? 'Ruim' : 'Moderada'}.`,
        recommendation: 'Considerar simplificação do esquema, uso de caixa de medicamentos semanal ou alarme de lembrete.',
      })
    }

    // Alerta renal
    if (patient.renalFunction && ['moderate_impairment', 'severe_impairment', 'failure'].includes(patient.renalFunction)) {
      if (/metformina|nsaid|ibuprofeno|diclofenaco|naproxeno|metronidazol/i.test(name)) {
        alerts.push({
          medicationName: displayName, severity: 'critical', type: 'renal',
          message: '⚠️ CONTRAINDICADO ou AJUSTE DE DOSE em insuficiência renal moderada/grave.',
          recommendation: 'Revisar dose ou substituir. Calcular ClCr e consultar protocolo de ajuste renal.',
        })
      }
    }

    // Alerta hepático
    if (patient.hepaticFunction && ['moderate_impairment', 'severe_impairment'].includes(patient.hepaticFunction)) {
      if (/paracetamol|acetaminofeno|atorvastatina|sinvastatina|metronidazol/i.test(name)) {
        alerts.push({
          medicationName: displayName, severity: 'critical', type: 'hepatic',
          message: '⚠️ AJUSTE DE DOSE necessário em disfunção hepática.',
          recommendation: 'Hepatotoxicidade potencial. Monitorar enzimas hepáticas. Consultar bula para ajuste.',
        })
      }
    }

    // Idoso — medicamentos de Beers
    if (patient.isElderly) {
      if (/amiodarona|glibenclamida|indometacina|diazepam|alprazolam|clonazepam|lorazepam|haloperidol|amitriptilina|nortriptilina/i.test(name)) {
        alerts.push({
          medicationName: displayName, severity: 'critical', type: 'high_risk',
          message: '⚠️ CRITÉRIOS DE BEERS — Medicamento potencialmente inapropriado em idosos (≥60 anos).',
          recommendation: 'Avaliar relação risco-benefício. Considerar alternativa mais segura para a faixa etária.',
        })
      }
    }
  }

  // ── Alertas de interações por horário (entre medicamentos) ─────────────────

  const hasFerro = meds.some(m => /ferro|sulfato\s*ferroso/i.test(m.activeIngredient))
  const hasLevotiroxina = meds.some(m => /levotiroxina/i.test(m.activeIngredient))
  if (hasFerro && hasLevotiroxina) {
    alerts.push({
      medicationName: 'Ferro + Levotiroxina',
      severity: 'critical', type: 'interaction',
      message: '⚠️ INTERAÇÃO: Ferro reduz absorção de Levotiroxina em até 30–40%.',
      recommendation: 'Separar horários por mínimo 4 horas. Levotiroxina: manhã em jejum. Ferro: tarde.',
    })
  }

  const hasCálcio = meds.some(m => /cálcio|carbonato/i.test(m.activeIngredient))
  if (hasCálcio && hasLevotiroxina) {
    alerts.push({
      medicationName: 'Cálcio + Levotiroxina',
      severity: 'critical', type: 'interaction',
      message: '⚠️ INTERAÇÃO: Cálcio reduz absorção de Levotiroxina.',
      recommendation: 'Separar por mínimo 4 horas.',
    })
  }

  const hasAntiacido = meds.some(m => /hidróxido\s*de\s*alumínio|hidróxido\s*de\s*magnésio|antiácido|bicarbonato/i.test(m.activeIngredient))
  const hasQuinolona = meds.some(m => /ciprofloxacino|levofloxacino|norfloxacino/i.test(m.activeIngredient))
  if (hasAntiacido && hasQuinolona) {
    alerts.push({
      medicationName: 'Antiácido + Quinolona',
      severity: 'critical', type: 'interaction',
      message: '⚠️ INTERAÇÃO: Antiácidos reduzem absorção de quinolonas em até 90%.',
      recommendation: 'Separar por mínimo 2 horas. Quinolona: antes do antiácido.',
    })
  }

  // Sort: critical first
  return alerts.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 }
    return order[a.severity] - order[b.severity]
  })
}

// ── Classe terapêutica para colorização ───────────────────────────────────────

export function getTherapeuticClass(activeIngredient: string): string {
  const n = activeIngredient.toLowerCase()
  if (/insulina|metformina|glibenc|glipiz|gliclaz|glimep|sitaglip|empaglifloz|dapaglifloz/i.test(n)) return 'diabetes'
  if (/losart|enalapril|captopril|ramipril|amlodip|nifedip|propranolol|atenolol|carvedil|bisoprolol|metoprolol|hidroclo|furosem|espirono|indapam/i.test(n)) return 'cardiovascular'
  if (/sinvasta|atorvasta|rosuva|fluva|prava/i.test(n)) return 'lipid'
  if (/varfarin|rivarox|apixab|dabigatr|heparina|clopidogrel|aspirina|ácido acetilsalicílico/i.test(n)) return 'anticoagulant'
  if (/amoxicil|ampicil|azitrom|claritrom|ciproflox|levoflox|metronid|cefalex|ceftri|tetraciclina|doxiciclin/i.test(n)) return 'antibiotic'
  if (/omeprazol|pantoprazol|esomeprazol|lansoprazol|rabeprazol|ranitidina|famotidina/i.test(n)) return 'gi'
  if (/prednisona|prednisolona|dexameta|hidrocort|betameta/i.test(n)) return 'steroid'
  if (/ibuprofeno|diclofenac|naproxen|nimesul|cetopr|meloxicam|celecox/i.test(n)) return 'nsaid'
  if (/levotiroxin/i.test(n)) return 'thyroid'
  if (/fenitoín|carbamazep|valproato|levetirace|lamotrigin|topiramato/i.test(n)) return 'neurologic'
  if (/sertralina|fluoxetina|escitalopram|paroxetina|venlafaxina|amitriptil|nortriptil/i.test(n)) return 'psychiatric'
  if (/sulfato\s*ferr|ferro|cálcio|carbonato|vitamina\s*d|vitamina\s*b/i.test(n)) return 'supplement'
  return 'other'
}

export const CLASS_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  diabetes:      { bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-blue-300',   label: 'Diabetes' },
  cardiovascular:{ bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-red-300',    label: 'Cardiovascular' },
  lipid:         { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300', label: 'Dislipidemia' },
  anticoagulant: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300', label: 'Anticoag.' },
  antibiotic:    { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300', label: 'Antibiótico' },
  gi:            { bg: 'bg-teal-100',   text: 'text-teal-800',   border: 'border-teal-300',   label: 'Gastro.' },
  steroid:       { bg: 'bg-amber-100',  text: 'text-amber-800',  border: 'border-amber-300',  label: 'Corticoide' },
  nsaid:         { bg: 'bg-rose-100',   text: 'text-rose-800',   border: 'border-rose-300',   label: 'AINE' },
  thyroid:       { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300', label: 'Tireóide' },
  neurologic:    { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-300', label: 'Neurológico' },
  psychiatric:   { bg: 'bg-pink-100',   text: 'text-pink-800',   border: 'border-pink-300',   label: 'Psiquiátrico' },
  supplement:    { bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-300',  label: 'Suplemento' },
  other:         { bg: 'bg-gray-100',   text: 'text-gray-700',   border: 'border-gray-300',   label: 'Outro' },
}
