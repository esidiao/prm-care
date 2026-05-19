/**
 * PRM Care — Serviço de enriquecimento farmacológico
 *
 * Usa APIs públicas gratuitas:
 * - OpenFDA (api.fda.gov): bulas oficiais com interações, alertas, contraindicações
 * - RxNorm (rxnav.nlm.nih.gov): normalização de nomes de medicamentos (PT→EN)
 *
 * Sem chave de API. OpenFDA: 240 req/min. RxNorm: ilimitado.
 */

const OPENFDA_BASE = 'https://api.fda.gov'
const RXNORM_BASE = 'https://rxnav.nlm.nih.gov/REST'

// Cache em memória por processo (evita chamadas duplicadas na mesma análise)
const labelCache = new Map<string, DrugLabelInfo | null>()
const rxcuiCache = new Map<string, string | null>()

// Dicionário PT → EN para nomes de medicamentos comuns no Brasil
const PT_EN_MAP: Record<string, string> = {
  // Antidiabéticos
  'metformina': 'metformin',
  'glibenclamida': 'glyburide',
  'glimepirida': 'glimepiride',
  'gliclazida': 'gliclazide',
  'insulina': 'insulin',
  'sitagliptina': 'sitagliptin',
  'empagliflozina': 'empagliflozin',
  'dapagliflozina': 'dapagliflozin',
  // Estatinas
  'sinvastatina': 'simvastatin',
  'atorvastatina': 'atorvastatin',
  'rosuvastatina': 'rosuvastatin',
  'pravastatina': 'pravastatin',
  'lovastatina': 'lovastatin',
  // Anti-hipertensivos
  'losartana': 'losartan',
  'valsartana': 'valsartan',
  'candesartana': 'candesartan',
  'olmesartana': 'olmesartan',
  'amlodipina': 'amlodipine',
  'nifedipina': 'nifedipine',
  'anlodipina': 'amlodipine',
  'hidroclorotiazida': 'hydrochlorothiazide',
  'furosemida': 'furosemide',
  'espironolactona': 'spironolactone',
  'atenolol': 'atenolol',
  'propranolol': 'propranolol',
  'metoprolol': 'metoprolol',
  'carvedilol': 'carvedilol',
  'bisoprolol': 'bisoprolol',
  // ACE inhibitors
  'enalapril': 'enalapril',
  'captopril': 'captopril',
  'ramipril': 'ramipril',
  'lisinopril': 'lisinopril',
  'perindopril': 'perindopril',
  // Anticoagulantes
  'varfarina': 'warfarin',
  'warfarina': 'warfarin',
  'rivaroxabana': 'rivaroxaban',
  'apixabana': 'apixaban',
  'dabigatrana': 'dabigatran',
  'heparina': 'heparin',
  'enoxaparina': 'enoxaparin',
  // Antiagregantes
  'clopidogrel': 'clopidogrel',
  'aspirina': 'aspirin',
  // Antibióticos
  'amoxicilina': 'amoxicillin',
  'claritromicina': 'clarithromycin',
  'azitromicina': 'azithromycin',
  'ciprofloxacino': 'ciprofloxacin',
  'levofloxacino': 'levofloxacin',
  'metronidazol': 'metronidazole',
  'cefalexina': 'cephalexin',
  'sulfametoxazol': 'sulfamethoxazole',
  'trimetoprima': 'trimethoprim',
  'nitrofurantoína': 'nitrofurantoin',
  // Antifúngicos
  'fluconazol': 'fluconazole',
  'itraconazol': 'itraconazole',
  'cetoconazol': 'ketoconazole',
  // Anti-inflamatórios
  'ibuprofeno': 'ibuprofen',
  'naproxeno': 'naproxen',
  'diclofenaco': 'diclofenac',
  'celecoxibe': 'celecoxib',
  'indometacina': 'indomethacin',
  'meloxicam': 'meloxicam',
  'piroxicam': 'piroxicam',
  // Analgésicos
  'paracetamol': 'acetaminophen',
  'tramadol': 'tramadol',
  'codeína': 'codeine',
  'morfina': 'morphine',
  // Psiquiátricos
  'sertralina': 'sertraline',
  'fluoxetina': 'fluoxetine',
  'escitalopram': 'escitalopram',
  'citalopram': 'citalopram',
  'venlafaxina': 'venlafaxine',
  'duloxetina': 'duloxetine',
  'bupropiona': 'bupropion',
  'amitriptilina': 'amitriptyline',
  'nortriptilina': 'nortriptyline',
  'haloperidol': 'haloperidol',
  'risperidona': 'risperidone',
  'quetiapina': 'quetiapine',
  'olanzapina': 'olanzapine',
  'clozapina': 'clozapine',
  'alprazolam': 'alprazolam',
  'clonazepam': 'clonazepam',
  'diazepam': 'diazepam',
  'lorazepam': 'lorazepam',
  'zolpidem': 'zolpidem',
  'carbonato de lítio': 'lithium',
  'lítio': 'lithium',
  // Anticonvulsivantes
  'fenitoína': 'phenytoin',
  'carbamazepina': 'carbamazepine',
  'ácido valpróico': 'valproic acid',
  'valproato': 'valproic acid',
  'lamotrigina': 'lamotrigine',
  'levetiracetam': 'levetiracetam',
  'gabapentina': 'gabapentin',
  'pregabalina': 'pregabalin',
  'topiramato': 'topiramate',
  // Cardiovascular
  'digoxina': 'digoxin',
  'amiodarona': 'amiodarone',
  'nitroglicerina': 'nitroglycerin',
  'isossorbida': 'isosorbide',
  // Endócrino
  'levotiroxina': 'levothyroxine',
  'metimazol': 'methimazole',
  'propiltiouracil': 'propylthiouracil',
  'prednisolona': 'prednisolone',
  'prednisona': 'prednisone',
  'dexametasona': 'dexamethasone',
  'hidrocortisona': 'hydrocortisone',
  // Respiratório
  'salbutamol': 'albuterol',
  'budesonida': 'budesonide',
  'formoterol': 'formoterol',
  'salmeterol': 'salmeterol',
  'tiotrópio': 'tiotropium',
  'ipratrópio': 'ipratropium',
  'montelucaste': 'montelukast',
  // Gastrointestinal
  'omeprazol': 'omeprazole',
  'pantoprazol': 'pantoprazole',
  'esomeprazol': 'esomeprazole',
  'lansoprazol': 'lansoprazole',
  'ranitidina': 'ranitidine',
  'domperidona': 'domperidone',
  'metoclopramida': 'metoclopramide',
  'ondansetrona': 'ondansetron',
  'loperamida': 'loperamide',
  // Outros
  'alopurinol': 'allopurinol',
  'colchicina': 'colchicine',
  'metotrexato': 'methotrexate',
  'azatioprina': 'azathioprine',
  'ciclosporina': 'cyclosporine',
  'tacrolimo': 'tacrolimus',
  'sildenafila': 'sildenafil',
  'tadalafila': 'tadalafil',
  'donepezila': 'donepezil',
  'memantina': 'memantine',
  'ferro': 'ferrous sulfate',
  'sulfato ferroso': 'ferrous sulfate',
  'ácido fólico': 'folic acid',
  'vitamina d': 'vitamin d',
  'cálcio': 'calcium carbonate',
  'bissulfato de clopidogrel': 'clopidogrel',
}

