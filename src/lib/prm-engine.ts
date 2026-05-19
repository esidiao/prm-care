/**
 * PRM Care — Motor Clínico de Análise Farmacoterapêutica
 * Baseado no Método Dáder de Seguimento Farmacoterapêutico
 *
 * Fontes clínicas:
 * - Critérios de Beers 2023 (American Geriatrics Society)
 * - Critérios STOPP/START v3 (2023)
 * - Diretrizes SBRAFH / CFF
 * - Bulário ANVISA
 *
 * AVISO: Este motor é uma ferramenta de apoio técnico e educacional.
 * Não substitui avaliação profissional. Todas as saídas devem ser
 * validadas por farmacêutico ou profissional habilitado.
 */

import type {
  PatientContext,
  MedicationContext,
  PRMFindingResult,
  AnalysisResult,
  SOAPSuggestion,
} from '@/types'
import { PRMCategory, RiskLevel, AdherenceLevel } from '@prisma/client'

// ─── Utility Functions ────────────────────────────────────────────────────────

function norm(name: string): string {
  return name.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function medContains(med: MedicationContext, keyword: string): boolean {
  const k = norm(keyword)
  return norm(med.activeIngredient).includes(k) || (med.tradeName ? norm(med.tradeName).includes(k) : false)
}

// ─── 1. INTERAÇÕES MEDICAMENTOSAS ────────────────────────────────────────────

interface KnownInteraction {
  drug1: string
  drug2: string
  severity: 'minor' | 'moderate' | 'major' | 'contraindicated'
  mechanism: string
  clinicalEffect: string
  management: string
}

const KNOWN_INTERACTIONS: KnownInteraction[] = [
  // ANTICOAGULANTES
  { drug1: 'warfarina', drug2: 'acido acetilsalicilico', severity: 'major', mechanism: 'Sinergismo anticoagulante e antiagregante', clinicalEffect: 'Risco elevado de hemorragia grave', management: 'Monitorar INR rigorosamente. Usar IBP. Avaliar risco-benefício.' },
  { drug1: 'warfarina', drug2: 'ibuprofeno', severity: 'major', mechanism: 'AINEs inibem tromboxano e deslocam warfarina de proteínas', clinicalEffect: 'Potencialização do anticoagulante e sangramento GI', management: 'Evitar. Substituir por paracetamol se analgesia necessária. Monitorar INR.' },
  { drug1: 'warfarina', drug2: 'diclofenaco', severity: 'major', mechanism: 'AINE inibe COX e desloca warfarina', clinicalEffect: 'Aumento do RNI e risco hemorrágico', management: 'Evitar combinação. Monitorar INR se inevitável.' },
  { drug1: 'warfarina', drug2: 'naproxeno', severity: 'major', mechanism: 'Inibição plaquetária e deslocamento proteico', clinicalEffect: 'Sangramento GI e sistêmico', management: 'Preferir paracetamol. Monitorar INR.' },
  { drug1: 'warfarina', drug2: 'amiodarona', severity: 'major', mechanism: 'Amiodarona inibe CYP2C9, reduzindo metabolismo da warfarina', clinicalEffect: 'Aumento abrupto do INR com risco hemorrágico', management: 'Reduzir dose de warfarina em 30-50%. Monitorar INR a cada 3-5 dias.' },
  { drug1: 'warfarina', drug2: 'fluconazol', severity: 'major', mechanism: 'Inibição de CYP2C9 pelo fluconazol', clinicalEffect: 'Elevação marcada do INR', management: 'Monitorar INR diariamente durante e após uso do antifúngico. Ajustar dose.' },
  { drug1: 'warfarina', drug2: 'metronidazol', severity: 'major', mechanism: 'Inibição de CYP2C9', clinicalEffect: 'Potencialização do efeito anticoagulante', management: 'Reduzir dose de warfarina. Monitorar INR.' },
  { drug1: 'warfarina', drug2: 'ciprofloxacino', severity: 'moderate', mechanism: 'Inibição de CYP1A2 e redução de flora intestinal produtora de vitamina K', clinicalEffect: 'Aumento do INR', management: 'Monitorar INR durante antibioticoterapia.' },
  { drug1: 'warfarina', drug2: 'sulfametoxazol', severity: 'major', mechanism: 'Inibição de CYP2C9 e redução de vitamina K bacteriana', clinicalEffect: 'Elevação importante do INR', management: 'Monitorar INR. Reduzir dose de warfarina se necessário.' },

  // ESTATINAS
  { drug1: 'sinvastatina', drug2: 'amiodarona', severity: 'major', mechanism: 'Amiodarona inibe CYP3A4', clinicalEffect: 'Miopatia e rabdomiólise', management: 'Limitar sinvastatina a 20 mg/dia. Preferir pravastatina ou rosuvastatina.' },
  { drug1: 'sinvastatina', drug2: 'claritromicina', severity: 'major', mechanism: 'Claritromicina é potente inibidor de CYP3A4', clinicalEffect: 'Rabdomiólise', management: 'Suspender sinvastatina durante uso do antibiótico.' },
  { drug1: 'sinvastatina', drug2: 'itraconazol', severity: 'major', mechanism: 'Inibição intensa de CYP3A4', clinicalEffect: 'Rabdomiólise potencialmente fatal', management: 'Contraindicado. Suspender estatina.' },
  { drug1: 'atorvastatina', drug2: 'claritromicina', severity: 'major', mechanism: 'Inibição de CYP3A4', clinicalEffect: 'Miopatia grave', management: 'Suspender atorvastatina durante claritromicina ou usar azitromicina.' },
  { drug1: 'rosuvastatina', drug2: 'gemfibrozila', severity: 'major', mechanism: 'Inibição de OATP1B1 pela gemfibrozila', clinicalEffect: 'Aumento das concentrações de estatina e risco de miopatia', management: 'Evitar combinação. Se necessário, monitorar CK.' },

  // SEROTONINA
  { drug1: 'fluoxetina', drug2: 'tramadol', severity: 'major', mechanism: 'Dupla inibição da recaptação de serotonina', clinicalEffect: 'Síndrome serotoninérgica: agitação, tremores, hipertermia, taquicardia', management: 'Evitar. Se necessário, monitorar ativamente sinais de serotoninergismo.' },
  { drug1: 'sertralina', drug2: 'tramadol', severity: 'major', mechanism: 'Inibição da recaptação de serotonina + ação opioide', clinicalEffect: 'Síndrome serotoninérgica', management: 'Evitar combinação. Considerar analgésico alternativo.' },
  { drug1: 'venlafaxina', drug2: 'tramadol', severity: 'major', mechanism: 'Síndrome serotoninérgica por mecanismos aditivos', clinicalEffect: 'Crise serotoninérgica grave', management: 'Contraindicado. Usar alternativa analgésica.' },
  { drug1: 'fluoxetina', drug2: 'sumatriptana', severity: 'moderate', mechanism: 'Efeitos serotoninérgicos aditivos', clinicalEffect: 'Síndrome serotoninérgica leve a moderada', management: 'Monitorar. Usar dose mínima eficaz.' },
  { drug1: 'inibidor mao', drug2: 'sertralina', severity: 'contraindicated', mechanism: 'Inibição da MAO + inibição da recaptação de serotonina', clinicalEffect: 'Síndrome serotoninérgica potencialmente fatal', management: 'Contraindicado. Aguardar washout de 14 dias entre IMAO e ISRS.' },
  { drug1: 'inibidor mao', drug2: 'fluoxetina', severity: 'contraindicated', mechanism: 'Hiperestimulação serotoninérgica grave', clinicalEffect: 'Crise hipertensiva e síndrome serotoninérgica fatal', management: 'Contraindicado absoluto. Fluoxetina requer 5 semanas de washout antes de IMAO.' },

  // CARDÍACOS
  { drug1: 'digoxina', drug2: 'amiodarona', severity: 'major', mechanism: 'Amiodarona inibe P-gp e CYP3A4, reduzindo clearance da digoxina', clinicalEffect: 'Toxicidade digitálica: náusea, vômito, arritmias, bloqueio AV', management: 'Reduzir dose de digoxina em 50%. Monitorar nível sérico e ECG.' },
  { drug1: 'digoxina', drug2: 'claritromicina', severity: 'major', mechanism: 'Inibição de P-glicoproteína', clinicalEffect: 'Toxicidade digitálica', management: 'Monitorar nível sérico de digoxina e ECG durante antibioticoterapia.' },
  { drug1: 'digoxina', drug2: 'verapamil', severity: 'major', mechanism: 'Inibição de P-gp + efeito cronotrópico negativo aditivo', clinicalEffect: 'Toxicidade digitálica e bradicardia grave', management: 'Reduzir digoxina em 30-50%. Monitorar FC e ECG.' },
  { drug1: 'amiodarona', drug2: 'metoprolol', severity: 'major', mechanism: 'Efeito cronotrópico e dromotrópico negativo aditivo', clinicalEffect: 'Bradicardia grave e bloqueio AV', management: 'Monitorar ECG e FC. Reduzir dose do betabloqueador.' },
  { drug1: 'diltiazem', drug2: 'metoprolol', severity: 'moderate', mechanism: 'Depressão aditiva do nó sinusal e AV', clinicalEffect: 'Bradicardia, bloqueio AV de 1º ou 2º grau', management: 'Monitorar FC e ECG. Evitar em ICC ou BAV preexistente.' },
  { drug1: 'verapamil', drug2: 'atenolol', severity: 'major', mechanism: 'Depressão severa da condução cardíaca', clinicalEffect: 'Bloqueio AV completo, assistolia', management: 'Combinação geralmente contraindicada. Avaliar alternativas.' },

  // IECA / SARTANA / DIURÉTICOS
  { drug1: 'enalapril', drug2: 'espironolactona', severity: 'moderate', mechanism: 'Retenção de potássio por mecanismos distintos', clinicalEffect: 'Hipercalemia com risco de arritmia', management: 'Monitorar potássio sérico regularmente (semanal-mensal).' },
  { drug1: 'losartana', drug2: 'espironolactona', severity: 'moderate', mechanism: 'Ambos poupam potássio', clinicalEffect: 'Hipercalemia', management: 'Monitorar eletrólitos periodicamente.' },
  { drug1: 'captopril', drug2: 'acido acetilsalicilico', severity: 'moderate', mechanism: 'AINEs reduzem efeito anti-hipertensivo dos IECA via prostaglandinas', clinicalEffect: 'Redução do controle pressórico', management: 'Monitorar PA. Usar menor dose possível de AAS.' },
  { drug1: 'enalapril', drug2: 'ibuprofeno', severity: 'major', mechanism: 'Inibição de prostaglandinas vasodilatadoras + risco de IRA', clinicalEffect: 'Falha anti-hipertensiva e nefrotoxicidade', management: 'Evitar AINEs em usuários de IECA. Usar paracetamol.' },
  { drug1: 'hidroclorotiazida', drug2: 'lítio', severity: 'major', mechanism: 'Diurético reduz clearance renal do lítio', clinicalEffect: 'Toxicidade por lítio: tremor, confusão, convulsões', management: 'Monitorar litemias. Considerar diurético alternativo.' },

  // METFORMINA
  { drug1: 'metformina', drug2: 'contraste iodado', severity: 'major', mechanism: 'Contraste pode causar IRA aguda acumulando metformina', clinicalEffect: 'Acidose lática potencialmente fatal', management: 'Suspender metformina 48h antes e 48h após uso de contraste iodado.' },
  { drug1: 'metformina', drug2: 'alcool', severity: 'moderate', mechanism: 'Álcool potencializa redução hepática de lactato', clinicalEffect: 'Risco aumentado de acidose lática', management: 'Orientar abstinência ou consumo muito moderado de álcool.' },

  // ANTIBIÓTICOS
  { drug1: 'metronidazol', drug2: 'alcool', severity: 'major', mechanism: 'Inibição do acetaldeído desidrogenase', clinicalEffect: 'Reação tipo dissulfiram: rubor, náusea, vômito, taquicardia', management: 'Abstinência alcoólica durante e 48h após tratamento.' },
  { drug1: 'ciprofloxacino', drug2: 'antacido', severity: 'moderate', mechanism: 'Quelação de fluoroquinolona por cátions di/trivalentes', clinicalEffect: 'Redução de absorção do antibiótico (até 85%)', management: 'Administrar ciprofloxacino 2h antes ou 6h após antiácido.' },
  { drug1: 'levofloxacino', drug2: 'omeprazol', severity: 'moderate', mechanism: 'Inibição CYP2C19', clinicalEffect: 'Possível aumento da concentração do antibiótico e risco de QT longo', management: 'Monitorar ECG em pacientes de risco.' },
  { drug1: 'claritromicina', drug2: 'sinvastatina', severity: 'major', mechanism: 'Potente inibidor de CYP3A4', clinicalEffect: 'Rabdomiólise', management: 'Suspender estatina durante uso do antibiótico.' },

  // ANTIFÚNGICOS
  { drug1: 'fluconazol', drug2: 'midazolam', severity: 'major', mechanism: 'Inibição intensa de CYP3A4', clinicalEffect: 'Sedação prolongada e apneia', management: 'Contraindicado com midazolam oral. Reduzir dose do IV e monitorar.' },
  { drug1: 'itraconazol', drug2: 'alprazolam', severity: 'major', mechanism: 'Inibição de CYP3A4', clinicalEffect: 'Sedação excessiva e depressão respiratória', management: 'Evitar combinação. Usar antifúngico alternativo.' },

  // HIPOGLICEMIANTES
  { drug1: 'glibenclamida', drug2: 'fluconazol', severity: 'major', mechanism: 'Inibição do metabolismo da sulfoniluréia', clinicalEffect: 'Hipoglicemia grave e prolongada', management: 'Monitorar glicemia intensivamente. Considerar redução da dose.' },
  { drug1: 'insulina', drug2: 'betabloqueador', severity: 'moderate', mechanism: 'Betabloqueadores mascaram sintomas adrenérgicos da hipoglicemia', clinicalEffect: 'Hipoglicemia não percebida (exceto sudorese)', management: 'Usar betabloqueador cardiosseletivo (metoprolol). Monitorar glicemia.' },

  // ANTIDEPRESSIVOS / ANTIPSICÓTICOS
  { drug1: 'haloperidol', drug2: 'amiodarona', severity: 'major', mechanism: 'Ambos prolongam intervalo QT', clinicalEffect: 'Torsades de pointes e morte súbita', management: 'Evitar combinação. Monitorar ECG se inevitável.' },
  { drug1: 'risperidona', drug2: 'metoclopramida', severity: 'moderate', mechanism: 'Bloqueio dopaminérgico aditivo', clinicalEffect: 'Sintomas extrapiramidais, parkinsonismo', management: 'Evitar uso concomitante. Se necessário, monitorar sintomas extrapiramidais.' },
  { drug1: 'amitriptilina', drug2: 'tramadol', severity: 'moderate', mechanism: 'Efeitos serotoninérgicos e anticolinérgicos aditivos', clinicalEffect: 'Síndrome serotoninérgica e toxicidade anticolinérgica', management: 'Monitorar. Evitar em idosos.' },

  // OUTROS
  { drug1: 'acido acetilsalicilico', drug2: 'ibuprofeno', severity: 'moderate', mechanism: 'AINE bloqueia sítio COX-1 do AAS', clinicalEffect: 'Redução do efeito antiagregante cardioprotetor do AAS', management: 'Administrar AAS pelo menos 2h antes do ibuprofeno.' },
  { drug1: 'colchicina', drug2: 'claritromicina', severity: 'major', mechanism: 'Inibição de CYP3A4 e P-gp eleva nível de colchicina', clinicalEffect: 'Toxicidade por colchicina: miopatia, neuropatia, pancitopenia', management: 'Reduzir dose de colchicina ou usar alternativa.' },
  { drug1: 'fenitoina', drug2: 'fluconazol', severity: 'major', mechanism: 'Inibição de CYP2C9 eleva nível de fenitoína', clinicalEffect: 'Toxicidade por fenitoína: nistagmo, ataxia, confusão', management: 'Monitorar nível sérico de fenitoína.' },
  { drug1: 'varfarina', drug2: 'acido acetilsalicilico', severity: 'major', mechanism: 'Sinergismo anticoagulante', clinicalEffect: 'Sangramento grave', management: 'Monitorar INR. Avaliar necessidade de IBP.' },
  { drug1: 'lítio', drug2: 'ibuprofeno', severity: 'major', mechanism: 'AINEs reduzem clearance renal do lítio', clinicalEffect: 'Toxicidade por lítio', management: 'Evitar AINEs em usuários de lítio. Usar paracetamol.' },
  { drug1: 'lítio', drug2: 'naproxeno', severity: 'major', mechanism: 'Redução da excreção renal de lítio', clinicalEffect: 'Toxicidade por lítio: tremor, confusão, insuficiência renal', management: 'Monitorar litemias. Usar paracetamol.' },
  { drug1: 'teofilina', drug2: 'ciprofloxacino', severity: 'major', mechanism: 'Inibição de CYP1A2 eleva nível de teofilina', clinicalEffect: 'Toxicidade por teofilina: arritmia, convulsão', management: 'Monitorar nível sérico. Considerar alternativa ao antibiótico.' },
  { drug1: 'sildenafila', drug2: 'nitrato', severity: 'contraindicated', mechanism: 'Potencialização do efeito vasodilatador via GMPc', clinicalEffect: 'Hipotensão grave e colapso cardiovascular', management: 'Contraindicado absoluto. Aguardar 24-48h após sildenafila antes de nitrato.' },
  { drug1: 'metotrexato', drug2: 'ibuprofeno', severity: 'major', mechanism: 'AINEs reduzem clearance renal do metotrexato', clinicalEffect: 'Toxicidade por metotrexato: mucosite, pancitopenia', management: 'Evitar AINEs. Se necessário, hidratar e monitorar função renal e hemograma.' },
  { drug1: 'ciclosporina', drug2: 'claritromicina', severity: 'major', mechanism: 'Inibição de CYP3A4 eleva ciclosporinemia', clinicalEffect: 'Nefrotoxicidade e toxicidade sistêmica', management: 'Monitorar nível sérico de ciclosporina. Reduzir dose.' },
  { drug1: 'tacrolimus', drug2: 'fluconazol', severity: 'major', mechanism: 'Inibição de CYP3A4', clinicalEffect: 'Nefrotoxicidade por acúmulo de tacrolimus', management: 'Monitorar tacrolimusemia e função renal intensivamente.' },
  { drug1: 'carbamazepina', drug2: 'claritromicina', severity: 'major', mechanism: 'Inibição de CYP3A4 eleva nível de carbamazepina', clinicalEffect: 'Toxicidade: diplopia, ataxia, confusão mental', management: 'Monitorar nível sérico. Considerar alternativa ao antibiótico.' },
  { drug1: 'clopidogrel', drug2: 'omeprazol', severity: 'moderate', mechanism: 'Omeprazol inibe CYP2C19, reduzindo ativação do clopidogrel', clinicalEffect: 'Redução do efeito antiagregante e maior risco de eventos cardiovasculares', management: 'Preferir pantoprazol ou rabeprazol se IBP necessário.' },
  { drug1: 'quetiapina', drug2: 'fluconazol', severity: 'major', mechanism: 'Inibição de CYP3A4 eleva quetiapina', clinicalEffect: 'Prolongamento de QT e sedação excessiva', management: 'Monitorar ECG. Reduzir dose de quetiapina.' },
]

// ─── 2. AJUSTE RENAL ──────────────────────────────────────────────────────────

const RENAL_ADJUSTMENT_REQUIRED: Record<string, string> = {
  metformina: 'Contraindicada se ClCr < 30 mL/min. Cautela se 30-45 mL/min. Reduzir dose se 45-60 mL/min.',
  digoxina: 'Ajuste obrigatório. Acumulação com risco de toxicidade em IRC.',
  gabapentina: 'Redução de dose proporcional ao ClCr. Risco de sedação e ataxia.',
  pregabalina: 'Ajuste obrigatório conforme ClCr. Iniciar com dose mínima.',
  atenolol: 'Reduzir dose se ClCr < 35 mL/min.',
  ciprofloxacino: 'Ajustar intervalo se ClCr < 30 mL/min.',
  levofloxacino: 'Ajuste de dose e intervalo em IR moderada a grave.',
  alopurinol: 'Redução significativa da dose. Risco de síndrome de hipersensibilidade grave.',
  aciclovir: 'Ajuste de dose e intervalo. Risco de cristalúria e toxicidade renal.',
  amoxicilina: 'Ajustar intervalo em IR grave (ClCr < 30 mL/min).',
  ampicilina: 'Ajuste de dose em IR grave.',
  colchicina: 'Contraindicada em IR grave (ClCr < 10 mL/min). Redução de dose em moderada.',
  lisinopril: 'Iniciar com dose reduzida. Monitorar potássio e creatinina.',
  enalapril: 'Reduzir dose inicial em IR. Monitorar função renal e potássio.',
  metoprolol: 'Ajuste não obrigatório, mas monitorar hipotensão.',
  tramadol: 'Evitar ou reduzir dose em IR moderada-grave. Risco de convulsões.',
  morfina: 'Evitar em IR grave. Acumulação de metabólitos ativos (morfina-6-glucuronídeo).',
  nitrofurantoina: 'Contraindicada se ClCr < 30 mL/min. Ineficácia e toxicidade pulmonar.',
  espironolactona: 'Evitar em IR moderada-grave. Risco de hipercalemia grave.',
  metoclopramida: 'Reduzir dose à metade em IR grave. Risco de efeitos extrapiramidais.',
  ranitidina: 'Reduzir dose em IR. Risco de confusão mental em idosos.',
  cimetidina: 'Reduzir dose. Muitas interações e efeitos anticolinérgicos.',
  fluconazol: 'Reduzir dose em IR grave.',
  varfarina: 'Monitorar INR com mais frequência em IR — farmacodinâmica alterada.',
  fenitoina: 'Monitorar nível livre (hipoalbuminemia comum em IRC altera ligação proteica).',
  carbamazepina: 'Monitorar em IR grave, possível acumulação.',
  dabigatrana: 'Contraindicada em IR grave (ClCr < 30 mL/min).',
  rivaroxabana: 'Contraindicada em ClCr < 15 mL/min. Cautela se 15-29 mL/min.',
  apixabana: 'Reduzir dose em IR moderada-grave.',
  sitagliptina: 'Redução de dose obrigatória conforme ClCr.',
  dapagliflozina: 'Ineficaz e contraindicada se ClCr < 25 mL/min.',
  empagliflozina: 'Suspender se ClCr < 20 mL/min.',
  baclofeno: 'Evitar em IR. Acumulação com risco de encefalopatia.',
  oxaliplatina: 'Reduzir dose em IR moderada-grave.',
  cisplatina: 'Contraindicada em IR. Alta nefrotoxicidade.',
}

// ─── 3. AJUSTE HEPÁTICO ───────────────────────────────────────────────────────

const HEPATIC_ADJUSTMENT_REQUIRED: Record<string, string> = {
  paracetamol: 'Dose máxima 2 g/dia em hepatopatas. Evitar uso crônico.',
  sinvastatina: 'Contraindicada em hepatopatia ativa ou elevação persistente de transaminases.',
  atorvastatina: 'Contraindicada em doença hepática ativa.',
  rosuvastatina: 'Contraindicada em doença hepática ativa.',
  metformina: 'Contraindicada em hepatopatia grave (risco de acidose lática).',
  isoniazida: 'Suspender se TGO/TGP > 3x LSN. Monitorar mensalmente.',
  rifampicina: 'Cautela e monitoramento hepático. Indutor enzimático potente.',
  pirazinamida: 'Hepatotóxico. Monitorar enzimas hepáticas.',
  amoxicilina: 'Cautela na colestase. DILI documentado com amoxicilina-clavulanato.',
  diclofenaco: 'Hepatotóxico. Monitorar TGO/TGP.',
  nimesulida: 'Alto risco de hepatotoxicidade. Evitar.',
  azatioprina: 'Monitorar enzimas hepáticas. Risco de hepatotoxicidade.',
  metotrexato: 'Risco de fibrose hepática com uso prolongado. Biopsia periódica.',
  amiodarona: 'Hepatotóxico. Monitorar TGO/TGP semestralmente.',
  carbamazepina: 'Monitorar enzimas hepáticas. Risco de hepatite granulomatosa.',
  fenitoina: 'Risco de hepatotoxicidade. Monitorar em hepatopatia.',
  haloperidol: 'Reduzir dose em hepatopatia grave.',
  midazolam: 'Acumulação em hepatopatia grave. Risco de sedação prolongada.',
  clopidogrel: 'Cautela em hepatopatia. Pró-fármaco dependente de CYP2C19 hepático.',
  tramadol: 'Reduzir dose e prolongar intervalo em hepatopatia grave.',
  morfina: 'Acumulação em cirrose. Usar com cautela e doses menores.',
  ondansetrona: 'Reduzir dose máxima em hepatopatia grave.',
  fluconazol: 'Monitorar enzimas hepáticas. Evitar em hepatopatia grave.',
  varfarina: 'Cautela. Hepatopatia altera síntese de fatores e sensibilidade à warfarina.',
}

// ─── 4. GESTAÇÃO ──────────────────────────────────────────────────────────────

const PREGNANCY_CONTRAINDICATED: string[] = [
  'warfarina', 'varfarina', 'acido valproico', 'valproato', 'isotretinoin', 'isotretinoina',
  'metotrexato', 'talidomida', 'sinvastatina', 'atorvastatina', 'rosuvastatina', 'pravastatina',
  'enalapril', 'lisinopril', 'captopril', 'losartana', 'valsartana', 'irbesartana',
  'candesartana', 'ramipril', 'perindopril', 'telmisartana', 'olmesartana',
  'amiodarona', 'tetraciclina', 'doxiciclina', 'minociclina',
  'ciprofloxacino', 'levofloxacino', 'moxifloxacino', 'norfloxacino',
  'misoprostol', 'metimazol', 'carbimazol', 'danazol', 'finasterida',
  'leflunomida', 'micofenolato', 'tacrolimus', 'ciclosporina',
  'hidroxiureia', 'bosentana', 'ribavirina', 'acitretina', 'bexaroteno',
  'dabigatrana', 'rivaroxabana', 'apixabana', 'edoxabana',
]

const PREGNANCY_CAUTION: string[] = [
  'acido acetilsalicilico', 'ibuprofeno', 'naproxeno', 'diclofenaco', 'nimesulida', 'meloxicam',
  'alprazolam', 'diazepam', 'clonazepam', 'lorazepam', 'midazolam',
  'tramadol', 'codeina', 'morfina', 'fentanila', 'oxicodona',
  'litio', 'lítio', 'carbamazepina', 'fenobarbital', 'topiramato', 'lamotrigina',
  'metronidazol', 'fluconazol', 'itraconazol',
  'propiltiouracil', 'hidralazina', 'metildopa', 'labetalol',
  'azatioprina', 'prednisolona', 'prednisona',
  'paroxetina', 'fluoxetina', 'sertralina', 'escitalopram',
  'metformina', 'insulina nph', 'glibenclamida',
]

// ─── 5. LACTAÇÃO ──────────────────────────────────────────────────────────────

const LACTATION_CONTRAINDICATED: string[] = [
  'amiodarona', 'lítio', 'litio', 'cloranfenicol', 'metotrexato',
  'ciclofosfamida', 'doxorrubicina', 'talidomida', 'isotretinoina',
  'ergotamina', 'bromocriptina', 'cabergolina', 'iodo radioativo',
  'ribavirina', 'acitretina', 'leflunomida', 'ciclosporina',
]

const LACTATION_CAUTION: string[] = [
  'fluoxetina', 'paroxetina', 'sertralina', 'citalopram', 'escitalopram',
  'diazepam', 'alprazolam', 'clonazepam', 'fenobarbital',
  'codeina', 'tramadol', 'morfina', 'oxicodona',
  'carbamazepina', 'valproato', 'fenitoina',
  'ciprofloxacino', 'metronidazol', 'tetraciclina', 'doxiciclina',
  'ibuprofeno', 'naproxeno', 'diclofenaco', 'celecoxibe',
  'atenolol', 'nadolol',
  'cloroquina', 'hidroxicloroquina',
]

// ─── 6. CRITÉRIOS DE BEERS 2023 (AGS) ─────────────────────────────────────────

const BEERS_CRITERIA_DRUGS: Record<string, { warning: string; level: 'high' | 'moderate' }> = {
  // Anticolinérgicos
  'amitriptilina': { warning: 'Antidepressivo tricíclico com alta atividade anticolinérgica: risco de delirium, retenção urinária, quedas e constipação em idosos.', level: 'high' },
  'nortriptilina': { warning: 'Tricíclico: efeitos anticolinérgicos significativos em idosos. Risco de hipotensão ortostática e quedas.', level: 'high' },
  'clomipramina': { warning: 'Tricíclico altamente anticolinérgico. Evitar em idosos.', level: 'high' },
  'imipramina': { warning: 'Tricíclico: sedação e anticolinergismo em idosos.', level: 'high' },
  'difenidramina': { warning: 'Antihistamínico H1 de 1ª geração: alta atividade anticolinérgica — delirium, sedação, retenção urinária, quedas.', level: 'high' },
  'prometazina': { warning: 'Fenotiazínico antihistamínico: potencial anticolinérgico alto. Evitar em idosos.', level: 'high' },
  'hidroxizina': { warning: 'Antihistamínico com sedação excessiva e efeito anticolinérgico em idosos.', level: 'high' },
  'clorfeniramina': { warning: 'Antihistamínico 1ª geração: sedação e anticolinergismo. Preferir loratadina ou cetirizina.', level: 'moderate' },
  'oxibutinina': { warning: 'Anticolinérgico para bexiga hiperativa: alto risco de delirium e comprometimento cognitivo em idosos.', level: 'high' },
  'solifenacina': { warning: 'Anticolinérgico urinário: risco de comprometimento cognitivo em idosos.', level: 'moderate' },
  'tolterodina': { warning: 'Anticolinérgico urinário. Preferir alternativas como mirabegrom.', level: 'moderate' },
  'escopolamina': { warning: 'Anticolinérgico potente. Contraindicada para uso sistêmico em idosos.', level: 'high' },
  'hioscina': { warning: 'Anticolinérgico. Evitar uso crônico em idosos.', level: 'high' },
  'diciclomina': { warning: 'Anticolinérgico gastrointestinal. Risco de delirium em idosos.', level: 'high' },

  // Benzodiazepínicos e sedativos-hipnóticos
  'diazepam': { warning: 'Benzodiazepínico: risco elevado de quedas, fraturas, sedação e delirium em idosos.', level: 'high' },
  'alprazolam': { warning: 'Benzodiazepínico: evitar uso crônico em idosos. Alto risco de dependência e quedas.', level: 'high' },
  'clonazepam': { warning: 'Benzodiazepínico de longa ação: acumulação e risco de quedas em idosos.', level: 'high' },
  'lorazepam': { warning: 'Benzodiazepínico: cautela em idosos. Preferir doses menores e curto prazo.', level: 'high' },
  'bromazepam': { warning: 'Benzodiazepínico: sedação e quedas em idosos. Evitar uso crônico.', level: 'high' },
  'nitrazepam': { warning: 'Benzodiazepínico de longa ação. Alto risco em idosos.', level: 'high' },
  'flurazepam': { warning: 'Meia-vida muito longa. Acumulação intensa em idosos — alto risco de quedas.', level: 'high' },
  'clorazepato': { warning: 'Benzodiazepínico de longa ação. Evitar em idosos.', level: 'high' },
  'zolpidem': { warning: 'Hipnótico Z: risco de quedas, fraturas, delirium e comportamentos incomuns durante sono em idosos.', level: 'high' },
  'zopiclona': { warning: 'Hipnótico Z: risco de quedas e comprometimento cognitivo em idosos.', level: 'high' },
  'zaleplon': { warning: 'Hipnótico Z. Evitar em idosos. Risco de quedas e amnésia.', level: 'high' },

  // Cardiovasculares
  'digoxina': { warning: 'Glicosídeo digitálico: em idosos, usar dose ≤ 0,125 mg/dia. Janela terapêutica estreita — risco de toxicidade com função renal reduzida.', level: 'high' },
  'amiodarona': { warning: 'Antiarrítmico: toxicidade pulmonar, tireoidiana e hepática cumulativa em idosos. Evitar como 1ª linha em FA.', level: 'moderate' },
  'nifedipina': { warning: 'Bloqueador de canal de cálcio de liberação rápida: hipotensão e edema de tornozelo. Preferir formulação de liberação prolongada.', level: 'high' },
  'doxazosina': { warning: 'Alfa-bloqueador: hipotensão ortostática e risco de quedas em idosos.', level: 'high' },
  'prazosina': { warning: 'Alfa-bloqueador: hipotensão ortostática grave em idosos. Evitar como anti-hipertensivo.', level: 'high' },
  'terazosina': { warning: 'Alfa-bloqueador: hipotensão ortostática em idosos.', level: 'moderate' },
  'espironolactona': { warning: 'Evitar doses > 25 mg/dia em insuficiência cardíaca. Risco de hipercalemia fatal em IR.', level: 'moderate' },
  'metildopa': { warning: 'Anti-hipertensivo central: sedação, depressão e bradicardia em idosos. Evitar.', level: 'high' },
  'clonidina': { warning: 'Anti-hipertensivo central: bradicardia e hipotensão ortostática em idosos. Risco de efeito rebote.', level: 'high' },

  // AINEs
  'ibuprofeno': { warning: 'AINE: risco aumentado de sangramento GI, IRA, retenção de sódio e hipertensão em idosos. Preferir paracetamol.', level: 'high' },
  'naproxeno': { warning: 'AINE: mesmo perfil de riscos que ibuprofeno. Evitar uso crônico em idosos.', level: 'high' },
  'diclofenaco': { warning: 'AINE: risco cardiovascular, renal e GI em idosos.', level: 'high' },
  'meloxicam': { warning: 'AINE seletivo COX-2: risco renal e GI em idosos. Não é livre de riscos.', level: 'moderate' },
  'indometacina': { warning: 'AINE: maior risco de efeitos adversos SNC (delirium) e GI. Evitar completamente em idosos.', level: 'high' },
  'cetorolaco': { warning: 'AINE parenteral/oral: alto risco de sangramento GI e IRA. Evitar em idosos, especialmente > 5 dias.', level: 'high' },
  'piroxicam': { warning: 'AINE de longa ação: alto risco de sangramento GI em idosos. Contraindicado.', level: 'high' },
  'nimesulida': { warning: 'AINE: hepatotóxico. Uso restrito pela ANVISA. Evitar em idosos.', level: 'high' },

  // Hipoglicemiantes
  'glibenclamida': { warning: 'Sulfonilureia de longa ação: risco de hipoglicemia grave e prolongada em idosos. Preferir glipizida ou gliclazida.', level: 'high' },
  'clorpropamida': { warning: 'Sulfonilureia de longuíssima ação: SIADH e hipoglicemia grave em idosos. Contraindicada.', level: 'high' },
  'glimepirida': { warning: 'Sulfonilureia: cautela em idosos pelo risco de hipoglicemia.', level: 'moderate' },

  // Antipsicóticos
  'haloperidol': { warning: 'Antipsicótico: risco de efeitos extrapiramidais, AVC e mortalidade aumentada em idosos com demência.', level: 'high' },
  'risperidona': { warning: 'Antipsicótico: risco de AVC e mortalidade aumentada em demência. Cautela em idosos.', level: 'high' },
  'quetiapina': { warning: 'Antipsicótico: hipotensão ortostática, sedação e quedas em idosos.', level: 'moderate' },
  'olanzapina': { warning: 'Antipsicótico: ganho de peso, dislipidemia, AVC e mortalidade em idosos com demência.', level: 'high' },
  'clorpromazina': { warning: 'Antipsicótico 1ª geração: efeitos extrapiramidais e anticolinérgicos graves em idosos.', level: 'high' },
  'levomepromazina': { warning: 'Fenotiazínico sedativo: sedação excessiva, hipotensão e anticolinergismo. Evitar em idosos.', level: 'high' },

  // Opioides
  'meperidina': { warning: 'Opioide: metabólito normeperidina é neurotóxico — convulsões e delirium em idosos. Contraindicado.', level: 'high' },
  'pentazocina': { warning: 'Opioide misto: delirium e efeitos psicotomiméticos em idosos. Evitar.', level: 'high' },

  // Outros
  'metoclopramida': { warning: 'Procinético: efeitos extrapiramidais e parkinsonismo, especialmente com uso prolongado em idosos.', level: 'high' },
  'domperidona': { warning: 'Procinético: prolongamento de QT em doses altas. Cautela em idosos com risco cardíaco.', level: 'moderate' },
  'nitrofurantoina': { warning: 'Antibiótico: evitar em idosos com ClCr < 30 mL/min — ineficácia e toxicidade pulmonar cumulativa.', level: 'high' },
  'carisoprodol': { warning: 'Relaxante muscular: sedação, quedas e dependência em idosos.', level: 'high' },
  'ciclobenzaprina': { warning: 'Relaxante muscular com propriedades anticolinérgicas: sedação e delirium em idosos.', level: 'high' },
  'orfenadrina': { warning: 'Relaxante muscular anticolinérgico: alto risco em idosos.', level: 'high' },
  'baclofeno': { warning: 'Relaxante muscular: sedação, confusão e quedas em idosos. Ajuste de dose obrigatório.', level: 'moderate' },
  'ranitidina': { warning: 'Antiulceroso H2: confusão mental e delirium em idosos. Preferir IBP ou gel de hidróxido de alumínio.', level: 'moderate' },
  'cimetidina': { warning: 'H2: muitas interações farmacológicas e efeitos anticolinérgicos. Evitar.', level: 'high' },
  'ergotamina': { warning: 'Vasoconstritora: risco de isquemia em idosos com doença aterosclerótica.', level: 'high' },
  'dextropropoxifeno': { warning: 'Analgésico opioide: retirado do mercado. Se ainda em uso, suspender imediatamente.', level: 'high' },
}

// ─── 7. CRITÉRIOS STOPP v3 (2023) ─────────────────────────────────────────────
// Medicamentos inapropriados em idosos por contexto clínico específico

interface STOPPCriterion {
  drugs: string[]
  condition: string
  conditionKeywords: string[]
  warning: string
  level: 'high' | 'moderate'
}

const STOPP_CRITERIA: STOPPCriterion[] = [
  {
    drugs: ['ibuprofeno', 'naproxeno', 'diclofenaco', 'meloxicam', 'indometacina', 'celecoxibe'],
    condition: 'Insuficiência cardíaca',
    conditionKeywords: ['insuficiencia cardiaca', 'ic ', 'icc', 'insuf card', 'heart failure'],
    warning: 'STOPP v3: AINEs contraindicados na insuficiência cardíaca — retenção de sódio e água, piora da ICC.',
    level: 'high',
  },
  {
    drugs: ['ibuprofeno', 'naproxeno', 'diclofenaco', 'meloxicam', 'indometacina', 'celecoxibe', 'nimesulida'],
    condition: 'Úlcera péptica / gastrite',
    conditionKeywords: ['ulcera', 'gastrite', 'gastropatia', 'hemorragia digestiva', 'sangramento gi'],
    warning: 'STOPP v3: AINEs aumentam risco de sangramento gastrointestinal ativo ou recorrente.',
    level: 'high',
  },
  {
    drugs: ['ibuprofeno', 'naproxeno', 'diclofenaco', 'meloxicam', 'indometacina', 'celecoxibe'],
    condition: 'Insuficiência renal',
    conditionKeywords: ['insuficiencia renal', 'doenca renal cronica', 'drc', 'ir ', 'irc', 'nefropatia'],
    warning: 'STOPP v3: AINEs nefrotóxicos — pioram progressão da DRC e podem precipitar IRA.',
    level: 'high',
  },
  {
    drugs: ['acido acetilsalicilico', 'clopidogrel', 'ticagrelor', 'warfarina', 'varfarina', 'dabigatrana', 'rivaroxabana', 'apixabana'],
    condition: 'Sangramento ativo',
    conditionKeywords: ['sangramento', 'hemorragia', 'hemoptise', 'hematuria', 'epistaxe recorrente'],
    warning: 'STOPP v3: Anticoagulantes e antiagregantes contraindicados em sangramento ativo não controlado.',
    level: 'high',
  },
  {
    drugs: ['metoclopramida', 'haloperidol', 'risperidona', 'olanzapina', 'quetiapina', 'clorpromazina'],
    condition: 'Doença de Parkinson',
    conditionKeywords: ['parkinson', 'doenca de parkinson', 'sindrome parkinsoniana'],
    warning: 'STOPP v3: Antidopaminérgicos pioram os sintomas de Parkinson.',
    level: 'high',
  },
  {
    drugs: ['diazepam', 'alprazolam', 'clonazepam', 'lorazepam', 'zolpidem', 'zopiclona', 'bromazepam'],
    condition: 'Quedas recorrentes',
    conditionKeywords: ['queda', 'quedas', 'fratura por queda', 'risco de queda'],
    warning: 'STOPP v3: Benzodiazepínicos e hipnóticos Z aumentam significativamente o risco de quedas e fraturas em idosos.',
    level: 'high',
  },
  {
    drugs: ['diazepam', 'alprazolam', 'clonazepam', 'lorazepam', 'zolpidem', 'zopiclona', 'amitriptilina', 'difenidramina', 'hidroxizina'],
    condition: 'Demência / comprometimento cognitivo',
    conditionKeywords: ['demencia', 'alzheimer', 'comprometimento cognitivo', 'delirium', 'confusao mental'],
    warning: 'STOPP v3: Sedativos e anticolinérgicos agravam o comprometimento cognitivo e precipitam delirium.',
    level: 'high',
  },
  {
    drugs: ['atenolol', 'propranolol', 'metoprolol', 'bisoprolol', 'carvedilol'],
    condition: 'DPOC / asma grave',
    conditionKeywords: ['dpoc', 'doenca pulmonar obstrutiva', 'asma grave', 'broncoespasmo cronico'],
    warning: 'STOPP v3: Betabloqueadores não cardiosseletivos podem precipitar broncoespasmo em DPOC/asma grave.',
    level: 'moderate',
  },
  {
    drugs: ['glibenclamida', 'clorpropamida', 'glimepirida', 'insulina nph', 'insulina regular'],
    condition: 'Hipoglicemia recorrente',
    conditionKeywords: ['hipoglicemia', 'hipoglicemias', 'episodios hipoglicemicos'],
    warning: 'STOPP v3: Sulfonilureias de longa ação e insulina NPH aumentam risco de hipoglicemia grave em idosos.',
    level: 'high',
  },
  {
    drugs: ['hidroxicloroquina', 'cloroquina'],
    condition: 'Retinopatia',
    conditionKeywords: ['retinopatia', 'maculopatia', 'degeneracao macular'],
    warning: 'STOPP v3: Antimaláricos podem agravar retinopatia preexistente.',
    level: 'moderate',
  },
  {
    drugs: ['nitrofurantoina'],
    condition: 'Insuficiência renal',
    conditionKeywords: ['insuficiencia renal', 'drc', 'irc', 'ir ', 'clcr'],
    warning: 'STOPP v3: Nitrofurantoína ineficaz e potencialmente tóxica (pulmão) em pacientes com ClCr < 30 mL/min.',
    level: 'high',
  },
  {
    drugs: ['varfarina', 'warfarina', 'dabigatrana', 'rivaroxabana', 'apixabana'],
    condition: 'Hemorragia intracraniana prévia',
    conditionKeywords: ['hemorragia intracraniana', 'avc hemorragico', 'acidente vascular hemorragico', 'hematoma subdural'],
    warning: 'STOPP v3: Anticoagulantes geralmente contraindicados em hemorragia intracraniana prévia sem reavaliação especializada.',
    level: 'high',
  },
  {
    drugs: ['doxazosina', 'prazosina', 'terazosina', 'alfuzosina', 'tansulosina'],
    condition: 'Hipotensão ortostática',
    conditionKeywords: ['hipotensao ortostatica', 'hipotensao postural', 'sincope', 'desmaio'],
    warning: 'STOPP v3: Alfa-bloqueadores pioram hipotensão ortostática e aumentam risco de quedas.',
    level: 'high',
  },
  {
    drugs: ['corticoide', 'prednisona', 'prednisolona', 'dexametasona', 'betametasona'],
    condition: 'Osteoporose',
    conditionKeywords: ['osteoporose', 'fratura osteoporotica', 'baixa densidade mineral ossea'],
    warning: 'STOPP v3: Corticoides sistêmicos crônicos agravam a osteoporose. Associar bisfosfonato + vitamina D + cálcio.',
    level: 'moderate',
  },
]

// ─── 8. CRITÉRIOS START v3 (tratamentos que deveriam ser iniciados) ───────────

interface STARTCriterion {
  missingDrugs: string[]
  condition: string
  conditionKeywords: string[]
  recommendation: string
}

const START_CRITERIA: STARTCriterion[] = [
  {
    missingDrugs: ['enalapril', 'lisinopril', 'captopril', 'ramipril', 'perindopril', 'losartana', 'valsartana', 'candesartana', 'irbesartana', 'telmisartana'],
    condition: 'Diabetes com microalbuminúria / nefropatia diabética',
    conditionKeywords: ['microalbuminuria', 'nefropatia diabetica', 'proteinuria', 'albuminuria'],
    recommendation: 'START v3: IECA ou BRA-II indicados para nefroproteção em diabéticos com micro/macroalbuminúria.',
  },
  {
    missingDrugs: ['sinvastatina', 'atorvastatina', 'rosuvastatina', 'pravastatina', 'pitavastatina'],
    condition: 'Diabetes com fatores de risco cardiovascular',
    conditionKeywords: ['diabetes', 'diabetico', 'dm2', 'diabetes mellitus'],
    recommendation: 'START v3: Estatina recomendada para prevenção cardiovascular em diabéticos com ≥ 1 fator de risco CV.',
  },
  {
    missingDrugs: ['acido acetilsalicilico', 'clopidogrel', 'ticagrelor'],
    condition: 'Doença cardiovascular estabelecida',
    conditionKeywords: ['infarto', 'iam', 'angina', 'doenca coronariana', 'avc isquemico', 'doenca arterial periferica'],
    recommendation: 'START v3: Antiagregante plaquetário indicado para prevenção secundária em doença cardiovascular estabelecida.',
  },
  {
    missingDrugs: ['enalapril', 'lisinopril', 'carvedilol', 'metoprolol', 'bisoprolol', 'espironolactona'],
    condition: 'Insuficiência cardíaca com FE reduzida',
    conditionKeywords: ['insuficiencia cardiaca', 'ic com fe reduzida', 'disfuncao sistolica', 'fe reduzida'],
    recommendation: 'START v3: IECA/BRA + betabloqueador ± espironolactona indicados em ICC com FE reduzida.',
  },
  {
    missingDrugs: ['acido ibandronico', 'alendronato', 'risedronato', 'zoledronato', 'denosumabe'],
    condition: 'Osteoporose com fratura prévia ou alto risco',
    conditionKeywords: ['osteoporose', 'fratura por fragilidade', 'fratura osteoporotica', 't-score'],
    recommendation: 'START v3: Bisfosfonato ou agente antirreabsortivo indicado em osteoporose confirmada para redução de fraturas.',
  },
  {
    missingDrugs: ['vitamina d', 'colecalciferol', 'calcio'],
    condition: 'Osteoporose ou idoso com hipovitaminose D',
    conditionKeywords: ['osteoporose', 'deficiencia de vitamina d', 'hipovitaminose d', 'raquitismo'],
    recommendation: 'START v3: Vitamina D e cálcio indicados na prevenção e tratamento da osteoporose em idosos.',
  },
  {
    missingDrugs: ['levotiroxina', 'tiroxina'],
    condition: 'Hipotireoidismo confirmado',
    conditionKeywords: ['hipotireoidismo', 'tsh elevado', 'mixedema'],
    recommendation: 'START v3: Levotiroxina indicada em hipotireoidismo clínico confirmado por TSH elevado.',
  },
  {
    missingDrugs: ['metformina'],
    condition: 'Diabetes tipo 2 sem contraindicação',
    conditionKeywords: ['diabetes tipo 2', 'dm2', 'diabetes mellitus tipo 2'],
    recommendation: 'START v3: Metformina é a 1ª linha no DM2 sem contraindicação renal ou hepática.',
  },
  {
    missingDrugs: ['omeprazol', 'pantoprazol', 'lansoprazol', 'esomeprazol', 'rabeprazol'],
    condition: 'Uso de AINE com fatores de risco GI',
    conditionKeywords: ['ulcera peptica', 'gastrite', 'uso cronico de aine', 'historico de sangramento gi'],
    recommendation: 'START v3: IBP indicado para gastroproteção em usuários de AINEs com fatores de risco GI.',
  },
  {
    missingDrugs: ['salbutamol', 'formoterol', 'salmeterol', 'fenoterol'],
    condition: 'DPOC ou asma com sintomas',
    conditionKeywords: ['dpoc', 'asma', 'broncoespasmo', 'dispneia obstrutiva'],
    recommendation: 'START v3: Broncodilatador inalatório (SABA ou LABA) indicado em DPOC/asma sintomática.',
  },
]

// ─── 9. POLIFARMÁCIA / DUPLICIDADE ───────────────────────────────────────────

const CLASS_KEYWORDS: Record<string, string[]> = {
  'AINE': ['ibuprofeno', 'naproxeno', 'diclofenaco', 'celecoxibe', 'meloxicam', 'indometacina', 'piroxicam', 'nimesulida', 'cetorolaco'],
  'Benzodiazepínico': ['diazepam', 'alprazolam', 'clonazepam', 'lorazepam', 'midazolam', 'bromazepam', 'nitrazepam', 'clorazepato', 'flurazepam'],
  'IECA': ['enalapril', 'captopril', 'lisinopril', 'ramipril', 'perindopril', 'quinapril', 'fosinopril', 'trandolapril'],
  'BRA-II (Sartana)': ['losartana', 'valsartana', 'irbesartana', 'candesartana', 'olmesartana', 'telmisartana', 'azilsartana'],
  'Estatina': ['sinvastatina', 'atorvastatina', 'rosuvastatina', 'pravastatina', 'fluvastatina', 'pitavastatina', 'lovastatina'],
  'IBP': ['omeprazol', 'pantoprazol', 'lansoprazol', 'esomeprazol', 'rabeprazol', 'dexlansoprazol'],
  'Sulfonilureia': ['glibenclamida', 'glipizida', 'glimepirida', 'gliclazida', 'clorpropamida', 'glipentida'],
  'Antihistamínico H1': ['loratadina', 'cetirizina', 'fexofenadina', 'desloratadina', 'levocetirizina', 'bilastina', 'rupatadina', 'difenidramina', 'clorfeniramina', 'prometazina', 'hidroxizina'],
  'Opioide': ['tramadol', 'codeina', 'morfina', 'oxicodona', 'fentanila', 'buprenorfina', 'meperidina'],
  'Betabloqueador': ['atenolol', 'metoprolol', 'carvedilol', 'bisoprolol', 'propranolol', 'nebivolol', 'labetalol', 'nadolol'],
  'Bloqueador Ca': ['amlodipina', 'nifedipina', 'diltiazem', 'verapamil', 'felodipina', 'lercanidipina', 'lacidipina'],
  'Hipnótico Z': ['zolpidem', 'zopiclona', 'zaleplon'],
  'Antipsicótico': ['haloperidol', 'risperidona', 'quetiapina', 'olanzapina', 'aripiprazol', 'clorpromazina', 'levomepromazina', 'ziprasidona'],
  'Antidepressivo tricíclico': ['amitriptilina', 'nortriptilina', 'clomipramina', 'imipramina', 'desipramina'],
  'ISRS': ['fluoxetina', 'sertralina', 'paroxetina', 'citalopram', 'escitalopram', 'fluvoxamina'],
  'Anticoagulante oral': ['warfarina', 'varfarina', 'dabigatrana', 'rivaroxabana', 'apixabana', 'edoxabana'],
  'Antiagregante': ['acido acetilsalicilico', 'clopidogrel', 'ticagrelor', 'prasugrel', 'dipiridamol'],
  'Diurético de alça': ['furosemida', 'bumetanida', 'torasemida', 'piretanida'],
  'Diurético tiazídico': ['hidroclorotiazida', 'clortalidona', 'indapamida', 'bendroflumetiazida'],
}

// ─── Funções Utilitárias ─────────────────────────────────────────────────────

function findInteractions(medications: MedicationContext[]) {
  const results: Array<{ med1: MedicationContext; med2: MedicationContext; interaction: KnownInteraction }> = []
  for (let i = 0; i < medications.length; i++) {
    for (let j = i + 1; j < medications.length; j++) {
      for (const interaction of KNOWN_INTERACTIONS) {
        const n1 = norm(medications[i].activeIngredient)
        const n2 = norm(medications[j].activeIngredient)
        const d1 = norm(interaction.drug1)
        const d2 = norm(interaction.drug2)
        if ((n1.includes(d1) && n2.includes(d2)) || (n1.includes(d2) && n2.includes(d1))) {
          results.push({ med1: medications[i], med2: medications[j], interaction })
        }
      }
    }
  }
  return results
}

function checkDuplicateTherapy(medications: MedicationContext[]) {
  const duplicates: Array<{ group: MedicationContext[]; reason: string }> = []
  for (const [className, keywords] of Object.entries(CLASS_KEYWORDS)) {
    const matching = medications.filter(med =>
      keywords.some(kw => norm(med.activeIngredient).includes(norm(kw)))
    )
    if (matching.length > 1) {
      duplicates.push({
        group: matching,
        reason: `${matching.length} medicamentos da classe ${className} em uso simultâneo: ${matching.map(m => m.activeIngredient).join(', ')}.`,
      })
    }
  }
  return duplicates
}

// ─── PRM Finders ──────────────────────────────────────────────────────────────

function findNecessityPRMs(context: PatientContext): PRMFindingResult[] {
  const findings: PRMFindingResult[] = []

  // Automedicação sem indicação
  for (const med of context.medications.filter(m => m.isSelfMedication && !m.indication)) {
    findings.push({
      category: PRMCategory.NECESSITY,
      riskLevel: RiskLevel.MODERATE,
      title: `Automedicação sem indicação registrada: ${med.activeIngredient}`,
      description: `Paciente usa ${med.activeIngredient} por automedicação sem indicação clínica documentada.`,
      clinicalEvidence: `Medicamento "${med.activeIngredient}" marcado como automedicação sem indicação terapêutica associada.`,
      potentialImpact: 'Uso de medicamento potencialmente desnecessário. Risco de efeitos adversos sem benefício terapêutico justificado.',
      pharmacistConduct: 'Investigar o motivo da automedicação. Orientar sobre riscos. Verificar se há problema de saúde não tratado. Discutir com o prescritor se necessário.',
      patientGuidance: 'Evite tomar medicamentos sem orientação profissional. Informe seu farmacêutico ou médico sobre todos os medicamentos em uso.',
      needsReferral: false,
      needsPrescriberContact: true,
      monitoring: 'Verificar evolução clínica e necessidade terapêutica real.',
      reevaluationPeriod: '30 dias',
      confidenceLevel: 'moderate',
      validationNote: 'Verificar com o paciente o motivo real do uso e histórico clínico completo.',
      interventionDeadline: 'Próxima consulta',
      medicationId: med.id,
    })
  }

  // Duplicidade terapêutica
  for (const dup of checkDuplicateTherapy(context.medications)) {
    findings.push({
      category: PRMCategory.NECESSITY,
      riskLevel: RiskLevel.MODERATE,
      title: 'Duplicidade terapêutica detectada',
      description: dup.reason,
      clinicalEvidence: `Medicamentos da mesma classe em uso simultâneo: ${dup.group.map(m => m.activeIngredient).join(', ')}.`,
      potentialImpact: 'Risco aumentado de efeitos adversos sem benefício adicional. Possível interação de classe.',
      pharmacistConduct: 'Verificar se a combinação é intencional. Caso contrário, discutir com o prescritor a racionalização do esquema.',
      patientGuidance: 'Informe ao seu médico que está usando múltiplos medicamentos semelhantes.',
      needsReferral: false,
      needsPrescriberContact: true,
      monitoring: 'Avaliar resposta terapêutica e racionalização do esquema.',
      reevaluationPeriod: '30 dias',
      confidenceLevel: 'moderate',
      validationNote: 'Confirmar com prescritor se a combinação é intencional.',
      interventionDeadline: 'Próxima consulta',
    })
  }

  // Condição não tratada (necessidade não atendida)
  const diagnosesText = context.diagnoses.map(d => norm(d.name)).join(' ')
  const medText = context.medications.map(m => norm(m.activeIngredient) + ' ' + norm(m.indication || '')).join(' ')

  const untreatedCheck = [
    { cond: 'hipertensão', keys: ['hipertens', 'pressao alta'], treat: ['enalapril', 'losartana', 'amlodipina', 'hidroclorotiazida', 'atenolol', 'captopril', 'ramipril', 'anti-hipertensivo', 'valsartana', 'metoprolol', 'bisoprolol', 'carvedilol'] },
    { cond: 'diabetes', keys: ['diabet', 'hiperglicemi', 'dm2'], treat: ['metformina', 'insulina', 'glibenclamida', 'sitagliptina', 'vildagliptina', 'saxagliptina', 'dapagliflozina', 'empagliflozina', 'gliclazida', 'glimepirida', 'pioglitazona'] },
    { cond: 'dislipidemia', keys: ['dislipidemi', 'hipercolesterol', 'hipertrigliceri', 'ldl elevado'], treat: ['sinvastatina', 'atorvastatina', 'rosuvastatina', 'pravastatina', 'fibrato', 'ezetimiba', 'estatina'] },
    { cond: 'hipotireoidismo', keys: ['hipotireoidismo', 'tsh elevado'], treat: ['levotiroxina', 'tiroxina', 't4'] },
    { cond: 'osteoporose', keys: ['osteoporose'], treat: ['alendronato', 'risedronato', 'zoledronato', 'denosumabe', 'ibandronato', 'vitamina d', 'colecalciferol'] },
  ]

  for (const item of untreatedCheck) {
    const hasDiagnosis = item.keys.some(k => diagnosesText.includes(k))
    const hasTreatment = item.treat.some(t => medText.includes(norm(t)))
    if (hasDiagnosis && !hasTreatment) {
      findings.push({
        category: PRMCategory.NECESSITY,
        riskLevel: RiskLevel.MODERATE,
        title: `Possível necessidade terapêutica não atendida: ${item.cond}`,
        description: `Diagnóstico de ${item.cond} registrado sem medicamento específico identificado.`,
        clinicalEvidence: `Diagnóstico: ${item.cond}. Nenhum medicamento habitual para esta condição localizado na lista atual.`,
        potentialImpact: 'Condição potencialmente não tratada, com risco de progressão e complicações.',
        pharmacistConduct: 'Verificar com o prescritor se há tratamento não-farmacológico, medicamento não listado ou tratamento pendente.',
        patientGuidance: 'Pergunte ao seu médico se precisa de medicamento para tratar esta condição.',
        needsReferral: false,
        needsPrescriberContact: true,
        monitoring: 'Acompanhar evolução clínica da condição.',
        reevaluationPeriod: '15-30 dias',
        confidenceLevel: 'low',
        validationNote: 'Pode haver tratamento não listado ou abordagem não-farmacológica. Confirmar com o prescritor.',
        interventionDeadline: 'Próxima consulta',
      })
    }
  }

  // START v3 — tratamentos que deveriam ser iniciados
  for (const criterion of START_CRITERIA) {
    const hasCondition = criterion.conditionKeywords.some(k => diagnosesText.includes(norm(k)))
    if (!hasCondition) continue
    const hasTreatment = criterion.missingDrugs.some(d => medText.includes(norm(d)))
    if (!hasTreatment) {
      findings.push({
        category: PRMCategory.NECESSITY,
        riskLevel: RiskLevel.MODERATE,
        title: `START v3: Tratamento indicado possivelmente ausente — ${criterion.condition}`,
        description: criterion.recommendation,
        clinicalEvidence: `Condição detectada: ${criterion.condition}. Medicamento da classe indicada não identificado na lista atual.`,
        potentialImpact: 'Subtratamento de condição clínica com evidência de benefício farmacológico estabelecido.',
        pharmacistConduct: 'Verificar com o prescritor a indicação e oportunidade de iniciar o tratamento recomendado pelos critérios START v3.',
        patientGuidance: 'Pergunte ao seu médico sobre as opções de tratamento disponíveis para sua condição.',
        needsReferral: false,
        needsPrescriberContact: true,
        monitoring: 'Acompanhar resposta ao tratamento se iniciado.',
        reevaluationPeriod: '30 dias',
        confidenceLevel: 'low',
        validationNote: 'Critério START v3. Pode haver contraindicação ou tratamento alternativo já estabelecido. Discussão com prescritor obrigatória.',
        interventionDeadline: 'Próxima consulta',
      })
    }
  }

  return findings
}

function findEffectivenessPRMs(context: PatientContext): PRMFindingResult[] {
  const findings: PRMFindingResult[] = []

  // Adesão comprometida
  for (const med of context.medications.filter(m => m.adherence === AdherenceLevel.POOR || m.adherence === AdherenceLevel.MODERATE)) {
    const isPoor = med.adherence === AdherenceLevel.POOR
    findings.push({
      category: PRMCategory.EFFECTIVENESS,
      riskLevel: isPoor ? RiskLevel.HIGH : RiskLevel.MODERATE,
      title: `${isPoor ? 'Baixa' : 'Adesão moderada'} ao tratamento: ${med.activeIngredient}`,
      description: `Paciente apresenta ${isPoor ? 'baixa' : 'adesão moderada'} ao uso de ${med.activeIngredient}.`,
      clinicalEvidence: `Adesão registrada como "${med.adherence}" para ${med.activeIngredient}${med.indication ? ` (indicação: ${med.indication})` : ''}.`,
      potentialImpact: 'Falha terapêutica por uso irregular. Risco de agravamento da condição tratada.',
      pharmacistConduct: 'Investigar barreiras (custo, efeitos adversos, esquema complexo). Aplicar estratégias motivacionais. Simplificar esquema se possível.',
      patientGuidance: 'Use seu medicamento regularmente. Informe ao farmacêutico se tiver dificuldades para usar o medicamento.',
      needsReferral: false,
      needsPrescriberContact: isPoor,
      monitoring: 'Reavaliar adesão a cada consulta.',
      reevaluationPeriod: isPoor ? '15 dias' : '30 dias',
      confidenceLevel: 'high',
      validationNote: 'Verificar com o paciente os motivos específicos e adequar a intervenção.',
      interventionDeadline: isPoor ? 'Imediato' : 'Próxima consulta',
      medicationId: med.id,
    })
  }

  // Esquema posológico complexo
  const complexMeds = context.medications.filter(m => m.frequencyHours && m.frequencyHours <= 6)
  if (complexMeds.length > 0) {
    findings.push({
      category: PRMCategory.EFFECTIVENESS,
      riskLevel: RiskLevel.LOW,
      title: `Esquema posológico complexo (${complexMeds.length} medicamento(s) com ≥ 4 doses/dia)`,
      description: 'Múltiplas doses diárias dificultam a adesão ao tratamento.',
      clinicalEvidence: `Medicamentos com intervalo ≤ 6h: ${complexMeds.map(m => m.activeIngredient).join(', ')}.`,
      potentialImpact: 'Esquemas complexos reduzem a adesão e, consequentemente, a efetividade terapêutica.',
      pharmacistConduct: 'Verificar se é possível simplificar (formulações de liberação prolongada, ajuste de horários).',
      patientGuidance: 'Use um organizador de medicamentos ou alarmes. Converse com seu médico sobre simplificar os horários.',
      needsReferral: false,
      needsPrescriberContact: true,
      monitoring: 'Avaliar adesão e efetividade após simplificação.',
      reevaluationPeriod: '30 dias',
      confidenceLevel: 'moderate',
      validationNote: 'Avaliar contexto individual do paciente.',
      interventionDeadline: 'Próxima consulta',
    })
  }

  // Polifarmácia
  if (context.medications.length >= 5) {
    findings.push({
      category: PRMCategory.EFFECTIVENESS,
      riskLevel: context.medications.length >= 10 ? RiskLevel.HIGH : context.medications.length >= 8 ? RiskLevel.MODERATE : RiskLevel.LOW,
      title: `Polifarmácia — ${context.medications.length} medicamentos em uso`,
      description: `Paciente em uso de ${context.medications.length} medicamentos simultaneamente.`,
      clinicalEvidence: `Total: ${context.medications.length} medicamentos: ${context.medications.map(m => m.activeIngredient).join(', ')}.`,
      potentialImpact: 'Polifarmácia aumenta risco de interações, erros de medicação, redução da adesão e hospitalizações.',
      pharmacistConduct: 'Realizar revisão abrangente da farmacoterapia (reconciliação medicamentosa). Identificar candidatos à desprescrição.',
      patientGuidance: 'Leve sempre a lista completa de medicamentos a cada consulta.',
      needsReferral: false,
      needsPrescriberContact: context.medications.length >= 8,
      monitoring: 'Revisar periodicamente, especialmente após internações.',
      reevaluationPeriod: '60-90 dias',
      confidenceLevel: 'high',
      validationNote: 'Polifarmácia pode ser clinicamente justificada. Análise individual de cada medicamento é necessária.',
      interventionDeadline: 'Próxima consulta',
    })
  }

  return findings
}

function findSafetyPRMs(context: PatientContext): PRMFindingResult[] {
  const findings: PRMFindingResult[] = []

  // Interações medicamentosas
  for (const { med1, med2, interaction } of findInteractions(context.medications)) {
    const riskLevel = interaction.severity === 'contraindicated' ? RiskLevel.URGENT
      : interaction.severity === 'major' ? RiskLevel.HIGH
      : interaction.severity === 'moderate' ? RiskLevel.MODERATE
      : RiskLevel.LOW
    findings.push({
      category: PRMCategory.SAFETY,
      riskLevel,
      title: `Interação medicamentosa ${interaction.severity === 'contraindicated' ? 'CONTRAINDICADA' : interaction.severity === 'major' ? 'GRAVE' : interaction.severity === 'moderate' ? 'MODERADA' : 'MENOR'}: ${med1.activeIngredient} + ${med2.activeIngredient}`,
      description: `Interação ${interaction.severity} entre ${med1.activeIngredient} e ${med2.activeIngredient}.`,
      clinicalEvidence: `Mecanismo: ${interaction.mechanism}. Efeito clínico: ${interaction.clinicalEffect}.`,
      potentialImpact: interaction.clinicalEffect,
      pharmacistConduct: interaction.management,
      patientGuidance: 'Não altere seus medicamentos por conta própria. Informe seu médico sobre esta interação e fique atento a sintomas incomuns.',
      needsReferral: riskLevel === RiskLevel.URGENT,
      needsPrescriberContact: riskLevel === RiskLevel.HIGH || riskLevel === RiskLevel.URGENT,
      monitoring: 'Monitorar sinais de toxicidade ou falha terapêutica.',
      reevaluationPeriod: riskLevel === RiskLevel.URGENT ? 'Imediato' : '7-15 dias',
      confidenceLevel: 'high',
      validationNote: 'A relevância clínica depende de fatores individuais. Avaliação profissional essencial.',
      interventionDeadline: riskLevel === RiskLevel.URGENT ? 'Imediato' : riskLevel === RiskLevel.HIGH ? '24-48h' : 'Próxima consulta',
      medicationId: med1.id,
    })
  }

  // Gestação — contraindicados
  if (context.isPregnant) {
    for (const med of context.medications) {
      const n = norm(med.activeIngredient)
      const isContra = PREGNANCY_CONTRAINDICATED.some(d => n.includes(norm(d)))
      const isCaution = !isContra && PREGNANCY_CAUTION.some(d => n.includes(norm(d)))
      if (isContra) {
        findings.push({
          category: PRMCategory.SAFETY,
          riskLevel: RiskLevel.URGENT,
          title: `URGENTE — Medicamento contraindicado na gestação: ${med.activeIngredient}`,
          description: `${med.activeIngredient} é contraindicado ou de alto risco durante a gravidez.`,
          clinicalEvidence: `Paciente gestante${context.gestationalAge ? ` (${context.gestationalAge} sem)` : ''} em uso de ${med.activeIngredient}.`,
          potentialImpact: 'Risco de teratogenicidade, restrição de crescimento fetal ou complicações obstétricas.',
          pharmacistConduct: 'URGENTE: Comunicar ao prescritor imediatamente. Não suspender sem orientação médica. Discutir alternativas seguras.',
          patientGuidance: 'Informe seu médico IMEDIATAMENTE que está grávida e usa este medicamento.',
          needsReferral: true,
          needsPrescriberContact: true,
          monitoring: 'Acompanhamento obstétrico rigoroso com avaliação fetal.',
          reevaluationPeriod: 'Imediato',
          confidenceLevel: 'high',
          validationNote: 'Avaliação individualizada com obstetrícia e farmacologia clínica.',
          interventionDeadline: 'Imediato — 24 horas',
          medicationId: med.id,
        })
      } else if (isCaution) {
        findings.push({
          category: PRMCategory.SAFETY,
          riskLevel: RiskLevel.HIGH,
          title: `Cautela na gestação: ${med.activeIngredient}`,
          description: `${med.activeIngredient} requer avaliação cuidadosa do risco-benefício na gravidez.`,
          clinicalEvidence: `Paciente gestante${context.gestationalAge ? ` (${context.gestationalAge} sem)` : ''} em uso de ${med.activeIngredient}.`,
          potentialImpact: 'Possível risco ao feto dependendo do trimestre, dose e duração.',
          pharmacistConduct: 'Revisar indicação. Discutir risco-benefício com o prescritor. Verificar alternativas mais seguras.',
          patientGuidance: 'Informe ao obstetra todos os medicamentos em uso.',
          needsReferral: false,
          needsPrescriberContact: true,
          monitoring: 'Pré-natal rigoroso com avaliação do desenvolvimento fetal.',
          reevaluationPeriod: '7 dias',
          confidenceLevel: 'moderate',
          validationNote: 'A segurança depende do trimestre e dose. Avaliação pelo obstetra é imprescindível.',
          interventionDeadline: '48-72 horas',
          medicationId: med.id,
        })
      }
    }
  }

  // Lactação
  if (context.isLactating) {
    for (const med of context.medications) {
      const n = norm(med.activeIngredient)
      const isContra = LACTATION_CONTRAINDICATED.some(d => n.includes(norm(d)))
      const isCaution = !isContra && LACTATION_CAUTION.some(d => n.includes(norm(d)))
      if (isContra) {
        findings.push({
          category: PRMCategory.SAFETY,
          riskLevel: RiskLevel.URGENT,
          title: `URGENTE — Medicamento contraindicado na lactação: ${med.activeIngredient}`,
          description: `${med.activeIngredient} é contraindicado durante a amamentação.`,
          clinicalEvidence: `Paciente em lactação usando ${med.activeIngredient}, medicamento com passagem significativa para o leite materno ou toxicidade neonatal documentada.`,
          potentialImpact: 'Risco de toxicidade para o lactente.',
          pharmacistConduct: 'Comunicar ao prescritor. Avaliar suspensão do medicamento ou da amamentação conforme caso.',
          patientGuidance: 'Informe seu médico que está amamentando e usa este medicamento.',
          needsReferral: true,
          needsPrescriberContact: true,
          monitoring: 'Monitorar o lactente quanto a sintomas adversos.',
          reevaluationPeriod: 'Imediato',
          confidenceLevel: 'high',
          validationNote: 'Avaliar com pediatra e prescritor.',
          interventionDeadline: 'Imediato',
          medicationId: med.id,
        })
      } else if (isCaution) {
        findings.push({
          category: PRMCategory.SAFETY,
          riskLevel: RiskLevel.MODERATE,
          title: `Cautela na lactação: ${med.activeIngredient}`,
          description: `${med.activeIngredient} requer avaliação na amamentação.`,
          clinicalEvidence: `Paciente em lactação em uso de ${med.activeIngredient}.`,
          potentialImpact: 'Possível passagem para o leite materno com risco para o lactente.',
          pharmacistConduct: 'Verificar compatibilidade (Lactmed, e-Lactancia). Discutir com prescritor.',
          patientGuidance: 'Informe seu médico e pediatra sobre todos os medicamentos em uso.',
          needsReferral: false,
          needsPrescriberContact: true,
          monitoring: 'Monitorar lactente quanto a sonolência, dificuldade de sucção ou irritabilidade.',
          reevaluationPeriod: '7 dias',
          confidenceLevel: 'moderate',
          validationNote: 'Consultar LactMed ou e-Lactancia para informação atualizada.',
          interventionDeadline: 'Próxima consulta',
          medicationId: med.id,
        })
      }
    }
  }

  // Beers 2023 — idosos
  if (context.isElderly) {
    for (const med of context.medications) {
      const n = norm(med.activeIngredient)
      for (const [drug, data] of Object.entries(BEERS_CRITERIA_DRUGS)) {
        if (n.includes(norm(drug))) {
          findings.push({
            category: PRMCategory.SAFETY,
            riskLevel: data.level === 'high' ? RiskLevel.HIGH : RiskLevel.MODERATE,
            title: `Medicamento potencialmente inapropriado para idosos (Beers 2023): ${med.activeIngredient}`,
            description: data.warning,
            clinicalEvidence: `Paciente idoso (${context.age ? `${context.age} anos` : '≥ 60 anos'}) em uso de ${med.activeIngredient} — listado nos Critérios de Beers 2023 (AGS).`,
            potentialImpact: 'Risco aumentado de quedas, fraturas, delirium, hospitalização e morte em idosos.',
            pharmacistConduct: 'Revisar necessidade. Avaliar alternativas mais seguras. Discutir desprescrição gradual com prescritor.',
            patientGuidance: 'Peça uma revisão de todos os seus medicamentos ao médico e farmacêutico.',
            needsReferral: false,
            needsPrescriberContact: true,
            monitoring: 'Avaliar risco de quedas, estado cognitivo e função renal.',
            suggestedExams: 'Avaliação de quedas, MEEM, creatinina/ClCr.',
            reevaluationPeriod: '30 dias',
            confidenceLevel: 'high',
            validationNote: 'Critérios de Beers 2023 (AGS). Aplicabilidade individual deve ser avaliada com o prescritor.',
            interventionDeadline: 'Próxima consulta',
            medicationId: med.id,
          })
          break
        }
      }
    }

    // STOPP v3 — idosos com condições específicas
    const diagnosesText = context.diagnoses.map(d => norm(d.name)).join(' ') + ' ' + norm(context.chiefComplaint || '')
    for (const criterion of STOPP_CRITERIA) {
      const hasCondition = criterion.conditionKeywords.some(k => diagnosesText.includes(norm(k)))
      if (!hasCondition) continue
      for (const med of context.medications) {
        const n = norm(med.activeIngredient)
        const matchesDrug = criterion.drugs.some(d => n.includes(norm(d)))
        if (matchesDrug) {
          findings.push({
            category: PRMCategory.SAFETY,
            riskLevel: criterion.level === 'high' ? RiskLevel.HIGH : RiskLevel.MODERATE,
            title: `STOPP v3: ${med.activeIngredient} inapropriado em "${criterion.condition}"`,
            description: criterion.warning,
            clinicalEvidence: `Paciente idoso com diagnóstico relacionado a "${criterion.condition}" em uso de ${med.activeIngredient}.`,
            potentialImpact: 'Risco de evento adverso grave relacionado à combinação do medicamento com a condição clínica.',
            pharmacistConduct: 'Revisar com o prescritor a continuidade do medicamento. Avaliar alternativas mais seguras para a condição.',
            patientGuidance: 'Não interrompa o medicamento por conta própria. Discuta com seu médico.',
            needsReferral: false,
            needsPrescriberContact: true,
            monitoring: 'Monitorar agravamento da condição clínica.',
            reevaluationPeriod: '30 dias',
            confidenceLevel: 'moderate',
            validationNote: 'Critério STOPP v3 (2023). Avaliação individualizada com o prescritor é obrigatória.',
            interventionDeadline: 'Próxima consulta',
            medicationId: med.id,
          })
        }
      }
    }
  }

  // Ajuste renal
  if (context.renalFunction && context.renalFunction !== 'normal') {
    for (const med of context.medications) {
      const n = norm(med.activeIngredient)
      for (const [drug, warning] of Object.entries(RENAL_ADJUSTMENT_REQUIRED)) {
        if (n.includes(norm(drug))) {
          findings.push({
            category: PRMCategory.SAFETY,
            riskLevel: (context.renalFunction === 'severe_impairment' || context.renalFunction === 'failure') ? RiskLevel.HIGH : RiskLevel.MODERATE,
            title: `Ajuste de dose em IR necessário: ${med.activeIngredient}`,
            description: warning,
            clinicalEvidence: `Função renal: ${context.renalFunction}${context.creatinineClearance ? ` (ClCr: ${context.creatinineClearance} mL/min)` : ''}. Medicamento: ${med.activeIngredient}.`,
            potentialImpact: 'Acúmulo do medicamento e toxicidade por clearance renal reduzido.',
            pharmacistConduct: 'Verificar adequação de dose e intervalo para a função renal atual. Comunicar ao prescritor.',
            patientGuidance: 'Informe sempre ao médico sobre problemas nos rins.',
            needsReferral: false,
            needsPrescriberContact: true,
            monitoring: 'Monitorar creatinina, ureia, ClCr e sinais de toxicidade.',
            suggestedExams: 'Creatinina sérica, ureia, eletrólitos, ClCr calculado.',
            reevaluationPeriod: '15-30 dias',
            confidenceLevel: 'moderate',
            validationNote: 'Ajuste de dose individualizado baseado no ClCr atual.',
            interventionDeadline: '48 horas',
            medicationId: med.id,
          })
          break
        }
      }
    }
  }

  // Ajuste hepático
  if (context.hepaticFunction && context.hepaticFunction !== 'normal') {
    for (const med of context.medications) {
      const n = norm(med.activeIngredient)
      for (const [drug, warning] of Object.entries(HEPATIC_ADJUSTMENT_REQUIRED)) {
        if (n.includes(norm(drug))) {
          findings.push({
            category: PRMCategory.SAFETY,
            riskLevel: context.hepaticFunction === 'severe_impairment' ? RiskLevel.HIGH : RiskLevel.MODERATE,
            title: `Cautela em hepatopatia: ${med.activeIngredient}`,
            description: warning,
            clinicalEvidence: `Função hepática comprometida (${context.hepaticFunction}). Medicamento: ${med.activeIngredient}.`,
            potentialImpact: 'Risco de acúmulo e hepatotoxicidade adicional.',
            pharmacistConduct: 'Verificar dose máxima para a função hepática. Comunicar ao prescritor.',
            patientGuidance: 'Informe ao médico sobre problemas no fígado. Evite automedicação.',
            needsReferral: false,
            needsPrescriberContact: true,
            monitoring: 'TGO, TGP, GGT, bilirrubinas, TP/INR, albumina.',
            suggestedExams: 'TGO, TGP, GGT, bilirrubinas, TP/INR, albumina, Child-Pugh.',
            reevaluationPeriod: '30 dias',
            confidenceLevel: 'moderate',
            validationNote: 'Usar escore de Child-Pugh para orientar ajustes.',
            interventionDeadline: 'Próxima consulta',
            medicationId: med.id,
          })
          break
        }
      }
    }
  }

  // Alergias
  for (const allergy of context.allergies) {
    for (const med of context.medications) {
      const allergyN = norm(allergy.substance)
      const medN = norm(med.activeIngredient)
      const tradeN = med.tradeName ? norm(med.tradeName) : ''
      if (medN.includes(allergyN) || allergyN.includes(medN) || (tradeN && (tradeN.includes(allergyN) || allergyN.includes(tradeN)))) {
        findings.push({
          category: PRMCategory.SAFETY,
          riskLevel: allergy.severity === 'anaphylaxis' ? RiskLevel.URGENT : RiskLevel.HIGH,
          title: `ALERTA DE ALERGIA: ${med.activeIngredient}`,
          description: `Paciente possui alergia registrada a "${allergy.substance}" e está em uso de "${med.activeIngredient}".`,
          clinicalEvidence: `Alergia: ${allergy.substance} | Reação: ${allergy.reaction || 'não especificada'} | Gravidade: ${allergy.severity || 'não especificada'}. Medicamento em uso: ${med.activeIngredient}.`,
          potentialImpact: 'Risco de reação alérgica — de urticária à anafilaxia com risco de vida.',
          pharmacistConduct: 'URGENTE: Verificar relação real entre alergia e medicamento. Comunicar ao prescritor imediatamente.',
          patientGuidance: 'Informe IMEDIATAMENTE ao médico que tem alergia a este medicamento.',
          needsReferral: allergy.severity === 'anaphylaxis',
          needsPrescriberContact: true,
          monitoring: 'Monitorar: urticária, angioedema, broncoespasmo, hipotensão.',
          reevaluationPeriod: 'Imediato',
          confidenceLevel: 'high',
          validationNote: 'Correlação deve ser confirmada clinicamente. Podem existir reações cruzadas.',
          interventionDeadline: 'Imediato',
          medicationId: med.id,
        })
      }
    }
  }

  return findings
}

function findAdherencePRMs(context: PatientContext): PRMFindingResult[] {
  const findings: PRMFindingResult[] = []

  for (const med of context.medications) {
    const effects = (med.adverseEffects || '').toLowerCase()
    const hasCostIssue = ['caro', 'custo', 'preco', 'acesso', 'nao consigo comprar', 'falta'].some(k => effects.includes(k))
    const hasFormIssue = ['engolir', 'comprimido', 'dificuldade', 'forma', 'grande demais', 'pastilha'].some(k => effects.includes(k))

    if (hasCostIssue) {
      findings.push({
        category: PRMCategory.ADHERENCE,
        riskLevel: RiskLevel.MODERATE,
        title: `Barreira financeira ao tratamento: ${med.activeIngredient}`,
        description: 'Paciente relata dificuldade financeira ou de acesso ao medicamento.',
        clinicalEvidence: `Relato de custo/acesso para: ${med.activeIngredient}.`,
        potentialImpact: 'Descontinuação do tratamento por barreira financeira.',
        pharmacistConduct: 'Orientar sobre Farmácia Popular, genéricos, programas de pacientes e alternativas terapêuticas de menor custo.',
        patientGuidance: 'Pergunte sobre versões genéricas ou programas de assistência. Verifique a Farmácia Popular do Brasil.',
        needsReferral: false,
        needsPrescriberContact: true,
        monitoring: 'Confirmar acesso regular ao medicamento.',
        reevaluationPeriod: '30 dias',
        confidenceLevel: 'moderate',
        validationNote: 'Verificar alternativas com o prescritor.',
        interventionDeadline: 'Próxima consulta',
        medicationId: med.id,
      })
    }

    if (hasFormIssue) {
      findings.push({
        category: PRMCategory.ADHERENCE,
        riskLevel: RiskLevel.LOW,
        title: `Dificuldade com forma farmacêutica: ${med.activeIngredient}`,
        description: 'Paciente relata dificuldade relacionada à forma farmacêutica.',
        clinicalEvidence: `Dificuldade de uso de ${med.activeIngredient} (${med.pharmaceuticalForm || 'forma não especificada'}).`,
        potentialImpact: 'Não adesão por dificuldade de administração.',
        pharmacistConduct: 'Verificar formas farmacêuticas alternativas (solução oral, manipulação). Orientar técnica correta.',
        patientGuidance: 'Informe ao farmacêutico sobre a dificuldade. Pode haver outras formas disponíveis.',
        needsReferral: false,
        needsPrescriberContact: true,
        monitoring: 'Verificar se a alternativa resolve o problema de adesão.',
        reevaluationPeriod: '30 dias',
        confidenceLevel: 'moderate',
        validationNote: 'Verificar disponibilidade e custo de alternativas antes de recomendar mudança.',
        interventionDeadline: 'Próxima consulta',
        medicationId: med.id,
      })
    }
  }

  return findings
}

// ─── SOAP Generator ───────────────────────────────────────────────────────────

function generateSOAP(context: PatientContext, findings: PRMFindingResult[]): SOAPSuggestion {
  const urgent = findings.filter(f => f.riskLevel === RiskLevel.URGENT)
  const high = findings.filter(f => f.riskLevel === RiskLevel.HIGH)

  const subjective = `Paciente ${context.age ? `de ${context.age} anos` : ''}${context.sex ? `, ${context.sex === 'MALE' ? 'sexo masculino' : context.sex === 'FEMALE' ? 'sexo feminino' : 'outro sexo'}` : ''}. ${
    context.diagnoses.length > 0 ? `Diagnósticos: ${context.diagnoses.map(d => d.name).join(', ')}. ` : ''
  }${context.isPregnant ? `Gestante${context.gestationalAge ? ` (${context.gestationalAge} semanas)` : ''}. ` : ''
  }${context.isLactating ? 'Em lactação. ' : ''
  }Em uso de ${context.medications.length} medicamento(s). ${
    context.medications.some(m => m.adherence === AdherenceLevel.POOR) ? 'Relata dificuldade de adesão. ' : ''
  }${context.allergies.length > 0 ? `Alergias: ${context.allergies.map(a => a.substance).join(', ')}. ` : ''
  }${context.chiefComplaint ? `Queixa principal: ${context.chiefComplaint}. ` : ''}`

  const objective = `Medicamentos em uso: ${context.medications.map(m =>
    `${m.activeIngredient}${m.dose ? ` ${m.dose}${m.doseUnit || ''}` : ''}${m.frequency ? ` (${m.frequency})` : ''}`
  ).join('; ')}. ${context.labResults.length > 0
    ? `Exames: ${context.labResults.map(l => `${l.examName}: ${l.value}${l.unit || ''}${l.isAbnormal ? ' (ALTERADO)' : ''}`).join('; ')}.`
    : 'Exames laboratoriais: não informados.'
  } ${context.renalFunction ? `Função renal: ${context.renalFunction}${context.creatinineClearance ? ` (ClCr: ${context.creatinineClearance} mL/min)` : ''}. ` : ''
  }${context.hepaticFunction ? `Função hepática: ${context.hepaticFunction}.` : ''}`

  const assessment = `Identificados ${findings.length} PRM(s). ${
    urgent.length > 0 ? `⚠️ URGENTE: ${urgent.map(f => f.title).join('; ')}. ` : ''
  }${high.length > 0 ? `Alto risco: ${high.map(f => f.title).join('; ')}. ` : ''
  }Por categoria: Necessidade (${findings.filter(f => f.category === 'NECESSITY').length}), Efetividade (${findings.filter(f => f.category === 'EFFECTIVENESS').length}), Segurança (${findings.filter(f => f.category === 'SAFETY').length}), Adesão (${findings.filter(f => f.category === 'ADHERENCE').length}). Análise gerada por ferramenta de apoio — deve ser validada por profissional habilitado.`

  const plan = `Intervenções farmacêuticas propostas:\n${
    findings.filter(f => f.riskLevel === RiskLevel.URGENT || f.riskLevel === RiskLevel.HIGH)
      .map(f => `• [${f.riskLevel}] ${f.title}: ${f.pharmacistConduct}`).join('\n') || '• Sem intervenções urgentes.'
  }\n\n${findings.some(f => f.needsPrescriberContact) ? `Comunicação com prescritor recomendada: ${findings.filter(f => f.needsPrescriberContact).map(f => f.title).join('; ')}.\n` : ''
  }${findings.some(f => f.needsReferral) ? `Encaminhamento: ${findings.filter(f => f.needsReferral).map(f => f.title).join('; ')}.\n` : ''
  }Reavaliação: ${findings.some(f => f.riskLevel === RiskLevel.URGENT) ? '24-48 horas' : findings.some(f => f.riskLevel === RiskLevel.HIGH) ? '7 dias' : '30 dias'}.`

  return { subjective, objective, assessment, plan }
}

// ─── Data Quality Checks ──────────────────────────────────────────────────────

function checkDataQuality(context: PatientContext): string[] {
  const warnings: string[] = []
  if (!context.age) warnings.push('Idade não informada — análise de risco etário limitada.')
  if (!context.sex) warnings.push('Sexo biológico não informado — algumas análises podem estar incompletas.')
  if (!context.renalFunction) warnings.push('Função renal não informada — ajuste de dose renal não avaliado.')
  if (!context.hepaticFunction) warnings.push('Função hepática não informada — ajuste de dose hepático não avaliado.')
  if (context.diagnoses.length === 0) warnings.push('Nenhum diagnóstico registrado — análise de necessidade terapêutica limitada.')
  if (context.medications.some(m => !m.dose)) warnings.push('Dose não informada para um ou mais medicamentos.')
  if (context.medications.some(m => m.adherence === AdherenceLevel.UNKNOWN)) warnings.push('Adesão desconhecida para um ou mais medicamentos.')
  if (context.labResults.length === 0) warnings.push('Nenhum exame laboratorial registrado — monitoramento limitado.')
  return warnings
}

// ─── Main Analysis Function ───────────────────────────────────────────────────

export function analyzePRM(context: PatientContext): AnalysisResult {
  if (context.medications.length === 0) {
    return {
      findings: [],
      summary: 'Nenhum medicamento registrado para análise. Cadastre os medicamentos do paciente para realizar a análise farmacoterapêutica.',
      totalPRMs: 0, urgentPRMs: 0, highRiskPRMs: 0, moderatePRMs: 0, lowRiskPRMs: 0,
      soapSuggestion: { subjective: '', objective: '', assessment: 'Dados insuficientes para análise.', plan: '' },
      dataQualityWarnings: ['Nenhum medicamento registrado.'],
    }
  }

  const allFindings = [
    ...findNecessityPRMs(context),
    ...findEffectivenessPRMs(context),
    ...findSafetyPRMs(context),
    ...findAdherencePRMs(context),
  ]

  const sortOrder: Record<RiskLevel, number> = { URGENT: 0, HIGH: 1, MODERATE: 2, LOW: 3 }
  allFindings.sort((a, b) => sortOrder[a.riskLevel] - sortOrder[b.riskLevel])

  const urgentPRMs = allFindings.filter(f => f.riskLevel === RiskLevel.URGENT).length
  const highRiskPRMs = allFindings.filter(f => f.riskLevel === RiskLevel.HIGH).length
  const moderatePRMs = allFindings.filter(f => f.riskLevel === RiskLevel.MODERATE).length
  const lowRiskPRMs = allFindings.filter(f => f.riskLevel === RiskLevel.LOW).length

  let summary = `Análise farmacoterapêutica concluída. `
  if (allFindings.length === 0) {
    summary += 'Nenhum PRM identificado com as informações disponíveis. Isso não exclui a existência de problemas não detectáveis com os dados fornecidos.'
  } else {
    summary += `Identificados ${allFindings.length} PRM(s): `
    if (urgentPRMs > 0) summary += `${urgentPRMs} urgente(s), `
    if (highRiskPRMs > 0) summary += `${highRiskPRMs} de alto risco, `
    if (moderatePRMs > 0) summary += `${moderatePRMs} moderado(s), `
    if (lowRiskPRMs > 0) summary += `${lowRiskPRMs} de baixo risco. `
    summary = summary.replace(/, $/, '.')
    if (urgentPRMs > 0) summary += ' ⚠️ ATENÇÃO: Há PRMs urgentes que requerem intervenção imediata.'
  }
  summary += ' Esta análise é uma ferramenta de apoio e não substitui a avaliação profissional habilitada.'

  return {
    findings: allFindings,
    summary,
    totalPRMs: allFindings.length,
    urgentPRMs,
    highRiskPRMs,
    moderatePRMs,
    lowRiskPRMs,
    soapSuggestion: generateSOAP(context, allFindings),
    dataQualityWarnings: checkDataQuality(context),
  }
}

export function getTokenCostForAnalysis(medicationCount: number, hasLabResults: boolean) {
  if (hasLabResults || medicationCount > 10) return { type: 'advanced', cost: 5, label: 'Análise Avançada (com exames laboratoriais)' }
  if (medicationCount > 3) return { type: 'complete', cost: 3, label: 'Análise Completa (até 10 medicamentos)' }
  return { type: 'basic', cost: 1, label: 'Análise Básica (até 3 medicamentos)' }
}
