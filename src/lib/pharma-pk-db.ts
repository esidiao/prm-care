/**
 * Banco de dados farmacocinético clínico — PRM Care
 *
 * Fontes: Micromedex®, UpToDate®, bulas ANVISA, Goodman & Gilman 13ª ed.,
 *         Clinical Pharmacokinetics (Rowland & Tozer), STOPP/START v3 (2023),
 *         Beers Criteria 2023 (AGS), Protocolo Brasileiro de Farmacoterapia.
 *
 * Cada entrada define as propriedades FC relevantes para a orientação
 * de horários na conciliação farmacêutica ambulatorial.
 */

export type FoodEffect =
  | 'jejum'           // absorção melhor / obrigatório em jejum
  | 'com_alimento'    // tomar junto à refeição
  | 'sem_restricao'   // indiferente
  | 'antes_refeicao'  // 30–60 min antes da refeição
  | 'apos_refeicao'   // depois da refeição
  | 'com_agua_abundante' // copo cheio de água, ereto ≥30 min

export type PreferredTime =
  | 'manha'     // 7h–8h
  | 'almoco'    // 12h
  | 'tarde'     // 14h–16h
  | 'jantar'    // 18h–19h
  | 'noite'     // 20h–22h
  | 'deitar'    // 22h (ao deitar)
  | 'qualquer'  // qualquer horário fixo

export interface PKProfile {
  /** Principal ingrediente ativo (lowercase, sem acentos obrigatórios para match) */
  drugs: string[]

  /** Classe terapêutica legível */
  class: string

  /** Momento preferencial baseado em FC e farmacodinâmica */
  preferredTime: PreferredTime

  /** Efeito de alimento na absorção */
  foodEffect: FoodEffect

  /** Horário(s) ideal(is) recomendados (24h) — ex: [8] ou [8, 20] */
  idealHours: number[]

  /** Justificativa clínica resumida */
  rationale: string

  /** Instrução de administração para o paciente */
  patientInstruction: string

  /** Alertas especiais de segurança */
  safetyNotes?: string[]

  /** Interações de horário com outros fármacos */
  timingInteractions?: Array<{
    with: string
    gap: number    // horas de separação mínima
    note: string
  }>

  /** Deve ser tomado com intervalo UNIFORME (antibióticos, antiepilépticos) */
  requiresUniformInterval?: boolean

  /** Meia-vida (horas) — para cálculo de intervalos */
  halfLifeH?: number

  /** Alta vigilância / margem terapêutica estreita */
  highAlert?: boolean
}

// ══════════════════════════════════════════════════════════════════════════════
// BASE DE DADOS FARMACOCINÉTICA
// ══════════════════════════════════════════════════════════════════════════════