export interface DrugLabelInfo {
  drugName: string          // nome pesquisado
  resolvedName: string      // nome em inglês resolvido
  drugInteractions: string  // texto de interações da bula FDA
  warnings: string          // avisos importantes
  contraindications: string // contraindicações
  boxedWarning: string      // alerta em caixa preta (mais grave)
  specificPopulations: string // gestantes, idosos, insuficiência renal/hepática
}

// ── Normalização de nomes ─────────────────────────────────────────────────────

function normalizeDrugName(name: string): string {
  const lower = name.toLowerCase().trim()

  // Check dictionary first
  if (PT_EN_MAP[lower]) return PT_EN_MAP[lower]

  // Try partial match (first word if compound name)
  const firstWord = lower.split(/\s+/)[0]
  if (PT_EN_MAP[firstWord]) return PT_EN_MAP[firstWord]

  // Common suffix conversions (PT → EN)
  // -ina → -ine: claritromicina → clarithromicine (not perfect but helps)
  // -ol → -ol (same): propranolol
  // -ato → -ate: sulfato → sulfate

  return lower // return as-is if no mapping found
}

// ── RxNorm: resolução de nomes ────────────────────────────────────────────────

async function resolveToEnglish(drugName: string): Promise<string> {
  const mapped = normalizeDrugName(drugName)
  if (mapped !== drugName.toLowerCase().trim()) return mapped

  // Try RxNorm approximate term for unknown names
  const cacheKey = drugName.toLowerCase().trim()
  if (rxcuiCache.has(cacheKey)) {
    return rxcuiCache.get(cacheKey) || drugName
  }

  try {
    const res = await fetch(
      `${RXNORM_BASE}/approximateTerm.json?term=${encodeURIComponent(drugName)}&maxEntries=1`,
      { signal: AbortSignal.timeout(4000) }
    )
    if (!res.ok) return drugName

    const data = await res.json()
    const candidate = data?.approximateGroup?.candidate?.[0]?.name
    if (candidate) {
      rxcuiCache.set(cacheKey, candidate.toLowerCase())
      return candidate.toLowerCase()
    }
  } catch {
    // silently fail
  }

  rxcuiCache.set(cacheKey, drugName)
  return drugName
}

