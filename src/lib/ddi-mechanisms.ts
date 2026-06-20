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

// ─────────────────────────────────────────────────────────────────────────────
// EXPANSÃO VERIFICADA (workflow adversarial: 5 domínios; por domínio, 1 finder +
// 2 revisores céticos — lente de correção farmacológica e lente de falso-positivo).
// Só entraram regras aprovadas pelas DUAS lentes; tags sem regra aprovada e stems
// reprovados foram descartados. Gate final humano aplicado (ver commit).
// ─────────────────────────────────────────────────────────────────────────────

const NEW_TAGS: Record<string, string[]> = {
  // — Neuropsiquiátrico —
  seizure_threshold: ['tramadol', 'tapentadol', 'bupropiona', 'clozapina', 'olanzapina', 'quetiapina', 'haloperidol', 'risperidona', 'paliperidona', 'amissulprida', 'clorpromazina', 'levomepromazina', 'ciprofloxacino', 'levofloxacino', 'moxifloxacino', 'norfloxacino', 'ofloxacino', 'teofilina', 'aminofilina', 'meperidina', 'petidina', 'maprotilina', 'clomipramina', 'amitriptilina', 'imipramina', 'venlafaxina', 'cefepima', 'imipenem', 'metanfetamina', 'anfetamina', 'mefenamico', 'tacrina', 'baclofeno', 'amoxapina'],
  maoi: ['fenelzina', 'tranilcipromina', 'isocarboxazida', 'selegilina', 'rasagilina', 'safinamida', 'linezolida', 'procarbazina', 'moclobemida', 'metiltionin', 'azul de metileno'],
  sympathomimetic: ['pseudoefedrina', 'efedrina', 'fenilefrina', 'metanfetamina', 'anfetamina', 'lisdexanfetamina', 'metilfenidato', 'fentermina', 'dietilpropiona', 'anfepramona', 'benzfetamina', 'mazindol', 'fenproporex', 'sibutramina', 'metaraminol', 'midodrina', 'fenilpropanolamina'],
  dopamine_blocker: ['haloperidol', 'droperidol', 'clorpromazina', 'levomepromazina', 'flufenazina', 'periciazina', 'pimozida', 'metoclopramida', 'bromoprida', 'proclorperazina', 'prometazina', 'risperidona', 'paliperidona', 'olanzapina', 'quetiapina', 'clozapina', 'ziprasidona', 'aripiprazol', 'brexpiprazol', 'cariprazina', 'asenapina', 'lurasidona', 'amissulprida', 'sulpirida', 'tiaprida', 'lumateperona', 'iloperidona', 'tetrabenazina', 'deutetrabenazina', 'reserpina', 'flupentixol', 'zuclopentixol'],
  dopaminergic: ['levodopa', 'carbidopa', 'benserazida', 'apomorfina', 'pramipexol', 'ropinirol', 'rotigotina', 'bromocriptina', 'cabergolina', 'pergolida', 'amantadina', 'entacapona', 'tolcapona', 'piribedil'],
  // — Cardiovascular —
  potassium_wasting: ['furosemida', 'bumetanida', 'torsemida', 'torasemida', 'acido etacrinico', 'piretanida', 'hidroclorotiazida', 'clortalidona', 'indapamida', 'metolazona', 'bendroflumetiazida', 'clortiazida', 'hidroflumetiazida', 'anfotericina b'],
  digoxin: ['digoxina', 'digitoxina', 'metildigoxina', 'lanatosideo', 'deslanosideo', 'ouabaina'],
  hypoglycemia_masking: ['propranolol', 'nadolol', 'timolol', 'pindolol', 'sotalol', 'carvedilol', 'labetalol', 'atenolol', 'metoprolol', 'bisoprolol', 'nebivolol', 'acebutolol', 'betaxolol', 'carteolol', 'esmolol'],
  // — Renal/eletrólitos —
  lithium: ['litio'],
  lithium_clearance_reducer: ['ibuprofeno', 'naproxeno', 'diclofenaco', 'indometacina', 'cetorolaco', 'celecoxibe', 'meloxicam', 'piroxicam', 'nimesulida', 'cetoprofeno', 'etodolaco', 'aceclofenaco', 'enalapril', 'captopril', 'lisinopril', 'ramipril', 'perindopril', 'quinaprila', 'fosinopril', 'trandolapril', 'benazepril', 'losartana', 'valsartana', 'irbesartana', 'candesartana', 'olmesartana', 'telmisartana', 'azilsartana', 'tiazida', 'clortalidona', 'indapamida', 'metolazona'],
  // — Farmacocinética —
  cyp2d6_inhibitor: ['fluoxetina', 'paroxetina', 'bupropiona', 'duloxetina', 'terbinafina', 'cinacalcete', 'mirabegrona'],
  cyp2d6_substrate_toxicity: ['metoprolol', 'risperidona', 'atomoxetina', 'nortriptilina', 'amitriptilina', 'clomipramina', 'imipramina', 'desipramina', 'haloperidol', 'tioridazina', 'flecainida'],
  cyp2d6_substrate_prodrug: ['codeina', 'tramadol', 'tamoxifeno', 'di-hidrocodeina', 'hidrocodona'],
  cyp2c9_inhibitor: ['fluconazol', 'amiodarona', 'metronidazol', 'sulfametoxazol', 'miconazol', 'capecitabina', 'voriconazol'],
  cyp2c9_substrate_nti: ['varfarina', 'warfarina', 'fenitoina', 'fosfenitoina'],
  cyp2c19_inhibitor: ['omeprazol', 'esomeprazol', 'fluvoxamina', 'fluconazol', 'ticlopidina'],
  cyp2c19_substrate_prodrug: ['clopidogrel'],
  pgp_inhibitor: ['verapamil', 'amiodarona', 'claritromicina', 'ciclosporina', 'dronedarona', 'itraconazol', 'cetoconazol', 'ritonavir', 'quinidina', 'propafenona'],
  pgp_substrate_nti: ['digoxina', 'digitoxina', 'dabigatrana', 'edoxabana'],
  polyvalent_cation: ['carbonato de calcio', 'citrato de calcio', 'sulfato ferroso', 'fumarato ferroso', 'gliconato ferroso', 'hidroxido de aluminio', 'hidroxido de magnesio', 'sulfato de magnesio', 'sucralfato', 'sevelamer', 'carbonato de lantanio', 'sulfato de zinco', 'subsalicilato de bismuto', 'colestiramina'],
  chelatable_drug: ['tetraciclina', 'doxiciclina', 'minociclina', 'demeclociclina', 'tigeciclina', 'ciprofloxacino', 'levofloxacino', 'moxifloxacino', 'norfloxacino', 'ofloxacino', 'gemifloxacino', 'levotiroxina', 'alendronato', 'alendronico', 'risedronato', 'risedronico', 'ibandronato', 'ibandronico', 'acido zoledronico', 'dolutegravir', 'raltegravir', 'bictegravir', 'elvitegravir', 'micofenolato'],
  // — Endócrino/hemato/outros —
  myelosuppressive: ['metotrexato', 'azatioprina', 'mercaptopurina', 'tioguanina', 'hidroxiureia', 'hidroxicarbamida', 'ciclofosfamida', 'ifosfamida', 'clorambucila', 'melfalano', 'busulfano', 'citarabina', 'fludarabina', 'cladribina', 'gencitabina', 'capecitabina', 'fluoruracila', 'doxorrubicina', 'daunorrubicina', 'epirrubicina', 'idarrubicina', 'etoposido', 'vinblastina', 'vincristina', 'paclitaxel', 'docetaxel', 'carboplatina', 'cisplatina', 'oxaliplatina', 'irinotecano', 'topotecano', 'bleomicina', 'dacarbazina', 'temozolomida', 'pemetrexede', 'ganciclovir', 'valganciclovir', 'zidovudina', 'linezolida', 'tedizolida', 'sulfametoxazol', 'trimetoprima', 'sulfassalazina', 'clozapina', 'deferiprona', 'cloranfenicol', 'flucitosina'],
  photosensitizing: ['doxiciclina', 'tetraciclina', 'minociclina', 'limeciclina', 'ciprofloxacino', 'levofloxacino', 'moxifloxacino', 'norfloxacino', 'ofloxacino', 'lomefloxacino', 'esparfloxacino', 'amiodarona', 'hidroclorotiazida', 'clortalidona', 'indapamida', 'sulfametoxazol', 'sulfadiazina', 'sulfassalazina', 'isotretinoina', 'acitretina', 'tretinoina', 'voriconazol', 'clorpromazina', 'tioridazina', 'prometazina', 'piroxicam', 'cetoprofeno', 'naproxeno', 'vandetanibe', 'vemurafenibe', 'metoxaleno', 'hiperico', 'dapsona', 'furosemida'],
  mtx_high_dose: ['metotrexato'],
  mtx_toxicity_potentiator: ['ibuprofeno', 'naproxeno', 'diclofenaco', 'cetoprofeno', 'cetorolaco', 'indometacina', 'piroxicam', 'meloxicam', 'celecoxibe', 'nimesulida', 'acido acetilsalicilico', 'salsalato', 'probenecida', 'sulfametoxazol', 'trimetoprima', 'sulfassalazina', 'omeprazol', 'esomeprazol', 'pantoprazol', 'lansoprazol', 'rabeprazol', 'amoxicilina', 'piperacilina'],
  aminoglycoside: ['gentamicina', 'amicacina', 'tobramicina', 'estreptomicina', 'neomicina', 'canamicina', 'netilmicina', 'paromomicina', 'plazomicina'],
  loop_diuretic: ['furosemida', 'bumetanida', 'torasemida', 'piretanida', 'acido etacrinico'],
}