export const PK_DATABASE: PKProfile[] = [

  // ── INIBIDORES DE BOMBA DE PRÓTONS ─────────────────────────────────────────
  {
    drugs: ['omeprazol', 'pantoprazol', 'esomeprazol', 'lansoprazol', 'rabeprazol', 'dexlansoprazol'],
    class: 'Inibidor de Bomba de Prótons (IBP)',
    preferredTime: 'manha',
    foodEffect: 'antes_refeicao',
    idealHours: [7],
    rationale: 'IBPs são pró-fármacos ativados em meio ácido. A tomada 30–60 min antes do café maximiza a concentração na célula parietal no momento em que as bombas são estimuladas pela refeição. Biodisponibilidade oral cai até 50% com alimento.',
    patientInstruction: 'Tomar em jejum, 30–60 minutos antes do café da manhã. Se necessário 2× ao dia, a segunda dose deve ser 30 min antes do jantar.',
    safetyNotes: [
      'Uso > 1 ano: risco de deficiência de Mg²⁺, vitamina B12 e fraturas',
      'Interação com clopidogrel (omeprazol/esomeprazol): preferir pantoprazol',
    ],
    timingInteractions: [
      { with: 'clopidogrel', gap: 2, note: 'Preferir pantoprazol ou rabeprazol — menor inibição de CYP2C19' },
    ],
  },

  // ── HORMÔNIO TIREOIDIANO ────────────────────────────────────────────────────
  {
    drugs: ['levotiroxina', 'l-tiroxina', 'tiroxina', 'liotironina'],
    class: 'Hormônio Tireoidiano',
    preferredTime: 'manha',
    foodEffect: 'jejum',
    idealHours: [6, 7],
    rationale: 'T½ = 7 dias; Tmax = 2–4 h. Absorção intestinal reduzida por alimentos em até 40%. Cálcio, ferro, soja e fibras quelam a tiroxina. Jejum rigoroso de 30–60 min garante biodisponibilidade consistente.',
    patientInstruction: 'Tomar em jejum rigoroso 30–60 min antes do café da manhã. Manter sempre o mesmo horário. Não tomar com cálcio, ferro, antiácidos (intervalo mínimo 4 h).',
    safetyNotes: ['Margem terapêutica estreita — não trocar de marca sem reavaliação de TSH'],
    highAlert: true,
    timingInteractions: [
      { with: 'ferro', gap: 4, note: 'Ferro reduz absorção de levotiroxina em 30–40%' },
      { with: 'calcio', gap: 4, note: 'Cálcio reduz absorção de levotiroxina' },
      { with: 'omeprazol', gap: 1, note: 'IBPs reduzem absorção; preferir jejum mais prolongado' },
    ],
  },

  // ── BISFOSFONATOS ───────────────────────────────────────────────────────────
  {
    drugs: ['alendronato', 'risedronato', 'ibandronato', 'zoledronato', 'acido alendrônico', 'acido risedronico'],
    class: 'Bisfosfonato',
    preferredTime: 'manha',
    foodEffect: 'com_agua_abundante',
    idealHours: [7],
    rationale: 'Biodisponibilidade oral < 1%; qualquer alimento, cálcio ou medicamento reduz a absorção para zero. Deve ser tomado ao acordar com 200 mL de água e o paciente deve permanecer ereto por 30 min para evitar esofagite.',
    patientInstruction: 'Tomar ao acordar, em jejum, com copo CHEIO de água (200 mL). Não comer nem deitar por 30 minutos. Não partir nem mastigar o comprimido.',
    safetyNotes: [
      'Risco de esofagite severa se deitar após tomar',
      'Contraindicado em hipocalcemia — corrigir antes de iniciar',
      'Monitorar dor no maxilar (osteonecrose — raro em uso oral)',
    ],
  },

  // ── METFORMINA ──────────────────────────────────────────────────────────────
  {
    drugs: ['metformina', 'cloridrato de metformina'],
    class: 'Biguanida — Antidiabético Oral',
    preferredTime: 'qualquer',
    foodEffect: 'com_alimento',
    idealHours: [8, 18],
    rationale: 'T½ = 6 h. Tomada com alimento reduz efeitos gastrointestinais (náusea, diarreia) sem afetar significativamente a eficácia hipoglicemiante. Formulação XR/liberação prolongada tem melhor tolerância GI.',
    patientInstruction: 'Tomar junto às refeições principais (café da manhã e jantar para 2× ao dia; café, almoço e jantar para 3× ao dia). Engolir com bastante água.',
    safetyNotes: [
      'Suspender 48 h antes de contraste iodado (risco de acidose lática)',
      'Contraindicada: ClCr < 30 mL/min',
    ],
  },

  // ── SULFONILUREIAS ──────────────────────────────────────────────────────────
  {
    drugs: ['glibenclamida', 'glipizida', 'gliclazida', 'glimepirida'],
    class: 'Sulfonilureia — Antidiabético Oral',
    preferredTime: 'manha',
    foodEffect: 'antes_refeicao',
    idealHours: [7, 12],
    rationale: 'Estimulam secreção de insulina. Glibenclamida e glipizida: 30 min antes das refeições para sincronizar pico de secreção insulínica com pico glicêmico pós-prandial. Glimepirida: pode ser tomada com ou antes do café.',
    patientInstruction: 'Tomar 30 minutos ANTES da refeição principal. Não pular a refeição após tomar — risco de hipoglicemia.',
    safetyNotes: [
      'Glibenclamida: CRITÉRIO DE BEERS em idosos — preferir gliclazida',
      'Monitorar hipoglicemia especialmente em idosos e insuficiência renal',
    ],
  },

  // ── INIBIDORES SGLT-2 ───────────────────────────────────────────────────────
  {
    drugs: ['empagliflozina', 'dapagliflozina', 'canagliflozina', 'ertugliflozina'],
    class: 'Inibidor SGLT-2 — Antidiabético Oral',
    preferredTime: 'manha',
    foodEffect: 'sem_restricao',
    idealHours: [8],
    rationale: 'Mecanismo independente de insulina. Tomada pela manhã minimiza risco de poliúria noturna e infecções urinárias. Ingestão com ou sem alimento não altera PK clinicamente relevante.',
    patientInstruction: 'Tomar pela manhã, com ou sem alimento. Aumentar ingestão de água ao longo do dia. Higiene íntima reforçada para prevenir infecção fúngica genital.',
    safetyNotes: [
      'Suspender em cirurgias/jejum prolongado — risco de cetoacidose euglicêmica',
      'Contraindicado: TFGe < 45 mL/min/1,73m² (empagliflozina/dapagliflozina)',
    ],
  },

  // ── INIBIDORES DPP-4 ───────────────────────────────────────────────────────
  {
    drugs: ['sitagliptina', 'vildagliptina', 'saxagliptina', 'linagliptina', 'alogliptina'],
    class: 'Inibidor DPP-4 — Antidiabético Oral',
    preferredTime: 'manha',
    foodEffect: 'sem_restricao',
    idealHours: [8],
    rationale: 'T½ longa (12–24 h). Boa tolerabilidade; alimento não interfere na absorção. Tomada matinal facilita adesão.',
    patientInstruction: 'Tomar uma vez ao dia pela manhã, com ou sem alimento.',
  },

  // ── ESTATINAS ───────────────────────────────────────────────────────────────
  {
    drugs: ['sinvastatina', 'lovastatina'],
    class: 'Estatina (T½ curta) — Hipolipemiante',
    preferredTime: 'noite',
    foodEffect: 'sem_restricao',
    idealHours: [22],
    rationale: 'T½ = 1–3 h (sinvastatina ativa). A maior síntese endógena de colesterol ocorre à meia-noite. Tomada noturna maximiza a inibição da HMG-CoA redutase no pico de atividade enzimática.',
    patientInstruction: 'Tomar à noite, próximo das 22h, com ou sem alimento. Evitar suco de toranja (grapefruit) — aumenta nível sérico e risco de miopatia.',
    safetyNotes: [
      'Interação grave com amiodarona, gemfibrozil, claritromicina — aumentam risco de rabdomiólise',
      'Monitorar CPK em dor muscular inexplicada',
    ],
  },
  {
    drugs: ['atorvastatina', 'rosuvastatina', 'fluvastatina', 'pravastatina', 'pitavastatina'],
    class: 'Estatina (T½ longa) — Hipolipemiante',
    preferredTime: 'qualquer',
    foodEffect: 'sem_restricao',
    idealHours: [20],
    rationale: 'T½ ≥ 14 h (atorvastatina T½ = 14 h; rosuvastatina T½ = 19 h). A longa meia-vida permite tomada em qualquer horário com eficácia semelhante. Preferência pela tarde/noite por conveniência e menor variabilidade.',
    patientInstruction: 'Tomar em horário fixo diário, preferencialmente à noite. Rosuvastatina: separar 2 h de antiácidos com alumínio/magnésio. Atorvastatina: evitar toranja.',
    safetyNotes: ['Rosuvastatina: interação com warfarina — monitorar INR'],
  },

  // ── ANTI-HIPERTENSIVOS ──────────────────────────────────────────────────────
  {
    drugs: ['losartana', 'valsartana', 'olmesartana', 'irbesartana', 'candesartana', 'telmisartana', 'azilsartana'],
    class: 'Antagonista do Receptor de Angiotensina II (BRA)',
    preferredTime: 'manha',
    foodEffect: 'sem_restricao',
    idealHours: [8],
    rationale: 'PA apresenta pico matinal (6h–10h). Tomada matinal controla o pico pressório mais crítico. Losartana T½ ativo (EXP-3174) = 6–9 h; telmisartana T½ = 24 h. Telmisartana pode ser tomada a qualquer hora.',
    patientInstruction: 'Tomar pela manhã, com ou sem alimento, sempre no mesmo horário. Não interromper por conta própria.',
  },
  {
    drugs: ['enalapril', 'ramipril', 'captopril', 'lisinopril', 'perindopril', 'benazepril', 'cilazapril'],
    class: 'Inibidor da ECA (IECA)',
    preferredTime: 'manha',
    foodEffect: 'jejum',
    idealHours: [7],
    rationale: 'Captopril: alimento reduz absorção em 25–50% — tomar em jejum. Enalapril/Ramipril/Lisinopril: alimento não interfere clinicamente. Captopril T½ = 2 h → preferível 2–3× ao dia.',
    patientInstruction: 'Captopril: tomar 30–60 min ANTES das refeições. Demais IECAs: tomar com ou sem alimento no mesmo horário diariamente.',
    safetyNotes: [
      'Monitorar creatinina, K⁺ e PA nas primeiras semanas',
      'Tosse seca crônica: efeito de classe — considerar troca por BRA',
    ],
  },
  {
    drugs: ['amlodipino', 'anlodipino', 'nifedipino', 'felodipino', 'lercanidipino', 'nitrendipino'],
    class: 'Bloqueador de Canal de Cálcio (BCC)',
    preferredTime: 'manha',
    foodEffect: 'sem_restricao',
    idealHours: [8],
    rationale: 'Amlodipino T½ = 35–50 h — tomada única diária com absorção independente de alimento. Nifedipino de liberação lenta: T½ efetivo = 24 h. Lercanidipino: alimento aumenta absorção — tomar 15 min antes de refeição.',
    patientInstruction: 'Tomar pela manhã, com ou sem alimento. Lercanidipino: 15 min antes do café. Nifedipino/amlodipino: evitar toranja.',
  },
  {
    drugs: ['propranolol', 'atenolol', 'metoprolol', 'bisoprolol', 'carvedilol', 'nebivolol', 'celiprolol'],
    class: 'Betabloqueador',
    preferredTime: 'manha',
    foodEffect: 'com_alimento',
    idealHours: [8],
    rationale: 'Propranolol: alimento aumenta biodisponibilidade em ~50% (efeito de primeira passagem reduzido). Metoprolol: tomar com alimento melhora absorção e reduz efeitos GI. Bisoprolol/Atenolol: absorção não afetada pelo alimento.',
    patientInstruction: 'Tomar com ou após o café da manhã. Não interromper abruptamente — risco de angina e taquicardia rebote.',
    safetyNotes: ['Retirada abrupta pode precipitar síndrome coronariana aguda'],
  },

  // ── DIURÉTICOS ──────────────────────────────────────────────────────────────
  {
    drugs: ['furosemida', 'torasemida'],
    class: 'Diurético de Alça',
    preferredTime: 'manha',
    foodEffect: 'sem_restricao',
    idealHours: [8, 14],
    rationale: 'Furosemida: início de ação 1–2 h, duração 4–6 h. Tomar pela manhã evita noctúria. Quando 2× ao dia: 8h e 14h (nunca após 16h para evitar diurese noturna). Torasemida T½ = 3–4 h — ação mais previsível que furosemida.',
    patientInstruction: 'Tomar pela manhã (e ao meio-dia se 2× ao dia). Nunca tomar após as 16h — causará acordar para urinar à noite.',
    safetyNotes: ['Monitorar K⁺, Na⁺, creatinina e PA — risco de hipocalemia e desidratação'],
  },
  {
    drugs: ['hidroclorotiazida', 'clortalidona', 'indapamida', 'bendroflumetiazida'],
    class: 'Diurético Tiazídico',
    preferredTime: 'manha',
    foodEffect: 'sem_restricao',
    idealHours: [8],
    rationale: 'Hidroclorotiazida T½ = 6–15 h, clortalidona T½ = 40–60 h. Tomada matinal evita noctúria; clortalidona pode ser tomada à tarde com menor impacto noturno devido à longa meia-vida.',
    patientInstruction: 'Tomar pela manhã, com ou sem alimento. Ingerir adequada quantidade de água ao longo do dia.',
  },
  {
    drugs: ['espironolactona', 'eplerenona', 'amilorida'],
    class: 'Diurético Poupador de Potássio',
    preferredTime: 'manha',
    foodEffect: 'com_alimento',
    idealHours: [8],
    rationale: 'Espironolactona: alimento aumenta absorção em ~70%. Efeito diurético mais leve — menor risco de noctúria. Início de ação lento (2–3 dias para efeito máximo).',
    patientInstruction: 'Tomar pela manhã com alimento. Monitorar K⁺ sérico — risco de hipercalemia especialmente com IECAs/BRAs ou suplementação de K⁺.',
    safetyNotes: ['Hipercalemia: risco aumentado com IECAs, BRAs, AINEs, suplementos de K⁺'],
  },

  // ── ANTICOAGULANTES ─────────────────────────────────────────────────────────
  {
    drugs: ['varfarina', 'warfarina'],
    class: 'Anticoagulante Oral (AVK)',
    preferredTime: 'tarde',
    foodEffect: 'sem_restricao',
    idealHours: [17],
    rationale: 'T½ = 36–42 h (mistura de isômeros). Tomada entre 17h–18h permite coleta de INR pela manhã após equilíbrio estável e ajuste de dose no mesmo dia. Importante manter ingestão CONSISTENTE de vitamina K.',
    patientInstruction: 'Tomar sempre no mesmo horário (ex: 17h). Manter dieta consistente em alimentos com vitamina K (verduras escuras). Qualquer novo medicamento ou suplemento deve ser comunicado ao farmacêutico.',
    safetyNotes: [
      '⚠️ ALTA VIGILÂNCIA — Margem terapêutica estreita (INR 2,0–3,0)',
      'Inúmeras interações medicamentosas e alimentares',
      'Checar INR a cada nova prescrição ou mudança de dose',
    ],
    highAlert: true,
    timingInteractions: [
      { with: 'aines', gap: 0, note: 'AINEs aumentam risco de sangramento — evitar combinação' },
    ],
  },
  {
    drugs: ['rivaroxabana'],
    class: 'Anticoagulante Oral (DOAC) — Inibidor direto do Fator Xa',
    preferredTime: 'jantar',
    foodEffect: 'com_alimento',
    idealHours: [18],
    rationale: 'Doses ≥ 15 mg: biodisponibilidade aumenta de 66% para 100% quando tomada com alimento. Dose de 10 mg (profilaxia): pode ser tomada sem alimento.',
    patientInstruction: 'Rivaroxabana 15 mg ou 20 mg: OBRIGATORIAMENTE com a refeição do jantar. Não pular a refeição. Dose de 10 mg (profilaxia): qualquer horário.',
    highAlert: true,
    safetyNotes: ['⚠️ Não há antídoto universal disponível no Brasil atualmente'],
  },
  {
    drugs: ['apixabana'],
    class: 'Anticoagulante Oral (DOAC) — Inibidor direto do Fator Xa',
    preferredTime: 'qualquer',
    foodEffect: 'sem_restricao',
    idealHours: [8, 20],
    rationale: 'T½ = 12 h; administração 2× ao dia. Absorção não afetada por alimento. Intervalo de 12 h entre as doses é essencial para manter nível terapêutico constante.',
    patientInstruction: 'Tomar 2× ao dia com intervalo de 12 horas (ex: 8h e 20h), com ou sem alimento.',
    highAlert: true,
    requiresUniformInterval: true,
  },
  {
    drugs: ['dabigatrana', 'dabigatrana etexilato'],
    class: 'Anticoagulante Oral (DOAC) — Inibidor direto da Trombina',
    preferredTime: 'qualquer',
    foodEffect: 'com_alimento',
    idealHours: [8, 20],
    rationale: 'T½ = 12–17 h; 2× ao dia. Tomar com alimento reduz irritação GI. NÃO abrir cápsula — aumenta absorção em 75% com risco de sangramento.',
    patientInstruction: 'Tomar com alimento. Engolir cápsula INTEIRA — não abrir, mastigar ou partir. Guardar na embalagem original (umidade degrada o fármaco).',
    highAlert: true,
    safetyNotes: ['Cápsula NUNCA deve ser aberta', 'Sensível à umidade — manter na embalagem original'],
    requiresUniformInterval: true,
  },
  {
    drugs: ['clopidogrel'],
    class: 'Antiagregante Plaquetário',
    preferredTime: 'manha',
    foodEffect: 'sem_restricao',
    idealHours: [8],
    rationale: 'Pró-fármaco ativado por CYP2C19. T½ ativo = 8 h; tomada matinal. Alimento não interfere significativamente na biodisponibilidade.',
    patientInstruction: 'Tomar pela manhã, com ou sem alimento. Não interromper sem orientação do médico.',
    safetyNotes: [
      'Interação com omeprazol/esomeprazol (CYP2C19) — preferir pantoprazol',
      'Risco de sangramento aumentado com AINEs e anticoagulantes',
    ],
  },

  // ── DIGOXINA ────────────────────────────────────────────────────────────────
  {
    drugs: ['digoxina'],
    class: 'Glicosídeo Cardíaco',
    preferredTime: 'manha',
    foodEffect: 'sem_restricao',
    idealHours: [8],
    rationale: 'T½ = 36–48 h. Tomar no mesmo horário diariamente para monitoração de nível sérico confiável (coleta 8 h após a última dose). Nível sérico alvo: 0,5–0,9 ng/mL (IC com FE reduzida).',
    patientInstruction: 'Tomar sempre no mesmo horário. Não tomar 2 comprimidos se esquecer uma dose. Monitorar frequência cardíaca diariamente — não tomar se FC < 60 bpm (comunicar médico).',
    safetyNotes: [
      '⚠️ MARGEM TERAPÊUTICA ESTREITA — monitorar nível sérico',
      'Hipocalemia potencializa toxicidade — monitorar K⁺',
      'Toxicidade: náusea, visão amarelada, bradicardia',
    ],
    highAlert: true,
  },

  // ── ANTIARRÍTMICOS ──────────────────────────────────────────────────────────
  {
    drugs: ['amiodarona'],
    class: 'Antiarrítmico — Classe III',
    preferredTime: 'manha',
    foodEffect: 'com_alimento',
    idealHours: [8],
    rationale: 'T½ = 40–55 dias. Tomar com alimento aumenta absorção e reduz irritação GI. Horário fixo pela manhã facilita monitorização e adesão.',
    patientInstruction: 'Tomar com o café da manhã. Usar protetor solar — risco de fotossensibilidade. Monitorar função tireoidiana, hepática e pulmonar regularmente.',
    safetyNotes: [
      'CRITÉRIO DE BEERS — evitar em idosos; risco de toxicidade tireoidiana, pulmonar e hepática',
      'Interações graves: varfarina (aumenta INR), digoxina (aumenta nível), estatinas',
    ],
    highAlert: true,
  },

  // ── INSULINAS ───────────────────────────────────────────────────────────────
  {
    drugs: ['insulina regular', 'insulina humana regular', 'insulina r'],
    class: 'Insulina Regular (bolus)',
    preferredTime: 'qualquer',
    foodEffect: 'antes_refeicao',
    idealHours: [7, 12, 18],
    rationale: 'Início de ação: 30–60 min; pico: 2–3 h; duração: 5–8 h. Aplicar 30 min antes das refeições para sincronizar pico insulínico com pico glicêmico pós-prandial.',
    patientInstruction: 'Aplicar 30 minutos ANTES de cada refeição principal. Rodízio de sítios de aplicação.',
    highAlert: true,
    requiresUniformInterval: false,
  },
  {
    drugs: ['insulina asparte', 'insulina lispro', 'insulina glulisina', 'novorapid', 'humalog'],
    class: 'Insulina Análogo Ultrarrápida (bolus)',
    preferredTime: 'qualquer',
    foodEffect: 'com_alimento',
    idealHours: [7, 12, 18],
    rationale: 'Início de ação: 10–15 min; pico: 1–2 h; duração: 3–5 h. Pode ser aplicada imediatamente antes ou logo após a refeição (flexibilidade para pacientes com apetite variável).',
    patientInstruction: 'Aplicar imediatamente ANTES ou logo após o início da refeição. Não aplicar se não for se alimentar.',
    highAlert: true,
  },
  {
    drugs: ['insulina glargina', 'insulina detemir', 'insulina degludeca', 'lantus', 'toujeo', 'tresiba'],
    class: 'Insulina Basal (análogo de longa duração)',
    preferredTime: 'deitar',
    foodEffect: 'sem_restricao',
    idealHours: [22],
    rationale: 'Glargina T½ efetivo ≈ 24 h; detemir T½ = 5–7 h (duração 18–24 h); degludeca T½ > 25 h. Tomada noturna (22h) cobre a gliconeogênese hepática noturna e o fenômeno do alvorecer. Horário FIXO obrigatório.',
    patientInstruction: 'Aplicar sempre no mesmo horário, preferencialmente ao deitar (22h). Glargina e degludeca: NÃO misturar com outras insulinas na mesma seringa.',
    highAlert: true,
  },
  {
    drugs: ['insulina nph', 'insulina isofana', 'insulina n'],
    class: 'Insulina NPH (ação intermediária)',
    preferredTime: 'manha',
    foodEffect: 'sem_restricao',
    idealHours: [8, 22],
    rationale: 'Início: 2–4 h; pico: 6–10 h; duração: 10–18 h. Quando 1× ao dia: ao deitar (22h) cobre melhor a glicemia de jejum. Quando 2× ao dia: 8h e 22h.',
    patientInstruction: 'Se dose única: aplicar ao deitar (22h). Se 2 doses: 8h e 22h. Homogeneizar o frasco girando suavemente (não agitar).',
    highAlert: true,
  },

  // ── CORTICOSTEROIDES ────────────────────────────────────────────────────────
  {
    drugs: ['prednisona', 'prednisolona', 'dexametasona', 'hidrocortisona', 'betametasona', 'metilprednisolona', 'budesonida oral'],
    class: 'Corticosteroide Oral',
    preferredTime: 'manha',
    foodEffect: 'com_alimento',
    idealHours: [8],
    rationale: 'Mimetiza o pico fisiológico do cortisol endógeno (6h–8h). Administração matinal com alimento reduz a supressão do eixo hipotálamo-hipófise-adrenal e a irritação gástrica. Dose fracionada: 2/3 pela manhã e 1/3 ao meio-dia.',
    patientInstruction: 'Tomar com o café da manhã. Nunca interromper abruptamente — pode causar insuficiência adrenal. Comunicar ao médico em situações de estresse (cirurgia, infecção grave).',
    safetyNotes: [
      'Não interromper abruptamente — retirada gradual obrigatória',
      'Risco: hiperglicemia, osteoporose, HAS, cataratas com uso prolongado',
      'Associar protetor gástrico em uso > 5 dias',
    ],
  },

  // ── AINEs ───────────────────────────────────────────────────────────────────
  {
    drugs: ['ibuprofeno', 'diclofenaco', 'naproxeno', 'nimesulida', 'cetoprofeno', 'meloxicam', 'piroxicam', 'tenoxicam'],
    class: 'AINE — Anti-inflamatório Não Esteroidal',
    preferredTime: 'qualquer',
    foodEffect: 'com_alimento',
    idealHours: [8, 14, 20],
    rationale: 'Alimento reduz pico de concentração e irritação da mucosa gástrica. Meloxicam T½ = 20 h — pode ser tomado 1× ao dia. Piroxicam T½ = 50 h — 1× ao dia. Ibuprofeno T½ = 2 h — 3–4× ao dia.',
    patientInstruction: 'Tomar SEMPRE com alimento ou leite. Associar protetor gástrico (IBP) em uso > 5 dias, idosos ou histórico de úlcera. Beber bastante água.',
    safetyNotes: [
      'Contraindicados ou uso com cautela em: IRC, IC, úlcera péptica ativa, idosos > 65 anos',
      'Risco de sangramento aumentado com anticoagulantes',
    ],
  },
  {
    drugs: ['celecoxibe', 'etoricoxibe'],
    class: 'Inibidor Seletivo COX-2',
    preferredTime: 'qualquer',
    foodEffect: 'sem_restricao',
    idealHours: [8],
    rationale: 'Menor toxicidade GI comparado aos AINEs não seletivos. Etoricoxibe T½ = 22 h — 1× ao dia. Celecoxibe T½ = 11 h — pode ser 1× ou 2× ao dia.',
    patientInstruction: 'Tomar com ou sem alimento. Risco cardiovascular aumentado — usar menor dose efetiva pelo menor tempo possível.',
  },

  // ── ANTIEPILÉPTICOS ────────────────────────────────────────────────────────
  {
    drugs: ['fenitoina', 'fenitoína', 'difenilhidantoína'],
    class: 'Antiepiléptico — Hidantoína',
    preferredTime: 'qualquer',
    foodEffect: 'com_alimento',
    idealHours: [8, 20],
    rationale: 'Cinética não linear (saturável); pequenas mudanças de dose causam grandes variações de nível. Tomar com alimento reduz irritação GI. Horário fixo essencial. Monitorar nível sérico (alvo: 10–20 µg/mL).',
    patientInstruction: 'Tomar SEMPRE no mesmo horário, com alimento. Nunca pular doses. Não trocar de marca sem reavaliação.',
    highAlert: true,
    requiresUniformInterval: true,
    safetyNotes: ['Margem terapêutica estreita', 'Cinética não linear — risco de toxicidade com pequenos aumentos de dose'],
  },
  {
    drugs: ['carbamazepina', 'oxcarbazepina'],
    class: 'Antiepiléptico — Iminostilbeno',
    preferredTime: 'qualquer',
    foodEffect: 'com_alimento',
    idealHours: [8, 20],
    rationale: 'Carbamazepina: auto-indutor enzimático (CYP3A4) — nível sérico cai nas primeiras semanas; monitorar. Tomar com alimento melhora absorção e tolerância GI. Manter intervalo fixo.',
    patientInstruction: 'Tomar com alimento no mesmo horário todos os dias. Nunca pular doses — risco de convulsão.',
    requiresUniformInterval: true,
    safetyNotes: ['Induz CYP3A4 — inúmeras interações medicamentosas', 'Hiponatremia: monitorar Na⁺'],
  },
  {
    drugs: ['valproato', 'ácido valpróico', 'valproato de sódio', 'divalproex'],
    class: 'Antiepiléptico / Estabilizador do Humor',
    preferredTime: 'qualquer',
    foodEffect: 'com_alimento',
    idealHours: [8, 20],
    rationale: 'T½ = 9–16 h; 2× ao dia. Tomar com alimento reduz irritação GI e náusea significativas. Formulação LP permite 1× ao dia.',
    patientInstruction: 'Tomar com alimento. Formulação LP: engolir inteiro — não partir ou mastigar.',
    requiresUniformInterval: true,
    safetyNotes: ['Hepatotoxicidade: monitorar enzimas hepáticas', 'Teratogênico — contracepção obrigatória em mulheres em idade fértil'],
  },
  {
    drugs: ['levetiracetam'],
    class: 'Antiepiléptico — Piracetam',
    preferredTime: 'qualquer',
    foodEffect: 'sem_restricao',
    idealHours: [8, 20],
    rationale: 'T½ = 6–8 h; 2× ao dia. Absorção rápida e completa, independente de alimento. Excreção renal — ajuste em DRC.',
    patientInstruction: 'Tomar 2× ao dia com intervalo de 12 h, com ou sem alimento. Nunca interromper abruptamente.',
    requiresUniformInterval: true,
  },
  {
    drugs: ['lamotrigina'],
    class: 'Antiepiléptico / Estabilizador do Humor',
    preferredTime: 'qualquer',
    foodEffect: 'sem_restricao',
    idealHours: [8, 20],
    rationale: 'T½ = 25–33 h (monoterapia); pode variar com indutores/inibidores enzimáticos. Absorção completa, independente de alimento. Manter intervalo regular.',
    patientInstruction: 'Tomar sempre no mesmo horário, com ou sem alimento. Não alterar dose ou marca sem orientação.',
  },

  // ── ANTIDEPRESSIVOS / ANSIOLÍTICOS ─────────────────────────────────────────
  {
    drugs: ['sertralina', 'escitalopram', 'citalopram', 'paroxetina', 'fluoxetina', 'fluvoxamina'],
    class: 'ISRS — Antidepressivo',
    preferredTime: 'manha',
    foodEffect: 'com_alimento',
    idealHours: [8],
    rationale: 'T½ variável (fluoxetina T½ = 1–3 dias; sertralina T½ = 24 h). Tomada matinal minimiza insônia. Fluoxetina: horário mais flexível por T½ muito longa. Paroxetina: tomada noturna se sedação for efeito adverso predominante.',
    patientInstruction: 'Tomar pela manhã com alimento. Paroxetina/mirtazapina (se causar sonolência): tomar ao deitar. Efeito terapêutico completo demora 2–6 semanas — não interromper sem orientação.',
    safetyNotes: ['Síndrome de descontinuação — nunca interromper abruptamente'],
  },
  {
    drugs: ['venlafaxina', 'desvenlafaxina', 'duloxetina'],
    class: 'IRSN — Antidepressivo',
    preferredTime: 'manha',
    foodEffect: 'com_alimento',
    idealHours: [8],
    rationale: 'Duloxetina: alimento não altera absorção mas a cápsula entérica não deve ser aberta (pH sensível). Venlafaxina LP: tomar com alimento ao mesmo horário.',
    patientInstruction: 'Tomar com o café da manhã. Engolir cápsulas/comprimidos inteiros. Não interromper abruptamente — síndrome de descontinuação intensa.',
    safetyNotes: ['Síndrome de descontinuação severa — retirada gradual obrigatória'],
  },
  {
    drugs: ['mirtazapina'],
    class: 'NaSSA — Antidepressivo',
    preferredTime: 'deitar',
    foodEffect: 'sem_restricao',
    idealHours: [22],
    rationale: 'T½ = 20–40 h. Propriedade anti-histamínica intensa causa sedação. Tomada ao deitar transforma o efeito adverso em vantagem terapêutica (melhora sono), evitando sonolência diurna.',
    patientInstruction: 'Tomar ao deitar (22h). Não dirigir após tomar.',
  },
  {
    drugs: ['bupropiona'],
    class: 'NDRI — Antidepressivo / Suporte ao abandono do tabagismo',
    preferredTime: 'manha',
    foodEffect: 'sem_restricao',
    idealHours: [8, 14],
    rationale: 'T½ = 21 h; ação estimulante. Evitar dose ao final do dia — causa insônia. Última dose não além das 14h–16h.',
    patientInstruction: 'Tomar pela manhã (e início da tarde se 2× ao dia). NUNCA tomar após as 16h — causa insônia. Não esmagar o comprimido.',
    safetyNotes: ['Reduz limiar convulsivo — contraindicado em epilepsia não controlada'],
  },
  {
    drugs: ['diazepam', 'alprazolam', 'clonazepam', 'lorazepam', 'bromazepam', 'midazolam'],
    class: 'Benzodiazepínico',
    preferredTime: 'noite',
    foodEffect: 'sem_restricao',
    idealHours: [22],
    rationale: 'Uso em insônia ou ansiedade situacional: ao deitar minimiza sedação diurna. Uso em epilepsia (clonazepam): intervalo fixo de 8h–12h necessário para nível sérico constante.',
    patientInstruction: 'Usar com cautela. Não dirigir após tomar. Uso crônico não recomendado — dependência física e tolerância. Retirada gradual obrigatória.',
    safetyNotes: ['CRITÉRIO DE BEERS em idosos — risco de quedas e fraturas'],
    requiresUniformInterval: false,
  },

  // ── SUPLEMENTOS / MINERAIS ─────────────────────────────────────────────────
  {
    drugs: ['sulfato ferroso', 'fumarato ferroso', 'gluconato ferroso', 'ferro', 'ferripolimaltose', 'hidróxido férrico'],
    class: 'Suplemento de Ferro',
    preferredTime: 'tarde',
    foodEffect: 'jejum',
    idealHours: [14],
    rationale: 'Absorção máxima em jejum, entre as refeições (1 h antes ou 2 h após). Vitamina C (ácido ascórbico) aumenta absorção em 2–3×. Tomada entre o almoço e o jantar minimiza interações com cálcio do café da manhã e levotiroxina da manhã.',
    patientInstruction: 'Tomar entre as refeições (ex: 14h) com suco de laranja ou vitamina C. Evitar com chá, café, laticínios, cálcio, antiácidos e levotiroxina (intervalo mínimo 4 h).',
    timingInteractions: [
      { with: 'levotiroxina', gap: 4, note: 'Ferro quelato a tiroxina reduzindo absorção em 30–40%' },
      { with: 'calcio', gap: 2, note: 'Cálcio inibe absorção de ferro' },
      { with: 'ciprofloxacino', gap: 2, note: 'Ferro reduz absorção da quinolona' },
    ],
  },
  {
    drugs: ['carbonato de calcio', 'citrato de calcio', 'calcio', 'gluconato de calcio'],
    class: 'Suplemento de Cálcio',
    preferredTime: 'noite',
    foodEffect: 'com_alimento',
    idealHours: [20],
    rationale: 'Carbonato de cálcio: necessita de ácido gástrico — OBRIGATORIAMENTE com alimento. Citrato de cálcio: pode ser tomado sem alimento. Absorção máxima em doses ≤ 500 mg. Tomada noturna aproveita menor competição com outros minerais e reposição óssea noturna.',
    patientInstruction: 'Carbonato: tomar com alimento (com o jantar). Citrato: tomar a qualquer hora. Não tomar mais de 500 mg por vez. Separar 4 h de ferro e levotiroxina.',
    timingInteractions: [
      { with: 'levotiroxina', gap: 4, note: 'Cálcio reduz absorção de levotiroxina' },
      { with: 'ferro', gap: 2, note: 'Cálcio inibe absorção de ferro' },
      { with: 'bisfosfanatos', gap: 2, note: 'Cálcio reduz absorção de bisfosfonatos a zero' },
    ],
  },
  {
    drugs: ['vitamina d', 'colecalciferol', 'ergocalciferol', 'vitamina d3'],
    class: 'Suplemento de Vitamina D',
    preferredTime: 'qualquer',
    foodEffect: 'com_alimento',
    idealHours: [12],
    rationale: 'Vitamina lipossolúvel — absorção aumentada com a refeição de maior teor lipídico (geralmente almoço). T½ extremamente longa (semanas). Horário tem importância menor que a regularidade.',
    patientInstruction: 'Tomar com a refeição principal (almoço ou jantar). Dose semanal: tomar sempre no mesmo dia da semana.',
  },
  {
    drugs: ['vitamina b12', 'cianocobalamina', 'hidroxicobalamina', 'metilcobalamina'],
    class: 'Vitamina B12',
    preferredTime: 'manha',
    foodEffect: 'sem_restricao',
    idealHours: [8],
    rationale: 'Absorção por fator intrínseco: máxima em jejum ou com pequena quantidade de alimento. Doses altas (> 1000 µg): absorção por difusão passiva, independente de alimento.',
    patientInstruction: 'Tomar com o café da manhã. Para doses sublinguais: manter sob a língua por 2–3 minutos antes de engolir.',
  },

  // ── ANTIBIÓTICOS ────────────────────────────────────────────────────────────
  {
    drugs: ['amoxicilina'],
    class: 'Antibiótico — Aminopenicilina',
    preferredTime: 'qualquer',
    foodEffect: 'sem_restricao',
    idealHours: [8, 14, 20],
    rationale: 'T½ = 1–1,5 h; dependente do tempo de concentração. Manter nível acima da CIM — intervalos uniformes de 8 h são essenciais. Absorção não afetada por alimento.',
    patientInstruction: 'Tomar a cada 8 horas (ex: 8h, 16h, 24h) com ou sem alimento. Completar o ciclo completo mesmo com melhora dos sintomas.',
    requiresUniformInterval: true,
  },
  {
    drugs: ['amoxicilina + clavulanato', 'amoxicilina/clavulanato', 'amoxicilina clavulanato'],
    class: 'Antibiótico — Aminopenicilina + Inibidor de Beta-lactamase',
    preferredTime: 'qualquer',
    foodEffect: 'com_alimento',
    idealHours: [8, 20],
    rationale: 'Tomar com alimento reduz irritação GI causada pelo clavulanato. Intervalos uniformes essenciais para antibioticoterapia eficaz.',
    patientInstruction: 'Tomar com as refeições. Intervalos fixos a cada 8 h (3× ao dia) ou 12 h (2× ao dia). Completar o tratamento.',
    requiresUniformInterval: true,
  },
  {
    drugs: ['azitromicina'],
    class: 'Antibiótico — Macrolídeo',
    preferredTime: 'qualquer',
    foodEffect: 'sem_restricao',
    idealHours: [8],
    rationale: 'T½ tecidual = 68 h — permite esquema de 1× ao dia por 3–5 dias. Absorção levemente reduzida por alimento mas clinicamente irrelevante. Manter intervalo de 24 h.',
    patientInstruction: 'Tomar 1× ao dia, no mesmo horário, com ou sem alimento. Completar os dias prescritos mesmo melhorando antes.',
    requiresUniformInterval: true,
  },
  {
    drugs: ['claritromicina'],
    class: 'Antibiótico — Macrolídeo',
    preferredTime: 'qualquer',
    foodEffect: 'com_alimento',
    idealHours: [8, 20],
    rationale: 'T½ = 3–7 h; 2× ao dia. Tomar com alimento melhora tolerância GI. Intervalos de 12 h.',
    patientInstruction: 'Tomar com alimento a cada 12 h. Engolir comprimidos inteiros.',
    requiresUniformInterval: true,
  },
  {
    drugs: ['ciprofloxacino'],
    class: 'Antibiótico — Fluorquinolona',
    preferredTime: 'qualquer',
    foodEffect: 'sem_restricao',
    idealHours: [8, 20],
    rationale: 'T½ = 4–6 h; 2× ao dia. Laticínios, antiácidos, ferro e cálcio reduzem absorção em até 90% por quelação. Intervalo de 12 h.',
    patientInstruction: 'Tomar com água, sem laticínios, antiácidos, ferro ou cálcio (separar 2–4 h). Evitar exposição solar intensa.',
    requiresUniformInterval: true,
    timingInteractions: [
      { with: 'ferro', gap: 2, note: 'Fe²⁺ e Fe³⁺ quelam fluorquinolonas, reduzindo absorção em até 90%' },
      { with: 'calcio', gap: 2, note: 'Cálcio forma quelato com quinolonas' },
    ],
  },
  {
    drugs: ['metronidazol'],
    class: 'Antibiótico / Antiprotozoário — Nitroimidazol',
    preferredTime: 'qualquer',
    foodEffect: 'com_alimento',
    idealHours: [8, 14, 20],
    rationale: 'T½ = 6–8 h; 3× ao dia (ou 2× ao dia). Alimento reduz náusea intensa. Efeito dissulfiram-like com álcool — abstinência obrigatória.',
    patientInstruction: 'Tomar com alimento. Proibido consumo de álcool durante o tratamento E por 48 h após o término (reação grave: náusea, vômito, rubor, taquicardia).',
    requiresUniformInterval: true,
    safetyNotes: ['Reação tipo dissulfiram com álcool — abstinência obrigatória durante e 48 h após o tratamento'],
  },

  // ── OUTROS ──────────────────────────────────────────────────────────────────
  {
    drugs: ['ácido fólico', 'folato', 'metilfolato'],
    class: 'Vitamina B9 — Ácido Fólico',
    preferredTime: 'manha',
    foodEffect: 'sem_restricao',
    idealHours: [8],
    rationale: 'Hidrossolúvel. Absorção não afetada por alimento. Tomada matinal facilita adesão.',
    patientInstruction: 'Tomar com ou sem alimento, no mesmo horário diariamente.',
  },
  {
    drugs: ['metotrexato', 'metotrexate'],
    class: 'Imunossupressor / Antineoplásico (dose baixa)',
    preferredTime: 'qualquer',
    foodEffect: 'sem_restricao',
    idealHours: [8],
    rationale: 'Dose baixa (doenças autoimunes): 1× por semana. Administrar ácido fólico (5 mg/semana) para reduzir toxicidade.',
    patientInstruction: 'Tomar 1× por semana, sempre no mesmo dia. Tomar ácido fólico no dia seguinte. Não tomar AINEs sem autorização médica.',
    highAlert: true,
    safetyNotes: ['⚠️ Dose SEMANAL — confusão de frequência pode causar toxicidade grave ou morte'],
  },
  {
    drugs: ['alopurinol'],
    class: 'Uricostático — Antigotoso',
    preferredTime: 'qualquer',
    foodEffect: 'apos_refeicao',
    idealHours: [8],
    rationale: 'T½ do metabólito ativo (oxipurinol) = 18–30 h — 1× ao dia. Tomar após refeição reduz irritação GI. Iniciar com dose baixa; titular gradualmente.',
    patientInstruction: 'Tomar com ou após o café da manhã. Beber bastante água (≥ 2 L/dia). Não iniciar durante crise de gota — aguardar resolução.',
  },
  {
    drugs: ['colchicina'],
    class: 'Antigotoso — Alcaloide',
    preferredTime: 'qualquer',
    foodEffect: 'sem_restricao',
    idealHours: [8],
    rationale: 'T½ = 26–31 h. Na crise aguda: 1,2 mg + 0,6 mg 1 h depois, depois 0,6 mg 2× ao dia. Dose profilática: 0,5 mg 1–2× ao dia.',
    patientInstruction: 'Seguir exatamente o esquema prescrito. Não dobrar doses. Parar e comunicar médico se diarreia, vômito ou dor muscular intensa.',
    safetyNotes: ['Interação grave com claritromicina e inibidores de CYP3A4/P-gp'],
  },
  {
    drugs: ['sildenafila', 'tadalafila', 'vardenafila', 'avanafila'],
    class: 'Inibidor de PDE-5 — Disfunção Erétil / HAP',
    preferredTime: 'qualquer',
    foodEffect: 'sem_restricao',
    idealHours: [20],
    rationale: 'Sildenafila: alimento (especialmente gorduroso) retarda absorção em 1 h. Tadalafila (diária): T½ = 17,5 h — qualquer horário fixo. Tadalafila (sob demanda): tomar 30–60 min antes.',
    patientInstruction: 'Sildenafila/vardenafila: tomar 1 h antes, preferencialmente sem refeição gordurosa. Tadalafila diária: horário fixo. NUNCA combinar com nitratos (queda grave de PA).',
    safetyNotes: ['Contraindicado com nitratos — hipotensão grave potencialmente fatal'],
  },
  {
    drugs: ['tamsulosina', 'dutasterida', 'finasterida', 'terazosina', 'alfuzosina', 'silodosina'],
    class: 'Medicamento para HBP / Alfa-bloqueador',
    preferredTime: 'noite',
    foodEffect: 'apos_refeicao',
    idealHours: [20],
    rationale: 'Alfuzosina e terazosina: tomada ao deitar reduz hipotensão ortostática de primeira dose. Tamsulosina LP: tomar 30 min após a mesma refeição diariamente para absorção consistente.',
    patientInstruction: 'Tomar após o jantar ou ao deitar. Levante-se devagar para evitar tontura (hipotensão ortostática).',
    safetyNotes: ['Hipotensão de primeira dose — iniciar com dose baixa ao deitar'],
  },
]

// ══════════════════════════════════════════════════════════════════════════════
// FUNÇÕES DE BUSCA
// ══════════════════════════════════════════════════════════════════════════════

/** Normaliza string para comparação */
function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

/** Busca o perfil FK de um fármaco pelo nome do princípio ativo */
export function getPKProfile(activeIngredient: string): PKProfile | undefined {
  const n = norm(activeIngredient)
  return PK_DATABASE.find(p =>
    p.drugs.some(d => {
      const dn = norm(d)
      return n.includes(dn) || dn.includes(n)
    })
  )
}

/** Converte hora preferencial para hora(s) recomendada(s) */
export function getRecommendedHours(
  profile: PKProfile,
  frequencyPerDay: number
): number[] {
  if (frequencyPerDay <= 1) return [profile.idealHours[0]]
  if (profile.idealHours.length >= frequencyPerDay) {
    return profile.idealHours.slice(0, frequencyPerDay)
  }
  // Distribuir uniformemente a partir da hora ideal
  const startHour = profile.idealHours[0]
  const interval = Math.round(24 / frequencyPerDay)
  return Array.from({ length: frequencyPerDay }, (_, i) =>
    (startHour + i * interval) % 24
  )
}
