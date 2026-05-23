/**
 * Motor de Posologia — PRM Care
 *
 * Usa o banco de dados farmacocinético (pharma-pk-db.ts) para gerar
 * horários baseados em evidências + alertas clínicos contextualizados.
 */

import { getPKProfile, getRecommendedHours, PK_DATABASE, type PKProfile } from './pharma-pk-db'

// ── Faixas horárias exibidas na grade ─────────────────────────────────────────

export const TIME_SLOTS = [
  { id: 't06', label: '6h',  hour: 6,  period: 'Madrugada', icon: '🌙' },
  { id: 't07', label: '7h',  hour: 7,  period: 'Manhã cedo', icon: '🌤️' },
  { id: 't08', label: '8h',  hour: 8,  period: 'Manhã',     icon: '🌅' },
  { id: 't10', label: '10h', hour: 10, period: 'Manhã',     icon: '🌅' },
  { id: 't12', label: '12h', hour: 12, period: 'Almoço',    icon: '☀️' },
  { id: 't14', label: '14h', hour: 14, period: 'Tarde',     icon: '🌤️' },
  { id: 't16', label: '16h', hour: 16, period: 'Tarde',     icon: '🌤️' },
  { id: 't18', label: '18h', hour: 18, period: 'Jantar',    icon: '🌇' },
  { id: 't20', label: '20h', hour: 20, period: 'Noite',     icon: '🌙' },
  { id: 't22', label: '22h', hour: 22, period: 'Dormir',    icon: '😴' },
]

export type TimeSlotId = typeof TIME_SLOTS[number]['id']

// ── Resultado de horário resolvido ────────────────────────────────────────────

export interface ResolvedSchedule {
  slots: TimeSlotId[]
  timing: string
  isVariable: boolean
  pkBased: boolean           // true = baseado em dados farmacocinéticos
  foodInstruction?: string   // instrução sobre alimento
  pkRationale?: string       // justificativa clínica (resumida)
  idealHours?: number[]      // horários recomendados em formato 24h
}

// ── Mapeamento hora → slot mais próximo ──────────────────────────────────────

function hourToSlot(hour: number): TimeSlotId {
  const h = ((hour % 24) + 24) % 24
  if (h <= 6)  return 't06'
  if (h === 7)  return 't07'
  if (h <= 9)  return 't08'
  if (h <= 11) return 't10'
  if (h <= 13) return 't12'
  if (h <= 15) return 't14'
  if (h <= 17) return 't16'
  if (h <= 19) return 't18'
  if (h <= 21) return 't20'
  return 't22'
}

/** Conta frequência diária a partir de texto/intervalo */
function parseFrequencyCount(med: {
  frequencyHours?: number | null
  frequency?: string | null
}): number {
  if (med.frequencyHours && med.frequencyHours > 0) {
    return Math.round(24 / med.frequencyHours)
  }
  if (med.frequency) {
    const f = med.frequency.toLowerCase()
    if (/1\s*[xv×]|uma\s*vez|once|1\s+vez|1x/i.test(f)) return 1
    if (/2\s*[xv×]|duas?\s*vez|twice|bid|2\s+vez|2x/i.test(f)) return 2
    if (/3\s*[xv×]|três\s*vez|three|tid|3\s+vez|3x/i.test(f)) return 3
    if (/4\s*[xv×]|quatro\s*vez|four|qid|4\s+vez|4x/i.test(f)) return 4
    if (/5\s*[xv×]|cinco|5x/i.test(f)) return 5
    const em = f.match(/cada\s+(\d+)\s*h/i) ?? f.match(/q\.?\s*(\d+)\s*h/i)
    if (em) return Math.round(24 / parseInt(em[1]))
    const nm = f.match(/(\d+)\s*[xv×]/i)
    if (nm) return parseInt(nm[1])
  }
  return 1
}

// ── Instrução de alimento ────────────────────────────────────────────────────

const FOOD_LABELS: Record<string, string> = {
  jejum:              'Em jejum (30–60 min antes do café)',
  com_alimento:       'Com alimento',
  sem_restricao:      'Com ou sem alimento',
  antes_refeicao:     '30–60 min antes da refeição',
  apos_refeicao:      'Após a refeição',
  com_agua_abundante: 'Em jejum com copo cheio de água (200 mL)',
}

