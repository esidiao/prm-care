// ── Clinical Scale Definitions ────────────────────────────────────────────────
// Validated instruments: GAD-7, PHQ-9, AUDIT-C, Morisky-4

export type ScaleType = 'GAD7' | 'PHQ9' | 'AUDIT_C' | 'MORISKY4'
export type SeverityLevel =
  | 'MINIMAL'
  | 'MILD'
  | 'MODERATE'
  | 'MODERATELY_SEVERE'
  | 'SEVERE'

export interface ScaleQuestion {
  id: number
  text: string
  options: { value: number; label: string }[]
}

export interface ScaleDefinition {
  type: ScaleType
  name: string
  fullName: string
  description: string
  color: string         // tailwind color key
  maxScore: number
  questionCount: number
  questions: ScaleQuestion[]
  getSeverity: (score: number) => SeverityLevel
  getSeverityLabel: (level: SeverityLevel) => string
  getSeverityColor: (level: SeverityLevel) => string
  getRecommendation: (level: SeverityLevel) => string
  reference: string
}

// ── Shared option sets ─────────────────────────────────────────────────────────

const FREQUENCY_0_3 = [
  { value: 0, label: 'Nenhuma vez' },
  { value: 1, label: 'Vários dias' },
  { value: 2, label: 'Mais da metade dos dias' },
  { value: 3, label: 'Quase todos os dias' },
]

// ── GAD-7 ─────────────────────────────────────────────────────────────────────

export const GAD7: ScaleDefinition = {
  type: 'GAD7',
  name: 'GAD-7',
  fullName: 'Escala de Ansiedade Generalizada – 7 itens',
  description: 'Avalia sintomas de transtorno de ansiedade generalizada nas últimas 2 semanas.',
  color: 'violet',
  maxScore: 21,
  questionCount: 7,
  questions: [
    { id: 1, text: 'Sentiu-se nervoso(a), ansioso(a) ou muito tenso(a)?', options: FREQUENCY_0_3 },
    { id: 2, text: 'Não conseguiu parar ou controlar as preocupações?', options: FREQUENCY_0_3 },
    { id: 3, text: 'Preocupou-se muito com diversas coisas?', options: FREQUENCY_0_3 },
    { id: 4, text: 'Teve dificuldade para relaxar?', options: FREQUENCY_0_3 },
    { id: 5, text: 'Ficou tão agitado(a) que era difícil ficar parado(a)?', options: FREQUENCY_0_3 },
    { id: 6, text: 'Ficou facilmente aborrecido(a) ou irritado(a)?', options: FREQUENCY_0_3 },
    { id: 7, text: 'Sentiu medo de que algo terrível pudesse acontecer?', options: FREQUENCY_0_3 },
  ],
  getSeverity(score) {
    if (score <= 4) return 'MINIMAL'
    if (score <= 9) return 'MILD'
    if (score <= 14) return 'MODERATE'
    return 'SEVERE'
  },
  getSeverityLabel(level) {
    return { MINIMAL: 'Mínima', MILD: 'Leve', MODERATE: 'Moderada', MODERATELY_SEVERE: 'Moderadamente grave', SEVERE: 'Grave' }[level]
  },
  getSeverityColor(level) {
    return { MINIMAL: 'green', MILD: 'yellow', MODERATE: 'orange', MODERATELY_SEVERE: 'red', SEVERE: 'red' }[level]
  },
  getRecommendation(level) {
    const map: Record<SeverityLevel, string> = {
      MINIMAL: 'Sem necessidade de intervenção imediata. Reavaliar em 6–12 meses.',
      MILD: 'Psicoeducação, técnicas de relaxamento e revisão de medicamentos ansiogênicos. Reavaliar em 1–3 meses.',
      MODERATE: 'Encaminhar para avaliação psicológica. Revisar farmacoterapia (corticoides, broncodilatadores, cafeína). Considerar TCC.',
      MODERATELY_SEVERE: 'Encaminhamento psiquiátrico urgente. Avaliar início de farmacoterapia ansiolítica.',
      SEVERE: 'Encaminhamento psiquiátrico urgente. Risco elevado — avaliar segurança do paciente.',
    }
    return map[level]
  },
  reference: 'Spitzer RL, et al. Arch Intern Med. 2006;166(10):1092-7.',
}

// ── PHQ-9 ─────────────────────────────────────────────────────────────────────

