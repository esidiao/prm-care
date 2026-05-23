// Common ICD-10 codes used in Brazilian clinical pharmacotherapy practice
// Subset curated for relevance in pharmaceutical follow-up (Método Dáder)

export interface ICD10Entry {
  code: string
  description: string
  category?: string
}

export const ICD10_DATA: ICD10Entry[] = [
  // Cardiovascular
  { code: 'I10', description: 'Hipertensão essencial (primária)', category: 'Cardiovascular' },
  { code: 'I11', description: 'Doença cardíaca hipertensiva', category: 'Cardiovascular' },
  { code: 'I11.0', description: 'Doença cardíaca hipertensiva com insuficiência cardíaca', category: 'Cardiovascular' },
  { code: 'I20', description: 'Angina pectoris', category: 'Cardiovascular' },
  { code: 'I20.0', description: 'Angina instável', category: 'Cardiovascular' },
  { code: 'I21', description: 'Infarto agudo do miocárdio', category: 'Cardiovascular' },
  { code: 'I25', description: 'Doença isquêmica crônica do coração', category: 'Cardiovascular' },
  { code: 'I25.1', description: 'Doença aterosclerótica do coração', category: 'Cardiovascular' },
  { code: 'I48', description: 'Fibrilação e flutter atrial', category: 'Cardiovascular' },
  { code: 'I48.0', description: 'Fibrilação atrial paroxística', category: 'Cardiovascular' },
  { code: 'I48.2', description: 'Fibrilação atrial crônica', category: 'Cardiovascular' },
  { code: 'I50', description: 'Insuficiência cardíaca', category: 'Cardiovascular' },
  { code: 'I50.0', description: 'Insuficiência cardíaca congestiva', category: 'Cardiovascular' },
  { code: 'I50.1', description: 'Insuficiência ventricular esquerda', category: 'Cardiovascular' },
  { code: 'I63', description: 'Infarto cerebral (AVC isquêmico)', category: 'Cardiovascular' },
  { code: 'I64', description: 'Acidente vascular cerebral (AVC), não especificado como hemorrágico ou isquêmico', category: 'Cardiovascular' },
  { code: 'I70', description: 'Aterosclerose', category: 'Cardiovascular' },
  { code: 'I73.0', description: 'Síndrome de Raynaud', category: 'Cardiovascular' },
  { code: 'I80', description: 'Flebite e tromboflebite', category: 'Cardiovascular' },
  { code: 'I82', description: 'Trombose venosa profunda', category: 'Cardiovascular' },
  { code: 'I26', description: 'Embolia pulmonar', category: 'Cardiovascular' },

  // Endocrine / Metabolic
  { code: 'E10', description: 'Diabetes mellitus tipo 1', category: 'Endocrinologia' },
  { code: 'E11', description: 'Diabetes mellitus tipo 2', category: 'Endocrinologia' },
  { code: 'E11.0', description: 'Diabetes mellitus tipo 2 com coma', category: 'Endocrinologia' },
  { code: 'E11.2', description: 'Diabetes mellitus tipo 2 com complicações renais', category: 'Endocrinologia' },
  { code: 'E11.3', description: 'Diabetes mellitus tipo 2 com complicações oftálmicas', category: 'Endocrinologia' },
  { code: 'E11.4', description: 'Diabetes mellitus tipo 2 com complicações neurológicas', category: 'Endocrinologia' },
  { code: 'E11.5', description: 'Diabetes mellitus tipo 2 com complicações circulatórias periféricas', category: 'Endocrinologia' },
  { code: 'E78', description: 'Distúrbios do metabolismo de lipoproteínas e outras lipidemias', category: 'Endocrinologia' },
  { code: 'E78.0', description: 'Hipercolesterolemia pura', category: 'Endocrinologia' },
  { code: 'E78.1', description: 'Hipertrigliceridemia pura', category: 'Endocrinologia' },
  { code: 'E78.5', description: 'Hiperlipidemia mista', category: 'Endocrinologia' },
  { code: 'E03', description: 'Hipotireoidismo', category: 'Endocrinologia' },
  { code: 'E03.9', description: 'Hipotireoidismo não especificado', category: 'Endocrinologia' },
  { code: 'E05', description: 'Tireotoxicose (Hipertireoidismo)', category: 'Endocrinologia' },
  { code: 'E05.0', description: 'Tireotoxicose com bócio difuso (Doença de Graves)', category: 'Endocrinologia' },
  { code: 'E66', description: 'Obesidade', category: 'Endocrinologia' },
  { code: 'E66.0', description: 'Obesidade devida a excesso de calorias', category: 'Endocrinologia' },
  { code: 'E28.2', description: 'Síndrome dos ovários policísticos (SOP)', category: 'Endocrinologia' },
  { code: 'E27.1', description: 'Insuficiência adrenocortical primária (Doença de Addison)', category: 'Endocrinologia' },

  // Renal
  { code: 'N18', description: 'Doença renal crônica (DRC)', category: 'Nefrologia' },
  { code: 'N18.1', description: 'DRC estágio 1', category: 'Nefrologia' },
  { code: 'N18.2', description: 'DRC estágio 2', category: 'Nefrologia' },
  { code: 'N18.3', description: 'DRC estágio 3', category: 'Nefrologia' },
  { code: 'N18.4', description: 'DRC estágio 4', category: 'Nefrologia' },
  { code: 'N18.5', description: 'DRC estágio 5', category: 'Nefrologia' },
  { code: 'N19', description: 'Insuficiência renal não especificada', category: 'Nefrologia' },
  { code: 'N20', description: 'Cálculo do rim e ureter (nefrolitíase)', category: 'Nefrologia' },
  { code: 'N39.0', description: 'Infecção do trato urinário', category: 'Nefrologia' },

  // Respiratory
  { code: 'J44', description: 'Doença pulmonar obstrutiva crônica (DPOC)', category: 'Pneumologia' },
  { code: 'J44.0', description: 'DPOC com infecção respiratória aguda', category: 'Pneumologia' },
  { code: 'J44.1', description: 'DPOC com exacerbação aguda', category: 'Pneumologia' },
  { code: 'J45', description: 'Asma', category: 'Pneumologia' },
  { code: 'J45.0', description: 'Asma predominantemente alérgica', category: 'Pneumologia' },
  { code: 'J45.1', description: 'Asma não alérgica', category: 'Pneumologia' },
  { code: 'J18', description: 'Pneumonia', category: 'Pneumologia' },
  { code: 'J06.9', description: 'Infecção aguda das vias aéreas superiores', category: 'Pneumologia' },

  // Neurological / Psychiatric
  { code: 'G20', description: 'Doença de Parkinson', category: 'Neurologia' },
  { code: 'G30', description: 'Doença de Alzheimer', category: 'Neurologia' },
  { code: 'G30.0', description: 'Doença de Alzheimer de início precoce', category: 'Neurologia' },
  { code: 'G30.1', description: 'Doença de Alzheimer de início tardio', category: 'Neurologia' },
  { code: 'G40', description: 'Epilepsia', category: 'Neurologia' },
  { code: 'G43', description: 'Enxaqueca (migrânea)', category: 'Neurologia' },
  { code: 'G35', description: 'Esclerose múltipla', category: 'Neurologia' },
  { code: 'F32', description: 'Episódios depressivos', category: 'Psiquiatria' },
  { code: 'F32.0', description: 'Episódio depressivo leve', category: 'Psiquiatria' },
  { code: 'F32.1', description: 'Episódio depressivo moderado', category: 'Psiquiatria' },
  { code: 'F32.2', description: 'Episódio depressivo grave sem sintomas psicóticos', category: 'Psiquiatria' },
  { code: 'F33', description: 'Transtorno depressivo recorrente', category: 'Psiquiatria' },
  { code: 'F41', description: 'Outros transtornos ansiosos', category: 'Psiquiatria' },
  { code: 'F41.0', description: 'Transtorno de pânico', category: 'Psiquiatria' },
  { code: 'F41.1', description: 'Ansiedade generalizada', category: 'Psiquiatria' },
  { code: 'F20', description: 'Esquizofrenia', category: 'Psiquiatria' },
  { code: 'F31', description: 'Transtorno afetivo bipolar', category: 'Psiquiatria' },
  { code: 'F10', description: 'Transtornos mentais devidos ao uso de álcool', category: 'Psiquiatria' },
  { code: 'F51.0', description: 'Insônia não orgânica', category: 'Psiquiatria' },
  { code: 'G47.0', description: 'Insônia', category: 'Neurologia' },

  // Musculoskeletal
  { code: 'M05', description: 'Artrite reumatoide soropositiva', category: 'Reumatologia' },
  { code: 'M06.0', description: 'Artrite reumatoide soronegativa', category: 'Reumatologia' },
  { code: 'M10', description: 'Gota', category: 'Reumatologia' },
  { code: 'M15', description: 'Poliartrose', category: 'Reumatologia' },
  { code: 'M16', description: 'Coxartrose (artrose do quadril)', category: 'Reumatologia' },
  { code: 'M17', description: 'Gonartrose (artrose do joelho)', category: 'Reumatologia' },
  { code: 'M19.9', description: 'Artrose não especificada', category: 'Reumatologia' },
  { code: 'M32', description: 'Lúpus eritematoso sistêmico (LES)', category: 'Reumatologia' },
  { code: 'M54.5', description: 'Lombalgia (dor lombar)', category: 'Reumatologia' },
  { code: 'M79.7', description: 'Fibromialgia', category: 'Reumatologia' },
  { code: 'M80', description: 'Osteoporose com fratura patológica', category: 'Reumatologia' },
  { code: 'M81', description: 'Osteoporose sem fratura patológica', category: 'Reumatologia' },
  { code: 'M81.0', description: 'Osteoporose pós-menopausa', category: 'Reumatologia' },

  // Gastroenterology
  { code: 'K21', description: 'Doença de refluxo gastroesofágico (DRGE)', category: 'Gastroenterologia' },
  { code: 'K21.0', description: 'DRGE com esofagite', category: 'Gastroenterologia' },
  { code: 'K25', description: 'Úlcera gástrica', category: 'Gastroenterologia' },
  { code: 'K26', description: 'Úlcera duodenal', category: 'Gastroenterologia' },
  { code: 'K58', description: 'Síndrome do intestino irritável (SII)', category: 'Gastroenterologia' },
  { code: 'K70', description: 'Doença alcoólica do fígado', category: 'Gastroenterologia' },
  { code: 'K74', description: 'Fibrose e cirrose hepática', category: 'Gastroenterologia' },
  { code: 'K76.0', description: 'Doença hepática gordurosa não alcoólica (DHGNA/NAFLD)', category: 'Gastroenterologia' },
  { code: 'K80', description: 'Colelitíase (cálculo biliar)', category: 'Gastroenterologia' },
  { code: 'K57', description: 'Doença diverticular do intestino', category: 'Gastroenterologia' },
  { code: 'K50', description: 'Doença de Crohn', category: 'Gastroenterologia' },
  { code: 'K51', description: 'Retocolite ulcerativa', category: 'Gastroenterologia' },

  // Oncology
  { code: 'C18', description: 'Neoplasia maligna do cólon', category: 'Oncologia' },
  { code: 'C34', description: 'Neoplasia maligna dos brônquios e pulmões', category: 'Oncologia' },
  { code: 'C50', description: 'Neoplasia maligna da mama', category: 'Oncologia' },
  { code: 'C61', description: 'Neoplasia maligna da próstata', category: 'Oncologia' },
  { code: 'C67', description: 'Neoplasia maligna da bexiga', category: 'Oncologia' },
  { code: 'C73', description: 'Neoplasia maligna da tireoide', category: 'Oncologia' },
  { code: 'C91', description: 'Leucemia linfocítica', category: 'Oncologia' },
  { code: 'C92', description: 'Leucemia mieloide', category: 'Oncologia' },

  // Hematology
  { code: 'D50', description: 'Anemia ferropriva', category: 'Hematologia' },
  { code: 'D51', description: 'Anemia por deficiência de vitamina B12', category: 'Hematologia' },
  { code: 'D52', description: 'Anemia por deficiência de folato', category: 'Hematologia' },
  { code: 'D57', description: 'Anemia falciforme', category: 'Hematologia' },
  { code: 'D64', description: 'Outras anemias', category: 'Hematologia' },
  { code: 'D69.3', description: 'Púrpura trombocitopênica idiopática (PTI)', category: 'Hematologia' },

  // Ophthalmology
  { code: 'H25', description: 'Catarata senil', category: 'Oftalmologia' },
  { code: 'H40', description: 'Glaucoma', category: 'Oftalmologia' },
  { code: 'H35.3', description: 'Degeneração macular relacionada à idade (DMRI)', category: 'Oftalmologia' },

  // Dermatology
  { code: 'L40', description: 'Psoríase', category: 'Dermatologia' },
  { code: 'L20', description: 'Dermatite atópica', category: 'Dermatologia' },
  { code: 'L50', description: 'Urticária', category: 'Dermatologia' },

  // Infectious
  { code: 'B20', description: 'Doença por HIV resultando em doenças infecciosas e parasitárias', category: 'Infectologia' },
  { code: 'B18', description: 'Hepatite viral crônica', category: 'Infectologia' },
  { code: 'B18.1', description: 'Hepatite B crônica sem agente delta', category: 'Infectologia' },
  { code: 'B18.2', description: 'Hepatite C crônica', category: 'Infectologia' },
  { code: 'A15', description: 'Tuberculose respiratória', category: 'Infectologia' },

  // Urology / Gynecology
  { code: 'N40', description: 'Hiperplasia benigna da próstata (HBP)', category: 'Urologia' },
  { code: 'N92', description: 'Menstruação excessiva, frequente e irregular', category: 'Ginecologia' },
  { code: 'N95.1', description: 'Menopausa e climatério feminino', category: 'Ginecologia' },
  { code: 'N94.3', description: 'Síndrome pré-menstrual', category: 'Ginecologia' },

  // Pain
  { code: 'R52', description: 'Dor não classificada em outra parte', category: 'Sintomas' },
  { code: 'G89.2', description: 'Dor crônica', category: 'Neurologia' },
  { code: 'M25.5', description: 'Dor articular', category: 'Reumatologia' },

  // Linfologia / Angiologia / Obesidade
  { code: 'E88.2', description: 'Lipedema', category: 'Endocrinologia' },
  { code: 'I89.0', description: 'Linfedema', category: 'Angiologia' },
  { code: 'E66.9', description: 'Obesidade não especificada', category: 'Endocrinologia' },
  { code: 'E78.2', description: 'Hiperlipidemia mista', category: 'Endocrinologia' },
]

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Search ICD-10 entries by code or description (case-insensitive, accent-insensitive).
 */
export function searchICD10(query: string, limit = 10): ICD10Entry[] {
  if (!query || query.length < 2) return []
  const q = norm(query.trim())
  return ICD10_DATA.filter(entry => {
    return entry.code.toLowerCase().includes(q) || norm(entry.description).includes(q)
  }).slice(0, limit)
}