// ── Resolver horário ──────────────────────────────────────────────────────────

export function resolveSchedule(med: {
  activeIngredient?: string | null
  schedule?: string | null
  frequencyHours?: number | null
  frequency?: string | null
}): ResolvedSchedule {

  // 1. Horário explícito cadastrado — respeitar sempre
  if (med.schedule?.trim()) {
    const slots = parseScheduleString(med.schedule)
    if (slots.length > 0) {
      const profile = med.activeIngredient ? getPKProfile(med.activeIngredient) : undefined
      return {
        slots,
        timing: 'Horário cadastrado',
        isVariable: false,
        pkBased: false,
        foodInstruction: profile ? FOOD_LABELS[profile.foodEffect] : undefined,
        pkRationale: profile?.rationale,
        idealHours: slots.map(s => parseInt(s.replace('t', ''))),
      }
    }
  }

  // 2. Buscar perfil farmacocinético
  const profile = med.activeIngredient ? getPKProfile(med.activeIngredient) : undefined
  const freqCount = parseFrequencyCount(med)

  if (profile) {
    // Frequência especial: textos que indicam não-diário
    const freqText = med.frequency?.toLowerCase() ?? ''
    if (/semanal|1\s*[xv×]\s*semana|weekly/i.test(freqText)) {
      return {
        slots: [hourToSlot(profile.idealHours[0])],
        timing: '1× por semana',
        isVariable: true,
        pkBased: true,
        foodInstruction: FOOD_LABELS[profile.foodEffect],
        pkRationale: profile.rationale,
        idealHours: [profile.idealHours[0]],
      }
    }
    if (/conforme|sos|prn|se\s+necessário|quando/i.test(freqText)) {
      return {
        slots: [],
        timing: 'Se necessário (SOS)',
        isVariable: true,
        pkBased: true,
        foodInstruction: FOOD_LABELS[profile.foodEffect],
        pkRationale: profile.rationale,
        idealHours: [],
      }
    }

    const hours = getRecommendedHours(profile, freqCount)
    const slots = Array.from(new Set(hours.map(h => hourToSlot(h))))

    return {
      slots,
      timing: freqCount === 1 ? '1× ao dia' : `${freqCount}× ao dia (${hours.map(h => `${h}h`).join(', ')})`,
      isVariable: false,
      pkBased: true,
      foodInstruction: FOOD_LABELS[profile.foodEffect],
      pkRationale: profile.rationale,
      idealHours: hours,
    }
  }

  // 3. Sem perfil FK — inferir pelo intervalo/texto
  if (med.frequencyHours && med.frequencyHours > 0) {
    const slots = slotsByInterval(med.frequencyHours)
    return { slots, timing: `a cada ${med.frequencyHours}h`, isVariable: false, pkBased: false }
  }
  if (med.frequency) {
    return parseFrequencyText(med.frequency)
  }

  return { slots: [], timing: 'Horário não informado', isVariable: true, pkBased: false }
}

// ── Parsers auxiliares ────────────────────────────────────────────────────────

function parseScheduleString(raw: string): TimeSlotId[] {
  const ids = new Set<TimeSlotId>()
  const matches = raw.match(/\d{1,2}h?/gi) ?? []
  for (const m of matches) {
    ids.add(hourToSlot(parseInt(m)))
  }
  return Array.from(ids)
}

function slotsByInterval(hours: number): TimeSlotId[] {
  const start = 8
  const result: TimeSlotId[] = []
  let h = start
  const count = Math.round(24 / hours)
  for (let i = 0; i < count && i < 6; i++) {
    const slot = hourToSlot(h % 24)
    if (!result.includes(slot)) result.push(slot)
    h += hours
  }
  return result
}