const ADD_STEMS: Record<string, string[]> = {
  serotonergic: ['tramadol', 'tapentadol', 'meperidina', 'petidina', 'metadona', 'fentanila', 'linezolida', 'azul de metileno', 'metiltionin', 'dextrometorfano', 'clomipramina', 'imipramina', 'desipramina', 'nortriptilina', 'trimipramina', 'protriptilina', 'milnaciprano', 'levomilnaciprano', 'vortioxetina', 'vilazodona', 'dextroanfetamina', 'triptofano', 'zolmitriptana', 'rizatriptana', 'naratriptana', 'lasmiditana', 'selegilina', 'rasagilina', 'safinamida', 'fenelzina', 'tranilcipromina', 'isocarboxazida', 'reboxetina', 'amoxapina', 'ergotamina', 'di-hidroergotamina'],
  cns_depressant: ['tapentadol', 'buprenorfina', 'butorfanol', 'sufentanila', 'alfentanila', 'remifentanila', 'hidromorfona', 'di-hidrocodeina', 'triazolam', 'clobazam', 'clorazepico', 'flurazepam', 'bromazepam', 'tizanidina', 'carisoprodol', 'orfenadrina', 'metocarbamol', 'fenobarbital', 'pentobarbital', 'secobarbital', 'amobarbital', 'butalbital', 'propofol', 'tiopental', 'cetamina', 'dexmedetomidina', 'suvorexanto', 'lemborexante', 'ramelteona', 'tasimelteona', 'hidroxizina', 'clorpromazina', 'levomepromazina', 'gabapentina', 'etanol', 'clonidina', 'guanfacina', 'mirtazapina', 'trazodona', 'difenidramina', 'doxilamina', 'clorfeniramina', 'hidrato de cloral', 'dextrometorfano'],
  anticholinergic: ['clorpromazina', 'levomepromazina', 'prometazina', 'clozapina', 'olanzapina', 'quetiapina', 'clomipramina', 'imipramina', 'desipramina', 'nortriptilina', 'trimipramina', 'protriptilina', 'maprotilina', 'amoxapina', 'doxepina', 'clorfeniramina', 'clemastina', 'hidroxizina', 'ciproeptadina', 'meclizina', 'dimenidrinato', 'escopolamina', 'butilescopolamina', 'atropina', 'oxibutinina', 'tolterodina', 'solifenacina', 'darifenacina', 'fesoterodina', 'trospio', 'ipratropio', 'tiotropio', 'aclidinio', 'umeclidinio', 'biperideno', 'triexifenidil', 'tropicamida', 'propantelina', 'diciclomina', 'orfenadrina', 'benztropina', 'glicopirronio', 'flavoxato'],
  qt_prolong: ['sunitinibe', 'sorafenibe', 'lapatinibe', 'ribociclibe', 'crizotinibe', 'ceritinibe', 'encorafenibe', 'glasdegibe', 'oxaliplatina', 'donepezila', 'levomepromazina', 'amissulprida'],
  bradycardic: ['ceritinibe', 'crizotinibe', 'lacosamida', 'ticagrelor', 'dexmedetomidina'],
  hyperkalemia: ['ibuprofeno', 'naproxeno', 'diclofenaco', 'indometacina', 'cetorolaco', 'celecoxibe', 'meloxicam', 'piroxicam', 'nimesulida', 'pentamidina', 'succinilcolina', 'canrenona'],
  nephrotoxic: ['aciclovir', 'ganciclovir', 'valganciclovir', 'tenofovir', 'colistimetato', 'colistina', 'polimixina', 'pentamidina', 'zoledronico', 'pamidronato', 'deferasirox', 'ifosfamida', 'pemetrexede', 'litio'],
  cyp3a4_inhibitor: ['dronedarona', 'imatinibe', 'fluvoxamina', 'grapefruit', 'toranja', 'boceprevir', 'telaprevir', 'conivaptana'],
  cyp3a4_substrate_nti: ['nimodipino', 'felodipino', 'nisoldipino', 'dronedarona', 'ticagrelor', 'vincristina', 'everolimo', 'sirolimo', 'tansulosina', 'domperidona', 'ergonovina', 'metilergometrina', 'salmeterol', 'ivabradina', 'naloxegol', 'cabazitaxel', 'darolutamida'],
  cyp3a4_inducer: ['hiperico', 'erva de sao joao', 'dexametasona', 'lumacaftor', 'lorlatinibe', 'dabrafenibe'],
  bleeding: ['fondaparinux', 'betrixabana', 'edoxabana', 'alteplase', 'tenecteplase', 'reteplase', 'estreptoquinase', 'uroquinase', 'defibrotida'],
  hypoglycemia: ['tirzepatida', 'albiglutida'],
  statin: ['pitavastatina'],
}

