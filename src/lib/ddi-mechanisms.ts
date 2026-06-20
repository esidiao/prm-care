// Camada QUALITATIVA para os pares externos (DDInter), que vêm sem mecanismo/manejo.
// Atribui "tags" farmacológicas a cada princípio ativo e, por regras tag×tag,
// infere mecanismo, efeito clínico e conduta ESPECÍFICOS — determinístico, custo zero,
// fundamentado na farmacologia. Se nenhuma regra casar, o engine mantém o texto genérico.

type Severity = 'contraindicated' | 'major' | 'moderate' | 'minor'

const norm = (s: string): string =>
  String(s || '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '')

// Cada tag → stems (já normalizados) de princípios ativos que carregam aquela propriedade.
// Matching por substring (norm(droga).includes(stem)) — stems escolhidos para evitar
// falsos positivos.
const TAGS: Record<string, string[]> = {
  // ── Farmacodinâmica aditiva (simétrica) ───────────────────────────────────
  serotonergic: [
    'fluoxetina', 'sertralina', 'paroxetina', 'citalopram', 'escitalopram', 'fluvoxamina',
    'venlafaxina', 'desvenlafaxina', 'duloxetina', 'milnaciprano', 'levomilnaciprano',
    'amitriptilina', 'nortriptilina', 'clomipramina', 'imipramina',
    'tramadol', 'tapentadol', 'meperidina', 'fentanila', 'metadona',
    'sumatriptana', 'zolmitriptana', 'rizatriptana', 'naratriptana', 'almotriptana',
    'fenelzina', 'tranilcipromina', 'isocarboxazida', 'selegilina', 'rasagilina',
    'linezolida', 'azul de metileno',
    'mirtazapina', 'trazodona', 'vortioxetina', 'vilazodona', 'nefazodona', 'buspirona',
    'ondansetrona', 'granisetrona', 'palonosetrona', 'metoclopramida', 'dextrometorfano',
    'litio',
  ],
  qt_prolong: [
    'amiodarona', 'dronedarona', 'sotalol', 'quinidina', 'procainamida', 'disopiramida',
    'dofetilida', 'ibutilida',
    'citalopram', 'escitalopram',
    'haloperidol', 'droperidol', 'pimozida', 'ziprasidona', 'quetiapina', 'clorpromazina',
    'tioridazina', 'olanzapina', 'mesoridazina', 'iloperidona',
    'metadona',
    'ondansetrona', 'domperidona', 'granisetrona',
    'ciprofloxacino', 'levofloxacino', 'moxifloxacino', 'gatifloxacino', 'gemifloxacino',
    'norfloxacino', 'ofloxacino', 'esparfloxacino',
    'azitromicina', 'claritromicina', 'eritromicina', 'telitromicina',
    'fluconazol', 'voriconazol', 'posaconazol', 'itraconazol', 'cetoconazol',
    'cloroquina', 'hidroxicloroquina', 'halofantrina', 'lumefantrina', 'mefloquina', 'quinina',
    'pentamidina', 'hidroxizina', 'trioxido de arsenio', 'vandetanibe', 'nilotinibe',
    'vemurafenibe', 'cisaprida', 'astemizol', 'terfenadina',
  ],
  cns_depressant: [
    // opioides
    'tramadol', 'codeina', 'morfina', 'oxicodona', 'fentanila', 'buprenorfina', 'meperidina',
    'metadona', 'hidrocodona', 'hidromorfona', 'tapentadol', 'sufentanila', 'alfentanila',
    'dextropropoxifeno', 'butorfanol', 'oliceridina', 'di-hidrocodeina',
    // benzodiazepínicos
    'diazepam', 'alprazolam', 'clonazepam', 'lorazepam', 'midazolam', 'bromazepam',
    'nitrazepam', 'flurazepam', 'clobazam', 'triazolam', 'estazolam', 'clordiazepoxido',
    'clorazepico',
    // hipnóticos Z e órexina/melatonina
    'zolpidem', 'zopiclona', 'zaleplon', 'eszopiclona', 'suvorexanto', 'lemborexante',
    // barbitúricos
    'fenobarbital', 'secobarbital', 'pentobarbital', 'amobarbital', 'butabarbital',
    'butalbital', 'primidona', 'metilfenobarbital',
    // antipsicóticos
    'haloperidol', 'risperidona', 'quetiapina', 'olanzapina', 'clorpromazina',
    'levomepromazina', 'ziprasidona', 'aripiprazol', 'clozapina', 'tioridazina',
    'paliperidona', 'lurasidona', 'asenapina', 'cariprazina', 'brexpiprazol',
    // anti-histamínicos sedativos (1ª geração)
    'difenidramina', 'clorfeniramina', 'prometazina', 'hidroxizina', 'dimenidrinato',
    'ciclizina', 'meclizina', 'doxilamina', 'clemastina', 'ciproeptadina', 'carbinoxamina',
    // tricíclicos / outros antidepressivos sedativos
    'amitriptilina', 'nortriptilina', 'clomipramina', 'imipramina', 'doxepina', 'amoxapina',
    'maprotilina', 'mirtazapina', 'trazodona',
    // gabapentinoides
    'gabapentina', 'pregabalina',
    // relaxantes musculares
    'baclofeno', 'ciclobenzaprina', 'tizanidina', 'carisoprodol', 'orfenadrina', 'metocarbamol',
    // outros sedativos
    'clonidina', 'alcool',
  ],
  anticholinergic: [
    'amitriptilina', 'nortriptilina', 'clomipramina', 'imipramina', 'doxepina', 'amoxapina',
    'difenidramina', 'clorfeniramina', 'prometazina', 'hidroxizina', 'clemastina',
    'ciproeptadina', 'dimenidrinato', 'meclizina', 'ciclizina', 'doxilamina', 'carbinoxamina',
    'oxibutinina', 'tolterodina', 'solifenacina', 'darifenacina', 'fesoterodina', 'trospio',
    'flavoxato', 'biperideno', 'triexifenidil', 'benztropina',
    'clozapina', 'clorpromazina', 'olanzapina', 'quetiapina', 'tioridazina',
    'escopolamina', 'hioscina', 'atropina', 'diciclomina', 'hiosciamina', 'propantelina',
    'glicopirronio', 'ciclobenzaprina', 'orfenadrina',
  ],
  bleeding: [
    // anticoagulantes
    'varfarina', 'warfarina', 'dabigatrana', 'rivaroxabana', 'apixabana', 'edoxabana',
    'betrixabana', 'heparina', 'enoxaparina', 'dalteparina', 'tinzaparina', 'fondaparinux',
    'bivalirudina', 'argatroban', 'lepirudina', 'desirudina', 'danaparoide', 'dicumarol',
    // antiagregantes
    'acido acetilsalicilico', 'clopidogrel', 'ticagrelor', 'prasugrel', 'dipiridamol',
    'ticlopidina', 'cilostazol', 'eptifibatida', 'tirofibana', 'abciximabe', 'vorapaxar',
    // AINEs
    'ibuprofeno', 'naproxeno', 'diclofenaco', 'celecoxibe', 'meloxicam', 'indometacina',
    'piroxicam', 'nimesulida', 'cetorolaco', 'cetoprofeno', 'etodolaco', 'sulindaco',
    'flurbiprofeno', 'oxaprozina', 'fenoprofeno', 'diflunisal', 'tolmetina', 'nabumetona',
    'acido mefenamico', 'meclofenamico', 'fenilbutazona', 'salsalato',
    // ISRS/IRSN (sangramento por depleção de serotonina plaquetária)
    'fluoxetina', 'sertralina', 'paroxetina', 'citalopram', 'escitalopram', 'fluvoxamina',
    'venlafaxina', 'desvenlafaxina', 'duloxetina', 'pentoxifilina',
  ],
  hyperkalemia: [
    'enalapril', 'captopril', 'lisinopril', 'ramipril', 'perindopril', 'quinaprila',
    'fosinopril', 'trandolapril', 'benazepril', 'moexipril',
    'losartana', 'valsartana', 'irbesartana', 'candesartana', 'olmesartana', 'telmisartana',
    'azilsartana', 'eprosartana',
    'espironolactona', 'eplerenona', 'amilorida', 'triantereno',
    'cloreto de potassio', 'citrato de potassio',
    'heparina', 'enoxaparina', 'trimetoprima', 'sulfametoxazol', 'drospirenona', 'alisquireno',
    'ciclosporina', 'tacrolimo', 'tacrolimus',
  ],
  nephrotoxic: [
    'ibuprofeno', 'naproxeno', 'diclofenaco', 'celecoxibe', 'meloxicam', 'indometacina',
    'piroxicam', 'nimesulida', 'cetorolaco', 'cetoprofeno',
    'gentamicina', 'amicacina', 'tobramicina', 'estreptomicina', 'neomicina', 'canamicina',
    'vancomicina', 'anfotericina b', 'foscarnet', 'tenofovir', 'cidofovir',
    'ciclosporina', 'tacrolimo', 'tacrolimus',
    'cisplatina', 'carboplatina', 'oxaliplatina', 'metotrexato',
    'iohexol', 'iopamidol', 'iodixanol', 'ioversol', 'iopromida', 'diatrizoato',
  ],
  hypoglycemia: [
    'insulina', 'glibenclamida', 'glipizida', 'glimepirida', 'gliclazida', 'clorpropamida',
    'tolbutamida', 'tolazamida', 'repaglinida', 'nateglinida', 'metformina',
    'exenatida', 'liraglutida', 'dulaglutida', 'semaglutida', 'lixisenatida',
  ],
  bradycardic: [
    'atenolol', 'metoprolol', 'carvedilol', 'bisoprolol', 'propranolol', 'nebivolol',
    'labetalol', 'nadolol', 'esmolol', 'pindolol', 'acebutolol', 'betaxolol', 'carteolol',
    'sotalol', 'verapamil', 'diltiazem', 'digoxina', 'digitoxina', 'amiodarona', 'dronedarona',
    'ivabradina', 'clonidina', 'metildopa', 'fingolimode',
    'donepezila', 'rivastigmina', 'galantamina', 'piridostigmina', 'neostigmina',
  ],
  // ── Farmacocinética (direcional) ───────────────────────────────────────────
  cyp3a4_inhibitor: [
    'cetoconazol', 'itraconazol', 'voriconazol', 'posaconazol', 'fluconazol', 'isavuconazonio',
    'claritromicina', 'eritromicina', 'telitromicina', 'troleandomicina',
    'ritonavir', 'cobicistat', 'nelfinavir', 'indinavir', 'saquinavir', 'atazanavir',
    'darunavir', 'fosamprenavir', 'amprenavir', 'tipranavir',
    'nefazodona', 'idelalisibe', 'diltiazem', 'verapamil', 'mifepristona',
  ],
  cyp3a4_substrate_nti: [
    'sinvastatina', 'atorvastatina', 'lovastatina',
    'ciclosporina', 'tacrolimo', 'tacrolimus', 'sirolimo', 'everolimo', 'temsirolimo',
    'midazolam', 'triazolam', 'alfentanila', 'fentanila',
    'colchicina', 'ergotamina', 'di-hidroergotamina', 'di-hidroergotamina',
    'quetiapina', 'ibrutinibe', 'venetoclax', 'lurasidona', 'eplerenona', 'ranolazina',
    'apixabana', 'rivaroxabana', 'avanafila', 'lomitapida',
  ],
  cyp3a4_inducer: [
    'rifampicina', 'rifabutina', 'rifapentina', 'carbamazepina', 'oxcarbazepina',
    'fenitoina', 'fosfenitoina', 'fenobarbital', 'primidona', 'topiramato',
    'efavirenz', 'nevirapina', 'etravirina', 'enzalutamida', 'apalutamida', 'mitotano',
    'bosentana', 'modafinila', 'armodafinila',
  ],
  statin: [
    'sinvastatina', 'atorvastatina', 'rosuvastatina', 'pravastatina', 'fluvastatina',
    'pitavastatina', 'lovastatina', 'cerivastatina',
  ],
  fibrate: ['genfibrozila', 'gemfibrozila', 'fenofibrato', 'ciprofibrato', 'bezafibrato', 'clofibrato'],
}

function tagsOf(drug: string): Set<string> {
  const d = norm(drug)
  const out = new Set<string>()
  for (const [tag, stems] of Object.entries(TAGS)) {
    if (stems.some(stem => d.includes(stem))) out.add(tag)
  }
  return out
}

export interface MechanismHit {
  mechanism: string
  clinicalEffect: string
  management: string
  /** Piso de severidade clínica desta combinação (nunca rebaixa a do DDInter; só pode elevar). */
  severityFloor: Severity
}

// Regras tag×tag, em ordem de prioridade clínica (a 1ª que casar vence).
interface Rule {
  a: string
  b: string
  hit: MechanismHit
}

const RULES: Rule[] = [
  {
    a: 'serotonergic', b: 'serotonergic',
    hit: {
      mechanism: 'Efeito serotoninérgico aditivo (aumento da serotonina sináptica).',
      clinicalEffect: 'Risco de síndrome serotoninérgica (agitação, tremor, hiper-reflexia, hipertermia, instabilidade autonômica).',
      management: 'Evitar a associação sempre que possível; se mantida, usar a menor dose, orientar sinais de alerta e suspender se surgirem. Cautela redobrada com IMAO/linezolida.',
      severityFloor: 'major',
    },
  },
  {
    a: 'qt_prolong', b: 'qt_prolong',
    hit: {
      mechanism: 'Prolongamento aditivo do intervalo QT (bloqueio de canais de potássio cardíacos).',
      clinicalEffect: 'Risco aumentado de torsades de pointes e arritmias ventriculares, sobretudo com hipocalemia/hipomagnesemia.',
      management: 'Evitar a combinação ou monitorar ECG (QTc) e eletrólitos (K⁺/Mg²⁺); corrigir distúrbios e revisar outros fármacos QT.',
      severityFloor: 'major',
    },
  },
  {
    a: 'bleeding', b: 'bleeding',
    hit: {
      mechanism: 'Efeito antitrombótico/antiplaquetário ou lesivo de mucosa aditivo.',
      clinicalEffect: 'Risco aumentado de sangramento, em especial hemorragia digestiva.',
      management: 'Confirmar a real necessidade da associação; considerar gastroproteção (IBP), revisar doses e orientar sinais de sangramento.',
      severityFloor: 'major',
    },
  },
  {
    a: 'cns_depressant', b: 'cns_depressant',
    hit: {
      mechanism: 'Depressão aditiva do sistema nervoso central.',
      clinicalEffect: 'Sedação excessiva, comprometimento cognitivo/psicomotor, quedas e — com opioides — depressão respiratória.',
      management: 'Evitar a sobreposição; consolidar em um único agente, usar a menor dose e reavaliar a necessidade, com atenção a idosos.',
      severityFloor: 'moderate',
    },
  },
  {
    a: 'cyp3a4_inhibitor', b: 'cyp3a4_substrate_nti',
    hit: {
      mechanism: 'Inibição do CYP3A4 reduz o metabolismo do substrato de janela terapêutica estreita.',
      clinicalEffect: 'Aumento dos níveis séricos do substrato e do risco de toxicidade (ex.: miopatia/rabdomiólise com estatinas; nefro/neurotoxicidade com imunossupressores).',
      management: 'Evitar ou ajustar a dose do substrato; monitorar toxicidade/níveis séricos. Considerar alternativa sem interação CYP3A4.',
      severityFloor: 'major',
    },
  },
  {
    a: 'cyp3a4_inducer', b: 'cyp3a4_substrate_nti',
    hit: {
      mechanism: 'Indução do CYP3A4 acelera o metabolismo do substrato.',
      clinicalEffect: 'Redução dos níveis séricos e possível falha terapêutica do substrato.',
      management: 'Monitorar eficácia/níveis; ajustar dose ou escolher alternativa não indutora. Atenção ao efeito prolongado após suspender o indutor.',
      severityFloor: 'moderate',
    },
  },
  {
    a: 'statin', b: 'fibrate',
    hit: {
      mechanism: 'Toxicidade muscular aditiva (estatina + fibrato), maior com genfibrozila.',
      clinicalEffect: 'Risco de miopatia e rabdomiólise.',
      management: 'Preferir fenofibrato à genfibrozila; usar a menor dose de estatina e orientar mialgia/urina escura. Monitorar CK se sintomas.',
      severityFloor: 'major',
    },
  },
  {
    a: 'hyperkalemia', b: 'hyperkalemia',
    hit: {
      mechanism: 'Retenção aditiva de potássio (efeitos sobre o sistema renina-angiotensina-aldosterona e/ou excreção renal).',
      clinicalEffect: 'Risco de hipercalemia, potencialmente grave (arritmias).',
      management: 'Monitorar potássio sérico e função renal; orientar sobre dieta rica em K⁺ e evitar combinações desnecessárias.',
      severityFloor: 'moderate',
    },
  },
  {
    a: 'nephrotoxic', b: 'nephrotoxic',
    hit: {
      mechanism: 'Nefrotoxicidade aditiva.',
      clinicalEffect: 'Risco aumentado de lesão renal aguda.',
      management: 'Monitorar creatinina/TFG e diurese; manter hidratação e evitar a associação em pacientes com função renal reduzida.',
      severityFloor: 'moderate',
    },
  },
  {
    a: 'bradycardic', b: 'bradycardic',
    hit: {
      mechanism: 'Depressão aditiva da automaticidade sinusal e da condução atrioventricular.',
      clinicalEffect: 'Risco de bradicardia, bloqueio AV e hipotensão.',
      management: 'Monitorar frequência cardíaca e ECG; iniciar em doses baixas e evitar a associação em distúrbios de condução.',
      severityFloor: 'moderate',
    },
  },
  {
    a: 'anticholinergic', b: 'anticholinergic',
    hit: {
      mechanism: 'Carga anticolinérgica aditiva.',
      clinicalEffect: 'Boca seca, retenção urinária, constipação, visão turva, confusão e quedas (sobretudo em idosos).',
      management: 'Minimizar a carga anticolinérgica total; preferir alternativas e reavaliar a necessidade de cada agente.',
      severityFloor: 'moderate',
    },
  },
  {
    a: 'hypoglycemia', b: 'hypoglycemia',
    hit: {
      mechanism: 'Efeito hipoglicemiante aditivo.',
      clinicalEffect: 'Risco aumentado de hipoglicemia.',
      management: 'Monitorar a glicemia, orientar sinais de hipoglicemia e ajustar doses, com atenção a idosos e à função renal.',
      severityFloor: 'moderate',
    },
  },
]

/**
 * Infere mecanismo/efeito/manejo ESPECÍFICOS para um par de fármacos a partir das
 * propriedades farmacológicas de cada um. Retorna null se nenhuma regra casar.
 */
export function inferExternalMechanism(drugA: string, drugB: string): MechanismHit | null {
  const ta = tagsOf(drugA)
  const tb = tagsOf(drugB)
  if (ta.size === 0 || tb.size === 0) return null
  for (const r of RULES) {
    const match =
      (ta.has(r.a) && tb.has(r.b)) || (ta.has(r.b) && tb.has(r.a))
    if (match) return r.hit
  }
  return null
}

const SEV_RANK: Record<Severity, number> = { contraindicated: 3, major: 2, moderate: 1, minor: 0 }

/** Eleva a severidade ao piso da regra, sem nunca rebaixar a do DDInter (cap em 'major'). */
export function maxSeverity(ddinter: Severity, floor: Severity): Severity {
  return SEV_RANK[floor] > SEV_RANK[ddinter] ? floor : ddinter
}