function parseFrequencyText(freq: string): ResolvedSchedule {
  const f = freq.toLowerCase().trim()
  const base = { pkBased: false, isVariable: false } as const

  if (/jejum|antes.*refeição|antes.*café|pré.?prandial/i.test(f))
    return { ...base, slots: ['t07'], timing: 'Em jejum', foodInstruction: FOOD_LABELS.jejum }
  if (/deitar|dormir|bedtime/i.test(f))
    return { ...base, slots: ['t22'], timing: 'Ao deitar' }
  if (/1\s*[xv×]|uma\s+vez|once|1x/i.test(f))
    return { ...base, slots: ['t08'], timing: '1× ao dia' }
  if (/2\s*[xv×]|duas?\s+vez|twice|bid|2x/i.test(f))
    return { ...base, slots: ['t08', 't20'], timing: '2× ao dia' }
  if (/3\s*[xv×]|três\s+vez|three|tid|3x/i.test(f))
    return { ...base, slots: ['t08', 't14', 't20'], timing: '3× ao dia' }
  if (/4\s*[xv×]|quatro|four|qid|4x/i.test(f))
    return { ...base, slots: ['t08', 't12', 't18', 't22'], timing: '4× ao dia' }
  if (/semanal|weekly/i.test(f))
    return { ...base, slots: ['t08'], timing: '1× por semana', isVariable: true }
  if (/necessário|sos|prn/i.test(f))
    return { ...base, slots: [], timing: 'Se necessário (SOS)', isVariable: true }

  const em = f.match(/cada\s+(\d+)\s*h/i) ?? f.match(/q\.?\s*(\d+)\s*h/i)
  if (em) {
    const h = parseInt(em[1])
    return { ...base, slots: slotsByInterval(h), timing: `a cada ${h}h` }
  }
  const nm = f.match(/(\d+)\s*[xv×]/i)
  if (nm) {
    const n = parseInt(nm[1])
    return { ...base, slots: slotsByInterval(Math.round(24 / n)), timing: `${n}× ao dia` }
  }

  return { ...base, slots: ['t08'], timing: freq, isVariable: false }
}

// ── Alertas clínicos ──────────────────────────────────────────────────────────

export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface PosologyAlert {
  medicationName: string
  severity: AlertSeverity
  type: 'timing' | 'food' | 'high_risk' | 'interaction' | 'adherence' | 'renal' | 'hepatic' | 'pk'
  message: string
  recommendation: string
  pkBased?: boolean
}

interface MedInput {
  activeIngredient: string
  tradeName?: string | null
  frequency?: string | null
  frequencyHours?: number | null
  schedule?: string | null
  dose?: number | null
  doseUnit?: string | null
  adherence?: string | null
  route?: string | null
}

interface PatientCtx {
  renalFunction?: string | null
  hepaticFunction?: string | null
  isElderly?: boolean
  isPregnant?: boolean
}