// ── OpenFDA: buscar bula ──────────────────────────────────────────────────────

async function getDrugLabel(drugName: string): Promise<DrugLabelInfo | null> {
  const englishName = await resolveToEnglish(drugName)
  const cacheKey = englishName.toLowerCase()

  if (labelCache.has(cacheKey)) return labelCache.get(cacheKey) ?? null

  // Try multiple search strategies
  const searchStrategies = [
    `openfda.generic_name:"${englishName}"`,
    `openfda.substance_name:"${englishName.toUpperCase()}"`,
    `openfda.generic_name:${englishName.split(' ')[0]}`,
  ]

  for (const search of searchStrategies) {
    try {
      const url = `${OPENFDA_BASE}/drug/label.json?search=${encodeURIComponent(search)}&limit=1`
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) })

      if (!res.ok) continue
      const data = await res.json()
      if (!data.results?.length) continue

      const label = data.results[0]

      const info: DrugLabelInfo = {
        drugName,
        resolvedName: englishName,
        drugInteractions: truncate(label.drug_interactions?.[0] || '', 1200),
        warnings: truncate(label.warnings_and_cautions?.[0] || label.warnings?.[0] || '', 600),
        contraindications: truncate(label.contraindications?.[0] || '', 500),
        boxedWarning: truncate(label.boxed_warning?.[0] || '', 400),
        specificPopulations: truncate(
          [
            label.pregnancy?.[0],
            label.geriatric_use?.[0],
            label.renal_impairment?.[0],
            label.hepatic_impairment?.[0],
          ].filter(Boolean).join(' | '),
          600
        ),
      }

      labelCache.set(cacheKey, info)
      return info
    } catch {
      continue
    }
  }

  labelCache.set(cacheKey, null)
  return null
}

function truncate(text: string, maxLen: number): string {
  if (!text || text.length <= maxLen) return text
  return text.substring(0, maxLen) + '...'
}

// ── Verificação direta de interações ─────────────────────────────────────────

export interface DirectInteraction {
  drugA: string
  drugB: string
  context: string  // trecho do texto onde a interação é mencionada
  source: 'FDA_LABEL'
}

function findMentions(text: string, targetName: string, windowChars = 300): string | null {
  if (!text || !targetName) return null
  const normalized = text.toLowerCase()
  const target = targetName.toLowerCase()

  // Try exact match and common variations
  const variations = [
    target,
    target.replace(/in$/, 'ina'),    // simvastatin → sinvastatina
    target.replace(/ine$/, 'ina'),   // clarithromycine → claritromicina
    target.split(' ')[0],            // first word only
  ]

  for (const variant of variations) {
    if (variant.length < 4) continue
    const idx = normalized.indexOf(variant)
    if (idx >= 0) {
      const start = Math.max(0, idx - 100)
      const end = Math.min(text.length, idx + windowChars)
      return text.substring(start, end).trim()
    }
  }

  return null
}