export const PHQ9: ScaleDefinition = {
  type: 'PHQ9',
  name: 'PHQ-9',
  fullName: 'Questionário de Saúde do Paciente – 9 itens',
  description: 'Rastreia e monitora sintomas depressivos nas últimas 2 semanas.',
  color: 'blue',
  maxScore: 27,
  questionCount: 9,
  questions: [
    { id: 1, text: 'Pouco interesse ou prazer em fazer as coisas?', options: FREQUENCY_0_3 },
    { id: 2, text: 'Sentiu-se para baixo, deprimido(a) ou sem perspectiva?', options: FREQUENCY_0_3 },
    { id: 3, text: 'Dificuldade para adormecer/dormir, acordar muito cedo ou dormir demais?', options: FREQUENCY_0_3 },
    { id: 4, text: 'Sentiu-se cansado(a) ou com pouca energia?', options: FREQUENCY_0_3 },
    { id: 5, text: 'Falta de apetite ou comeu demais?', options: FREQUENCY_0_3 },
    { id: 6, text: 'Sentiu-se mal consigo mesmo(a), ou que é um fracasso, ou que decepcionou sua família?', options: FREQUENCY_0_3 },
    { id: 7, text: 'Dificuldade de concentrar-se nas coisas, como ler jornal ou ver televisão?', options: FREQUENCY_0_3 },
    { id: 8, text: 'Movia ou falava tão devagar que outras pessoas notavam? Ou ao contrário, ficou tão agitado(a) que se mexia muito mais que o usual?', options: FREQUENCY_0_3 },
    { id: 9, text: 'Pensou em se machucar de alguma forma ou que seria melhor estar morto(a)?', options: FREQUENCY_0_3 },
  ],
  getSeverity(score) {
    if (score <= 4) return 'MINIMAL'
    if (score <= 9) return 'MILD'
    if (score <= 14) return 'MODERATE'
    if (score <= 19) return 'MODERATELY_SEVERE'
    return 'SEVERE'
  },
  getSeverityLabel(level) {
    return { MINIMAL: 'Mínima', MILD: 'Leve', MODERATE: 'Moderada', MODERATELY_SEVERE: 'Moderadamente grave', SEVERE: 'Grave' }[level]
  },
  getSeverityColor(level) {
    return { MINIMAL: 'green', MILD: 'yellow', MODERATE: 'orange', MODERATELY_SEVERE: 'red', SEVERE: 'red' }[level]
  },
  getRecommendation(level) {
    const map: Record<SeverityLevel, string> = {
      MINIMAL: 'Sem depressão significativa. Reavaliar se houver mudanças clínicas.',
      MILD: 'Psicoeducação e vigilância ativa. Revisar medicamentos depressogênicos (beta-bloqueadores, corticoides, isotretinoína, anticoncepcionais hormonais).',
      MODERATE: 'Encaminhar para avaliação psicológica/psiquiátrica. Considerar TCC e/ou farmacoterapia. Reavaliar em 2–4 semanas.',
      MODERATELY_SEVERE: 'Início de antidepressivo (ISRS de 1ª linha) + encaminhamento psiquiátrico. Monitorar resposta em 4–6 semanas.',
      SEVERE: 'Encaminhamento psiquiátrico URGENTE. Avaliar risco de suicídio — questão 9 positiva exige avaliação imediata.',
    }
    return map[level]
  },
  reference: 'Kroenke K, Spitzer RL, Williams JB. J Gen Intern Med. 2001;16(9):606-13.',
}

// ── AUDIT-C ───────────────────────────────────────────────────────────────────

export const AUDIT_C: ScaleDefinition = {
  type: 'AUDIT_C',
  name: 'AUDIT-C',
  fullName: 'Teste de Identificação de Problemas com o Álcool – versão curta',
  description: 'Rastreio de consumo problemático de álcool (3 questões).',
  color: 'amber',
  maxScore: 12,
  questionCount: 3,
  questions: [
    {
      id: 1,
      text: 'Com que frequência você consome bebidas alcoólicas?',
      options: [
        { value: 0, label: 'Nunca' },
        { value: 1, label: 'Mensalmente ou menos' },
        { value: 2, label: '2 a 4 vezes por mês' },
        { value: 3, label: '2 a 3 vezes por semana' },
        { value: 4, label: '4 ou mais vezes por semana' },
      ],
    },
    {
      id: 2,
      text: 'Quantas doses você consome em um dia típico quando bebe?',
      options: [
        { value: 0, label: '1 ou 2' },
        { value: 1, label: '3 ou 4' },
        { value: 2, label: '5 ou 6' },
        { value: 3, label: '7 a 9' },
        { value: 4, label: '10 ou mais' },
      ],
    },
    {
      id: 3,
      text: 'Com que frequência você consome 6 ou mais doses em uma única ocasião?',
      options: [
        { value: 0, label: 'Nunca' },
        { value: 1, label: 'Menos de uma vez por mês' },
        { value: 2, label: 'Mensalmente' },
        { value: 3, label: 'Semanalmente' },
        { value: 4, label: 'Diariamente ou quase' },
      ],
    },
  ],
  getSeverity(score) {
    if (score <= 2) return 'MINIMAL'
    if (score <= 5) return 'MILD' // fem ≥3, masc ≥4 = positivo
    if (score <= 8) return 'MODERATE'
    return 'SEVERE'
  },
  getSeverityLabel(level) {
    return { MINIMAL: 'Baixo risco', MILD: 'Risco moderado', MODERATE: 'Risco alto', MODERATELY_SEVERE: 'Risco muito alto', SEVERE: 'Risco muito alto' }[level]
  },
  getSeverityColor(level) {
    return { MINIMAL: 'green', MILD: 'yellow', MODERATE: 'orange', MODERATELY_SEVERE: 'red', SEVERE: 'red' }[level]
  },
  getRecommendation(level) {
    const map: Record<SeverityLevel, string> = {
      MINIMAL: 'Consumo dentro dos limites seguros. Reforçar educação sobre limites.',
      MILD: 'Consumo positivo no rastreio. Realizar intervenção breve (SBIRT). Revisar interações álcool-medicamento.',
      MODERATE: 'Consumo problemático. Intervenção motivacional. Avaliar hepatotoxicidade de medicamentos concomitantes.',
      MODERATELY_SEVERE: 'Dependência provável. Encaminhar para serviço especializado em álcool e drogas.',
      SEVERE: 'Dependência provável. Encaminhar urgentemente. Avaliar síndrome de abstinência.',
    }
    return map[level]
  },
  reference: 'Bush K, et al. Arch Intern Med. 1998;158(16):1789-95.',
}