for (const [t, s] of Object.entries(ADD_STEMS)) TAGS[t] = Array.from(new Set([...(TAGS[t] || []), ...s]))
for (const [t, s] of Object.entries(NEW_TAGS)) TAGS[t] = Array.from(new Set([...(TAGS[t] || []), ...s]))

const EXTRA_RULES: Rule[] = [
  { a: 'maoi', b: 'sympathomimetic', hit: {
    mechanism: 'O IMAO impede a degradação de aminas simpaticomiméticas, com liberação/acúmulo de noradrenalina nas terminações adrenérgicas.',
    clinicalEffect: 'Crise hipertensiva grave, cefaleia, hiperpirexia, arritmias e risco de AVC hemorrágico.',
    management: 'Associação contraindicada. Evitar descongestionantes (pseudoefedrina/efedrina/fenilefrina), anorexígenos e estimulantes durante o uso de IMAO e por 14 dias após. Orientar leitura de rótulos de medicamentos isentos de prescrição.',
    severityFloor: 'contraindicated' } },
  { a: 'seizure_threshold', b: 'seizure_threshold', hit: {
    mechanism: 'Redução aditiva do limiar convulsivante (somatório de agentes pró-convulsivantes).',
    clinicalEffect: 'Risco aumentado de convulsões, sobretudo em epilépticos, idosos, insuficiência renal/hepática, abstinência alcoólica e doses altas.',
    management: 'Evitar a associação quando possível; usar a menor dose eficaz, evitar escalonamento rápido e corrigir fatores precipitantes. Atenção especial a tramadol/bupropiona com quinolonas, antipsicóticos ou teofilina.',
    severityFloor: 'major' } },
  { a: 'dopamine_blocker', b: 'dopamine_blocker', hit: {
    mechanism: 'Bloqueio dopaminérgico D2 aditivo nas vias nigroestriatal e tuberoinfundibular.',
    clinicalEffect: 'Aumento de sintomas extrapiramidais (distonia, parkinsonismo, acatisia, discinesia tardia), maior risco de síndrome neuroléptica maligna e de hiperprolactinemia.',
    management: 'Evitar associar antipsicótico a antiemético dopaminérgico (metoclopramida/bromoprida/proclorperazina/prometazina). Se inevitável, usar menor dose e duração, monitorar EPS e sinais de SNM (febre, rigidez, alteração de consciência, CK elevada); preferir antiemético alternativo (ondansetrona).',
    severityFloor: 'major' } },
  { a: 'dopamine_blocker', b: 'dopaminergic', hit: {
    mechanism: 'Antagonismo farmacodinâmico: o bloqueador D2 contrapõe o efeito do agonista/precursor dopaminérgico nos receptores estriatais.',
    clinicalEffect: 'Redução da eficácia antiparkinsoniana (piora de rigidez, bradicinesia, tremor) e, em idosos, parkinsonismo farmacológico.',
    management: 'Evitar antipsicóticos típicos e metoclopramida/bromoprida em parkinsonianos. Se necessário antipsicótico, preferir quetiapina/clozapina; para náusea, preferir domperidona/ondansetrona em vez de metoclopramida.',
    severityFloor: 'moderate' } },
  { a: 'sympathomimetic', b: 'sympathomimetic', hit: {
    mechanism: 'Estimulação adrenérgica aditiva (alfa e beta) por somatório de aminas simpaticomiméticas.',
    clinicalEffect: 'Hipertensão, taquicardia, arritmias, agitação e maior risco cardiovascular.',
    management: 'Evitar associar descongestionantes a anorexígenos/estimulantes. Cautela em hipertensos, coronariopatas e hipertireóideos; monitorar PA e FC; limitar a períodos curtos.',
    severityFloor: 'moderate' } },
  { a: 'potassium_wasting', b: 'digoxin', hit: {
    mechanism: 'Diuréticos de alça/tiazídicos, corticoides, anfotericina B e beta-2 agonistas espoliam potássio e magnésio; a hipocalemia aumenta a ligação da digoxina à Na⁺/K⁺-ATPase miocárdica.',
    clinicalEffect: 'Toxicidade digitálica mesmo com digoxinemia "normal": náuseas, distúrbios visuais e arritmias (extrassístoles, bloqueio AV, taquiarritmias), com risco de arritmia fatal.',
    management: 'Monitorar K⁺ e Mg²⁺ séricos e corrigir a hipocalemia/hipomagnesemia; vigiar sinais de intoxicação digitálica e ECG; reavaliar dose/nível de digoxina.',
    severityFloor: 'major' } },
  { a: 'potassium_wasting', b: 'qt_prolong', hit: {
    mechanism: 'A hipocalemia/hipomagnesemia induzida por espoliadores de potássio prolonga a repolarização ventricular (reduz a corrente IKr) e sensibiliza o miocárdio ao efeito QT de fármacos pró-arrítmicos.',
    clinicalEffect: 'Prolongamento aditivo do QTc e risco aumentado de torsades de pointes, sobretudo com diuréticos em altas doses.',
    management: 'Corrigir e manter K⁺ > 4,0 mEq/L e Mg²⁺ normal antes/durante a associação; monitorar ECG (QTc) nos de maior risco; revisar demais fármacos QT.',
    severityFloor: 'major' } },
  { a: 'hypoglycemia_masking', b: 'hypoglycemia', hit: {
    mechanism: 'O betabloqueio atenua a resposta adrenérgica de alerta à hipoglicemia (taquicardia, tremor, palpitações) e pode retardar a recuperação glicêmica, enquanto insulina/secretagogos reduzem a glicemia.',
    clinicalEffect: 'Hipoglicemia despercebida ("hypoglycemia unawareness") e potencialmente prolongada; a sudorese pode ser o único sinal residual.',
    management: 'Preferir betabloqueador cardiosseletivo quando indicado; reforçar automonitorização glicêmica e orientar sobre sintomas atípicos; ajustar dose de insulina/sulfonilureia. Risco relevante com insulina/secretagogos, não com metformina/GLP-1 isolados.',
    severityFloor: 'moderate' } },
  { a: 'lithium_clearance_reducer', b: 'lithium', hit: {
    mechanism: 'Redução da depuração renal do lítio: AINE (queda de prostaglandinas e do fluxo renal), IECA/BRA (queda da TFG e da natriurese) e tiazídicos (depleção de volume com aumento da reabsorção proximal de lítio).',
    clinicalEffect: 'Elevação da litemia com risco de intoxicação (tremor grosseiro, ataxia, disartria, vômitos, sonolência, confusão, convulsões e arritmias nos casos graves).',
    management: 'Evitar a associação quando possível. Se inevitável, reduzir a dose de lítio (25–50%), dosar a litemia em 5–7 dias e após mudanças, manter hidratação/sódio adequados e orientar sinais de toxicidade. Preferir analgésico não-AINE (paracetamol).',
    severityFloor: 'major' } },
  { a: 'cyp2c9_inhibitor', b: 'cyp2c9_substrate_nti', hit: {
    mechanism: 'Inibição do CYP2C9 reduz o metabolismo da varfarina (S-enantiômero) e da fenitoína, ambas de janela terapêutica estreita.',
    clinicalEffect: 'Aumento do efeito anticoagulante (elevação do INR, risco hemorrágico) ou da exposição à fenitoína (nistagmo, ataxia, sedação, toxicidade).',
    management: 'Monitorar INR mais frequentemente e ajustar a dose de varfarina; dosar níveis de fenitoína. Antecipar a interação ao iniciar/suspender o inibidor (ex.: cursos de fluconazol/metronidazol/sulfametoxazol).',
    severityFloor: 'major' } },
  { a: 'cyp2c19_inhibitor', b: 'cyp2c19_substrate_prodrug', hit: {
    mechanism: 'Inibição do CYP2C19 reduz a conversão do clopidogrel em seu metabólito ativo.',
    clinicalEffect: 'Diminuição da inibição plaquetária e maior risco de eventos aterotrombóticos (trombose de stent, IAM).',
    management: 'Evitar omeprazol/esomeprazol com clopidogrel; se necessário IBP, preferir pantoprazol. Considerar antiagregante alternativo (prasugrel/ticagrelor) quando indicado.',
    severityFloor: 'major' } },
  { a: 'pgp_inhibitor', b: 'pgp_substrate_nti', hit: {
    mechanism: 'Inibição da glicoproteína-P reduz o efluxo intestinal/biliar/renal do substrato, aumentando sua absorção e exposição.',
    clinicalEffect: 'Acúmulo do substrato com toxicidade: intoxicação digitálica com digoxina/digitoxina; risco hemorrágico aumentado com dabigatrana/edoxabana.',
    management: 'Monitorar digoxinemia e sinais de toxicidade; reduzir a dose de digoxina (~30–50%) ao associar inibidor potente. Para dabigatrana/edoxabana, reduzir dose ou evitar conforme função renal e o inibidor específico.',
    severityFloor: 'major' } },
  { a: 'cyp2d6_inhibitor', b: 'cyp2d6_substrate_toxicity', hit: {
    mechanism: 'Inibição do CYP2D6 reduz o metabolismo (inativante) do substrato, elevando sua exposição sistêmica.',
    clinicalEffect: 'Aumento dos níveis e da toxicidade do substrato: bradicardia/hipotensão com metoprolol; efeitos extrapiramidais com risperidona/haloperidol; cardiotoxicidade com tricíclicos/flecainida.',
    management: 'Monitorar resposta clínica e efeitos adversos; reduzir a dose do substrato ou preferir agente sem dependência de CYP2D6 (ex.: betabloqueador hidrofílico como atenolol/bisoprolol).',
    severityFloor: 'moderate' } },
  { a: 'cyp2d6_inhibitor', b: 'cyp2d6_substrate_prodrug', hit: {
    mechanism: 'Inibição do CYP2D6 bloqueia a bioativação do pró-fármaco (codeína→morfina; tramadol→O-desmetiltramadol; tamoxifeno→endoxifeno).',
    clinicalEffect: 'Perda de eficácia: analgesia inadequada com codeína/tramadol; redução do efeito antiestrogênico do tamoxifeno (potencial impacto oncológico).',
    management: 'Para dor, usar analgésico não dependente de CYP2D6 (ex.: morfina). Em tamoxifeno, evitar inibidores potentes (fluoxetina, paroxetina, bupropiona); preferir citalopram/escitalopram ou venlafaxina.',
    severityFloor: 'moderate' } },
  { a: 'polyvalent_cation', b: 'chelatable_drug', hit: {
    mechanism: 'Cátions polivalentes (Ca²⁺, Mg²⁺, Al³⁺, Fe²⁺/³⁺, Zn²⁺) formam complexos insolúveis não absorvíveis no TGI; sequestrantes (colestiramina/sucralfato/sevelâmer) reduzem a absorção por adsorção.',
    clinicalEffect: 'Redução acentuada da absorção e da eficácia do fármaco-alvo (falha de antibioticoterapia; hipotireoidismo por levotiroxina subdosada; menor eficácia de bifosfonatos/inibidores de integrase).',
    management: 'Separar a administração: tomar o fármaco quelável 2 h antes ou 4–6 h após o cátion/sequestrante. Para levotiroxina e bifosfonatos, manter jejum e o intervalo recomendado.',
    severityFloor: 'moderate' } },
  { a: 'myelosuppressive', b: 'myelosuppressive', hit: {
    mechanism: 'Mielossupressão aditiva: supressão somada da hematopoese (linhagens mieloide, eritroide e megacariocítica).',
    clinicalEffect: 'Neutropenia/leucopenia, anemia e plaquetopenia somadas, com risco de infecção grave, sangramento e, em casos extremos, pancitopenia/agranulocitose.',
    management: 'Hemograma seriado; orientar sinais de infecção/febre e sangramento; ajustar dose ou espaçar ciclos. Cautela máxima com metotrexato + cotrimoxazol/linezolida e com clozapina (agranulocitose).',
    severityFloor: 'major' } },
  { a: 'mtx_toxicity_potentiator', b: 'mtx_high_dose', hit: {
    mechanism: 'Aumento da toxicidade do metotrexato por redução da depuração renal: competição pela secreção tubular (AINEs, salicilatos, probenecida), redução do fluxo renal (AINEs), competição por transportadores (IBP) e efeito antifólico aditivo (cotrimoxazol).',
    clinicalEffect: 'Acúmulo de MTX com mucosite/estomatite, mielossupressão, hepato e nefrotoxicidade; risco potencialmente fatal, inclusive em baixa dose semanal.',
    management: 'Evitar AINEs/salicilatos e cotrimoxazol durante o MTX; suspender IBP/probenecida no periciclo de alta dose; monitorar função renal, hemograma e níveis séricos; garantir hidratação/alcalinização e resgate com folinato conforme protocolo.',
    severityFloor: 'major' } },
  { a: 'aminoglycoside', b: 'loop_diuretic', hit: {
    mechanism: 'Ototoxicidade aditiva: o aminoglicosídeo lesa células ciliadas cócleo-vestibulares e o diurético de alça altera a homeostase iônica da estria vascular; a depleção volêmica agrava a nefrotoxicidade.',
    clinicalEffect: 'Ototoxicidade frequentemente irreversível (hipoacusia, zumbido, vertigem) e maior risco de lesão renal aguda.',
    management: 'Evitar a associação; se imprescindível, menor dose/duração, manter euvolemia, infundir o diurético lentamente, monitorar função renal e níveis do aminoglicosídeo e avaliar audiometria em uso prolongado.',
    severityFloor: 'major' } },
  { a: 'photosensitizing', b: 'photosensitizing', hit: {
    mechanism: 'Fotossensibilidade aditiva: potenciais fototóxico e/ou fotoalérgico somados ante exposição a UV/luz solar.',
    clinicalEffect: 'Reações cutâneas exageradas à exposição solar (eritema tipo queimadura, bolhas, hiperpigmentação).',
    management: 'Orientar fotoproteção rigorosa (FPS alto, roupas, evitar pico solar) durante e até alguns dias após o tratamento.',
    severityFloor: 'minor' } },
]