export function generatePosologyAlerts(meds: MedInput[], patient: PatientCtx): PosologyAlert[] {
  const alerts: PosologyAlert[] = []

  for (const med of meds) {
    const displayName = med.tradeName
      ? `${med.activeIngredient} (${med.tradeName})`
      : med.activeIngredient

    const profile = getPKProfile(med.activeIngredient)

    // ── Alerta baseado em perfil FK ─────────────────────────────────────────
    if (profile) {
      const freqCount = parseFrequencyCount(med)
      const hours = getRecommendedHours(profile, freqCount)
      const foodLabel = FOOD_LABELS[profile.foodEffect]
      const severity: AlertSeverity = profile.highAlert ? 'critical' : 'info'

      alerts.push({
        medicationName: displayName,
        severity,
        type: 'pk',
        message: `${profile.class} — Horário recomendado: ${hours.map(h => `${h}h`).join(', ')}. ${foodLabel}.`,
        recommendation: profile.patientInstruction,
        pkBased: true,
      })

      // Notas de segurança
      if (profile.safetyNotes) {
        for (const note of profile.safetyNotes) {
          alerts.push({
            medicationName: displayName,
            severity: 'critical',
            type: 'high_risk',
            message: note,
            recommendation: 'Orientar paciente e revisar na próxima consulta farmacêutica.',
            pkBased: true,
          })
        }
      }
    }

    // ── Alertas de adesão documentada ──────────────────────────────────────
    if (med.adherence === 'POOR' || med.adherence === 'MODERATE') {
      alerts.push({
        medicationName: displayName,
        severity: 'warning',
        type: 'adherence',
        message: `Adesão documentada: ${med.adherence === 'POOR' ? 'Ruim' : 'Moderada'}.`,
        recommendation: 'Considerar simplificação do esquema, organizador semanal de medicamentos ou aplicativo de lembretes.',
      })
    }

    // ── Alertas renais ──────────────────────────────────────────────────────
    if (['moderate_impairment', 'severe_impairment', 'failure'].includes(patient.renalFunction ?? '')) {
      if (/metformina|nsaid|ibuprofeno|diclofenaco|naproxeno|metronidazol|levetiracetam/i.test(med.activeIngredient)) {
        alerts.push({
          medicationName: displayName,
          severity: 'critical',
          type: 'renal',
          message: '⚠️ AJUSTE DE DOSE ou CONTRAINDICADO em insuficiência renal moderada/grave.',
          recommendation: 'Calcular ClCr (Cockcroft-Gault) e ajustar dose conforme protocolo. Monitorar creatinina e ureia.',
        })
      }
    }

    // ── Alertas hepáticos ───────────────────────────────────────────────────
    if (['moderate_impairment', 'severe_impairment'].includes(patient.hepaticFunction ?? '')) {
      if (/paracetamol|acetaminofeno|atorvastatina|sinvastatina|metronidazol|valproato/i.test(med.activeIngredient)) {
        alerts.push({
          medicationName: displayName,
          severity: 'critical',
          type: 'hepatic',
          message: '⚠️ AJUSTE DE DOSE necessário em disfunção hepática.',
          recommendation: 'Monitorar AST, ALT, fosfatase alcalina. Consultar bula para ajuste posológico.',
        })
      }
    }

    // ── Critérios de Beers em idosos ────────────────────────────────────────
    if (patient.isElderly) {
      if (/amiodarona|glibenclamida|indometacina|diazepam|alprazolam|clonazepam|lorazepam|haloperidol|amitriptilina|nortriptilina|clorfeniramina|difenidramina/i.test(med.activeIngredient)) {
        alerts.push({
          medicationName: displayName,
          severity: 'critical',
          type: 'high_risk',
          message: '⚠️ CRITÉRIOS DE BEERS 2023 — Medicamento potencialmente inapropriado em pacientes ≥ 65 anos.',
          recommendation: 'Avaliar relação risco-benefício. Considerar alternativa mais segura para a faixa etária. Revisão farmacêutica obrigatória.',
        })
      }
    }
  }

  // ── Alertas de interações por horário (entre medicamentos) ─────────────────
  const names = meds.map(m => m.activeIngredient.toLowerCase())

  // Varrer todas as interações de timing na base FK
  for (const profile of PK_DATABASE) {
    if (!profile.timingInteractions) continue
    const hasDrug = profile.drugs.some(d => names.some(n => n.includes(d.toLowerCase()) || d.toLowerCase().includes(n)))
    if (!hasDrug) continue
    for (const inter of profile.timingInteractions) {
      const hasOther = names.some(n => n.includes(inter.with.toLowerCase()) || inter.with.toLowerCase().includes(n))
      if (!hasOther) continue
      const drugName = profile.drugs[0]
      alerts.push({
        medicationName: `${drugName} + ${inter.with}`,
        severity: 'critical',
        type: 'interaction',
        message: `⚠️ INTERAÇÃO DE HORÁRIO: ${inter.note}`,
        recommendation: inter.gap > 0
          ? `Separar os horários de administração por no mínimo ${inter.gap} horas.`
          : 'Evitar a combinação ou revisar com o médico prescritor.',
        pkBased: true,
      })
    }
  }

  // Ordenar: critical → warning → info
  return alerts.sort((a, b) => {
    const o = { critical: 0, warning: 1, info: 2 }
    return o[a.severity] - o[b.severity]
  })
}

// ── Classe terapêutica para colorização ──────────────────────────────────────