// ── Morisky-4 ─────────────────────────────────────────────────────────────────

export const MORISKY4: ScaleDefinition = {
  type: 'MORISKY4',
  name: 'Morisky-4',
  fullName: 'Escala de Morisky de Adesão a Medicamentos – 4 itens',
  description: 'Avalia o comportamento de adesão à farmacoterapia.',
  color: 'teal',
  maxScore: 4,
  questionCount: 4,
  questions: [
    {
      id: 1,
      text: 'Você alguma vez esquece de tomar seu(s) remédio(s)?',
      options: [{ value: 0, label: 'Sim' }, { value: 1, label: 'Não' }],
    },
    {
      id: 2,
      text: 'Você às vezes é descuidado(a) quanto ao horário de tomar seu(s) remédio(s)?',
      options: [{ value: 0, label: 'Sim' }, { value: 1, label: 'Não' }],
    },
    {
      id: 3,
      text: 'Quando você se sente bem, você às vezes para de tomar o(s) remédio(s)?',
      options: [{ value: 0, label: 'Sim' }, { value: 1, label: 'Não' }],
    },
    {
      id: 4,
      text: 'Quando se sente mal ao tomar os remédios, você às vezes para de tomá-los?',
      options: [{ value: 0, label: 'Sim' }, { value: 1, label: 'Não' }],
    },
  ],
  getSeverity(score) {
    if (score === 4) return 'MINIMAL'   // alta adesão
    if (score === 3) return 'MILD'      // média adesão
    return 'MODERATE'                   // baixa adesão (0-2)
  },
  getSeverityLabel(level) {
    return {
      MINIMAL: 'Alta adesão',
      MILD: 'Média adesão',
      MODERATE: 'Baixa adesão',
      MODERATELY_SEVERE: 'Baixa adesão',
      SEVERE: 'Baixa adesão',
    }[level]
  },
  getSeverityColor(level) {
    return { MINIMAL: 'green', MILD: 'yellow', MODERATE: 'red', MODERATELY_SEVERE: 'red', SEVERE: 'red' }[level]
  },
  getRecommendation(level) {
    const map: Record<SeverityLevel, string> = {
      MINIMAL: 'Boa adesão. Reforçar positivamente e monitorar na próxima consulta.',
      MILD: 'Adesão parcial. Identificar barreiras (efeitos adversos, custo, complexidade). Simplificar regime se possível.',
      MODERATE: 'Baixa adesão — risco de insucesso terapêutico. Intervenção farmacêutica: conciliação, simplificação, dose única diária quando possível, uso de piluleiro/alarme.',
      MODERATELY_SEVERE: 'Baixa adesão crítica. Avaliar risco de hospitalização.',
      SEVERE: 'Baixa adesão crítica.',
    }
    return map[level]
  },
  reference: 'Morisky DE, et al. Med Care. 1986;24(1):67-74.',
}

// ── Registry ──────────────────────────────────────────────────────────────────

export const SCALES: Record<ScaleType, ScaleDefinition> = {
  GAD7,
  PHQ9,
  AUDIT_C,
  MORISKY4,
}

export const SCALE_LIST: ScaleDefinition[] = [GAD7, PHQ9, AUDIT_C, MORISKY4]

export const SEVERITY_BADGE_CLASSES: Record<SeverityLevel, string> = {
  MINIMAL: 'bg-green-50 text-green-700 border-green-200',
  MILD: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  MODERATE: 'bg-orange-50 text-orange-700 border-orange-200',
  MODERATELY_SEVERE: 'bg-red-50 text-red-700 border-red-200',
  SEVERE: 'bg-red-100 text-red-800 border-red-300',
}