RULES.push(...EXTRA_RULES)

// ── Amplificação 2 (interações enzimáticas/metabólicas clássicas; verificada por
// 2 lentes adversariais; regra IMAO×serotoninérgico descartada por super-escalar). ──
const NEW_TAGS_2: Record<string, string[]> = {
  cyp1a2_inhibitor: ['fluvoxamina', 'ciprofloxacino', 'enoxacino', 'cimetidina', 'vemurafenibe'],
  cyp1a2_substrate_nti: ['teofilina', 'aminofilina', 'tizanidina', 'clozapina', 'ramelteona', 'pirfenidona'],
  xo_inhibitor: ['alopurinol', 'febuxostate'],
  thiopurine: ['azatioprina', 'mercaptopurina'],
  ugt_valproate: ['valproato', 'acido valproico'],
  lamotrigine: ['lamotrigina'],
  sulfonylurea_2c9: ['glibenclamida', 'glimepirida', 'glipizida', 'gliclazida', 'tolbutamida', 'clorpropamida'],
}
for (const [t, s] of Object.entries(NEW_TAGS_2)) TAGS[t] = Array.from(new Set([...(TAGS[t] || []), ...s]))

const EXTRA_RULES_2: Rule[] = [
  { a: 'xo_inhibitor', b: 'thiopurine', hit: {
    mechanism: 'A inibição da xantina-oxidase (alopurinol/febuxostate) bloqueia a principal via de catabolismo da mercaptopurina/azatioprina, elevando seus níveis ativos.',
    clinicalEffect: 'Mielossupressão grave (pancitopenia), potencialmente fatal.',
    management: 'Evitar a associação. Com alopurinol, se imprescindível, reduzir a tiopurina para ~25–33% da dose e monitorar hemograma de perto; com febuxostate, a associação é contraindicada.',
    severityFloor: 'major' } },
  { a: 'cyp1a2_inhibitor', b: 'cyp1a2_substrate_nti', hit: {
    mechanism: 'Inibição do CYP1A2 reduz o metabolismo do substrato de janela terapêutica estreita.',
    clinicalEffect: 'Acúmulo do substrato com toxicidade: convulsões/arritmias por teofilina; hipotensão e sedação intensas por tizanidina; toxicidade por clozapina (sedação, convulsões).',
    management: 'Evitar a associação — tizanidina, ramelteona e pirfenidona têm contraindicação em bula com fluvoxamina/ciprofloxacino. Se inevitável, reduzir a dose do substrato e monitorar níveis/efeitos (teofilinemia, clozapinemia).',
    severityFloor: 'major' } },
  { a: 'cyp2c9_inhibitor', b: 'sulfonylurea_2c9', hit: {
    mechanism: 'Inibição do CYP2C9 reduz o metabolismo da sulfonilureia, aumentando sua exposição.',
    clinicalEffect: 'Hipoglicemia prolongada e potencialmente grave (ex.: fluconazol/sulfametoxazol + glibenclamida/glimepirida).',
    management: 'Monitorar a glicemia de perto e orientar sinais de hipoglicemia; considerar reduzir a dose da sulfonilureia durante o curso do inibidor (azol/sulfa/metronidazol).',
    severityFloor: 'major' } },
  { a: 'ugt_valproate', b: 'lamotrigine', hit: {
    mechanism: 'O valproato inibe a glicuronidação (UGT) da lamotrigina, podendo dobrar ou triplicar seus níveis séricos.',
    clinicalEffect: 'Aumento do risco de exantema grave (Stevens-Johnson/NET) e de toxicidade da lamotrigina.',
    management: 'Usar o esquema de titulação mais lento e doses-alvo menores de lamotrigina quando associada ao valproato (conforme bula); orientar busca imediata se surgir rash.',
    severityFloor: 'major' } },
]
RULES.push(...EXTRA_RULES_2)

