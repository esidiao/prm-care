/**
 * Farmacogenômica — base curada das principais associações gene–medicamento
 * da CPIC (Clinical Pharmacogenetics Implementation Consortium — diretrizes
 * públicas e gratuitas, cpicpgx.org). APOIO À DECISÃO: resumos das diretrizes;
 * a conduta final é do farmacêutico/prescritor, conferindo a versão vigente da
 * diretriz CPIC e o contexto do paciente. NÃO substitui aconselhamento genético.
 */

export interface PgxRecommendation { phenotype: string; action: string }
export interface PgxGuideline {
  gene: string
  drugs: string[]        // princípios ativos (normalizados) cobertos
  drugLabel: string
  test: string           // o que é avaliado
  level: 'A' | 'B'       // força da recomendação CPIC
  summary: string        // implicação farmacogenética
  recommendations: PgxRecommendation[]
}

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

export const PGX_GUIDELINES: PgxGuideline[] = [
  {
    gene: 'CYP2C19', drugs: ['clopidogrel'], drugLabel: 'Clopidogrel', test: 'Genótipo CYP2C19 (alelos *2/*3 = perda de função; *17 = ganho)', level: 'A',
    summary: 'Clopidogrel é pró-fármaco ativado pela CYP2C19. Metabolizadores lentos/intermediários têm ativação reduzida e maior risco de eventos cardiovasculares (sobretudo pós-SCA/stent).',
    recommendations: [
      { phenotype: 'Metabolizador lento (PM) ou intermediário (IM)', action: 'Preferir antiagregante alternativo não dependente de CYP2C19 (prasugrel ou ticagrelor), se sem contraindicação.' },
      { phenotype: 'Metabolizador normal/rápido/ultrarrápido', action: 'Clopidogrel em dose padrão.' },
    ],
  },
  {
    gene: 'CYP2D6', drugs: ['codeina', 'tramadol'], drugLabel: 'Codeína / Tramadol', test: 'Genótipo CYP2D6 (atividade)', level: 'A',
    summary: 'Codeína e tramadol são ativados pela CYP2D6. Ultrarrápidos formam metabólito ativo em excesso (toxicidade opioide); lentos têm analgesia inadequada.',
    recommendations: [
      { phenotype: 'Ultrarrápido (UM)', action: 'EVITAR (risco de toxicidade/depressão respiratória). Usar analgésico não metabolizado pela CYP2D6 (ex.: morfina, AINE, paracetamol conforme caso).' },
      { phenotype: 'Lento (PM)', action: 'EVITAR por analgesia insuficiente; escolher alternativa.' },
      { phenotype: 'Normal/Intermediário', action: 'Dose padrão, monitorando resposta e efeitos adversos.' },
    ],
  },
  {
    gene: 'CYP2D6', drugs: ['tamoxifeno'], drugLabel: 'Tamoxifeno', test: 'Genótipo CYP2D6', level: 'A',
    summary: 'CYP2D6 converte tamoxifeno em endoxifeno (metabólito ativo). Lentos/intermediários têm menor exposição ao endoxifeno.',
    recommendations: [
      { phenotype: 'Lento (PM)', action: 'Considerar inibidor de aromatase (se pós-menopausa) ou conduta especializada; evitar inibidores fortes de CYP2D6 concomitantes.' },
      { phenotype: 'Intermediário (IM)', action: 'Avaliar individualmente; evitar inibidores de CYP2D6.' },
      { phenotype: 'Normal', action: 'Dose padrão.' },
    ],
  },
  {
    gene: 'CYP2C9 / VKORC1', drugs: ['varfarina', 'warfarina'], drugLabel: 'Varfarina', test: 'Genótipos CYP2C9, VKORC1 (e CYP4F2)', level: 'A',
    summary: 'Variantes em CYP2C9 e VKORC1 alteram a dose de varfarina necessária e o risco de sangramento na titulação inicial.',
    recommendations: [
      { phenotype: 'Variantes de baixa atividade', action: 'Dose inicial menor; titulação por algoritmo farmacogenético (ex.: warfarindosing) com monitorização rigorosa de INR.' },
      { phenotype: 'Genótipo normal', action: 'Algoritmo padrão de dose + INR.' },
    ],
  },
  {
    gene: 'SLCO1B1', drugs: ['sinvastatina'], drugLabel: 'Sinvastatina (estatinas)', test: 'Genótipo SLCO1B1 (*5/rs4149056)', level: 'A',
    summary: 'Função reduzida do transportador SLCO1B1 eleva a exposição à sinvastatina e o risco de miopatia/rabdomiólise.',
    recommendations: [
      { phenotype: 'Função reduzida/baixa', action: 'Limitar dose de sinvastatina ou preferir estatina de menor risco (ex.: rosuvastatina/pravastatina em dose adequada). Monitorar CK e sintomas musculares.' },
      { phenotype: 'Função normal', action: 'Dose padrão conforme meta de LDL.' },
    ],
  },
  {
    gene: 'TPMT / NUDT15', drugs: ['azatioprina', 'mercaptopurina', 'tioguanina'], drugLabel: 'Azatioprina / Mercaptopurina', test: 'Atividade/genótipo TPMT e NUDT15', level: 'A',
    summary: 'Baixa atividade de TPMT/NUDT15 causa acúmulo de metabólitos tiopurínicos e mielossupressão grave.',
    recommendations: [
      { phenotype: 'Atividade baixa/ausente', action: 'Reduzir drasticamente a dose ou evitar; hemograma frequente.' },
      { phenotype: 'Intermediária', action: 'Reduzir dose inicial e monitorar hemograma.' },
      { phenotype: 'Normal', action: 'Dose padrão com monitorização.' },
    ],
  },
  {
    gene: 'HLA-B*57:01', drugs: ['abacavir'], drugLabel: 'Abacavir', test: 'HLA-B*57:01 (presente/ausente)', level: 'A',
    summary: 'Portadores de HLA-B*57:01 têm alto risco de reação de hipersensibilidade grave ao abacavir.',
    recommendations: [
      { phenotype: 'HLA-B*57:01 positivo', action: 'CONTRAINDICADO — não usar abacavir.' },
      { phenotype: 'Negativo', action: 'Abacavir permitido (manter vigilância clínica).' },
    ],
  },
  {
    gene: 'HLA-B*15:02 / HLA-A*31:01', drugs: ['carbamazepina', 'oxcarbazepina'], drugLabel: 'Carbamazepina / Oxcarbazepina', test: 'HLA-B*15:02 (e HLA-A*31:01)', level: 'A',
    summary: 'HLA-B*15:02 associa-se a risco elevado de SJS/TEN (síndromes cutâneas graves) com carbamazepina, especialmente em ascendência asiática.',
    recommendations: [
      { phenotype: 'HLA-B*15:02 positivo', action: 'EVITAR carbamazepina/oxcarbazepina; usar anticonvulsivante alternativo.' },
      { phenotype: 'Negativo', action: 'Permitido; orientar sinais cutâneos nas primeiras semanas.' },
    ],
  },
  {
    gene: 'DPYD', drugs: ['fluorouracil', 'capecitabina', '5-fu'], drugLabel: 'Fluoruracila / Capecitabina', test: 'Variantes DPYD', level: 'A',
    summary: 'Deficiência de DPD (DPYD) reduz o metabolismo das fluoropirimidinas → toxicidade grave (mielossupressão, mucosite, neurotoxicidade).',
    recommendations: [
      { phenotype: 'Metabolizador deficiente', action: 'Evitar ou reduzir fortemente a dose (conforme escore de atividade); conduta oncológica especializada.' },
      { phenotype: 'Normal', action: 'Dose padrão.' },
    ],
  },
  {
    gene: 'CYP2C19', drugs: ['citalopram', 'escitalopram', 'sertralina'], drugLabel: 'ISRS (citalopram/escitalopram)', test: 'Genótipo CYP2C19', level: 'A',
    summary: 'Metabolizadores lentos de CYP2C19 têm maior exposição a citalopram/escitalopram (risco de QT/efeitos adversos); ultrarrápidos podem ter resposta reduzida.',
    recommendations: [
      { phenotype: 'Lento (PM)', action: 'Reduzir dose (ex.: 50%) ou trocar por ISRS não-CYP2C19; atenção ao QT.' },
      { phenotype: 'Ultrarrápido', action: 'Considerar alternativa se resposta inadequada.' },
      { phenotype: 'Normal/Intermediário', action: 'Dose padrão.' },
    ],
  },
  {
    gene: 'CYP3A5', drugs: ['tacrolimo', 'tacrolimus'], drugLabel: 'Tacrolimo', test: 'Genótipo CYP3A5 (*1 = expressor)', level: 'A',
    summary: 'Expressores de CYP3A5 metabolizam mais o tacrolimo e tendem a precisar de doses maiores para atingir o alvo.',
    recommendations: [
      { phenotype: 'Expressor (CYP3A5*1)', action: 'Iniciar com dose maior (ex.: 1,5–2×) guiada por nível sérico-alvo.' },
      { phenotype: 'Não-expressor', action: 'Dose padrão guiada por nível sérico.' },
    ],
  },
]

/** Retorna as diretrizes CPIC que se aplicam ao medicamento informado (por princípio ativo). */
export function lookupPgx(drugName: string): PgxGuideline[] {
  const n = norm(drugName)
  if (!n) return []
  return PGX_GUIDELINES.filter(g => g.drugs.some(d => n.includes(norm(d)) || norm(d).includes(n)))
}

/** Lista, para uma lista de medicamentos, as diretrizes aplicáveis (sem duplicar). */
export function pgxForDrugs(drugNames: string[]): PgxGuideline[] {
  const seen = new Set<string>(); const out: PgxGuideline[] = []
  for (const d of drugNames) for (const g of lookupPgx(d)) {
    const k = g.gene + '|' + g.drugLabel
    if (!seen.has(k)) { seen.add(k); out.push(g) }
  }
  return out
}