export function getTherapeuticClass(activeIngredient: string): string {
  const n = activeIngredient.toLowerCase()
  const profile = getPKProfile(activeIngredient)
  if (profile) {
    const cls = profile.class.toLowerCase()
    if (/diabetes|antidiabét|insulina|biguanida|sglt|dpp-4|glp/i.test(cls)) return 'diabetes'
    if (/cardiovascular|hipertens|antiarr|diurét|betablo|bcc|ieca|bra|anticoag|antiagr/i.test(cls)) return 'cardiovascular'
    if (/lipid|estatina|hipolipem/i.test(cls)) return 'lipid'
    if (/anticoag/i.test(cls)) return 'anticoagulant'
    if (/antibiótico|antimicrob/i.test(cls)) return 'antibiotic'
    if (/gastro|bomba|ibp/i.test(cls)) return 'gi'
    if (/cortico|esteroide/i.test(cls)) return 'steroid'
    if (/aine|anti-inflam/i.test(cls)) return 'nsaid'
    if (/tireoid/i.test(cls)) return 'thyroid'
    if (/epilép|anticonvuls/i.test(cls)) return 'neurologic'
    if (/antidepres|ansiolít|psiquiát|benzo|isrs|irsn/i.test(cls)) return 'psychiatric'
    if (/suplemento|vitamin|mineral|ferro|cálcio/i.test(cls)) return 'supplement'
  }
  if (/insulina|metformina|glibenc|glipiz|gliclaz|glimep|sitaglip|empaglifloz|dapaglifloz/i.test(n)) return 'diabetes'
  if (/losart|enalapril|captopril|ramipril|amlodip|nifedip|propranolol|atenolol|carvedil|bisoprolol|metoprolol|furosem|espirono/i.test(n)) return 'cardiovascular'
  if (/sinvasta|atorvasta|rosuva|fluva|prava/i.test(n)) return 'lipid'
  if (/varfarin|rivarox|apixab|dabigatr|heparina|clopidogrel/i.test(n)) return 'anticoagulant'
  if (/amoxicil|azitrom|claritrom|ciproflox|levoflox|metronid/i.test(n)) return 'antibiotic'
  if (/omeprazol|pantoprazol|esomeprazol/i.test(n)) return 'gi'
  if (/prednisona|dexameta|hidrocort/i.test(n)) return 'steroid'
  if (/ibuprofeno|diclofenac|naproxen|nimesul/i.test(n)) return 'nsaid'
  if (/levotiroxin/i.test(n)) return 'thyroid'
  if (/fenitoín|carbamazep|valproato|levetirace|lamotrigin/i.test(n)) return 'neurologic'
  if (/sertralina|fluoxetina|escitalopram|paroxetina|venlafaxina|mirtazapina/i.test(n)) return 'psychiatric'
  if (/sulfato\s*ferr|ferro|cálcio|vitamina\s*d|vitamina\s*b/i.test(n)) return 'supplement'
  return 'other'
}

export const CLASS_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  diabetes:       { bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-blue-300',   label: 'Diabetes' },
  cardiovascular: { bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-red-300',    label: 'Cardiovascular' },
  lipid:          { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300', label: 'Dislipidemia' },
  anticoagulant:  { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300', label: 'Anticoag.' },
  antibiotic:     { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300', label: 'Antibiótico' },
  gi:             { bg: 'bg-teal-100',   text: 'text-teal-800',   border: 'border-teal-300',   label: 'Gastro.' },
  steroid:        { bg: 'bg-amber-100',  text: 'text-amber-800',  border: 'border-amber-300',  label: 'Corticoide' },
  nsaid:          { bg: 'bg-rose-100',   text: 'text-rose-800',   border: 'border-rose-300',   label: 'AINE' },
  thyroid:        { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300', label: 'Tireóide' },
  neurologic:     { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-300', label: 'Neurológico' },
  psychiatric:    { bg: 'bg-pink-100',   text: 'text-pink-800',   border: 'border-pink-300',   label: 'Psiquiátrico' },
  supplement:     { bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-300',  label: 'Suplemento' },
  other:          { bg: 'bg-gray-100',   text: 'text-gray-700',   border: 'border-gray-300',   label: 'Outro' },
}