const SEV_RANK: Record<Severity, number> = { contraindicated: 3, major: 2, moderate: 1, minor: 0 }

/**
 * Infere mecanismo/efeito/manejo ESPECÍFICOS para um par de fármacos a partir das
 * propriedades farmacológicas de cada um. Entre todas as regras que casam, retorna a de
 * MAIOR severityFloor (a ordem do array deixa de importar). Retorna null se nenhuma casar.
 */
export function inferExternalMechanism(drugA: string, drugB: string): MechanismHit | null {
  const ta = tagsOf(drugA)
  const tb = tagsOf(drugB)
  if (ta.size === 0 || tb.size === 0) return null
  let best: MechanismHit | null = null
  for (const r of RULES) {
    const match =
      (ta.has(r.a) && tb.has(r.b)) || (ta.has(r.b) && tb.has(r.a))
    if (!match) continue
    if (!best || SEV_RANK[r.hit.severityFloor] > SEV_RANK[best.severityFloor]) best = r.hit
  }
  return best
}

/** Eleva a severidade ao piso clínico da regra, sem nunca rebaixar a do DDInter. */
export function maxSeverity(ddinter: Severity, floor: Severity): Severity {
  return SEV_RANK[floor] > SEV_RANK[ddinter] ? floor : ddinter
}