export async function checkDirectInteractions(drugNames: string[]): Promise<DirectInteraction[]> {
  if (drugNames.length < 2) return []

  const interactions: DirectInteraction[] = []
  const seen = new Set<string>()

  // Fetch labels in parallel
  const labels = await Promise.all(
    drugNames.map(name => getDrugLabel(name).catch(() => null))
  )

  // Cross-check each drug's interaction text against other drugs
  for (let i = 0; i < drugNames.length; i++) {
    const labelA = labels[i]
    if (!labelA?.drugInteractions) continue

    for (let j = 0; j < drugNames.length; j++) {
      if (i === j) continue

      const drugB = drugNames[j]
      const englishB = normalizeDrugName(drugB)
      const pairKey = [Math.min(i, j), Math.max(i, j)].join('-')

      if (seen.has(pairKey)) continue
      seen.add(pairKey)

      // Check if drug B is mentioned in drug A's interaction text
      const context = findMentions(labelA.drugInteractions, englishB) ||
                      findMentions(labelA.drugInteractions, drugB)

      if (context) {
        interactions.push({
          drugA: drugNames[i],
          drugB,
          context,
          source: 'FDA_LABEL',
        })
      }
    }
  }

  return interactions
}

// ── API principal: enriquecer análise ─────────────────────────────────────────

export interface FDAEnrichmentResult {
  labels: Map<string, DrugLabelInfo>
  directInteractions: DirectInteraction[]
  fdaContextSummary: string  // texto resumido para inserir no prompt do Groq
}

export async function enrichWithFDA(drugNames: string[]): Promise<FDAEnrichmentResult> {
  if (drugNames.length === 0) {
    return { labels: new Map(), directInteractions: [], fdaContextSummary: '' }
  }

  // Run label fetches and direct interaction check in parallel
  const [labelsArray, directInteractions] = await Promise.all([
    Promise.all(drugNames.map(name => getDrugLabel(name).catch(() => null))),
    checkDirectInteractions(drugNames).catch(() => [] as DirectInteraction[]),
  ])

  const labels = new Map<string, DrugLabelInfo>()
  labelsArray.forEach((label, i) => {
    if (label) labels.set(drugNames[i], label)
  })

  // Build context summary for the AI prompt
  const parts: string[] = []

  // Direct interactions found
  if (directInteractions.length > 0) {
    parts.push('=== INTERAÇÕES ENCONTRADAS NAS BULAS FDA ===')
    for (const inter of directInteractions) {
      parts.push(
        `⚠️ ${inter.drugA.toUpperCase()} × ${inter.drugB.toUpperCase()} [Fonte: Bula FDA]\n` +
        `Contexto: "${inter.context.replace(/\s+/g, ' ').substring(0, 300)}"`
      )
    }
  }

  // Label data per drug
  const labelParts: string[] = []
  for (const [name, info] of Array.from(labels.entries())) {
    const sections: string[] = []
    if (info.boxedWarning) sections.push(`⬛ ALERTA CAIXA PRETA: ${info.boxedWarning}`)
    if (info.contraindications) sections.push(`Contraindicações: ${info.contraindications}`)
    if (info.drugInteractions) sections.push(`Interações (FDA): ${info.drugInteractions}`)
    if (info.specificPopulations) sections.push(`Populações especiais: ${info.specificPopulations}`)

    if (sections.length > 0) {
      labelParts.push(`--- ${name.toUpperCase()} (${info.resolvedName}) ---\n${sections.join('\n')}`)
    }
  }

  if (labelParts.length > 0) {
    parts.push('\n=== DADOS DAS BULAS OFICIAIS FDA ===')
    parts.push(...labelParts)
  }

  return {
    labels,
    directInteractions,
    fdaContextSummary: parts.join('\n\n'),
  }
}
