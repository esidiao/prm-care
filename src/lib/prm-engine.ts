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
import { RENAL_FUNCTION_LABELS, HEPATIC_FUNCTION_LABELS } from '@/lib/utils'
import { canonicalizeDrug } from '@/lib/drug-aliases'

function labelRenal(v?: string | null) { return v ? (RENAL_FUNCTION_LABELS[v] || v) : '—' }
function labelHepatic(v?: string | null) { return v ? (HEPATIC_FUNCTION_LABELS[v] || v) : '—' }

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
  { drug1: 'sinvastatina', drug2: 'claritromicina', severity: 'major', mechanism: 'Claritromicina é potente inibidor de CYP3A4', clinicalEffect: 'Rabdomiólise', management: 'Suspender sinvastatina durante uso do antibiótico.' },  { drug1: 'atorvastatina', drug2: 'claritromicina', severity: 'major', mechanism: 'Inibição de CYP3A4', clinicalEffect: 'Miopatia grave', management: 'Suspender atorvastatina durante claritromicina ou usar azitromicina.' },
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
  // Quelação de quinolonas por cátions (ferro/cálcio) e bifosfonato por cálcio
  { drug1: 'ciprofloxacino', drug2: 'ferro', severity: 'moderate', mechanism: 'Quelação da fluoroquinolona pelo ferro (cátion di/trivalente)', clinicalEffect: 'Redução marcante da absorção do antibiótico — risco de falha terapêutica', management: 'Tomar o ciprofloxacino 2h antes ou 6h após o sulfato ferroso.' },
  { drug1: 'ciprofloxacino', drug2: 'calcio', severity: 'moderate', mechanism: 'Quelação da fluoroquinolona pelo cálcio', clinicalEffect: 'Redução da absorção do antibiótico', management: 'Separar a administração do ciprofloxacino e do cálcio (2h antes ou 6h após). Evitar tomar com leite/laticínios.' },
  { drug1: 'levofloxacino', drug2: 'calcio', severity: 'moderate', mechanism: 'Quelação da fluoroquinolona por cátions di/trivalentes', clinicalEffect: 'Redução da absorção do antibiótico', management: 'Separar levofloxacino de cálcio/ferro/antiácidos por ≥2h.' },
  { drug1: 'levofloxacino', drug2: 'ferro', severity: 'moderate', mechanism: 'Quelação pelo ferro', clinicalEffect: 'Redução da absorção do antibiótico', management: 'Separar a administração por ≥2h.' },
  { drug1: 'alendronato', drug2: 'calcio', severity: 'moderate', mechanism: 'Cálcio (e outros cátions) reduz a absorção já baixa do bifosfonato por quelação', clinicalEffect: 'Falha terapêutica do bifosfonato (sem proteção óssea)', management: 'Tomar o alendronato em jejum, com água, 30–60 min antes de qualquer alimento, cálcio ou outro medicamento.' },
  { drug1: 'levofloxacino', drug2: 'omeprazol', severity: 'moderate', mechanism: 'Inibição CYP2C19', clinicalEffect: 'Possível aumento da concentração do antibiótico e risco de QT longo', management: 'Monitorar ECG em pacientes de risco.' },
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

  // CLOPIDOGREL + IBP (CYP2C19)
  { drug1: 'clopidogrel', drug2: 'omeprazol', severity: 'major', mechanism: 'Omeprazol inibe a CYP2C19, que ativa o clopidogrel (pró-fármaco)', clinicalEffect: 'Redução do efeito antiplaquetário e maior risco de eventos trombóticos', management: 'Preferir pantoprazol (menor inibição) ou avaliar necessidade do IBP.' },
  { drug1: 'clopidogrel', drug2: 'esomeprazol', severity: 'major', mechanism: 'Esomeprazol inibe a CYP2C19', clinicalEffect: 'Perda de eficácia antiplaquetária do clopidogrel', management: 'Trocar por pantoprazol ou reavaliar o IBP.' },

  // NITRATO + INIBIDOR DE PDE5 (hipotensão grave)
  { drug1: 'isossorbida', drug2: 'sildenafila', severity: 'contraindicated', mechanism: 'Potencialização do efeito vasodilatador (via GMPc)', clinicalEffect: 'Hipotensão grave/potencialmente fatal', management: 'Contraindicado. Não associar; respeitar intervalo de segurança entre as classes.' },
  { drug1: 'isossorbida', drug2: 'tadalafila', severity: 'contraindicated', mechanism: 'Vasodilatação aditiva por inibição da PDE5', clinicalEffect: 'Hipotensão grave', management: 'Contraindicado.' },
  { drug1: 'nitroglicerina', drug2: 'sildenafila', severity: 'contraindicated', mechanism: 'Sinergismo vasodilatador', clinicalEffect: 'Hipotensão refratária', management: 'Contraindicado (inclui uso de nitrato de resgate).' },

  // OPIOIDE + BENZODIAZEPÍNICO (depressão respiratória — tarja preta)
  { drug1: 'morfina', drug2: 'diazepam', severity: 'major', mechanism: 'Depressão aditiva do SNC e do drive respiratório', clinicalEffect: 'Sedação profunda, depressão respiratória, óbito', management: 'Evitar a combinação; se imprescindível, menor dose/tempo e monitorização.' },
  { drug1: 'tramadol', drug2: 'clonazepam', severity: 'major', mechanism: 'Depressão aditiva do SNC', clinicalEffect: 'Sedação e depressão respiratória', management: 'Evitar; orientar sinais de alerta e revisar necessidade.' },
  { drug1: 'codeina', drug2: 'alprazolam', severity: 'major', mechanism: 'Depressão respiratória aditiva (opioide + benzodiazepínico)', clinicalEffect: 'Risco de hipoventilação e óbito', management: 'Evitar a associação.' },

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
  { drug1: 'carbamazepina', drug2: 'claritromicina', severity: 'major', mechanism: 'Inibição de CYP3A4 eleva nível de carbamazepina', clinicalEffect: 'Toxicidade: diplopia, ataxia, confusão mental', management: 'Monitorar nível sérico. Considerar alternativa ao antibiótico.' },  { drug1: 'quetiapina', drug2: 'fluconazol', severity: 'major', mechanism: 'Inibição de CYP3A4 eleva quetiapina', clinicalEffect: 'Prolongamento de QT e sedação excessiva', management: 'Monitorar ECG. Reduzir dose de quetiapina.' },

  // ── CYP2D6 ─────────────────────────────────────────────────────────────────
  { drug1: 'paroxetina', drug2: 'tamoxifeno', severity: 'major', mechanism: 'Paroxetina inibe CYP2D6, reduzindo conversão de tamoxifeno em endoxifeno (metabólito ativo)', clinicalEffect: 'Redução de até 65% do efeito antiestrogênico do tamoxifeno — risco de falha terapêutica no câncer de mama', management: 'Contraindicado. Substituir por sertralina, venlafaxina ou mirtazapina, que têm menor impacto no CYP2D6.' },
  { drug1: 'fluoxetina', drug2: 'tamoxifeno', severity: 'major', mechanism: 'Fluoxetina inibe CYP2D6 — mesma interação da paroxetina', clinicalEffect: 'Falha terapêutica no tratamento do câncer de mama', management: 'Evitar combinação. Usar antidepressivo alternativo (sertralina, venlafaxina).' },
  { drug1: 'paroxetina', drug2: 'codeina', severity: 'moderate', mechanism: 'Inibição de CYP2D6 reduz conversão de codeína em morfina (metabólito ativo)', clinicalEffect: 'Analgesia reduzida — falha terapêutica da codeína', management: 'Usar analgésico alternativo (tramadol com cautela, morfina em doses reduzidas).' },
  { drug1: 'bupropiona', drug2: 'tramadol', severity: 'major', mechanism: 'Inibição de CYP2D6 + rebaixamento do limiar convulsivo por ambos os medicamentos', clinicalEffect: 'Risco significativo de convulsões', management: 'Evitar combinação. Monitorar rigorosamente se inevitável. Não usar em epilépticos.' },
  { drug1: 'amiodarona', drug2: 'flecainida', severity: 'major', mechanism: 'Inibição de CYP2D6 pela amiodarona eleva níveis de flecainida', clinicalEffect: 'Toxicidade por flecainida: arritmias proarrítmicas e bloqueio de condução', management: 'Reduzir dose de flecainida em 50%. Monitorar ECG rigorosamente.' },
  { drug1: 'haloperidol', drug2: 'paroxetina', severity: 'moderate', mechanism: 'Paroxetina inibe CYP2D6, elevando nível de haloperidol', clinicalEffect: 'Toxicidade por haloperidol: efeitos extrapiramidais, sedação excessiva, QT longo', management: 'Monitorar nível plasmático de haloperidol e ECG. Reduzir dose se necessário.' },

  // ── CYP3A4 — novos pares ────────────────────────────────────────────────────
  { drug1: 'rifampicina', drug2: 'varfarina', severity: 'major', mechanism: 'Rifampicina é potente indutor de CYP2C9 e CYP3A4 — aumenta metabolismo da warfarina', clinicalEffect: 'Redução drástica do INR e falha anticoagulante — risco tromboembólico', management: 'Monitorar INR 2x por semana. Geralmente necessário aumentar dose de warfarina em 2-5x.' },
  { drug1: 'rifampicina', drug2: 'sinvastatina', severity: 'major', mechanism: 'Rifampicina induz CYP3A4 fortemente', clinicalEffect: 'Redução de até 90% nos níveis de sinvastatina — falha terapêutica', management: 'Monitorar lipidograma. Considerar dobrar ou triplicar dose da estatina durante rifampicina.' },
  { drug1: 'rifampicina', drug2: 'atorvastatina', severity: 'major', mechanism: 'Indução de CYP3A4', clinicalEffect: 'Redução marcante dos níveis de atorvastatina', management: 'Monitorar lipidograma e ajustar dose.' },
  // Indutores enzimáticos + anticoncepcional hormonal → falha contraceptiva
  { drug1: 'rifampicina', drug2: 'etinilestradiol', severity: 'major', mechanism: 'Rifampicina induz CYP3A4 e acelera o metabolismo do estrogênio/progestagênio', clinicalEffect: 'Redução da eficácia do anticoncepcional — risco de falha contraceptiva e gravidez não planejada', management: 'Orientar método contraceptivo adicional (de barreira) durante e até 4 semanas após o uso. Considerar método não hormonal/DIU.' },
  { drug1: 'carbamazepina', drug2: 'etinilestradiol', severity: 'major', mechanism: 'Carbamazepina induz CYP3A4 — reduz níveis de estrogênio/progestagênio', clinicalEffect: 'Falha contraceptiva e gravidez não planejada (carbamazepina também é teratogênica)', management: 'Recomendar contracepção não hormonal/DIU de cobre ou método de barreira adicional. Discutir planejamento reprodutivo.' },
  { drug1: 'fenitoina', drug2: 'etinilestradiol', severity: 'major', mechanism: 'Fenitoína induz CYP3A4', clinicalEffect: 'Redução da eficácia contraceptiva', management: 'Usar contracepção adicional/não hormonal. Avaliar antiepiléptico alternativo se desejo reprodutivo.' },
  { drug1: 'fenobarbital', drug2: 'etinilestradiol', severity: 'major', mechanism: 'Fenobarbital induz CYP3A4', clinicalEffect: 'Falha contraceptiva', management: 'Recomendar método contraceptivo adicional ou não hormonal.' },
  { drug1: 'topiramato', drug2: 'etinilestradiol', severity: 'moderate', mechanism: 'Topiramato em doses ≥200 mg/dia induz CYP3A4', clinicalEffect: 'Possível redução da eficácia contraceptiva (dose-dependente)', management: 'Em doses altas, orientar contracepção adicional.' },
  { drug1: 'hiperico', drug2: 'etinilestradiol', severity: 'major', mechanism: 'Erva-de-são-joão (Hypericum) induz CYP3A4 e P-gp', clinicalEffect: 'Redução da eficácia contraceptiva e de outros fármacos (varfarina, ciclosporina, ISRS)', management: 'Evitar erva-de-são-joão com anticoncepcional e outros fármacos de janela estreita. Orientar contracepção adicional.' },
  { drug1: 'hiperico', drug2: 'varfarina', severity: 'major', mechanism: 'Indução de CYP enzimas pela erva-de-são-joão', clinicalEffect: 'Redução do INR e falha anticoagulante', management: 'Evitar a associação. Monitorar INR se uso inadvertido.' },
  { drug1: 'fluconazol', drug2: 'sildenafila', severity: 'major', mechanism: 'Inibição de CYP3A4 e CYP2C9 eleva nível de sildenafila', clinicalEffect: 'Hipotensão grave, priapismo e toxicidade sistêmica', management: 'Reduzir dose de sildenafila para 25 mg. Monitorar PA.' },
  { drug1: 'itraconazol', drug2: 'sinvastatina', severity: 'major', mechanism: 'Inibição intensa de CYP3A4', clinicalEffect: 'Elevação > 10x dos níveis de sinvastatina — rabdomiólise', management: 'Contraindicado. Suspender sinvastatina durante itraconazol.' },
  // DOAC + inibidores potentes de CYP3A4/P-gp → risco hemorrágico
  { drug1: 'rivaroxabana', drug2: 'itraconazol', severity: 'major', mechanism: 'Inibição dupla de CYP3A4 e P-glicoproteína eleva a exposição à rivaroxabana', clinicalEffect: 'Aumento do efeito anticoagulante e risco de sangramento maior', management: 'Evitar a associação (azólicos potentes e inibidores de protease são contraindicados com rivaroxabana). Preferir antifúngico alternativo e monitorar sinais de sangramento.' },
  { drug1: 'rivaroxabana', drug2: 'cetoconazol', severity: 'major', mechanism: 'Inibição potente de CYP3A4/P-gp', clinicalEffect: 'Risco hemorrágico aumentado', management: 'Evitar. Usar antifúngico alternativo (ex.: fluconazol com cautela) e monitorar.' },
  { drug1: 'rivaroxabana', drug2: 'claritromicina', severity: 'moderate', mechanism: 'Inibição de CYP3A4/P-gp eleva a rivaroxabana', clinicalEffect: 'Aumento do risco de sangramento (maior em disfunção renal)', management: 'Cautela; preferir azitromicina. Monitorar sinais de sangramento, sobretudo se TFG reduzida.' },
  { drug1: 'apixabana', drug2: 'itraconazol', severity: 'major', mechanism: 'Inibição dupla de CYP3A4 e P-gp eleva a apixabana', clinicalEffect: 'Aumento do efeito anticoagulante e risco hemorrágico', management: 'Evitar a associação com inibidores potentes de CYP3A4/P-gp. Antifúngico alternativo.' },
  { drug1: 'apixabana', drug2: 'cetoconazol', severity: 'major', mechanism: 'Inibição potente de CYP3A4/P-gp', clinicalEffect: 'Risco hemorrágico aumentado', management: 'Evitar; preferir alternativa.' },
  // Estatina + fibrato (genfibrozila) → miopatia/rabdomiólise
  { drug1: 'sinvastatina', drug2: 'genfibrozila', severity: 'major', mechanism: 'Genfibrozila inibe a glicuronidação e o transporte da estatina, elevando seus níveis', clinicalEffect: 'Miopatia e rabdomiólise', management: 'Combinação contraindicada (genfibrozila + estatina). Se fibrato necessário, preferir fenofibrato com cautela e monitorar CK/sintomas musculares.' },
  { drug1: 'atorvastatina', drug2: 'genfibrozila', severity: 'major', mechanism: 'Genfibrozila eleva níveis da estatina', clinicalEffect: 'Risco de miopatia/rabdomiólise', management: 'Evitar genfibrozila com estatina; preferir fenofibrato e monitorar CK.' },
  { drug1: 'claritromicina', drug2: 'midazolam', severity: 'major', mechanism: 'Inibição de CYP3A4', clinicalEffect: 'Sedação profunda e apneia', management: 'Contraindicado com midazolam oral. Reduzir dose IV e monitorar.' },
  { drug1: 'eritromicina', drug2: 'sinvastatina', severity: 'major', mechanism: 'Inibição de CYP3A4', clinicalEffect: 'Miopatia grave e rabdomiólise', management: 'Suspender sinvastatina durante eritromicina. Usar azitromicina como alternativa.' },
  { drug1: 'cetoconazol', drug2: 'sinvastatina', severity: 'major', mechanism: 'Inibição potente de CYP3A4', clinicalEffect: 'Rabdomiólise', management: 'Contraindicado. Suspender estatina.' },
  { drug1: 'verapamil', drug2: 'sinvastatina', severity: 'moderate', mechanism: 'Inibição de CYP3A4', clinicalEffect: 'Aumento dos níveis de sinvastatina — miopatia', management: 'Limitar sinvastatina a 10 mg/dia com verapamil.' },
  { drug1: 'diltiazem', drug2: 'sinvastatina', severity: 'moderate', mechanism: 'Inibição de CYP3A4', clinicalEffect: 'Aumento moderado dos níveis de sinvastatina', management: 'Limitar sinvastatina a 10 mg/dia. Monitorar sintomas musculares.' },

  // ── CYP1A2 ─────────────────────────────────────────────────────────────────
  { drug1: 'ciprofloxacino', drug2: 'clozapina', severity: 'major', mechanism: 'Inibição de CYP1A2 eleva nível de clozapina', clinicalEffect: 'Toxicidade por clozapina: sedação extrema, convulsões, agranulocitose', management: 'Evitar combinação. Monitorar nível sérico de clozapina e hemograma.' },
  { drug1: 'fluvoxamina', drug2: 'olanzapina', severity: 'major', mechanism: 'Inibição potente de CYP1A2', clinicalEffect: 'Aumento dos níveis de olanzapina — sedação e toxicidade', management: 'Reduzir dose de olanzapina em 50%. Monitorar sinais de toxicidade.' },
  { drug1: 'fluvoxamina', drug2: 'teofilina', severity: 'major', mechanism: 'Inibição de CYP1A2 reduz metabolismo da teofilina', clinicalEffect: 'Toxicidade por teofilina: arritmias, convulsões, náusea', management: 'Monitorar nível sérico de teofilina. Reduzir dose em 50%.' },
  { drug1: 'fluvoxamina', drug2: 'clozapina', severity: 'major', mechanism: 'Potente inibidor de CYP1A2', clinicalEffect: 'Toxicidade grave por clozapina', management: 'Combinação de alto risco. Monitorar nível sérico intensivamente.' },

  // ── QT longo — pares de alto risco ─────────────────────────────────────────
  { drug1: 'haloperidol', drug2: 'ciprofloxacino', severity: 'major', mechanism: 'Ambos prolongam intervalo QT por mecanismos distintos', clinicalEffect: 'Torsades de pointes e morte súbita', management: 'Monitorar ECG. Evitar combinação ou usar alternativas para QT.' },
  { drug1: 'amiodarona', drug2: 'ciprofloxacino', severity: 'major', mechanism: 'Efeito aditivo no prolongamento do QT', clinicalEffect: 'Torsades de pointes', management: 'Monitorar QTc. Preferir outro antibiótico.' },
  { drug1: 'quetiapina', drug2: 'ciprofloxacino', severity: 'major', mechanism: 'Ambos prolongam QT', clinicalEffect: 'Arritmia ventricular grave', management: 'Monitorar ECG. Preferir amoxicilina ou cefalexina.' },
  { drug1: 'domperidona', drug2: 'claritromicina', severity: 'major', mechanism: 'Bloqueio de canal hERG aditivo — ambos prolongam QT', clinicalEffect: 'Torsades de pointes', management: 'Contraindicado. Suspender domperidona ou usar metoclopramida com cautela.' },
  { drug1: 'domperidona', drug2: 'fluconazol', severity: 'major', mechanism: 'Inibição de CYP3A4 eleva domperidona + bloqueio aditivo de canal de potássio', clinicalEffect: 'Torsades de pointes', management: 'Evitar combinação. Monitorar ECG se inevitável.' },
  { drug1: 'ondansetrona', drug2: 'amiodarona', severity: 'major', mechanism: 'Prolongamento aditivo do QT', clinicalEffect: 'Arritmia ventricular e Torsades de pointes', management: 'Monitorar QTc. Preferir metoclopramida em pacientes com amiodarona.' },
  { drug1: 'risperidona', drug2: 'ciprofloxacino', severity: 'moderate', mechanism: 'Ambos prolongam QT', clinicalEffect: 'Arritmia ventricular', management: 'Monitorar ECG. Preferir antibiótico alternativo.' },
  { drug1: 'metadona', drug2: 'ciprofloxacino', severity: 'major', mechanism: 'Metadona é potente prolongador de QT + inibição CYP3A4', clinicalEffect: 'Torsades de pointes de alto risco', management: 'Contraindicado. Usar amoxicilina ou cefalosporina.' },
  { drug1: 'metadona', drug2: 'fluconazol', severity: 'major', mechanism: 'Inibição de CYP3A4 + bloqueio aditivo de canal de potássio', clinicalEffect: 'Torsades de pointes', management: 'Evitar. Monitorar ECG se inevitável. Considerar alternativa antifúngica.' },

  // ── Bloqueio duplo do SRAA (IECA + BRA) ────────────────────────────────────
  { drug1: 'enalapril', drug2: 'losartana', severity: 'major', mechanism: 'Bloqueio duplo do SRAA: IECA + BRA-II em combinação', clinicalEffect: 'Hipercalemia grave, hipotensão e insuficiência renal aguda — sem benefício cardiovascular adicional comprovado', management: 'Contraindicado pela guideline ESC 2023 e FDA. Suspender um dos agentes. Monitorar K⁺ e creatinina.' },
  { drug1: 'enalapril', drug2: 'valsartana', severity: 'major', mechanism: 'Duplo bloqueio SRAA', clinicalEffect: 'Hipercalemia e IRA', management: 'Contraindicado exceto em situações específicas com monitoramento intensivo.' },
  { drug1: 'captopril', drug2: 'losartana', severity: 'major', mechanism: 'Duplo bloqueio SRAA', clinicalEffect: 'Hipercalemia, hipotensão e IRA', management: 'Suspender um dos agentes. ONTARGET trial demonstrou sem benefício e maior risco renal.' },
  { drug1: 'ramipril', drug2: 'losartana', severity: 'major', mechanism: 'Duplo bloqueio SRAA', clinicalEffect: 'Hipercalemia e IRA', management: 'Contraindicado. Usar apenas um agente bloqueador do SRAA.' },

  // ── Anticoagulantes combinados ──────────────────────────────────────────────
  { drug1: 'rivaroxabana', drug2: 'warfarina', severity: 'contraindicated', mechanism: 'Anticoagulação excessiva por mecanismos aditivos', clinicalEffect: 'Hemorragia potencialmente fatal', management: 'Contraindicado absoluto. Usar apenas um anticoagulante por vez.' },
  { drug1: 'apixabana', drug2: 'warfarina', severity: 'contraindicated', mechanism: 'Anticoagulação dupla sem benefício adicional', clinicalEffect: 'Risco hemorrágico extremo', management: 'Contraindicado absoluto.' },
  { drug1: 'dabigatrana', drug2: 'warfarina', severity: 'contraindicated', mechanism: 'Dupla anticoagulação', clinicalEffect: 'Hemorragia grave', management: 'Contraindicado. Transição deve ser orientada pelo médico com washout adequado.' },

  // ── Hipoglicemiantes ────────────────────────────────────────────────────────
  { drug1: 'metformina', drug2: 'furosemida', severity: 'moderate', mechanism: 'Furosemida pode elevar creatinina por desidratação, contraindicando metformina', clinicalEffect: 'Risco de acidose lática se função renal deteriorar', management: 'Monitorar função renal regularmente. Suspender metformina se ClCr < 30 mL/min.' },
  { drug1: 'glibenclamida', drug2: 'ciprofloxacino', severity: 'moderate', mechanism: 'Fluoroquinolonas causam disglicemia (hipo e hiperglicemia)', clinicalEffect: 'Hipoglicemia intensa e prolongada, especialmente em idosos', management: 'Monitorar glicemia 3-4x/dia durante antibioticoterapia.' },
  { drug1: 'insulina', drug2: 'corticoide', severity: 'moderate', mechanism: 'Corticosteroides elevam a glicemia por resistência insulínica e glicogenólise', clinicalEffect: 'Hiperglicemia rebelde ao tratamento com insulina', management: 'Monitorar glicemia com mais frequência. Ajustar doses de insulina.' },

  // ── Outros ─────────────────────────────────────────────────────────────────
  { drug1: 'acido valproico', drug2: 'lamotrigina', severity: 'major', mechanism: 'Ácido valpróico inibe glucuronidação da lamotrigina (UGT enzimas)', clinicalEffect: 'Aumento de até 100% nos níveis de lamotrigina — toxicidade: ataxia, diplopia, Stevens-Johnson', management: 'Reduzir dose de lamotrigina em 50% quando iniciando valproato. Monitorar nível sérico.' },
  { drug1: 'acido valproico', drug2: 'carbamazepina', severity: 'moderate', mechanism: 'Interação farmacocinética bidirecional com variação imprevisível nos níveis', clinicalEffect: 'Toxicidade por carbamazepina ou redução do valproato', management: 'Monitorar níveis séricos de ambos os anticonvulsivantes mensalmente.' },
  { drug1: 'lítio', drug2: 'enalapril', severity: 'major', mechanism: 'IECA reduz excreção renal de lítio', clinicalEffect: 'Toxicidade por lítio: tremor, confusão, insuficiência renal', management: 'Monitorar litemias semanalmente no início. Ajustar dose de lítio.' },  { drug1: 'alopurinol', drug2: 'azatioprina', severity: 'major', mechanism: 'Alopurinol inibe xantina oxidase — impede inativação da azatioprina', clinicalEffect: 'Toxicidade grave por azatioprina: leucopenia, infecções oportunistas', management: 'Contraindicado. Se inevitável, reduzir azatioprina em 75%. Monitorar hemograma semanalmente.' },
  { drug1: 'metotrexato', drug2: 'trimetoprima', severity: 'major', mechanism: 'Inibição aditiva do folato', clinicalEffect: 'Toxicidade hematológica grave: pancitopenia', management: 'Evitar combinação. Monitorar hemograma se impossível evitar.' },
  { drug1: 'metotrexato', drug2: 'sulfametoxazol', severity: 'contraindicated', mechanism: 'Sulfametoxazol-trimetoprima (cotrimoxazol) soma antifolato ao metotrexato e desloca-o de proteínas plasmáticas', clinicalEffect: 'Pancitopenia/mielossupressão grave, potencialmente fatal', management: 'Combinação a evitar (contraindicada). Preferir outro antibiótico. Se inevitável, monitorar hemograma de perto e ácido folínico (leucovorin) conforme orientação.' },
  { drug1: 'metotrexato', drug2: 'naproxeno', severity: 'major', mechanism: 'AINE reduz a excreção renal do metotrexato', clinicalEffect: 'Toxicidade por metotrexato: mucosite, pancitopenia, nefrotoxicidade', management: 'Evitar AINEs com metotrexato. Preferir paracetamol; se inevitável, hidratar e monitorar hemograma e função renal.' },
  { drug1: 'metotrexato', drug2: 'diclofenaco', severity: 'major', mechanism: 'AINE reduz a excreção renal do metotrexato', clinicalEffect: 'Toxicidade por metotrexato', management: 'Evitar. Preferir paracetamol; monitorar hemograma e função renal se uso concomitante.' },
  { drug1: 'varfarina', drug2: 'paracetamol', severity: 'moderate', mechanism: 'Paracetamol em doses > 2g/dia inibe CYP2C9 de forma dose-dependente', clinicalEffect: 'Elevação do INR de forma proporcional à dose', management: 'Monitorar INR se uso regular de paracetamol > 2g/dia. Manter menor dose eficaz.' },
]

// ─── 1b. LISTA ISMP BRASIL — MEDICAMENTOS DE ALTO RISCO (MAR) ────────────────
// Fonte: ISMP Brasil (Instituto para Práticas Seguras no Uso de Medicamentos)
// Medicamentos que têm risco inerentemente elevado de causar danos graves quando
// há erros no seu uso — requerem protocolos especiais de verificação.

const ISMP_HIGH_ALERT_DRUGS: Record<string, { risk: string; monitoring: string; level: 'critical' | 'high' }> = {
  // Anticoagulantes
  'warfarina':    { risk: 'MAR: Anticoagulante oral com janela terapêutica estreita. Risco de hemorragia grave ou trombose.', monitoring: 'INR a cada 4-6 semanas em estável. Verificar interações alimentares (vitamina K) e medicamentosas.', level: 'critical' },
  'varfarina':    { risk: 'MAR: Anticoagulante oral com janela terapêutica estreita. Risco de hemorragia grave ou trombose.', monitoring: 'INR a cada 4-6 semanas em estável. Verificar interações alimentares (vitamina K) e medicamentosas.', level: 'critical' },
  'heparina':     { risk: 'MAR: Anticoagulante parenteral — erros de dose são frequentes e fatais.', monitoring: 'TTPA a cada 6h nas primeiras 24h. Monitorar sangramento e plaquetas (HITT).', level: 'critical' },
  'enoxaparina':  { risk: 'MAR: HBPM — ajuste obrigatório em IR e peso extremo. Risco de hemorragia.', monitoring: 'Anti-Xa em obesos, gestantes e IR. Monitorar plaquetas.', level: 'critical' },
  'rivaroxabana': { risk: 'MAR: NOAC — sem antídoto de acesso amplo no Brasil. Risco hemorrágico real.', monitoring: 'Função renal a cada 3-6 meses. Adesão rigorosa. Sem monitoramento rotineiro de INR.', level: 'high' },
  'apixabana':    { risk: 'MAR: NOAC — sem monitoramento laboratorial de rotina, erros difíceis de detectar.', monitoring: 'Função renal semestral. Verificar interações. Orientar sobre sinais de sangramento.', level: 'high' },
  'dabigatrana':  { risk: 'MAR: NOAC — nefrotóxico em IR. Antídoto (idarucizumab) disponível mas de alto custo.', monitoring: 'ClCr a cada 3 meses. Contraindicado se ClCr < 30 mL/min.', level: 'high' },
  // Insulinas
  'insulina':     { risk: 'MAR: Insulina — medicamento de alto risco para hipoglicemia grave. Erros de tipo, dose e hora são frequentes e letais.', monitoring: 'Glicemia capilar antes das refeições e ao deitar. Atenção a tipo (regular, NPH, análogos). Orientar sinais de hipoglicemia.', level: 'critical' },
  // Opioides potentes
  'morfina':      { risk: 'MAR: Opioide potente — risco de depressão respiratória e overdose, especialmente em IR e idosos.', monitoring: 'Monitorar FR, nível de sedação, SpO₂. Ter naloxona disponível.', level: 'critical' },
  'fentanila':    { risk: 'MAR: Opioide altamente potente (100x morfina) — janela terapêutica mínima. Risco de sobredose fatal.', monitoring: 'Monitorar sedação e FR. Não substituir por outros opioides sem conversão de dose.', level: 'critical' },
  'metadona':     { risk: 'MAR: Opioide de longa ação — meia-vida imprevisível (24-72h) e prolongador de QT. Acumulação perigosa.', monitoring: 'ECG (QTc), eletrólitos, FR. Risco de sedação tardia nas primeiras 72h.', level: 'critical' },
  'oxicodona':    { risk: 'MAR: Opioide — alto potencial de abuso e dependência. Risco de depressão respiratória.', monitoring: 'Monitorar sedação, FR. Orientar sobre risco de dependência.', level: 'high' },
  // Imunossupressores
  'metotrexato':  { risk: 'MAR: Imunossupressor/antineoplásico — dose semanal frequentemente confundida com dose diária, causando toxicidade fatal.', monitoring: 'Hemograma e transaminases mensais. CONFIRMAR: dose SEMANAL (não diária). Suplementar ácido fólico.', level: 'critical' },
  'azatioprina':  { risk: 'MAR: Imunossupressor — mielotoxicidade dose-dependente. Interação fatal com alopurinol.', monitoring: 'Hemograma quinzenal no início, mensal após estabilização. Verificar interação com alopurinol.', level: 'high' },
  'ciclosporina': { risk: 'MAR: Imunossupressor com janela terapêutica estreita — nefrotóxico e com múltiplas interações CYP3A4.', monitoring: 'Nível sérico (C₀) a cada 2 semanas inicialmente. Creatinina, PA, magnésio mensais.', level: 'critical' },
  'tacrolimus':   { risk: 'MAR: Imunossupressor com janela terapêutica estreita e alta variabilidade farmacocinética.', monitoring: 'Nível sérico (C₀) a cada 2 semanas. Creatinina, potássio, glicemia mensais.', level: 'critical' },
  // Lítio
  'lítio':        { risk: 'MAR: Lítio — janela terapêutica estreita. Toxicidade em desidratação, dieta hipossódica e interações (AINE, IECA, diuréticos).', monitoring: 'Litemia a cada 3-6 meses (alvo: 0,6-1,0 mEq/L). Função renal e tireoidiana semestrais.', level: 'critical' },
  'litio':        { risk: 'MAR: Lítio — janela terapêutica estreita. Toxicidade em desidratação, dieta hipossódica e interações.', monitoring: 'Litemia a cada 3-6 meses. Função renal e tireoidiana semestrais.', level: 'critical' },
  // Amiodarona
  'amiodarona':   { risk: 'MAR: Antiarrítmico com toxicidade pulmonar, tireoidiana e hepática cumulativa. Meia-vida de 40-55 dias.', monitoring: 'RX tórax, TSH, TGO/TGP e ECG a cada 6 meses. Olhos (microdepósitos córneanos) anualmente.', level: 'critical' },
  // Anticonvulsivantes com janela estreita
  'fenitoina':    { risk: 'MAR: Anticonvulsivante com cinética não-linear — pequenas mudanças de dose causam grandes variações no nível sérico.', monitoring: 'Nível sérico (alvo: 10-20 mcg/mL) a cada 3-6 meses. Atenção a hipoalbuminemia (calcular nível livre).', level: 'high' },
  'fenitoína':    { risk: 'MAR: Anticonvulsivante com cinética não-linear e janela terapêutica estreita.', monitoring: 'Nível sérico a cada 3-6 meses. Albumina para correção do nível livre.', level: 'high' },
  'digoxina':     { risk: 'MAR: Glicosídeo cardíaco — janela terapêutica estreita. Toxicidade aumentada por hipocalemia, hipomagnesemia e IR.', monitoring: 'Nível sérico (alvo: 0,5-0,9 ng/mL), potássio, magnésio, creatinina mensais em estável.', level: 'critical' },
}

// ─── 1c. DROGAS COM RISCO DE PROLONGAMENTO DE QT ─────────────────────────────
// Fonte: CredibleMeds / AHA / ANVISA
// Detecção sistemática de combinações que aumentam risco de Torsades de Pointes

const QT_HIGH_RISK: string[] = [
  'amiodarona', 'sotalol', 'quinidina', 'procainamida', 'disopiramida',
  'droperidol', 'metadona', 'haloperidol', 'clorpromazina', 'levomepromazina',
  'tioridazina', 'ziprasidona', 'amisulprida',
]

const QT_MODERATE_RISK: string[] = [
  'claritromicina', 'eritromicina', 'azitromicina', 'moxifloxacino',
  'ciprofloxacino', 'levofloxacino',
  'fluconazol', 'itraconazol', 'voriconazol',
  'ondansetrona', 'granisetrona', 'domperidona', 'metoclopramida',
  'quetiapina', 'risperidona', 'olanzapina', 'aripiprazol',
  'amitriptilina', 'nortriptilina', 'imipramina', 'clomipramina',
  'citalopram', 'escitalopram',
  'hidroxicloroquina', 'cloroquina',
  'ranolazina', 'ivabradina',
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

  // Outros — antiulcerosos e procinéticos
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

  // ── Beers 2023 — ADIÇÕES (Table 2 e Table 3) ──────────────────────────────

  // Anticolinérgicos — carga (ACB/ADS) — antimuscarínicos respiratórios
  'ipratropio': { warning: 'Broncodilatador anticolinérgico: cautela em idosos com glaucoma de ângulo fechado ou retenção urinária.', level: 'moderate' },
  'tiotrópio': { warning: 'Anticolinérgico inalatório de longa ação: risco de retenção urinária e piora de glaucoma em idosos.', level: 'moderate' },
  'aclidínio': { warning: 'Anticolinérgico inalatório: cautela em idosos com hipertrofia prostática ou glaucoma.', level: 'moderate' },
  'glicopirrônio': { warning: 'Anticolinérgico de longa ação: efeitos sistêmicos em idosos com polifarmácia.', level: 'moderate' },

  // Anticolinérgicos — antiespasmódicos GI
  'butilescopolamina': { warning: 'Antiespasmódico anticolinérgico: risco de delirium e retenção urinária em idosos.', level: 'high' },
  'atropina': { warning: 'Anticolinérgico sistêmico: evitar uso não emergencial em idosos. Taquicardia, retenção urinária, delirium.', level: 'high' },

  // Anticolinérgicos — antidepressivos
  'paroxetina': { warning: 'ISRS com maior atividade anticolinérgica da classe: delirium, constipação, retenção urinária em idosos. Preferir sertralina.', level: 'moderate' },

  // Anticolinérgicos — antieméticos
  'dimenidrinato': { warning: 'Antiemético antihistamínico: alta atividade anticolinérgica — sedação e delirium em idosos.', level: 'high' },
  'meclizina': { warning: 'Antihistamínico H1 anticolinérgico: evitar em idosos. Risco de sedação e queda.', level: 'high' },

  // Hipnóticos não BDZ adicionais
  'melatonina': { warning: 'Uso de melatonina > 0,5 mg em idosos pode causar sedação diurna residual e interações com anticoagulantes.', level: 'moderate' },
  'doxilamina': { warning: 'Antihistamínico hipnótico: sedação excessiva e efeito anticolinérgico. Evitar em idosos.', level: 'high' },

  // Cardiovasculares adicionais
  'disopiramida': { warning: 'Antiarrítmico com forte atividade anticolinérgica e inotrópico negativo. Contraindicado em idosos com ICC.', level: 'high' },
  'reserpina': { warning: 'Anti-hipertensivo central: depressão, sedação e hipotensão ortostática. Contraindicado.', level: 'high' },
  'guanetidina': { warning: 'Anti-hipertensivo de ação periférica: hipotensão ortostática grave em idosos.', level: 'high' },
  'hidralazina': { warning: 'Em monoterapia como anti-hipertensivo em idosos: não recomendado pela baixa eficácia e risco de lúpus farmacológico.', level: 'moderate' },
  'propranolol': { warning: 'Betabloqueador não seletivo: bradicardia, hipoglicemia mascarada e broncoespasmo. Preferir metoprolol ou carvedilol em idosos.', level: 'moderate' },
  'atenolol': { warning: 'Betabloqueador: cautela em idosos — bradicardia e fadiga. Associado a pior desfecho em hipertensão não complicada.', level: 'moderate' },

  // Hipoglicemiantes adicionais
  'insulina nph': { warning: 'Insulina intermediária: perfil de ação imprevisível em idosos — maior risco de hipoglicemia noturna. Considerar análogos de longa ação.', level: 'high' },
  'insulina regular': { warning: 'Insulina de ação rápida em idosos: risco elevado de hipoglicemia. Monitorar glicemia com frequência.', level: 'moderate' },
  'glipizida': { warning: 'Sulfonilureia: risco de hipoglicemia em idosos, especialmente em jejum. Titular com cuidado.', level: 'moderate' },
  'gliclazida': { warning: 'Sulfonilureia: menor risco de hipoglicemia que glibenclamida, mas cautela em idosos com IR.', level: 'moderate' },

  // Antiepiléticos / estabilizadores de humor
  'fenitoína': { warning: 'Antiepiléptico: janela terapêutica estreita, metabolismo saturável não linear — toxicidade imprevisível em idosos. Monitorar nível sérico.', level: 'high' },
  'fenobarbital': { warning: 'Barbitúrico antiepiléptico: sedação, dependência e interações graves. Preferir antiepilépticos de nova geração em idosos.', level: 'high' },
  'carbamazepina': { warning: 'Antiepiléptico: indutor enzimático potente, hiponatremia (SIADH), diplopia e ataxia em idosos. Monitorar sódio.', level: 'high' },
  'ácido valproico': { warning: 'Estabilizador de humor: trombocitopenia, hiperamonemia e encefalopatia em idosos. Monitorar amônia em confusão aguda.', level: 'moderate' },
  'lítio': { warning: 'Estabilizador de humor: janela terapêutica estreita — toxicidade aumentada em idosos com IR, desidratação ou diuréticos.', level: 'high' },
  'gabapentina': { warning: 'Antiepiléptico/neuropático: sedação, tontura e quedas em idosos. Ajuste de dose obrigatório com ClCr < 60 mL/min.', level: 'moderate' },
  'pregabalina': { warning: 'Antiepiléptico/neuropático: sedação, edema e quedas em idosos. Evitar doses altas com IR.', level: 'moderate' },

  // Analgésicos adicionais
  'tramadol': { warning: 'Opioide fraco: risco de convulsões, síndrome serotoninérgica, hiponatremia e delirium em idosos. Precaução redobrada.', level: 'high' },
  'codeína': { warning: 'Pró-fármaco opioide: metabolismo variável por CYP2D6 — risco de toxicidade opioide em metabolizadores ultrarrápidos.', level: 'moderate' },
  'morfina': { warning: 'Opioide: titulação cautelosa em idosos. Reduzir dose inicial em 25-50%. Risco de acumulação de metabólito ativo (M6G) em IR.', level: 'moderate' },

  // Corticosteroides sistêmicos — uso crônico
  'prednisona': { warning: 'Corticosteroide oral: uso crônico em idosos aumenta risco de osteoporose, hiperglicemia, cataratas, imunossupressão e miopatia. Usar a menor dose eficaz.', level: 'moderate' },
  'prednisolona': { warning: 'Corticosteroide: riscos idênticos à prednisona. Suplementar cálcio e vitamina D se uso > 3 meses.', level: 'moderate' },
  'deflazacorte': { warning: 'Corticosteroide: menor impacto ósseo, mas ainda relevante em idosos. Avaliar densitometria óssea.', level: 'moderate' },
  'dexametasona': { warning: 'Corticosteroide potente: hiperglicemia intensa, psicose esteroidal e imunossupressão grave em idosos.', level: 'high' },

  // Antimicrobianos de cautela
  'ciprofloxacino': { warning: 'Fluoroquinolona: risco de tendinopatia/ruptura de tendão, neuropatia periférica e delirium em idosos. Reservar para infecções sem alternativa.', level: 'moderate' },
  'levofloxacino': { warning: 'Fluoroquinolona: mesmos riscos do ciprofloxacino. Prolongamento de QT e hipoglicemia em idosos diabéticos.', level: 'moderate' },

  // Vitaminas/suplementos em dose excessiva
  'vitamina e': { warning: 'Suplementação de vitamina E > 400 UI/dia em idosos: sem benefício comprovado e possível aumento de mortalidade cardiovascular. Evitar.', level: 'moderate' },
  'vitamina a': { warning: 'Vitamina A em altas doses: hepatotóxico, teratogênico e risco de fraturas osteoporóticas em idosos. Não suplementar sem indicação.', level: 'moderate' },

  // Anticoagulantes — janela estreita
  'varfarina': { warning: 'Anticoagulante: monitorar INR rigorosamente em idosos. Risco de sangramento 2-3x maior. Avaliar NOACs como alternativa mais segura.', level: 'moderate' },

  // Urológicos — alfa-bloqueadores (já há alguns, adicionar)
  'tansulosina': { warning: 'Alfa-bloqueador seletivo: hipotensão ortostática e síndrome da íris flácida intraoperatória (IFIS) em cirurgia de catarata. Informar oftalmologista.', level: 'moderate' },
  'alfuzosina': { warning: 'Alfa-bloqueador: hipotensão ortostática em idosos. Cuidado com hipotensores concomitantes.', level: 'moderate' },

  // Antidepressivos — ISRS (hipona tremia / SIADH)
  'fluoxetina': { warning: 'ISRS: hiponatremia (SIADH) em idosos, especialmente nas primeiras semanas. Monitorar sódio. Meia-vida muito longa — acumulação.', level: 'moderate' },
  'escitalopram': { warning: 'ISRS: hiponatremia e prolongamento de QT em altas doses em idosos. Dose máxima recomendada: 10 mg/dia em > 65 anos.', level: 'moderate' },
  'citalopram': { warning: 'ISRS: prolongamento de QT dose-dependente. Dose máxima em idosos: 20 mg/dia (FDA). Monitorar ECG.', level: 'high' },
  'venlafaxina': { warning: 'IRSN: hipertensão, hiponatremia e descontinuação abrupta problemática em idosos. Reduzir dose gradualmente.', level: 'moderate' },

  // Antiparkinsoniano
  'levodopa': { warning: 'Antiparkinsoniano: hipotensão ortostática, alucinações e psicose em idosos. Titular lentamente e monitorar PA ortostática.', level: 'moderate' },
  'pramipexol': { warning: 'Agonista dopaminérgico: comportamento compulsivo (jogo, hipersexualidade), sonolência súbita e hipotensão em idosos.', level: 'high' },
  'ropinirol': { warning: 'Agonista dopaminérgico: mesmo perfil de risco do pramipexol. Cautela em idosos.', level: 'high' },
  'biperideno': { warning: 'Anticolinérgico antiparkinsoniano: delirium, constipação grave e retenção urinária em idosos.', level: 'high' },
  'tri-hexifenidil': { warning: 'Anticolinérgico antiparkinsoniano: alta atividade anticolinérgica central — delirium. Evitar em idosos.', level: 'high' },
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
  // STOPP v3 — novos critérios
  {
    drugs: ['pioglitazona'],
    condition: 'Insuficiência cardíaca',
    conditionKeywords: ['insuficiencia cardiaca', 'ic ', 'icc', 'fe reduzida', 'edema por ic'],
    warning: 'STOPP v3: Pioglitazona contraindicada na insuficiência cardíaca — retenção de líquidos e piora do edema.',
    level: 'high',
  },
  {
    drugs: ['pioglitazona', 'rosiglitazona'],
    condition: 'Fratura óssea',
    conditionKeywords: ['fratura', 'osteoporose', 'risco de fratura'],
    warning: 'STOPP v3: Glitazonas aumentam risco de fraturas ósseas, especialmente em mulheres.',
    level: 'moderate',
  },
  {
    drugs: ['tramadol', 'codeina', 'morfina', 'oxicodona', 'fentanila'],
    condition: 'Constipação intestinal',
    conditionKeywords: ['constipacao', 'obstipacao', 'prisao de ventre', 'intestino preso'],
    warning: 'STOPP v3: Opioides pioram a constipação. Laxativo osmótico ou estimulante deve ser prescrito concomitantemente.',
    level: 'moderate',
  },
  {
    drugs: ['diazepam', 'alprazolam', 'clonazepam', 'lorazepam', 'bromazepam', 'midazolam'],
    condition: 'DPOC',
    conditionKeywords: ['dpoc', 'doenca pulmonar obstrutiva', 'enfisema', 'bronquite cronica'],
    warning: 'STOPP v3: Benzodiazepínicos deprimem o drive respiratório em DPOC — risco de hipercapnia e insuficiência respiratória.',
    level: 'high',
  },
  {
    drugs: ['acido acetilsalicilico', 'clopidogrel'],
    condition: 'Ausência de doença cardiovascular',
    conditionKeywords: ['uso profilatico', 'prevencao primaria', 'sem doenca coronariana', 'sem historico cardiovascular'],
    warning: 'STOPP v3: Dupla antiagregação sem indicação cardiovascular documentada (síndrome coronariana aguda ou stent recente) — risco hemorrágico sem benefício.',
    level: 'moderate',
  },
  {
    drugs: ['metoclopramida', 'domperidona'],
    condition: 'Doença de Parkinson',
    conditionKeywords: ['parkinson', 'doenca de parkinson', 'parkinsonismo'],
    warning: 'STOPP v3: Antidopaminérgicos (metoclopramida, domperidona) agravam os sintomas motores do Parkinson.',
    level: 'high',
  },
  {
    drugs: ['ibuprofeno', 'naproxeno', 'diclofenaco', 'meloxicam', 'indometacina', 'celecoxibe', 'nimesulida'],
    condition: 'Hipertensão arterial',
    conditionKeywords: ['hipertensao', 'pressao alta', 'has ', 'hipertenso'],
    warning: 'STOPP v3: AINEs elevam a pressão arterial em média 3-5 mmHg e antagonizam anti-hipertensivos. Evitar em HAS não controlada.',
    level: 'moderate',
  },
  {
    drugs: ['clorpropamida', 'glibenclamida'],
    condition: 'Insuficiência renal',
    conditionKeywords: ['insuficiencia renal', 'drc', 'irc', 'clcr'],
    warning: 'STOPP v3: Sulfonilureias de longa ação (glibenclamida, clorpropamida) contraindicadas em IR — acumulação e hipoglicemia grave prolongada.',
    level: 'high',
  },
  {
    drugs: ['warfarina', 'varfarina', 'dabigatrana', 'rivaroxabana', 'apixabana', 'edoxabana'],
    condition: 'Alto risco de queda',
    conditionKeywords: ['alto risco de queda', 'quedas frequentes', 'instabilidade postural', 'fratura recente'],
    warning: 'STOPP v3: Anticoagulantes em pacientes com alto risco de queda aumentam risco de hemorragia intracraniana. Avaliar risco-benefício da anticoagulação.',
    level: 'moderate',
  },
  {
    drugs: ['omeprazol', 'pantoprazol', 'lansoprazol', 'esomeprazol', 'rabeprazol'],
    condition: 'Uso prolongado sem indicação',
    conditionKeywords: ['sem ulcera', 'sem gerd', 'uso cronico de ibp', 'ibp sem indicacao'],
    warning: 'STOPP v3: IBPs em uso crônico (> 8 semanas) sem indicação clara — risco de deficiência de B12, magnésio, fraturas e infecções por C. difficile.',
    level: 'moderate',
  },
  {
    drugs: ['oxibutinina', 'solifenacina', 'tolterodina', 'darifenacina', 'fesoterodina', 'difenidramina', 'amitriptilina', 'imipramina', 'clomipramina', 'biperideno', 'tri-hexifenidil', 'escopolamina', 'hioscina'],
    condition: 'Hiperplasia prostática benigna / retenção urinária',
    conditionKeywords: ['hiperplasia prostatica', 'hpb', 'prostatismo', 'retencao urinaria', 'bexiga neurogenica', 'esvaziamento vesical incompleto'],
    warning: 'STOPP v3: Anticolinérgicos/antimuscarínicos em HPB ou retenção urinária pioram o esvaziamento vesical — risco de retenção urinária aguda.',
    level: 'high',
  },
  {
    drugs: ['oxibutinina', 'solifenacina', 'tolterodina', 'difenidramina', 'amitriptilina', 'imipramina', 'clomipramina', 'biperideno', 'tri-hexifenidil', 'escopolamina', 'hioscina', 'ipratropio'],
    condition: 'Glaucoma de ângulo fechado',
    conditionKeywords: ['glaucoma de angulo fechado', 'glaucoma agudo', 'glaucoma de angulo estreito'],
    warning: 'STOPP v3: Anticolinérgicos/antimuscarínicos contraindicados no glaucoma de ângulo fechado — risco de crise aguda de glaucoma por midríase.',
    level: 'high',
  },

  // ── Beers 2023 Table 2 — Drug-Disease Interactions (novos critérios) ─────────

  // Demência / comprometimento cognitivo
  {
    drugs: ['difenidramina', 'dimenidrinato', 'prometazina', 'hidroxizina', 'meclizina', 'clorfeniramina', 'escopolamina', 'hioscina', 'oxibutinina', 'solifenacina', 'tolterodina', 'amitriptilina', 'imipramina', 'clomipramina', 'nortriptilina', 'paroxetina', 'tri-hexifenidil', 'biperideno', 'carisoprodol', 'ciclobenzaprina', 'orfenadrina'],
    condition: 'Demência ou comprometimento cognitivo',
    conditionKeywords: ['demencia', 'alzheimer', 'comprometimento cognitivo', 'delirium', 'deficit cognitivo', 'disfuncao cognitiva'],
    warning: 'Beers 2023 (Table 2): Medicamentos anticolinérgicos estão associados a piora cognitiva, delirium e aceleração da progressão da demência. Contraindicados.',
    level: 'high',
  },
  // Parkinson
  {
    drugs: ['haloperidol', 'clorpromazina', 'levomepromazina', 'risperidona', 'olanzapina', 'quetiapina', 'metoclopramida', 'domperidona'],
    condition: 'Doença de Parkinson',
    conditionKeywords: ['parkinson', 'doenca de parkinson', 'sindrome parkinsoniana'],
    warning: 'Beers 2023 (Table 2): Bloqueadores dopaminérgicos agravam o Parkinson — rigidez, bradicinesia e quedas. Evitar. Se necessário antipsicótico, usar clozapina ou quetiapina em doses mínimas.',
    level: 'high',
  },
  // Incontinência urinária / bexiga hiperativa (em mulheres)
  {
    drugs: ['diuréticos de alça', 'furosemida', 'bumetanida', 'torasemida'],
    condition: 'Incontinência urinária',
    conditionKeywords: ['incontinencia urinaria', 'bexiga hiperativa', 'urge-incontinencia'],
    warning: 'Beers 2023 (Table 2): Diuréticos de alça aumentam urgência e frequência urinária, piorando incontinência. Avaliar necessidade e horário de administração.',
    level: 'moderate',
  },
  // Epilepsia / convulsão
  {
    drugs: ['tramadol', 'bupropiona', 'clozapina', 'meperidina', 'teofilina'],
    condition: 'Epilepsia ou história de convulsão',
    conditionKeywords: ['epilepsia', 'convulsao', 'crise epileptica', 'historia de convulsao'],
    warning: 'Beers 2023 (Table 2): Estes medicamentos reduzem o limiar convulsivo. Contraindicados ou de uso cauteloso em pacientes com epilepsia.',
    level: 'high',
  },
  // Glaucoma de ângulo fechado
  {
    drugs: ['difenidramina', 'dimenidrinato', 'prometazina', 'hidroxizina', 'escopolamina', 'hioscina', 'atropina', 'oxibutinina', 'solifenacina', 'tolterodina', 'amitriptilina', 'imipramina', 'biperideno', 'tri-hexifenidil'],
    condition: 'Glaucoma de ângulo fechado',
    conditionKeywords: ['glaucoma angulo fechado', 'glaucoma angular', 'glaucoma'],
    warning: 'Beers 2023 (Table 2): Medicamentos anticolinérgicos precipitam crise aguda de glaucoma de ângulo fechado. Contraindicados. Verificar tipo de glaucoma antes de prescrever.',
    level: 'high',
  },
  // Hipertrofia prostática benigna / retenção urinária
  {
    drugs: ['difenidramina', 'dimenidrinato', 'prometazina', 'hidroxizina', 'escopolamina', 'hioscina', 'atropina', 'oxibutinina', 'solifenacina', 'tolterodina', 'amitriptilina', 'imipramina', 'disopiramida'],
    condition: 'Hipertrofia prostática benigna ou retenção urinária',
    conditionKeywords: ['hipertrofia prostatica', 'hpb', 'retencao urinaria', 'prostatismo', 'bexiga neurogena'],
    warning: 'Beers 2023 (Table 2): Anticolinérgicos causam retenção urinária aguda em homens com HPB ou comprometimento do esvaziamento vesical.',
    level: 'high',
  },
  // Síncope / quedas recorrentes
  {
    drugs: ['haloperidol', 'clorpromazina', 'levomepromazina', 'risperidona', 'olanzapina', 'quetiapina', 'doxazosina', 'prazosina', 'terazosina', 'tansulosina', 'alfuzosina', 'metildopa', 'clonidina', 'nifedipina'],
    condition: 'Síncope ou quedas recorrentes',
    conditionKeywords: ['sincope', 'queda recorrente', 'quedas frequentes', 'hipotensao ortosta', 'ortostase'],
    warning: 'Beers 2023 (Table 2): Medicamentos com ação hipotensora ou sedativa em pacientes com síncope/quedas recorrentes aumentam risco de hospitalização por trauma.',
    level: 'high',
  },
  // Insuficiência cardíaca
  {
    drugs: ['ibuprofeno', 'naproxeno', 'diclofenaco', 'meloxicam', 'indometacina', 'cetorolaco', 'piroxicam', 'nimesulida', 'celecoxibe'],
    condition: 'Insuficiência cardíaca',
    conditionKeywords: ['insuficiencia cardiaca', 'icc', 'ic sistolica', 'ic diastolica', 'feve reduzida'],
    warning: 'Beers 2023 (Table 2): AINEs causam retenção de sódio e água, agravando a ICC e aumentando risco de hospitalização. Contraindicados na ICC.',
    level: 'high',
  },
  // Doença ulcerosa péptica / sangramento GI
  {
    drugs: ['ibuprofeno', 'naproxeno', 'diclofenaco', 'meloxicam', 'indometacina', 'cetorolaco', 'piroxicam', 'nimesulida', 'aspirina', 'ácido acetilsalicílico'],
    condition: 'Úlcera péptica ou sangramento GI',
    conditionKeywords: ['ulcera peptica', 'sangramento gi', 'hemorragia digestiva', 'ulcera gastrica', 'historia de sangramento'],
    warning: 'Beers 2023 (Table 2): AINEs e AAS em altas doses em pacientes com história de úlcera/sangramento GI — alto risco de ressangramento. Se indispensável, associar IBP.',
    level: 'high',
  },
  // Insuficiência renal crônica
  {
    drugs: ['ibuprofeno', 'naproxeno', 'diclofenaco', 'meloxicam', 'indometacina', 'cetorolaco', 'piroxicam', 'nimesulida', 'celecoxibe'],
    condition: 'Insuficiência renal crônica',
    conditionKeywords: ['insuficiencia renal', 'drc', 'irc', 'creatinina elevada', 'tfg reduzida'],
    warning: 'Beers 2023 (Table 2): AINEs causam vasoconstrição aferente renal — risco de IRA aguda sobre crônica, hipercalemia e piora da proteinúria.',
    level: 'high',
  },
  // Osteoporose / risco de fratura
  {
    drugs: ['prednisona', 'prednisolona', 'dexametasona', 'deflazacorte', 'hidrocortisona'],
    condition: 'Osteoporose ou risco de fratura',
    conditionKeywords: ['osteoporose', 'osteopenia', 'fratura por fragilidade', 'densitometria alterada'],
    warning: 'Beers 2023 (Table 2): Corticosteroides orais em uso crônico causam perda óssea acelerada. Suplementar cálcio (1200 mg/dia) + vitamina D e considerar bifosfonato se uso > 3 meses.',
    level: 'moderate',
  },
  // Hiponatremia / SIADH
  {
    drugs: ['fluoxetina', 'sertralina', 'paroxetina', 'escitalopram', 'citalopram', 'venlafaxina', 'duloxetina', 'carbamazepina', 'oxcarbazepina', 'mirtazapina'],
    condition: 'Hiponatremia ou SIADH',
    conditionKeywords: ['hiponatremia', 'siadh', 'sodio baixo', 'na < 135', 'sodio menor que 135'],
    warning: 'Beers 2023 (Table 2): Antidepressivos e antiepilépticos podem causar/agravar SIADH e hiponatremia em idosos. Monitorar sódio nas primeiras 4 semanas e após aumentos de dose.',
    level: 'high',
  },
]

// ─── 8. CRITÉRIOS START v3 (tratamentos que deveriam ser iniciados) ───────────

interface STARTCriterion {
  missingDrugs: string[]
  condition: string
  conditionKeywords: string[]
  recommendation: string
  /** Se presente, além de conditionKeywords, pelo menos UMA destas também deve constar
   *  (gating composto: ex. DM2 E (DCV ou DRC)). Evita falso positivo de condição isolada. */
  alsoRequiresAnyOf?: string[]
  /** Se presente, pelo menos UM medicamento da lista deve estar em uso para o critério
   *  fazer sentido (ex.: gastroproteção só faz sentido se há AINE em uso). */
  requiresMedAnyOf?: string[]
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
    requiresMedAnyOf: ['ibuprofeno', 'naproxeno', 'diclofenaco', 'celecoxibe', 'meloxicam', 'indometacina', 'piroxicam', 'nimesulida', 'cetorolaco'],
    recommendation: 'START v3: IBP indicado para gastroproteção em usuários de AINEs com fatores de risco GI.',
  },
  {
    missingDrugs: ['salbutamol', 'formoterol', 'salmeterol', 'fenoterol'],
    condition: 'DPOC ou asma com sintomas',
    conditionKeywords: ['dpoc', 'asma', 'broncoespasmo', 'dispneia obstrutiva'],
    recommendation: 'START v3: Broncodilatador inalatório (SABA ou LABA) indicado em DPOC/asma sintomática.',
  },
  // START v3 — novos critérios
  {
    missingDrugs: ['enalapril', 'lisinopril', 'captopril', 'ramipril', 'perindopril', 'losartana', 'valsartana', 'candesartana'],
    condition: 'Doença renal crônica com proteinúria',
    conditionKeywords: ['doenca renal cronica', 'drc', 'proteinuria', 'nefropatia'],
    recommendation: 'START v3: IECA ou BRA indicados em DRC com proteinúria para nefroproteção — independente de ser diabético.',
  },
  {
    missingDrugs: ['atenolol', 'metoprolol', 'bisoprolol', 'carvedilol', 'propranolol'],
    condition: 'Pós-infarto do miocárdio',
    conditionKeywords: ['infarto', 'iam', 'pos-infarto', 'sindrome coronariana aguda', 'sca'],
    recommendation: 'START v3: Betabloqueador indicado na prevenção secundária pós-IAM por pelo menos 3 anos.',
  },
  {
    missingDrugs: ['warfarina', 'varfarina', 'rivaroxabana', 'apixabana', 'dabigatrana', 'edoxabana'],
    condition: 'Fibrilação atrial',
    conditionKeywords: ['fibrilacao atrial', 'fa ', 'flutter atrial', 'arritmia atrial'],
    recommendation: 'START v3: Anticoagulação oral indicada em FA com CHA₂DS₂-VASc ≥ 2 (homens) ou ≥ 3 (mulheres) para prevenção de AVC.',
  },
  {
    missingDrugs: ['empagliflozina', 'dapagliflozina', 'canagliflozina'],
    condition: 'Diabetes tipo 2 com doença cardiovascular ou DRC',
    conditionKeywords: ['diabetes tipo 2', 'dm2', 'diabetes mellitus tipo 2'],
    alsoRequiresAnyOf: ['insuficiencia cardiaca', 'doenca renal cronica', 'drc', 'doenca cardiovascular', 'dcv', 'infarto', 'doenca coronariana', 'avc'],
    recommendation: 'START v3: iSGLT2 (empagliflozina, dapagliflozina) indicados no DM2 com DCV estabelecida ou DRC — reduzem mortalidade cardiovascular e progressão renal.',
  },
  {
    missingDrugs: ['semaglutida', 'liraglutida', 'dulaglutida', 'tirzepatida'],
    condition: 'Diabetes tipo 2 com doença cardiovascular ou obesidade',
    conditionKeywords: ['diabetes tipo 2', 'dm2', 'diabetes mellitus tipo 2'],
    alsoRequiresAnyOf: ['doenca cardiovascular', 'dcv', 'infarto', 'doenca coronariana', 'avc', 'obesidade', 'imc elevado', 'sobrepeso'],
    recommendation: 'ADA/START 2024: GLP-1 RA (semaglutida, dulaglutida) indicados no DM2 com DCV estabelecida ou obesidade — benefício cardiovascular e de peso, independentemente da HbA1c.',
  },
  {
    missingDrugs: ['donepezila', 'rivastigmina', 'galantamina', 'memantina'],
    condition: 'Doença de Alzheimer ou demência vascular leve-moderada',
    conditionKeywords: ['alzheimer', 'demencia vascular', 'demencia leve', 'demencia moderada'],
    recommendation: 'START v3: Inibidor de colinesterase (donepezila, rivastigmina) indicado em demência de Alzheimer leve a moderada.',
  },
  {
    missingDrugs: ['acido folico', 'folato'],
    condition: 'Uso de metotrexato',
    conditionKeywords: ['metotrexato', 'mtx'],
    recommendation: 'START v3: Ácido fólico (5 mg/semana) indicado em usuários de metotrexato para reduzir toxicidade gastrintestinal e hematológica.',
  },
  {
    missingDrugs: ['colecalciferol', 'vitamina d', 'calcitriol'],
    condition: 'Idoso institucionalizado ou com pouca exposição solar',
    conditionKeywords: ['idoso', 'institucionalizado', 'acamado', 'hipovitaminose d', 'osteoporose'],
    recommendation: 'START v3: Suplementação de vitamina D indicada em idosos com risco de deficiência para prevenção de quedas e fraturas.',
  },
]

// ─── 8a. CARGA ANTICOLINÉRGICA (ACB Score) ────────────────────────────────────
// Fonte: Anticholinergic Cognitive Burden (ACB) Scale — Boustani et al., 2008
// Scores 1 = atividade anticolinérgica possível; 2 = confirmada; 3 = severa
// Score total ≥ 3 = comprometimento cognitivo significativo em idosos

const ACB_SCORES: Record<string, number> = {
  // Score 3 — Severo
  'amitriptilina': 3, 'nortriptilina': 3, 'imipramina': 3, 'clomipramina': 3,
  'difenidramina': 3, 'prometazina': 3, 'dimenidrinato': 3, 'meclizina': 3,
  'oxibutinina': 3, 'tolterodina': 3, 'solifenacina': 3, 'fesoterodina': 3,
  'biperideno': 3, 'tri-hexifenidil': 3, 'tri-hexifenidila': 3, 'triexifenidil': 3,
  'escopolamina': 3, 'hioscina': 3, 'atropina': 3, 'diciclomina': 3,
  'clorpromazina': 3, 'levomepromazina': 3, 'clozapina': 3,
  'doxepina': 3, 'maprotilina': 3,
  'meperidina': 3, 'carisoprodol': 3, 'ciclobenzaprina': 3, 'orfenadrina': 3,
  'cimetidina': 3, 'ranitidina': 2, 'doxilamina': 3, 'hidroxizina': 3,
  // Score 2 — Confirmado
  'olanzapina': 2, 'quetiapina': 2, 'risperidona': 1, 'haloperidol': 1,
  'paroxetina': 2, 'fluoxetina': 1, 'amantadina': 2,
  'tioridazina': 3, 'clordiazepóxido': 1,
  'diazepam': 1, 'alprazolam': 1,
  'ipratropio': 1, 'tiotrópio': 1, 'aclidínio': 1,
  'nefazodona': 1, 'mirtazapina': 1,
  // Score 1 — Possível
  'metoclopramida': 1, 'domperidona': 1,
  'captopril': 1, 'enalapril': 1, 'furosemida': 1,
  'digoxina': 1, 'prednisolona': 1, 'prednisona': 1,
  'colchicina': 1, 'codeina': 1, 'tramadol': 1,
  'carbamazepina': 1, 'oxcarbazepina': 1,
  'loperamida': 1, 'warfarina': 1, 'varfarina': 1,
  'nifedipina': 1, 'baclofeno': 1,
  'isosorbida': 1, 'nitroglicerina': 1,
}

// ─── 8b. NORMALIZAÇÃO DE SINÔNIMOS DIAGNÓSTICOS ───────────────────────────────
// Expande abreviações e variações comuns usadas em prontuários brasileiros
// para garantir que STOPP/START detecte mesmo quando o farmacêutico digita diferente

const DIAGNOSIS_SYNONYMS: Record<string, string[]> = {
  // Diabetes
  'diabetes mellitus tipo 2': ['dm2', 'dm 2', 'diabetes tipo 2', 'diabetico', 'diabetes mellitus', 'dm'],
  'diabetes mellitus tipo 1': ['dm1', 'dm 1', 'diabetes tipo 1', 'diabetes insulinodependente'],
  // Insuficiência cardíaca
  'insuficiencia cardiaca': ['ic ', 'icc', 'insufficiencia cardiaca', 'insuf card', 'heart failure', 'ic com fe', 'icfer', 'icfep'],
  // Doença renal
  'doenca renal cronica': ['drc', 'irc', 'insuficiencia renal cronica', 'insuficiencia renal', 'ir ', 'nefropatia', 'nefropatia cronica'],
  'insuficiencia renal aguda': ['ira ', 'aki', 'lesao renal aguda', 'lra'],
  // Cardiovascular
  'fibrilacao atrial': ['fa ', 'flutter atrial', 'arritmia atrial', 'fibrilação atrial'],
  'infarto agudo do miocardio': ['iam', 'infarto', 'infarto do miocardio', 'sindrome coronariana aguda', 'sca', 'sca st', 'iamssst', 'iamcsst'],
  'doenca arterial coronariana': ['dac', 'doenca coronariana', 'angina', 'angina estaveis', 'angina instavel', 'coronariopatia'],
  'acidente vascular cerebral': ['avc', 'avc isquemico', 'avc hemorragico', 'avc hem', 'stroke', 'acidente vascular encefálico', 'ave'],
  'hipertensao arterial sistemica': ['has', 'has ', 'hipertensao', 'pressao alta', 'hta', 'hiper'],
  // Respiratório
  'doenca pulmonar obstrutiva cronica': ['dpoc', 'enfisema', 'bronquite cronica', 'doença pulmonar obstrutiva'],
  'asma bronquica': ['asma', 'broncoespasmo cronico', 'asma grave'],
  // Neurológico
  'doenca de parkinson': ['parkinson', 'sindrome parkinsoniana', 'parkinsonismo'],
  'demencia de alzheimer': ['alzheimer', 'demencia', 'comprometimento cognitivo', 'dea', 'da ', 'doenca de alzheimer'],
  'epilepsia': ['epilepsia', 'crise convulsiva', 'convulsao', 'crise epileptica'],
  // Osteoarticular
  'osteoporose': ['osteoporose', 'osteopenia', 't-score', 'fratura por fragilidade', 'fratura osteoporotica'],
  // GI
  'ulcera peptica': ['ulcera', 'ulcera gastrica', 'ulcera duodenal', 'gastrite erosiva', 'hemorragia digestiva'],
  'doenca do refluxo': ['drge', 'gerd', 'refluxo gastroesofagico', 'esofagite de refluxo'],
  // Outros
  'hipotireoidismo': ['hipotireoidismo', 'tsh elevado', 'mixedema'],
  'hipertireoidismo': ['hipertireoidismo', 'tireotoxicose', 'bócio', 'graves'],
  'hipertrofia prostatica benigna': ['hpb', 'hbp', 'hipertrofia prostatica', 'prostatismo', 'hipertrofia da prostata'],
  'gota': ['gota', 'hiperuricemia', 'artrite goutica', 'crise de gota'],
  'insuficiencia hepatica': ['cirrose', 'hepatopatia', 'hepatite cronica', 'child-pugh', 'encefalopatia hepatica', 'ascite'],
  'hipotensao ortostatica': ['hipotensao ortostatica', 'sincope', 'desmaio', 'queda por hipotensao', 'hipotensão postural'],
  'quedas recorrentes': ['queda', 'quedas', 'risco de queda', 'historico de queda', 'fratura por queda'],
}

/** Expande texto de diagnósticos com sinônimos normalizados */
function expandDiagnosesWithSynonyms(text: string): string {
  let expanded = text
  for (const [canonical, synonyms] of Object.entries(DIAGNOSIS_SYNONYMS)) {
    const normCanonical = norm(canonical)
    const hasAny = synonyms.some(s => text.includes(norm(s))) || text.includes(normCanonical)
    if (hasAny) {
      // Add the canonical + all synonyms to ensure cross-matching
      expanded += ' ' + normCanonical + ' ' + synonyms.map(s => norm(s)).join(' ')
    }
  }
  return expanded
}

// ─── 8b. INTERAÇÕES ALIMENTO-MEDICAMENTO ─────────────────────────────────────
// Fonte: FDA, ANVISA, Stockley's Drug Interactions, Clinical Pharmacology
// Detectadas sempre — orientação ao paciente é obrigatória independente da dieta

interface FoodDrugInteraction {
  food: string               // nome legível do alimento
  emoji: string
  drugs: string[]            // princípios ativos afetados
  severity: 'major' | 'moderate'
  mechanism: string
  clinicalEffect: string
  management: string         // orientação ao farmacêutico
  patientGuidance: string    // linguagem acessível ao paciente
}

const FOOD_DRUG_INTERACTIONS: FoodDrugInteraction[] = [
  // ── GRAPEFRUIT (toranja) ────────────────────────────────────────────────────
  {
    food: 'Grapefruit (toranja) e suco de grapefruit',
    emoji: '🍊',
    drugs: ['sinvastatina', 'lovastatina', 'atorvastatina'],
    severity: 'major',
    mechanism: 'Grapefruit inibe CYP3A4 intestinal de forma irreversível por 24-72h, aumentando biodisponibilidade das estatinas',
    clinicalEffect: 'Aumento de até 10x nos níveis de sinvastatina/lovastatina — risco de miopatia e rabdomiólise. Atorvastatina: aumento de 2-3x.',
    management: 'Orientar evitar completamente grapefruit e suco de grapefruit. Uma única dose de 200 mL pode inibir CYP3A4 por até 72h.',
    patientGuidance: 'Evite completamente toranja (grapefruit) e seu suco enquanto usar esta estatina — mesmo uma taça pode causar reação grave.',
  },
  {
    food: 'Grapefruit (toranja)',
    emoji: '🍊',
    drugs: ['felodipina', 'nifedipina', 'anlodipina', 'amlodipina', 'nitrendipina', 'lercanidipina', 'lacidipina'],
    severity: 'major',
    mechanism: 'Inibição de CYP3A4 intestinal aumenta biodiponibilidade dos bloqueadores de canal de cálcio',
    clinicalEffect: 'Felodipina: aumento de 3x na concentração — hipotensão intensa, taquicardia reflexa, rubor.',
    management: 'Orientar evitar grapefruit. Felodipina é a mais afetada — a interação foi originalmente descoberta nesta droga.',
    patientGuidance: 'Evite toranja e suco de toranja. Use suco de laranja como alternativa segura.',
  },
  {
    food: 'Grapefruit (toranja)',
    emoji: '🍊',
    drugs: ['ciclosporina', 'tacrolimus', 'sirolimus', 'everolimus'],
    severity: 'major',
    mechanism: 'Inibição de CYP3A4 e P-gp eleva concentração sérica de imunossupressores',
    clinicalEffect: 'Toxicidade por imunossupressor: nefrotoxicidade, neurotoxicidade, infecções oportunistas.',
    management: 'CONTRAINDICADO. Instruir claramente o paciente. Monitorar nível sérico se exposição acidental.',
    patientGuidance: 'PROIBIDO consumir toranja, grapefruit ou suco em qualquer quantidade enquanto usar este imunossupressor.',
  },
  {
    food: 'Grapefruit (toranja)',
    emoji: '🍊',
    drugs: ['alprazolam', 'midazolam', 'triazolam', 'diazepam'],
    severity: 'moderate',
    mechanism: 'Inibição de CYP3A4 aumenta biodisponibilidade dos benzodiazepínicos',
    clinicalEffect: 'Sedação excessiva, depressão respiratória — especialmente com midazolam e triazolam.',
    management: 'Orientar evitar grapefruit. Risco maior com benzodiazepínicos de curta ação (midazolam, triazolam).',
    patientGuidance: 'Evite toranja e suco de toranja. Pode aumentar o efeito do calmante ou sonífero.',
  },
  {
    food: 'Grapefruit (toranja)',
    emoji: '🍊',
    drugs: ['carbamazepina', 'buspiron', 'quetiapina', 'aripiprazol'],
    severity: 'moderate',
    mechanism: 'Inibição de CYP3A4',
    clinicalEffect: 'Aumento dos níveis plasmáticos — toxicidade anticonvulsivante ou antipsicótica.',
    management: 'Orientar evitar grapefruit. Monitorar sinais de toxicidade.',
    patientGuidance: 'Evite toranja e suco de toranja enquanto usar este medicamento.',
  },

  // ── VITAMINA K / VEGETAIS FOLHOSOS ──────────────────────────────────────────
  {
    food: 'Alimentos ricos em vitamina K (couve, brócolis, espinafre, alface, repolho)',
    emoji: '🥦',
    drugs: ['warfarina', 'varfarina'],
    severity: 'major',
    mechanism: 'Vitamina K é cofator da síntese de fatores de coagulação II, VII, IX, X — antagoniza o mecanismo de ação da warfarina',
    clinicalEffect: 'Variações no consumo de vitamina K causam instabilidade do INR — risco de trombose (pouco consumo) ou sangramento (muito consumo súbito).',
    management: 'Não é necessário eliminar alimentos com vitamina K — o fundamental é MANTER consumo CONSTANTE. Instruir o paciente sobre consistência alimentar. Monitorar INR após mudanças dietéticas.',
    patientGuidance: 'Não elimine verduras — mantenha sempre a mesma quantidade na semana. Grandes mudanças no consumo de couve, brócolis ou espinafre podem alterar o efeito do seu anticoagulante.',
  },

  // ── TIRAMINA + IMAO ─────────────────────────────────────────────────────────
  {
    food: 'Alimentos ricos em tiramina (queijo curado, vinho tinto, cerveja, embutidos, molho de soja, fígado)',
    emoji: '🧀',
    drugs: ['fenelzina', 'tranilcipromina', 'isocarboxazida', 'selegilina', 'rasagilina', 'safinamida'],
    severity: 'major',
    mechanism: 'IMAOs inibem a MAO intestinal e hepática que normalmente degrada a tiramina — acumulação de tiramina leva à liberação massiva de noradrenalina',
    clinicalEffect: 'Crise hipertensiva tiramínica: cefaleia occipital intensa, HAS grave (PA > 180/120), AVC hemorrágico, morte.',
    management: 'DIETA RESTRITIVA OBRIGATÓRIA. Fornecer lista escrita de alimentos proibidos. Instruir sobre reconhecimento e manejo da crise. Manter o paciente com receituário de nifedipina sublingual para emergência.',
    patientGuidance: 'ALIMENTOS PROIBIDOS: queijos curados, vinho tinto, cerveja, salsicha/linguiça, fígado, molho de soja, molho inglês, extratos de levedura. Qualquer descuido pode causar crise de pressão grave.',
  },

  // ── LATICÍNIOS / CÁLCIO ─────────────────────────────────────────────────────
  {
    food: 'Leite, iogurte, queijo e alimentos ricos em cálcio',
    emoji: '🥛',
    drugs: ['tetraciclina', 'doxiciclina', 'minociclina'],
    severity: 'major',
    mechanism: 'Cálcio e outros cátions divalentes (Mg²⁺, Fe²⁺, Al³⁺) formam quelatos com tetraciclinas, reduzindo drasticamente a absorção',
    clinicalEffect: 'Redução de 50-80% na absorção da tetraciclina — falha terapêutica do antibiótico.',
    management: 'Administrar tetraciclinas 1h antes ou 2h após laticínios, antiácidos e suplementos de ferro/cálcio.',
    patientGuidance: 'Tome este antibiótico com estômago vazio ou somente com água. Evite leite, iogurte e queijo por pelo menos 2 horas antes e depois.',
  },
  {
    food: 'Laticínios, antiácidos e alimentos ricos em cálcio',
    emoji: '🥛',
    drugs: ['ciprofloxacino', 'levofloxacino', 'moxifloxacino', 'norfloxacino'],
    severity: 'moderate',
    mechanism: 'Quelação de fluoroquinolonas por cátions divalentes (Ca²⁺, Mg²⁺, Al³⁺, Fe²⁺)',
    clinicalEffect: 'Redução de 30-50% na absorção da fluoroquinolona — falha terapêutica.',
    management: 'Administrar fluoroquinolona 2h antes ou 4-6h após laticínios, antiácidos e suplementos minerais.',
    patientGuidance: 'Tome o antibiótico 2 horas antes ou 6 horas depois de laticínios, leite ou suplementos de cálcio/magnésio.',
  },
  {
    food: 'Alimentos, leite e suplementos de cálcio',
    emoji: '🥛',
    drugs: ['alendronato', 'risedronato', 'ibandronato', 'zoledronato'],
    severity: 'major',
    mechanism: 'Cálcio e qualquer alimento impedem absorção dos bisfosfonatos — biodisponibilidade já é < 1%',
    clinicalEffect: 'Absorção praticamente zero se tomado com alimentos ou bebidas (exceto água) — falha completa no tratamento da osteoporose.',
    management: 'Orientar rigorosamente: tomar em jejum com 200 mL de água, permanecer em pé por 30 minutos, só comer após 30-60 minutos.',
    patientGuidance: 'Tome em jejum pela manhã, só com água. Fique de pé por 30 minutos e não coma nem tome outros medicamentos por pelo menos 30 minutos.',
  },
  {
    food: 'Suplementos de cálcio, antiácidos e alimentos ricos em cálcio',
    emoji: '🥛',
    drugs: ['levotiroxina', 'tiroxina'],
    severity: 'moderate',
    mechanism: 'Cálcio e ferro reduzem absorção da levotiroxina por quelação',
    clinicalEffect: 'Hipotireoidismo por absorção inadequada — TSH elevado.',
    management: 'Tomar levotiroxina 30-60 minutos antes do café da manhã. Separar suplementos de cálcio/ferro por pelo menos 4 horas.',
    patientGuidance: 'Tome o hormônio tireoidiano em jejum, de estômago vazio. Aguarde pelo menos 30 minutos antes de tomar café, leite ou outros medicamentos.',
  },

  // ── ÁLCOOL ──────────────────────────────────────────────────────────────────
  {
    food: 'Álcool (qualquer bebida alcoólica)',
    emoji: '🍺',
    drugs: ['metronidazol', 'tinidazol', 'secnidazol', 'ornidazol'],
    severity: 'major',
    mechanism: 'Nitroimidazóis inibem aldeído desidrogenase — acumulação de acetaldeído',
    clinicalEffect: 'Reação tipo dissulfiram: rubor intenso, cefaleia, náusea, vômito, taquicardia, hipotensão — pode ser grave.',
    management: 'Abstinência ABSOLUTA de álcool durante e até 48-72h após o término do tratamento. Incluir álcool em produtos de higiene oral e alimentos.',
    patientGuidance: 'PROIBIDO álcool durante o tratamento e por 3 dias depois. Evite também enxaguante bucal com álcool.',
  },
  {
    food: 'Álcool',
    emoji: '🍺',
    drugs: ['metformina'],
    severity: 'major',
    mechanism: 'Álcool aumenta produção de lactato e inibe gliconeogênese hepática — potencializa risco de acidose lática',
    clinicalEffect: 'Acidose lática potencialmente fatal — risco maior em jejum prolongado ou ingestão excessiva aguda.',
    management: 'Orientar evitar consumo excessivo de álcool e uso em jejum. Consumo moderado ocasional durante refeições é geralmente tolerado.',
    patientGuidance: 'Evite beber em excesso ou em jejum. O álcool pode causar uma complicação grave (acidose lática) com a metformina.',
  },
  {
    food: 'Álcool',
    emoji: '🍺',
    drugs: ['diazepam', 'alprazolam', 'clonazepam', 'lorazepam', 'zolpidem', 'zopiclona', 'tramadol', 'codeina', 'morfina'],
    severity: 'major',
    mechanism: 'Depressão aditiva do sistema nervoso central',
    clinicalEffect: 'Sedação profunda, depressão respiratória, coma e morte — especialmente com opioides.',
    management: 'Contraindicado. Orientar abstinência alcoólica rigorosa durante uso de sedativos/opioides.',
    patientGuidance: 'PROIBIDO álcool com este medicamento — pode causar sonolência extrema e parada respiratória.',
  },
  {
    food: 'Álcool',
    emoji: '🍺',
    drugs: ['paracetamol', 'acetaminofeno'],
    severity: 'moderate',
    mechanism: 'Álcool induz CYP2E1 aumentando formação do metabólito hepatotóxico NAPQI e depleta glutationa protetora',
    clinicalEffect: 'Hepatotoxicidade grave em alcoolistas crônicos mesmo com doses "terapêuticas" de paracetamol (≥ 2g/dia).',
    management: 'Limitar paracetamol a < 2g/dia em usuários regulares de álcool. Alertar sobre risco mesmo com doses normais.',
    patientGuidance: 'Se você bebe regularmente, cuidado com paracetamol — pode causar problema grave no fígado. Informe seu médico.',
  },
  {
    food: 'Álcool',
    emoji: '🍺',
    drugs: ['warfarina', 'varfarina'],
    severity: 'major',
    mechanism: 'Efeito bifásico: álcool agudo inibe metabolismo da warfarina (INR sobe); uso crônico induz CYP2C9 (INR cai)',
    clinicalEffect: 'Instabilidade do INR — risco de sangramento (agudo) ou trombose (crônico).',
    management: 'Orientar evitar consumo excessivo e manter padrão constante. Monitorar INR em qualquer mudança do padrão.',
    patientGuidance: 'Evite excessos alcoólicos. Se beber, mantenha sempre a mesma quantidade por semana para não desregular o anticoagulante.',
  },
  {
    food: 'Álcool',
    emoji: '🍺',
    drugs: ['amiodarona', 'metotrexato', 'isoniazida', 'rifampicina', 'pirazinamida', 'nimesulida', 'diclofenaco'],
    severity: 'moderate',
    mechanism: 'Hepatotoxicidade aditiva',
    clinicalEffect: 'Lesão hepática acelerada e mais grave.',
    management: 'Orientar abstinência ou consumo mínimo. Monitorar TGO/TGP.',
    patientGuidance: 'Evite bebidas alcoólicas durante o tratamento — este medicamento já sobrecarrega o fígado.',
  },

  // ── POTÁSSIO / ALIMENTOS RICOS ───────────────────────────────────────────────
  {
    food: 'Alimentos muito ricos em potássio (banana, abacate, feijão, batata, laranja, tomate)',
    emoji: '🍌',
    drugs: ['enalapril', 'captopril', 'lisinopril', 'ramipril', 'perindopril', 'espironolactona', 'losartana', 'valsartana', 'candesartana'],
    severity: 'moderate',
    mechanism: 'IECA, BRA e diuréticos poupadores de K⁺ retêm potássio — dieta hiperkalêmica pode precipitar hipercalemia',
    clinicalEffect: 'Hipercalemia: fraqueza muscular, arritmias cardíacas graves, parada cardíaca.',
    management: 'Orientar sobre dieta moderada em potássio, especialmente se ClCr < 60 mL/min ou em uso de suplementos de K⁺. Monitorar K⁺ sérico.',
    patientGuidance: 'Não exagere em alimentos ricos em potássio (banana, abacate, feijão) enquanto usar este medicamento. Informe ao médico se tomar suplemento de potássio.',
  },

  // ── FERRO / SUPLEMENTOS ──────────────────────────────────────────────────────
  {
    food: 'Suplementos de ferro, zinco, magnésio e cálcio',
    emoji: '💊',
    drugs: ['ciprofloxacino', 'levofloxacino', 'norfloxacino', 'tetraciclina', 'doxiciclina'],
    severity: 'major',
    mechanism: 'Quelação de antibióticos por cátions polivalentes — formação de complexos inabsorvíveis',
    clinicalEffect: 'Redução de 30-75% na absorção do antibiótico — falha terapêutica com risco de progressão infecciosa.',
    management: 'Separar antibiótico dos suplementos por pelo menos 2h (antes) ou 4-6h (depois).',
    patientGuidance: 'Não tome este antibiótico junto com suplementos de ferro, cálcio, magnésio ou zinco. Separe por pelo menos 2 horas.',
  },
  {
    food: 'Suplementos de ferro',
    emoji: '🩸',
    drugs: ['levotiroxina', 'tiroxina'],
    severity: 'moderate',
    mechanism: 'Ferro forma quelato com levotiroxina reduzindo absorção',
    clinicalEffect: 'Hipotireoidismo por absorção inadequada.',
    management: 'Separar levotiroxina do ferro por pelo menos 4 horas.',
    patientGuidance: 'Tome o remédio da tireoide longe do suplemento de ferro — pelo menos 4 horas de diferença.',
  },

  // ── CAFEÍNA / CHÁ PRETO ──────────────────────────────────────────────────────
  {
    food: 'Cafeína em excesso (café, chá preto, energéticos)',
    emoji: '☕',
    drugs: ['teofilina', 'aminofilina'],
    severity: 'moderate',
    mechanism: 'Efeitos xantínicos aditivos na inibição de fosfodiesterase',
    clinicalEffect: 'Toxicidade por xantinas: taquicardia, tremor, insônia, convulsões em casos graves.',
    management: 'Orientar reduzir consumo de cafeína. Monitorar nível sérico de teofilina.',
    patientGuidance: 'Reduza café e energéticos enquanto usar este medicamento — podem causar coração acelerado e tremor.',
  },

  // ── FIBRA / ALIMENTOS ────────────────────────────────────────────────────────
  {
    food: 'Alta ingestão de fibras (aveia, farelo, psyllium) junto com o medicamento',
    emoji: '🌾',
    drugs: ['digoxina', 'levotiroxina'],
    severity: 'moderate',
    mechanism: 'Fibras adsorvem medicamentos no trato GI reduzindo absorção',
    clinicalEffect: 'Redução da biodisponibilidade — falha terapêutica.',
    management: 'Orientar não tomar com refeições ricas em fibra. Separar por pelo menos 1-2 horas.',
    patientGuidance: 'Tome este medicamento longe de suplementos de fibra ou aveia — podem reduzir o efeito.',
  },
]

// ─── 8c. INTERAÇÕES MEDICAMENTO-CONDIÇÃO CLÍNICA ─────────────────────────────
// Fonte: KDIGO, ESC/ESH, ADA Standards, ABCDE-Farma, UpToDate, Micromedex
// Detectam contraindicações e precauções absolutas por comorbidade específica
// Diferem dos critérios STOPP por cobrir populações além de idosos

interface DrugDiseaseInteraction {
  drugs: string[]                      // princípios ativos contraindicados/restritos
  conditions: string[]                 // palavras-chave que identificam a condição
  conditionLabel: string               // nome amigável da condição
  severity: 'contraindicated' | 'major' | 'moderate'
  mechanism: string                    // mecanismo farmacológico/fisiopatológico
  clinicalRisk: string                 // consequência clínica esperada
  pharmacistConduct: string
  patientGuidance: string
  monitoringRequired: string
  alternative?: string                 // alternativa terapêutica, quando aplicável
}

const DRUG_DISEASE_INTERACTIONS: DrugDiseaseInteraction[] = [

  // ── INSUFICIÊNCIA RENAL / DRC ─────────────────────────────────────────────

  {
    drugs: ['metformina'],
    conditions: ['insuficiencia renal grave', 'drc estadio 4', 'drc estadio 5', 'dialise', 'hemodialise', 'tfg < 30', 'clcr < 30', 'creatinina > 3'],
    conditionLabel: 'Insuficiência renal grave (TFG < 30 mL/min)',
    severity: 'contraindicated',
    mechanism: 'Metformina é excretada inalterada pelos rins. Em IR grave, acumula-se e inibe a cadeia respiratória mitocondrial hepática — aumenta produção de lactato.',
    clinicalRisk: 'Acidose lática grave (mortalidade ~50%). Risco aumenta proporcionalmente à redução da TFG.',
    pharmacistConduct: 'CONTRAINDICADA com TFG < 30 mL/min. Suspender imediatamente e comunicar prescritor. Alternativas: iSGLT2 (com restrição de dose), iDPP-4, insulina. Dose deve ser reduzida com TFG 30-45.',
    patientGuidance: 'Não tome metformina se seus rins não estão funcionando bem. Informe ao médico seus exames de função renal mais recentes.',
    monitoringRequired: 'TFG/creatinina a cada 3-6 meses em DRC. Suspender antes de procedimentos com contraste iodado.',
    alternative: 'iDPP-4 (sitagliptina com ajuste de dose), iSGLT2 com TFG ≥ 45, insulina',
  },

  {
    drugs: ['ibuprofeno', 'naproxeno', 'diclofenaco', 'meloxicam', 'indometacina', 'cetorolaco', 'piroxicam', 'nimesulida', 'celecoxibe'],
    conditions: ['insuficiencia renal', 'drc', 'irc', 'tfg reduzida', 'creatinina elevada', 'proteinuria', 'nefropatia', 'transplante renal'],
    conditionLabel: 'Doença renal crônica',
    severity: 'contraindicated',
    mechanism: 'AINEs inibem a síntese de prostaglandinas vasodilatadoras renais (PGE2, PGI2) que mantêm a perfusão glomerular em estados de baixo fluxo. Também bloqueiam a excreção de potássio e sódio.',
    clinicalRisk: 'IRA aguda sobre crônica, hipercalemia, retenção hidrossalina, progressão da DRC e piora da proteinúria.',
    pharmacistConduct: 'AINEs contraindicados em DRC. Orientar substituição por paracetamol (dor leve/moderada) ou opioides fracos com ajuste de dose. Verificar outros analgésicos e discutir com prescritor.',
    patientGuidance: 'Evite completamente anti-inflamatórios (ibuprofeno, diclofenaco, naproxeno) — prejudicam os rins. Para dor, prefira paracetamol e consulte seu médico.',
    monitoringRequired: 'Creatinina, ureia, K⁺ antes e 7 dias após início de qualquer AINE.',
    alternative: 'Paracetamol (até 3 g/dia em DRC), tramadol (com ajuste), fisioterapia',
  },

  {
    drugs: ['digoxina'],
    conditions: ['insuficiencia renal', 'drc', 'irc', 'dialise', 'tfg reduzida'],
    conditionLabel: 'Insuficiência renal',
    severity: 'major',
    mechanism: 'Digoxina é eliminada ~70% por via renal inalterada. Em IR, ocorre acumulação progressiva com risco de toxicidade mesmo com doses terapêuticas.',
    clinicalRisk: 'Intoxicação digitálica: bradicardia, bloqueios AV, arritmias ventriculares (FV), náusea, confusão — potencializada por hipocalemia e hipomagnesemia comuns na DRC.',
    pharmacistConduct: 'Reduzir dose e aumentar intervalo de administração. Alvo de digoxinemia: 0,5-0,9 ng/mL em IC. Monitorar eletrólitos rigorosamente. Evitar diuréticos hipocalemiantes sem reposição de K⁺.',
    patientGuidance: 'Informe ao médico se sentir batimentos lentos, irregulares, náusea ou visão turva/amarelada. Faça exames de sangue regularmente.',
    monitoringRequired: 'Nível sérico de digoxina (coleta 6-8h após última dose), K⁺, Mg²⁺, creatinina. Dosagem sérica a cada 3 meses ou após ajuste.',
    alternative: 'Betabloqueador ou amiodarona para controle de frequência em FA com IR',
  },

  {
    drugs: ['espironolactona', 'eplerenona', 'canrenoato'],
    conditions: ['insuficiencia renal grave', 'drc estadio 4', 'drc estadio 5', 'hipercalemia', 'k+ > 5', 'potassio elevado'],
    conditionLabel: 'Insuficiência renal grave ou hipercalemia',
    severity: 'contraindicated',
    mechanism: 'Antagonistas de aldosterona reduzem excreção renal de K⁺. Em IR, o rim já tem capacidade reduzida de excretar K⁺ — somando os dois fatores, há risco de hipercalemia grave.',
    clinicalRisk: 'Hipercalemia grave (K⁺ > 6,5 mEq/L): parada cardíaca por assistolia ou FV.',
    pharmacistConduct: 'Contraindicado com TFG < 30 mL/min ou K⁺ > 5 mEq/L. Verificar combinação com IECA/BRA (aumenta risco). Comunicar prescritor imediatamente.',
    patientGuidance: 'Faça exame de potássio regularmente. Evite suplementos de potássio, sal substituto e alimentos ricos em potássio sem orientação.',
    monitoringRequired: 'K⁺ e creatinina em 1 semana após início, depois mensalmente por 3 meses.',
    alternative: 'Furosemida para manejo de volume, betabloqueador para ICC',
  },

  {
    drugs: ['nitrofurantoina'],
    conditions: ['insuficiencia renal', 'drc', 'irc', 'tfg < 45', 'clcr < 45'],
    conditionLabel: 'Insuficiência renal (TFG < 45 mL/min)',
    severity: 'contraindicated',
    mechanism: 'Nitrofurantoína depende de excreção renal para atingir concentrações bactericidas na urina. Com TFG < 45, os níveis urinários são insuficientes para efeito terapêutico e os níveis séricos causam toxicidade.',
    clinicalRisk: 'Falha terapêutica da ITU e toxicidade sistêmica: neuropatia periférica, pneumonite, hepatite, anemia hemolítica.',
    pharmacistConduct: 'Contraindicada com TFG < 45 mL/min. Substituir por fosfomicina (dose única) ou cefalosporina oral com ajuste de dose. Comunicar prescritor.',
    patientGuidance: 'Informe ao médico sobre seus exames de rim antes de usar nitrofurantoína. Pode não funcionar e causar efeitos adversos.',
    monitoringRequired: 'TFG antes de prescrever. Sintomas de neuropatia (formigamento, fraqueza).',
    alternative: 'Fosfomicina 3g dose única, cefalexina, amoxicilina-clavulanato (com ajuste)',
  },

  {
    drugs: ['alendronato', 'risedronato', 'ibandronato', 'zoledronato'],
    conditions: ['insuficiencia renal grave', 'drc estadio 4', 'drc estadio 5', 'tfg < 35', 'clcr < 35'],
    conditionLabel: 'Insuficiência renal grave (TFG < 35 mL/min)',
    severity: 'contraindicated',
    mechanism: 'Bisfosfonatos são excretados pelos rins sem metabolização. Em IR grave, acumulam-se no osso e causam mineralização defeituosa — osteomalácia adinâmica.',
    clinicalRisk: 'Osteomalácia, fraturas de estresse, hipocalcemia grave.',
    pharmacistConduct: 'Contraindicados com TFG < 35 mL/min. Para osteoporose em DRC, o tratamento deve ser guiado pela doença óssea metabólica subjacente (osteíte fibrosa x osteomalácia) — requer avaliação especializada.',
    patientGuidance: 'Não use medicamentos para ossos como alendronato se seus rins não estão funcionando bem. Consulte seu médico.',
    monitoringRequired: 'TFG antes de iniciar. Cálcio e fósforo séricos.',
    alternative: 'Calcitriol, cinacalcete (DRC-doença óssea mineral), avaliação por nefrologista',
  },

  // ── INSUFICIÊNCIA CARDÍACA ────────────────────────────────────────────────

  {
    drugs: ['ibuprofeno', 'naproxeno', 'diclofenaco', 'meloxicam', 'indometacina', 'cetorolaco', 'piroxicam', 'nimesulida', 'celecoxibe'],
    conditions: ['insuficiencia cardiaca', 'icc', 'ic sistolica', 'ic diastolica', 'feve reduzida', 'cardiomiopatia', 'descompensacao cardiaca'],
    conditionLabel: 'Insuficiência cardíaca',
    severity: 'contraindicated',
    mechanism: 'AINEs inibem prostaglandinas vasodilatadoras renais e aumentam resistência vascular sistêmica. Promovem retenção de sódio e água, aumentando a pré e pós-carga cardíaca.',
    clinicalRisk: 'Descompensação aguda da ICC, internação por sobrecarga hídrica, piora da função renal (síndrome cardiorrenal), aumento da mortalidade.',
    pharmacistConduct: 'AINEs absolutamente contraindicados na ICC (todas as classes funcionais). Substituir por paracetamol. Verificar uso de corticosteroides (mesmo risco). Comunicar prescritor.',
    patientGuidance: 'Nunca use anti-inflamatórios como ibuprofeno ou diclofenaco — causam piora do coração e inchaço. Use apenas paracetamol para dor, com orientação médica.',
    monitoringRequired: 'Peso diário, edema, pressão arterial, função renal após qualquer AINE inadvertido.',
    alternative: 'Paracetamol, tramadol (baixas doses), opioides com cautela',
  },

  {
    drugs: ['verapamil', 'diltiazem'],
    conditions: ['insuficiencia cardiaca sistolica', 'feve reduzida', 'disfuncao sistolica', 'feve < 40'],
    conditionLabel: 'Insuficiência cardíaca com fração de ejeção reduzida (FEr)',
    severity: 'contraindicated',
    mechanism: 'Bloqueadores de canais de cálcio não-dihidropiridínicos têm efeito inotrópico negativo significativo — reduzem a contratilidade miocárdica já comprometida.',
    clinicalRisk: 'Descompensação aguda da ICC, piora hemodinâmica, choque cardiogênico.',
    pharmacistConduct: 'Verapamil e diltiazem contraindicados em ICFEr. Se objetivo é controle de frequência em FA, usar betabloqueador (carvedilol, bisoprolol, metoprolol succinato). Comunicar prescritor.',
    patientGuidance: 'Informe ao seu médico que tem insuficiência cardíaca antes de iniciar qualquer medicamento para o coração.',
    monitoringRequired: 'FE ecocardiográfica, frequência cardíaca, PA.',
    alternative: 'Betabloqueador para controle de FC; anlodipino se necessário BCC em ICFEr (evidência neutra)',
  },

  {
    drugs: ['pioglitazona', 'rosiglitazona'],
    conditions: ['insuficiencia cardiaca', 'icc', 'ic', 'feve reduzida', 'classe funcional iii', 'classe funcional iv'],
    conditionLabel: 'Insuficiência cardíaca classes III-IV',
    severity: 'contraindicated',
    mechanism: 'Glitazonas causam retenção de sódio e água por ativação de receptores PPAR-γ no ducto coletor — aumentam volemia e agravam ICC.',
    clinicalRisk: 'Piora da ICC com retenção hídrica, edema pulmonar, internação.',
    pharmacistConduct: 'Contraindicadas na ICC classes III-IV (NYHA). Comunicar prescritor para substituição por iSGLT2 (empagliflozina, dapagliflozina — reduzem hospitalizações por ICC) ou iDPP-4.',
    patientGuidance: 'Informe ao médico sobre seu problema cardíaco. Há medicamentos para diabetes melhores para quem tem insuficiência cardíaca.',
    monitoringRequired: 'Peso diário, edema, dispneia, capacidade funcional.',
    alternative: 'Empagliflozina ou dapagliflozina (benefício cardiovascular comprovado em ICC+DM2)',
  },

  // ── DOENÇA HEPÁTICA ───────────────────────────────────────────────────────

  {
    drugs: ['metformina'],
    conditions: ['cirrose hepatica', 'insuficiencia hepatica', 'hepatite fulminante', 'child-pugh c', 'child pugh c', 'ascite', 'encefalopatia hepatica'],
    conditionLabel: 'Insuficiência hepática grave / Cirrose descompensada',
    severity: 'contraindicated',
    mechanism: 'Insuficiência hepática grave reduz a depuração de lactato (fígado é o principal órgão metabolizador de lactato). Metformina inibe a neoglicogênese hepática e aumenta produção de lactato.',
    clinicalRisk: 'Acidose lática grave com mortalidade elevada.',
    pharmacistConduct: 'Contraindicada em hepatopatia grave. Substituir por insulina (tratamento mais seguro em hepatopatia severa) ou iDPP-4 com cautela.',
    patientGuidance: 'Com doença do fígado grave, a metformina não é segura. Informe ao médico e discuta alternativas.',
    monitoringRequired: 'Transaminases, bilirrubina, albumina, INR (função hepática sintética).',
    alternative: 'Insulina (primeira escolha em hepatopatia grave)',
  },

  {
    drugs: ['paracetamol', 'acetaminofeno'],
    conditions: ['cirrose hepatica', 'hepatite alcoholica', 'alcoolismo', 'uso cronico de alcool', 'hepatopatia cronica', 'insuficiencia hepatica'],
    conditionLabel: 'Hepatopatia crônica / Alcoolismo',
    severity: 'major',
    mechanism: 'Paracetamol é metabolizado em NAPQI (metabólito hepatotóxico) pela CYP2E1, induzida pelo álcool. Em hepatopatia, há depleção de glutationa — o sistema tampão que detoxifica NAPQI.',
    clinicalRisk: 'Hepatotoxicidade grave com doses menores que as tóxicas habituais. Em alcoolistas, risco já com 2g/dia.',
    pharmacistConduct: 'Limitar a 2 g/dia em hepatopatia crônica ou alcoolismo (vs 4 g/dia para adultos saudáveis). Evitar em hepatite alcoólica aguda. Orientar abstinência alcoólica. Monitorar enzimas hepáticas.',
    patientGuidance: 'Não tome paracetamol junto com álcool. Se tem doença do fígado, nunca ultrapasse 2 comprimidos ao dia e avise seu médico.',
    monitoringRequired: 'TGO, TGP, bilirrubinas. Dosagem sérica de paracetamol se suspeita de superdosagem.',
    alternative: 'Dipirona (com cautela), opioides fracos para dor intensa',
  },

  {
    drugs: ['estatinas', 'sinvastatina', 'atorvastatina', 'rosuvastatina', 'lovastatina', 'pravastatina', 'fluvastatina', 'pitavastatina'],
    conditions: ['hepatite ativa', 'transaminases elevadas', 'ast > 3x', 'alt > 3x', 'hepatite alcoholica', 'insuficiencia hepatica'],
    conditionLabel: 'Hepatite ativa / Transaminases > 3× LSN',
    severity: 'contraindicated',
    mechanism: 'Estatinas são metabolizadas pelo fígado (CYP3A4, CYP2C9) e inibem a síntese de colesterol hepático. Em hepatite ativa, o metabolismo está comprometido e já há lesão hepatocelular em curso.',
    clinicalRisk: 'Piora da hepatite, hepatotoxicidade grave, rabdomiólise (em coexistência com miopatia).',
    pharmacistConduct: 'Contraindicadas em hepatite ativa ou AST/ALT > 3× LSN. Suspender até resolução. Após normalização enzimática, pode reiniciar com monitoramento.',
    patientGuidance: 'Se tiver hepatite ativa ou exames de fígado muito alterados, informe ao médico antes de iniciar ou continuar o colesterol.',
    monitoringRequired: 'TGO, TGP antes de iniciar e a cada 3 meses. Suspender se > 3× LSN.',
    alternative: 'Correção de fatores de risco cardiovascular não farmacológicos até normalização hepática',
  },

  // ── DOENÇA RESPIRATÓRIA ───────────────────────────────────────────────────

  {
    drugs: ['betabloqueadores nao seletivos', 'propranolol', 'atenolol', 'nadolol', 'timolol'],
    conditions: ['asma', 'broncoespasmo', 'dpoc grave', 'bronquite asmatiforme'],
    conditionLabel: 'Asma / DPOC com broncoespasmo',
    severity: 'contraindicated',
    mechanism: 'Betabloqueadores não seletivos bloqueiam receptores β2 brônquicos, promovendo broncoconstrição por ação parassimpática não antagonizada.',
    clinicalRisk: 'Broncoespasmo grave, crise asmática, insuficiência respiratória.',
    pharmacistConduct: 'Betabloqueadores não seletivos contraindicados em asma. Em DPOC com broncoespasmo: usar apenas betabloqueadores cardiosseletivos (metoprolol, bisoprolol, nebivolol) com vigilância. Comunicar prescritor.',
    patientGuidance: 'Informe SEMPRE ao médico que tem asma antes de tomar qualquer remédio para pressão ou coração.',
    monitoringRequired: 'Espirometria, pico de fluxo, sintomas respiratórios nas primeiras semanas.',
    alternative: 'Metoprolol succinato, bisoprolol, carvedilol (cardioseletivos) em DPOC sem broncoespasmo',
  },

  {
    drugs: ['aspirina', 'ácido acetilsalicílico', 'aas'],
    conditions: ['asma induzida por aspirina', 'triade samter', 'asma por aine'],
    conditionLabel: 'Asma induzida por AAS / Tríade de Samter',
    severity: 'contraindicated',
    mechanism: 'AAS inibe COX-1, desviando o metabolismo do ácido araquidônico para a via dos leucotrienos (LTC4, LTD4) — potentes broncoconstritores.',
    clinicalRisk: 'Broncoespasmo grave, rinossinusite, urticária — até anafilaxia em casos severos.',
    pharmacistConduct: 'AAS absolutamente contraindicado em asma por AAS/tríade de Samter. Evitar também outros AINEs. Para antiagregação, usar clopidogrel. Comunicar prescritor.',
    patientGuidance: 'NUNCA tome aspirina, ibuprofeno ou diclofenaco se já teve crise de asma ao usá-los. Informe sempre ao médico.',
    monitoringRequired: 'Spirometria, sintomas respiratórios.',
    alternative: 'Clopidogrel para antiagregação, paracetamol para analgesia (geralmente tolerado)',
  },

  // ── HIPERTENSÃO / CARDIOVASCULAR ─────────────────────────────────────────

  {
    drugs: ['enalapril', 'captopril', 'lisinopril', 'ramipril', 'perindopril', 'fosinopril', 'trandolapril', 'benazepril'],
    conditions: ['estenose bilateral de arteria renal', 'estenose da arteria renal em rim unico', 'estenose renal bilateral'],
    conditionLabel: 'Estenose bilateral de artéria renal',
    severity: 'contraindicated',
    mechanism: 'Em estenose bilateral, a angiotensina II mantém a filtração glomerular por vasoconstrição eferente. IECAs/BRAs bloqueiam este mecanismo compensatório — o único suporte à TFG residual.',
    clinicalRisk: 'IRA precipitada com anúria, hipercalemia grave, necessidade de diálise de emergência.',
    pharmacistConduct: 'IECAs/BRAs absolutamente contraindicados em estenose bilateral ou em rim único com estenose. Comunicar prescritor urgentemente. Alternativas: anlodipino, furosemida para hipertensão.',
    patientGuidance: 'Se foi diagnosticado com estreitamento das artérias dos rins, informe ao médico — este medicamento pode parar de funcionar seus rins.',
    monitoringRequired: 'Creatinina e K⁺ em 1-2 semanas após início de IECA/BRA (rastreio de estenose oculta).',
    alternative: 'Anlodipino, hidralazina + nitrato, furosemida',
  },

  {
    drugs: ['sibutramina'],
    conditions: ['hipertensao arterial', 'has', 'pressao alta', 'doenca cardiovascular', 'arritmia', 'insuficiencia cardiaca', 'historico de avc', 'historico de infarto'],
    conditionLabel: 'Hipertensão não controlada / Doença cardiovascular',
    severity: 'contraindicated',
    mechanism: 'Sibutramina inibe recaptação de noradrenalina e serotonina — aumenta PA e frequência cardíaca.',
    clinicalRisk: 'Hipertensão grave, taquicardia, eventos cardiovasculares maiores (IAM, AVC).',
    pharmacistConduct: 'Contraindicada em HAS não controlada, DAC, AVC prévio, ICC, arritmias. Comunicar prescritor. Retirada do mercado em vários países por aumento de risco cardiovascular (estudo SCOUT).',
    patientGuidance: 'Informe ao médico sobre problemas do coração ou pressão antes de tomar qualquer medicamento para emagrecer.',
    monitoringRequired: 'PA e frequência cardíaca a cada consulta.',
    alternative: 'Liraglutida, semaglutida (benefício cardiovascular), tratamento não farmacológico',
  },

  // ── DISTÚRBIOS ENDÓCRINOS ─────────────────────────────────────────────────

  {
    drugs: ['corticosteroides sistemicos', 'prednisona', 'prednisolona', 'dexametasona', 'hidrocortisona', 'betametasona', 'deflazacorte'],
    conditions: ['diabetes mellitus', 'dm2', 'hiperglicemia', 'diabetes descompensado'],
    conditionLabel: 'Diabetes mellitus',
    severity: 'major',
    mechanism: 'Corticosteroides aumentam a neoglicogênese hepática, reduzem a captação periférica de glicose por inibição do GLUT-4 e causam resistência à insulina — hiperglicemia principalmente pós-prandial.',
    clinicalRisk: 'Hiperglicemia intensa (pode ultrapassar 400 mg/dL), cetoacidose em DM1, estado hiperosmolar em DM2. Piora do controle glicêmico cronicamente.',
    pharmacistConduct: 'Antecipar hiperglicemia ao iniciar corticoide em diabéticos. Aumentar frequência de monitoramento glicêmico. Ajustar antidiabéticos ou insulina com prescritor. Preferir corticoides de curta ação e menor dose eficaz.',
    patientGuidance: 'Ao usar cortisona, monitore o açúcar no sangue com mais frequência — pode subir bastante. Informe ao médico imediatamente se o açúcar subir muito.',
    monitoringRequired: 'Glicemia em jejum e pós-prandial diariamente durante uso de corticoide. HbA1c após ciclo prolongado.',
    alternative: 'Menor dose eficaz; preferir corticoides tópicos/inalatórios quando possível',
  },

  {
    drugs: ['levotiroxina', 'tiroxina'],
    conditions: ['doenca cardiaca', 'angina', 'infarto recente', 'arritmia', 'fibrilacao atrial', 'insuficiencia cardiaca'],
    conditionLabel: 'Doença cardíaca isquêmica / Arritmia',
    severity: 'major',
    mechanism: 'Levotiroxina aumenta consumo miocárdico de oxigênio, frequência cardíaca e contratilidade — pode precipitar isquemia ou arritmia em coração comprometido.',
    clinicalRisk: 'Angina instável, IAM, FA, taquiarritmias — especialmente na fase inicial do tratamento ou com doses elevadas.',
    pharmacistConduct: 'Iniciar com dose muito baixa (12,5-25 mcg/dia) e aumentar lentamente a cada 4-6 semanas em cardiopatas. Meta de TSH pode ser mais conservadora (1-3 mUI/L). Monitorar ECG e sintomas.',
    patientGuidance: 'Informe ao médico sobre problemas cardíacos antes de iniciar ou aumentar a dose do hormônio da tireoide. Relate palpitações, dor no peito ou falta de ar.',
    monitoringRequired: 'TSH, T4L a cada 4-6 semanas na fase de ajuste. ECG se sintomas cardiovasculares.',
    alternative: 'Iniciar com doses ultrabaixas e titulação lenta',
  },

  // ── NEUROLÓGICO / PSIQUIÁTRICO ────────────────────────────────────────────

  {
    drugs: ['tramadol', 'meperidina', 'bupropiona', 'antidepressivos triciclicos', 'amitriptilina', 'imipramina', 'clomipramina'],
    conditions: ['epilepsia', 'convulsao', 'crise epileptica', 'historico de convulsao', 'baixo limiar convulsivo'],
    conditionLabel: 'Epilepsia / Histórico de convulsões',
    severity: 'major',
    mechanism: 'Tramadol e bupropiona inibem a recaptação de serotonina e noradrenalina e têm propriedades GABA-anérgicas — reduzem o limiar convulsivo. Tricíclicos também têm propriedades pro-convulsivantes em superdosagem.',
    clinicalRisk: 'Crise convulsiva, especialmente com doses elevadas, em combinação com outros serotoninérgicos ou em pacientes com epilepsia conhecida.',
    pharmacistConduct: 'Uso com extrema cautela em epiléticos. Tramadol: contraindicado pela maioria das diretrizes em epilepsia ativa. Bupropiona: contraindicada em transtornos alimentares e epilepsia. Comunicar prescritor.',
    patientGuidance: 'Informe SEMPRE ao médico que tem ou teve convulsões. Alguns analgésicos e antidepressivos podem provocar crises.',
    monitoringRequired: 'Frequência e tipo de crises, EEG se necessário, nível sérico de antiepiléptico concomitante.',
    alternative: 'Opioides sem efeito serotonérgico (morfina, oxicodona) para dor; ISRS com menor potencial convulsivo (sertralina)',
  },

  {
    drugs: ['haloperidol', 'clorpromazina', 'levomepromazina', 'risperidona', 'olanzapina', 'quetiapina', 'metoclopramida', 'domperidona', 'sulpirida'],
    conditions: ['parkinson', 'doenca de parkinson', 'sindrome parkinsoniana', 'tremor essencial parkinsoniano'],
    conditionLabel: 'Doença de Parkinson',
    severity: 'contraindicated',
    mechanism: 'Bloqueadores dopaminérgicos D2 antagonizam a via nigroestriatal já deficiente no Parkinson — agravam a sintomatologia motora drasticamente.',
    clinicalRisk: 'Piora de rigidez, bradicinesia, tremor, disfagia, pneumonia aspirativa, queda com fratura.',
    pharmacistConduct: 'Antipsicóticos típicos e metoclopramida/domperidona CONTRAINDICADOS em Parkinson. Se necessário antipsicótico: clozapina (único com evidência de não piorar Parkinson) ou quetiapina em dose mínima. Comunicar prescritor.',
    patientGuidance: 'Informe ao médico sobre o Parkinson ANTES de tomar qualquer remédio para enjoo, refluxo ou psiquiátrico.',
    monitoringRequired: 'Escala UPDRS, frequência de quedas, capacidade de deglutição.',
    alternative: 'Clozapina (psicose em Parkinson), ondansetrona (náusea), domperidona com monitoramento de QT',
  },

  // ── HEMATOLÓGICO / HEMOSTASIA ─────────────────────────────────────────────

  {
    drugs: ['aspirina', 'ácido acetilsalicílico', 'aas', 'ibuprofeno', 'naproxeno', 'diclofenaco', 'clopidogrel', 'ticagrelor', 'prasugrel'],
    conditions: ['historia de sangramento gi', 'ulcera peptica ativa', 'hemorragia digestiva', 'hemofilia', 'trombocitopenia grave', 'plaquetas < 50'],
    conditionLabel: 'Sangramento GI ativo / Úlcera péptica / Trombocitopenia grave',
    severity: 'contraindicated',
    mechanism: 'AINEs inibem COX-1 e reduzem PGE2 citoprotetora gástrica. Antiagregantes inibem a função plaquetária, comprometendo a hemostasia primária.',
    clinicalRisk: 'Ressangramento digestivo, perfuração de úlcera, hemorragia com risco de vida.',
    pharmacistConduct: 'Contraindicados em sangramento ativo ou úlcera não tratada. Se antiagregação é indispensável (DAC, stent), associar IBP (omeprazol, pantoprazol). Tratar H. pylori antes de reiniciar. Comunicar prescritor.',
    patientGuidance: 'Não tome aspirina nem anti-inflamatórios se tiver úlcera ou sangramento no estômago. Informe ao médico.',
    monitoringRequired: 'Hemoglobina, hematócrito, sinais de sangramento (melena, hematêmese).',
    alternative: 'Paracetamol para analgesia, IBP profilático se antiagregação inevitável',
  },

  // ── DOENÇA RENAL POLICÍSTICA / GOTA ──────────────────────────────────────

  {
    drugs: ['alopurinol'],
    conditions: ['insuficiencia renal moderada', 'drc estadio 3', 'tfg 15-60', 'clcr < 60'],
    conditionLabel: 'Insuficiência renal (TFG < 60 mL/min)',
    severity: 'major',
    mechanism: 'Alopurinol e seu metabólito ativo (oxipurinol) são eliminados pelos rins. Em IR, ocorre acumulação de oxipurinol — aumenta risco de reações de hipersensibilidade graves (SJS/TEN/DRESS).',
    clinicalRisk: 'Síndrome de hipersensibilidade ao alopurinol (AHS): eritrodermia, insuficiência orgânica múltipla, mortalidade > 20%.',
    pharmacistConduct: 'Iniciar com dose muito baixa (50-100 mg/dia) e aumentar gradualmente com monitoramento. Dose máxima proporcional ao ClCr. Considerar febuxostat (excreção predominantemente hepática). Comunicar prescritor.',
    patientGuidance: 'Com problema nos rins, tome alopurinol em dose menor que o médico indicar. Informe qualquer erupção na pele imediatamente.',
    monitoringRequired: 'Ácido úrico, creatinina, atenção a qualquer erupção cutânea — interromper imediatamente se surgir rash.',
    alternative: 'Febuxostat (metabolismo hepático, menos ajuste renal necessário)',
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
  'Hipnótico Z': ['zolpidem', 'zopiclona', 'zaleplon', 'eszopiclona'],
  'Antipsicótico': ['haloperidol', 'risperidona', 'quetiapina', 'olanzapina', 'aripiprazol', 'clorpromazina', 'levomepromazina', 'ziprasidona'],
  'Antidepressivo tricíclico': ['amitriptilina', 'nortriptilina', 'clomipramina', 'imipramina', 'desipramina'],
  'ISRS': ['fluoxetina', 'sertralina', 'paroxetina', 'citalopram', 'escitalopram', 'fluvoxamina'],
  'Anticoagulante oral': ['warfarina', 'varfarina', 'dabigatrana', 'rivaroxabana', 'apixabana', 'edoxabana'],
  'Antiagregante': ['acido acetilsalicilico', 'clopidogrel', 'ticagrelor', 'prasugrel', 'dipiridamol'],
  'Diurético de alça': ['furosemida', 'bumetanida', 'torasemida', 'piretanida'],
  'Diurético tiazídico': ['hidroclorotiazida', 'clortalidona', 'indapamida', 'bendroflumetiazida'],
  'Nitrato': ['isossorbida', 'mononitrato de isossorbida', 'dinitrato de isossorbida', 'nitroglicerina', 'propatilnitrato', 'monocordil', 'sustrate'],
  'Inibidor de PDE5': ['sildenafila', 'tadalafila', 'vardenafila', 'avanafila', 'lodenafila'],
  'BCC não-diidropiridínico': ['verapamil', 'diltiazem'],
}

/**
 * Interações classe×classe: disparam para QUALQUER membro de cada classe (via
 * CLASS_KEYWORDS), não apenas pares de nomes enumerados. Cobrem efeitos de classe
 * onde o risco independe do princípio ativo específico (ex.: opioide+benzo).
 */
interface ClassInteraction {
  class1: string
  class2: string
  severity: KnownInteraction['severity']
  mechanism: string
  clinicalEffect: string
  management: string
}

const CLASS_INTERACTIONS: ClassInteraction[] = [
  { class1: 'Opioide', class2: 'Benzodiazepínico', severity: 'major', mechanism: 'Depressão aditiva do SNC e do drive respiratório (tarja preta FDA/ANVISA)', clinicalEffect: 'Sedação profunda, depressão respiratória, risco de óbito', management: 'Evitar a combinação. Se imprescindível, usar a menor dose e menor tempo possíveis, orientar sinais de alerta e considerar naloxona domiciliar.' },
  { class1: 'Opioide', class2: 'Hipnótico Z', severity: 'major', mechanism: 'Depressão aditiva do SNC (zolpidem/zopiclona somam-se ao opioide)', clinicalEffect: 'Sedação e depressão respiratória', management: 'Evitar a associação; reavaliar necessidade do hipnótico.' },
  { class1: 'Nitrato', class2: 'Inibidor de PDE5', severity: 'contraindicated', mechanism: 'Potencialização do efeito vasodilatador via acúmulo de GMPc', clinicalEffect: 'Hipotensão grave/potencialmente fatal', management: 'CONTRAINDICADO. Não associar; respeitar intervalo de segurança e nunca usar nitrato de resgate sob efeito de PDE5.' },
  { class1: 'IECA', class2: 'BRA-II (Sartana)', severity: 'major', mechanism: 'Duplo bloqueio do sistema renina-angiotensina-aldosterona', clinicalEffect: 'Hipercalemia, hipotensão e lesão renal aguda, sem benefício cardiovascular adicional (ONTARGET)', management: 'Não associar IECA + BRA rotineiramente. Suspender uma das classes e monitorar K+ e função renal.' },
  { class1: 'Benzodiazepínico', class2: 'Hipnótico Z', severity: 'moderate', mechanism: 'Sobreposição de sedativos GABAérgicos', clinicalEffect: 'Sedação excessiva, quedas e comprometimento cognitivo (especialmente idosos)', management: 'Evitar uso concomitante; consolidar em um único agente e planejar desmame.' },
  { class1: 'Betabloqueador', class2: 'BCC não-diidropiridínico', severity: 'major', mechanism: 'Depressão aditiva do nó sinusal e da condução AV (verapamil/diltiazem + betabloqueador)', clinicalEffect: 'Bradicardia grave, bloqueio AV e hipotensão; risco maior em ICC ou distúrbio de condução', management: 'Evitar a associação, sobretudo com verapamil. Se imprescindível, monitorar FC e ECG e iniciar em doses baixas. Para controle de frequência, preferir um único agente.' },
  { class1: 'AINE', class2: 'Anticoagulante oral', severity: 'major', mechanism: 'AINEs lesam a mucosa GI e inibem a função plaquetária, somando-se ao efeito anticoagulante', clinicalEffect: 'Risco elevado de hemorragia digestiva', management: 'Evitar AINEs em anticoagulados. Preferir paracetamol. Se imprescindível, usar IBP e o menor tempo possível, com monitorização.' },
  { class1: 'AINE', class2: 'Antiagregante', severity: 'moderate', mechanism: 'AINE + antiagregante somam lesão de mucosa e inibição plaquetária', clinicalEffect: 'Aumento do risco de sangramento gastrointestinal', management: 'Evitar uso crônico concomitante; associar IBP para gastroproteção e reavaliar a necessidade do AINE.' },
  { class1: 'Anticoagulante oral', class2: 'Antiagregante', severity: 'major', mechanism: 'Terapia antitrombótica combinada (anticoagulante + antiagregante)', clinicalEffect: 'Risco hemorrágico aumentado; só justificável em indicações específicas (ex.: SCA/stent recente em FA)', management: 'Confirmar indicação e duração planejada da terapia combinada. Associar IBP, definir tempo de dupla/tripla terapia e reavaliar conforme escores de risco (HAS-BLED).' },
]

/** Membros (medicamentos) de uma classe presentes na lista do paciente. */
function membersOfClass(className: string, medications: MedicationContext[]): MedicationContext[] {
  const keywords = CLASS_KEYWORDS[className] || []
  return medications.filter(med => keywords.some(kw => norm(med.activeIngredient).includes(norm(kw))))
}

/**
 * Cascatas de prescrição: um medicamento "tratamento" foi possivelmente adicionado
 * para manejar um efeito adverso de um medicamento "gatilho". Detecção determinística
 * quando AMBOS estão presentes — sinaliza para o farmacêutico investigar a indicação
 * real do tratamento (candidato a desprescrição se for só efeito adverso do gatilho).
 */
interface PrescriptionCascade {
  id: string
  triggerKeywords: string[]
  triggerLabel: string
  treatmentKeywords: string[]
  treatmentLabel: string
  suspectedEffect: string
  conduct: string
}

const PRESCRIPTION_CASCADES: PrescriptionCascade[] = [
  {
    id: 'bcc_edema_diuretico',
    triggerKeywords: ['amlodipina', 'nifedipina', 'felodipina', 'lercanidipina', 'lacidipina', 'manidipina', 'nitrendipina'],
    triggerLabel: 'bloqueador de canal de cálcio di-hidropiridínico',
    treatmentKeywords: ['furosemida', 'hidroclorotiazida', 'clortalidona', 'indapamida', 'bumetanida', 'espironolactona'],
    treatmentLabel: 'diurético',
    suspectedEffect: 'edema periférico induzido por di-hidropiridínico (vasodilatação arteriolar)',
    conduct: 'Investigar se o diurético foi iniciado para tratar edema do di-hidropiridínico. Se sim, o diurético tende a ser ineficaz para esse edema — preferir reduzir a dose do BCC ou trocar por anlodipino+IECA/BRA, em vez de adicionar diurético.',
  },
  {
    id: 'antipsicotico_eps_antiparkinsoniano',
    triggerKeywords: ['haloperidol', 'risperidona', 'flufenazina', 'clorpromazina', 'levomepromazina', 'metoclopramida', 'sulpirida', 'amissulprida'],
    triggerLabel: 'antipsicótico/antidopaminérgico',
    treatmentKeywords: ['biperideno', 'tri-hexifenidil', 'triexifenidil', 'prociclidina'],
    treatmentLabel: 'antiparkinsoniano anticolinérgico',
    suspectedEffect: 'sintomas extrapiramidais (parkinsonismo medicamentoso) induzidos pelo antidopaminérgico',
    conduct: 'Investigar se o anticolinérgico foi adicionado para tratar sintomas extrapiramidais. Preferir reduzir a dose ou trocar o antipsicótico por um de menor risco extrapiramidal, em vez de manter o anticolinérgico (que carrega carga anticolinérgica e risco de delirium em idosos).',
  },
  {
    id: 'tiazidico_hiperuricemia_gota',
    triggerKeywords: ['hidroclorotiazida', 'clortalidona', 'indapamida', 'bendroflumetiazida'],
    triggerLabel: 'diurético tiazídico',
    treatmentKeywords: ['alopurinol', 'febuxostate', 'colchicina', 'benzobromarona'],
    treatmentLabel: 'hipouricemiante/antigotoso',
    suspectedEffect: 'hiperuricemia/crise de gota precipitada pelo tiazídico (redução da excreção renal de ácido úrico)',
    conduct: 'Investigar se a gota/hiperuricemia surgiu após o tiazídico. Avaliar trocar o tiazídico por outro anti-hipertensivo (ex.: BCC, IECA/BRA — losartana tem efeito uricosúrico) em vez de manter terapia antigotosa crônica.',
  },
  {
    id: 'isrs_disfuncao_sexual_pde5',
    triggerKeywords: ['fluoxetina', 'sertralina', 'paroxetina', 'citalopram', 'escitalopram', 'fluvoxamina', 'venlafaxina', 'duloxetina'],
    triggerLabel: 'ISRS/IRSN',
    treatmentKeywords: ['sildenafila', 'tadalafila', 'vardenafila', 'avanafila', 'lodenafila'],
    treatmentLabel: 'inibidor de PDE5',
    suspectedEffect: 'disfunção sexual induzida por ISRS/IRSN (efeito de classe muito frequente)',
    conduct: 'Investigar se a disfunção sexual surgiu após o antidepressivo. Discutir com o prescritor estratégias (troca por antidepressivo de menor impacto sexual — bupropiona, mirtazapina — ou ajuste de dose) antes de cronificar o uso de inibidor de PDE5.',
  },
  {
    id: 'ieca_tosse_antitussigeno',
    triggerKeywords: ['enalapril', 'captopril', 'lisinopril', 'ramipril', 'perindopril', 'quinapril', 'fosinopril', 'trandolapril'],
    triggerLabel: 'IECA',
    treatmentKeywords: ['dextrometorfano', 'levodropropizina', 'cloperastina', 'codeina'],
    treatmentLabel: 'antitussígeno',
    suspectedEffect: 'tosse seca induzida por IECA (acúmulo de bradicinina)',
    conduct: 'Investigar se a tosse surgiu após o IECA. Se for tosse do IECA, o antitussígeno é ineficaz — substituir o IECA por um BRA (sartana), que não causa tosse.',
  },
]

function findPrescriptionCascades(medications: MedicationContext[]): PRMFindingResult[] {
  const findings: PRMFindingResult[] = []
  for (const c of PRESCRIPTION_CASCADES) {
    const trigger = medications.find(m => c.triggerKeywords.some(k => norm(m.activeIngredient).includes(norm(k))))
    const treatment = medications.find(m => c.treatmentKeywords.some(k => norm(m.activeIngredient).includes(norm(k))))
    if (trigger && treatment && trigger.id !== treatment.id) {
      findings.push({
        category: PRMCategory.NECESSITY,
        riskLevel: RiskLevel.MODERATE,
        title: `Possível cascata de prescrição: ${treatment.activeIngredient} para efeito de ${trigger.activeIngredient}`,
        description: `${treatment.activeIngredient} (${c.treatmentLabel}) pode ter sido adicionado para tratar ${c.suspectedEffect}, causado por ${trigger.activeIngredient} (${c.triggerLabel}).`,
        clinicalEvidence: `Cascata de prescrição (Rochon & Gurwitz). Gatilho: ${trigger.activeIngredient}; tratamento: ${treatment.activeIngredient}. Efeito suspeito: ${c.suspectedEffect}.`,
        potentialImpact: 'Manutenção de medicamento potencialmente desnecessário, somando custo, risco de eventos adversos e complexidade do regime.',
        pharmacistConduct: c.conduct,
        patientGuidance: 'Converse com seu farmacêutico/médico sobre quando cada remédio foi iniciado. Não suspenda nada por conta própria.',
        needsReferral: false,
        needsPrescriberContact: true,
        monitoring: 'Reavaliar o sintoma-alvo após ajuste do medicamento gatilho.',
        reevaluationPeriod: 'Próxima consulta',
        confidenceLevel: 'moderate',
        validationNote: 'Confirmar com o paciente a cronologia de início dos medicamentos e se o tratamento é para outra indicação legítima.',
        interventionDeadline: 'Próxima consulta',
        medicationId: treatment.id,
      })
    }
  }
  return findings
}

// ─── Funções Utilitárias ─────────────────────────────────────────────────────

const SEVERITY_RANK: Record<KnownInteraction['severity'], number> = {
  contraindicated: 3, major: 2, moderate: 1, minor: 0,
}

function findInteractions(medications: MedicationContext[]) {
  // Dedup por par de medicamentos: cada dupla gera no MÁXIMO uma interação.
  // Se múltiplas entradas casarem (incl. duplicatas), mantém a de maior severidade.
  const byPair = new Map<string, { med1: MedicationContext; med2: MedicationContext; interaction: KnownInteraction }>()

  for (let i = 0; i < medications.length; i++) {
    for (let j = i + 1; j < medications.length; j++) {
      const n1 = norm(medications[i].activeIngredient)
      const n2 = norm(medications[j].activeIngredient)
      const key = [medications[i].id, medications[j].id].sort().join('|')
      for (const interaction of KNOWN_INTERACTIONS) {
        const d1 = norm(interaction.drug1)
        const d2 = norm(interaction.drug2)
        if ((n1.includes(d1) && n2.includes(d2)) || (n1.includes(d2) && n2.includes(d1))) {
          const cur = byPair.get(key)
          if (!cur || SEVERITY_RANK[interaction.severity] > SEVERITY_RANK[cur.interaction.severity]) {
            byPair.set(key, { med1: medications[i], med2: medications[j], interaction })
          }
        }
      }
    }
  }

  // Interações por classe×classe (qualquer membro de cada classe)
  for (const ci of CLASS_INTERACTIONS) {
    const group1 = membersOfClass(ci.class1, medications)
    const group2 = membersOfClass(ci.class2, medications)
    for (const m1 of group1) {
      for (const m2 of group2) {
        if (m1.id === m2.id) continue
        const key = [m1.id, m2.id].sort().join('|')
        if (byPair.has(key)) continue // já coberto por par de nomes específico
        byPair.set(key, {
          med1: m1,
          med2: m2,
          interaction: {
            drug1: m1.activeIngredient,
            drug2: m2.activeIngredient,
            severity: ci.severity,
            mechanism: ci.mechanism,
            clinicalEffect: ci.clinicalEffect,
            management: ci.management,
          },
        })
      }
    }
  }

  return Array.from(byPair.values())
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

  // Cascatas de prescrição (medicamento tratando efeito adverso de outro)
  findings.push(...findPrescriptionCascades(context.medications))

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
  const startDiagText = expandDiagnosesWithSynonyms(
    [...context.diagnoses.map(d => norm(d.name)), ...context.comorbidities.map(c => norm(c.name)), norm(context.chiefComplaint || '')].join(' ')
  )
  for (const criterion of START_CRITERIA) {
    const hasCondition = criterion.conditionKeywords.some(k => startDiagText.includes(norm(k)))
    if (!hasCondition) continue
    if (criterion.alsoRequiresAnyOf && !criterion.alsoRequiresAnyOf.some(k => startDiagText.includes(norm(k)))) continue
    if (criterion.requiresMedAnyOf && !criterion.requiresMedAnyOf.some(k => medText.includes(norm(k)))) continue
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

  // ── Carga Anticolinérgica Total (ACB Score) ──────────────────────────────────
  // Fonte: Anticholinergic Cognitive Burden Scale (Boustani et al. 2008)
  // Score ≥ 3 associado a comprometimento cognitivo; ≥ 6 risco muito alto
  {
    let totalACB = 0
    const acbMeds: { name: string; score: number }[] = []
    for (const med of context.medications) {
      const n = norm(med.activeIngredient)
      for (const [drug, score] of Object.entries(ACB_SCORES)) {
        if (n.includes(norm(drug))) {
          totalACB += score
          acbMeds.push({ name: med.activeIngredient, score })
          break
        }
      }
    }
    if (totalACB >= 3) {
      const isHigh = totalACB >= 6
      findings.push({
        category: PRMCategory.SAFETY,
        riskLevel: isHigh ? RiskLevel.HIGH : RiskLevel.MODERATE,
        title: `${isHigh ? '⚠️' : '🔶'} Carga Anticolinérgica Elevada (ACB Score: ${totalACB})`,
        description: `Paciente em uso de múltiplos medicamentos com atividade anticolinérgica. Soma da carga ACB: ${totalACB} pontos${totalACB >= 6 ? ' — CARGA MUITO ALTA' : ' — carga relevante'}.`,
        clinicalEvidence: `Medicamentos com atividade anticolinérgica: ${acbMeds.map(m => `${m.name} (ACB=${m.score})`).join(', ')}. Score total: ${totalACB}. Limite de risco: ACB ≥ 3 = comprometimento cognitivo; ≥ 6 = risco muito alto. Fonte: Anticholinergic Cognitive Burden Scale (Boustani et al., 2008).`,
        potentialImpact: isHigh
          ? 'Risco muito alto de delirium, déficit cognitivo agudo, quedas, retenção urinária e visão turva. Associado a aumento de mortalidade em idosos (JAGS 2008).'
          : 'Comprometimento cognitivo, sedação, constipação, xerostomia, retenção urinária e risco de quedas aumentado.',
        pharmacistConduct: `Revisar cada medicamento com atividade anticolinérgica e avaliar desprescrição ou substituição. Priorizar os de ACB=3 (${acbMeds.filter(m => m.score === 3).map(m => m.name).join(', ') || 'nenhum'}). Calcular score atualizado após mudanças. Usar ferramenta online: anticholinergicburden.com`,
        patientGuidance: 'Peça uma revisão completa dos seus medicamentos ao médico. Alguns podem estar causando confusão, tontura ou dificuldade de urinar.',
        needsReferral: false,
        needsPrescriberContact: true,
        monitoring: 'MEEM ou MoCA para cognição. Avaliação de risco de quedas. Função urinária. Constipação.',
        suggestedExams: 'Avaliação cognitiva (MEEM), risco de quedas (TUG test), sintomas anticolinérgicos periféricos.',
        reevaluationPeriod: '30 dias',
        confidenceLevel: 'high',
        validationNote: `ACB Score total: ${totalACB}. Scores individuais: ${acbMeds.map(m => `${m.name}=${m.score}`).join(', ')}. Fonte: Anticholinergic Cognitive Burden Scale. Limites: ≥3 = risco, ≥6 = alto risco.`,
        interventionDeadline: isHigh ? '7 dias' : 'Próxima consulta',
      })
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
    const diagnosesText = expandDiagnosesWithSynonyms(
      context.diagnoses.map(d => norm(d.name)).join(' ') + ' ' +
      context.comorbidities.map(c => norm(c.name)).join(' ') + ' ' +
      norm(context.chiefComplaint || '')
    )
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
            clinicalEvidence: `Função renal: ${labelRenal(context.renalFunction)}${context.creatinineClearance ? ` (ClCr: ${context.creatinineClearance} mL/min)` : ''}. Medicamento: ${med.activeIngredient}.`,
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
            clinicalEvidence: `Função hepática comprometida — ${labelHepatic(context.hepaticFunction)}. Medicamento: ${med.activeIngredient}.`,
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

  // ── ISMP Brasil — Medicamentos de Alto Risco (MAR) ───────────────────────────
  for (const med of context.medications) {
    const n = norm(med.activeIngredient)
    for (const [drug, data] of Object.entries(ISMP_HIGH_ALERT_DRUGS)) {
      if (n.includes(norm(drug))) {
        findings.push({
          category: PRMCategory.SAFETY,
          riskLevel: data.level === 'critical' ? RiskLevel.HIGH : RiskLevel.MODERATE,
          title: `Medicamento de Alto Risco (ISMP Brasil): ${med.activeIngredient}`,
          description: data.risk,
          clinicalEvidence: `Lista ISMP Brasil de Medicamentos de Alto Risco. ${med.activeIngredient} requer monitoramento e verificação especiais.`,
          potentialImpact: 'Erros no uso deste medicamento podem causar danos graves ou fatais.',
          pharmacistConduct: `Verificar: ${data.monitoring}. Confirmar indicação, dose, via e frequência. Registrar monitoramento.`,
          patientGuidance: 'Este medicamento requer atenção especial. Nunca altere a dose ou frequência sem orientação médica. Informe qualquer sintoma novo.',
          needsReferral: false,
          needsPrescriberContact: false,
          monitoring: data.monitoring,
          reevaluationPeriod: '30 dias',
          confidenceLevel: 'high',
          validationNote: 'Classificação ISMP Brasil. Aplicar protocolo de dupla verificação.',
          interventionDeadline: 'Próxima consulta',
          medicationId: med.id,
        })
        break
      }
    }
  }

  // ── Prolongamento de QT — combinações de risco ────────────────────────────
  const qtHighMeds = context.medications.filter(m =>
    QT_HIGH_RISK.some(d => norm(m.activeIngredient).includes(norm(d)))
  )
  const qtModerateMeds = context.medications.filter(m =>
    !QT_HIGH_RISK.some(d => norm(m.activeIngredient).includes(norm(d))) &&
    QT_MODERATE_RISK.some(d => norm(m.activeIngredient).includes(norm(d)))
  )

  // 2+ drogas com risco QT alto
  if (qtHighMeds.length >= 2) {
    findings.push({
      category: PRMCategory.SAFETY,
      riskLevel: RiskLevel.URGENT,
      title: `URGENTE — Combinação de múltiplos prolongadores de QT: ${qtHighMeds.map(m => m.activeIngredient).join(' + ')}`,
      description: 'Dois ou mais medicamentos de alto risco para prolongamento do intervalo QT em uso simultâneo — risco elevado de Torsades de Pointes e morte súbita.',
      clinicalEvidence: `Medicamentos de alto risco QT identificados: ${qtHighMeds.map(m => m.activeIngredient).join(', ')}. Fatores agravantes: hipocalemia, hipomagnesemia, bradicardia, sexo feminino, cardiopatia prévia. Fonte: CredibleMeds / AHA.`,
      potentialImpact: 'Torsades de pointes — arritmia ventricular potencialmente fatal.',
      pharmacistConduct: 'Comunicar ao prescritor IMEDIATAMENTE. Solicitar ECG (QTc). Verificar e corrigir eletrólitos (K⁺, Mg²⁺). Avaliar substituição de um dos medicamentos.',
      patientGuidance: 'Informe ao médico imediatamente. Procure atendimento se sentir palpitações, tontura ou desmaio.',
      needsReferral: true,
      needsPrescriberContact: true,
      monitoring: 'ECG com QTc, K⁺, Mg²⁺ imediatos. QTc > 500 ms = suspender medicamentos.',
      suggestedExams: 'ECG (QTc), potássio, magnésio, creatinina.',
      reevaluationPeriod: 'Imediato',
      confidenceLevel: 'high',
      validationNote: 'Risco aumenta com hipocalemia, bradicardia e sexo feminino. Avaliação cardiológica recomendada.',
      interventionDeadline: 'Imediato',
    })
  } else if (qtHighMeds.length === 1 && qtModerateMeds.length >= 1) {
    // 1 droga alto risco + ≥1 droga moderado risco
    const allQtMeds = [...qtHighMeds, ...qtModerateMeds]
    findings.push({
      category: PRMCategory.SAFETY,
      riskLevel: RiskLevel.HIGH,
      title: `Combinação de risco para prolongamento de QT: ${allQtMeds.map(m => m.activeIngredient).join(' + ')}`,
      description: 'Combinação de medicamento de alto risco com medicamento de risco moderado para prolongamento do QT.',
      clinicalEvidence: `Alto risco: ${qtHighMeds.map(m => m.activeIngredient).join(', ')}. Moderado risco: ${qtModerateMeds.map(m => m.activeIngredient).join(', ')}. Fonte: CredibleMeds.`,
      potentialImpact: 'Prolongamento do QTc com risco de Torsades de pointes.',
      pharmacistConduct: 'Solicitar ECG basal e monitoramento do QTc. Corrigir hipocalemia e hipomagnesemia. Avaliar alternativas ao medicamento de risco moderado.',
      patientGuidance: 'Informe ao médico sobre todos os medicamentos. Relate palpitações ou tontura.',
      needsReferral: false,
      needsPrescriberContact: true,
      monitoring: 'ECG (QTc), K⁺, Mg²⁺. Repetir ECG após mudanças de dose.',
      suggestedExams: 'ECG, eletrólitos.',
      reevaluationPeriod: '7 dias',
      confidenceLevel: 'high',
      validationNote: 'Risco depende de fatores individuais (eletrólitos, FC, cardiopatia).',
      interventionDeadline: '7 dias',
    })
  } else if (qtModerateMeds.length >= 2) {
    // ≥2 drogas de risco moderado
    findings.push({
      category: PRMCategory.SAFETY,
      riskLevel: RiskLevel.MODERATE,
      title: `Múltiplos medicamentos com risco moderado de QT longo: ${qtModerateMeds.map(m => m.activeIngredient).join(' + ')}`,
      description: 'Dois ou mais medicamentos com risco moderado de prolongamento do QT em uso simultâneo.',
      clinicalEvidence: `Medicamentos com risco moderado QT: ${qtModerateMeds.map(m => m.activeIngredient).join(', ')}.`,
      potentialImpact: 'Prolongamento cumulativo do QT com risco de arritmia.',
      pharmacistConduct: 'Solicitar ECG. Monitorar eletrólitos. Avaliar se todos os medicamentos são necessários.',
      patientGuidance: 'Relate palpitações, desmaio ou tontura ao médico.',
      needsReferral: false,
      needsPrescriberContact: true,
      monitoring: 'ECG (QTc), K⁺, Mg²⁺.',
      reevaluationPeriod: '30 dias',
      confidenceLevel: 'moderate',
      validationNote: 'Risco individual depende de dose, eletrólitos e fatores de risco basais.',
      interventionDeadline: 'Próxima consulta',
    })
  }

  // ── "Triple whammy" — AINE + (IECA ou BRA) + diurético ────────────────────────
  // Combinação clássica de nefrotoxicidade: vasoconstrição aferente (AINE) +
  // vasodilatação eferente bloqueada (IECA/BRA) + hipovolemia (diurético) → IRA.
  {
    const aineMeds = membersOfClass('AINE', context.medications)
    const raasMeds = [
      ...membersOfClass('IECA', context.medications),
      ...membersOfClass('BRA-II (Sartana)', context.medications),
    ]
    const diureticMeds = [
      ...membersOfClass('Diurético de alça', context.medications),
      ...membersOfClass('Diurético tiazídico', context.medications),
    ]
    if (aineMeds.length > 0 && raasMeds.length > 0 && diureticMeds.length > 0) {
      const todos = [...aineMeds, ...raasMeds, ...diureticMeds]
      findings.push({
        category: PRMCategory.SAFETY,
        riskLevel: RiskLevel.HIGH,
        title: `"Triple whammy" — risco de lesão renal aguda: ${aineMeds[0].activeIngredient} + ${raasMeds[0].activeIngredient} + ${diureticMeds[0].activeIngredient}`,
        description: 'Uso simultâneo de AINE + IECA/BRA + diurético ("triple whammy") — combinação de alto risco para lesão renal aguda, especialmente em idosos, hipovolemia ou doença renal prévia.',
        clinicalEvidence: `AINE: ${aineMeds.map(m => m.activeIngredient).join(', ')}; IECA/BRA: ${raasMeds.map(m => m.activeIngredient).join(', ')}; Diurético: ${diureticMeds.map(m => m.activeIngredient).join(', ')}. O AINE bloqueia as prostaglandinas que dilatam a arteríola aferente, o IECA/BRA dilata a eferente e o diurético reduz a volemia — os três reduzem a pressão de filtração glomerular. Fonte: BMJ 2013 (Lapi et al.); NICE.`,
        potentialImpact: 'Lesão renal aguda (IRA), hipercalemia e retenção hidrossalina — risco aumentado nas primeiras semanas da associação.',
        pharmacistConduct: 'Comunicar ao prescritor. Suspender ou substituir o AINE (preferir paracetamol). Se a tríade for inevitável, monitorar creatinina e K⁺ de perto e orientar hidratação adequada.',
        patientGuidance: 'Evite anti-inflamatórios (ibuprofeno, diclofenaco, naproxeno) enquanto usa seus remédios para pressão e diurético — a combinação pode prejudicar os rins. Para dor, prefira paracetamol e fale com seu médico.',
        needsReferral: false,
        needsPrescriberContact: true,
        monitoring: 'Creatinina, ureia e K⁺ basais e 5-7 dias após início da associação. Reavaliar diurese e sinais de hipovolemia.',
        suggestedExams: 'Creatinina, ureia, potássio.',
        reevaluationPeriod: '7 dias',
        confidenceLevel: 'high',
        validationNote: 'Risco maior em idosos, desidratação, DRC prévia ou estenose de artéria renal. Avaliação individual essencial.',
        interventionDeadline: '24-48h',
        medicationId: aineMeds[0].id,
      })
    }
  }

  // ── Suplemento de potássio + fármaco que retém potássio ───────────────────────
  {
    const kSupp = context.medications.find(m => {
      const n = norm(m.activeIngredient)
      const t = norm(m.tradeName || '')
      return ['cloreto de potassio', 'citrato de potassio', 'suplemento de potassio', 'slow-k', 'slow k', 'kcl'].some(k => n.includes(norm(k)) || t.includes(norm(k)))
    })
    const kRetentor = context.medications.find(m =>
      ['enalapril', 'captopril', 'lisinopril', 'ramipril', 'perindopril', 'losartana', 'valsartana', 'candesartana', 'irbesartana', 'telmisartana', 'olmesartana', 'espironolactona', 'eplerenona', 'amilorida', 'triantereno'].some(d => norm(m.activeIngredient).includes(norm(d)))
    )
    if (kSupp && kRetentor) {
      findings.push({
        category: PRMCategory.SAFETY,
        riskLevel: RiskLevel.HIGH,
        title: `Suplemento de potássio com fármaco que retém potássio: ${kSupp.activeIngredient} + ${kRetentor.activeIngredient}`,
        description: `Uso de suplemento de potássio (${kSupp.activeIngredient}) junto a ${kRetentor.activeIngredient}, que reduz a excreção renal de potássio — combinação raramente apropriada e de alto risco para hipercalemia.`,
        clinicalEvidence: `IECA/BRA e poupadores de potássio retêm K⁺; somar suplementação de potássio aumenta substancialmente o risco de hipercalemia. Fonte: Beers 2023 / bulário.`,
        potentialImpact: 'Hipercalemia com risco de arritmias graves e parada cardíaca.',
        pharmacistConduct: 'Comunicar ao prescritor. Reavaliar a real necessidade do suplemento de potássio (dosar K⁺ antes de manter). Em geral, suspender o suplemento na vigência de IECA/BRA/poupador, salvo hipocalemia documentada com monitorização.',
        patientGuidance: 'Evite suplementos e sais de potássio sem orientação enquanto usa esses remédios. Relate fraqueza muscular ou palpitações.',
        needsReferral: false,
        needsPrescriberContact: true,
        monitoring: 'Potássio sérico e função renal antes de manter o suplemento; ECG se K⁺ elevado.',
        suggestedExams: 'Potássio, creatinina, ECG se alterado.',
        reevaluationPeriod: '7 dias',
        confidenceLevel: 'high',
        validationNote: 'Confirmar indicação do suplemento (hipocalemia documentada?) e o valor atual de K⁺.',
        interventionDeadline: '24-48h',
        medicationId: kSupp.id,
      })
    }
  }

  // ── Interações alimento-medicamento ──────────────────────────────────────────
  for (const interaction of FOOD_DRUG_INTERACTIONS) {
    for (const med of context.medications) {
      const medN = norm(med.activeIngredient)
      const tradeN = med.tradeName ? norm(med.tradeName) : ''
      const matched = interaction.drugs.some(d => {
        const dn = norm(d)
        return medN.includes(dn) || dn.includes(medN) || (tradeN && (tradeN.includes(dn) || dn.includes(tradeN)))
      })
      if (matched) {
        findings.push({
          category: PRMCategory.SAFETY,
          riskLevel: interaction.severity === 'major' ? RiskLevel.HIGH : RiskLevel.MODERATE,
          title: `Interação alimento-medicamento: ${interaction.emoji} ${interaction.food} + ${med.activeIngredient}`,
          description: `${interaction.clinicalEffect} Mecanismo: ${interaction.mechanism}.`,
          clinicalEvidence: `Alimento: ${interaction.food} | Medicamento: ${med.activeIngredient} | Efeito: ${interaction.clinicalEffect}`,
          potentialImpact: interaction.clinicalEffect,
          pharmacistConduct: interaction.management,
          patientGuidance: interaction.patientGuidance,
          needsReferral: false,
          needsPrescriberContact: interaction.severity === 'major',
          monitoring: `Monitorar sinais clínicos de ${interaction.clinicalEffect.toLowerCase().slice(0, 80)}.`,
          reevaluationPeriod: interaction.severity === 'major' ? '7 dias' : '30 dias',
          confidenceLevel: 'high',
          validationNote: 'Avaliar frequência de consumo e hábitos alimentares do paciente.',
          interventionDeadline: interaction.severity === 'major' ? 'Próxima consulta' : 'Orientação imediata',
          medicationId: med.id,
        })
      }
    }
  }

  // ── Interações medicamento-condição clínica ───────────────────────────────
  {
    const diagText = expandDiagnosesWithSynonyms([
      ...context.diagnoses.map(d => norm(d.name)),
      ...context.comorbidities.map(c => norm(c.name)),
      norm(context.chiefComplaint || ''),
      norm(context.renalFunction || ''),
      context.creatinineClearance ? `clcr ${context.creatinineClearance}` : '',
    ].join(' '))

    for (const interaction of DRUG_DISEASE_INTERACTIONS) {
      const hasCondition = interaction.conditions.some(c => diagText.includes(norm(c)))
      if (!hasCondition) continue

      for (const med of context.medications) {
        const medN   = norm(med.activeIngredient)
        const tradeN = med.tradeName ? norm(med.tradeName) : ''

        const matched = interaction.drugs.some(d => {
          const dn = norm(d)
          return medN.includes(dn) || dn.includes(medN) || (tradeN && (tradeN.includes(dn) || dn.includes(tradeN)))
        })
        if (!matched) continue

        const riskLevel = interaction.severity === 'contraindicated'
          ? RiskLevel.URGENT
          : interaction.severity === 'major'
            ? RiskLevel.HIGH
            : RiskLevel.MODERATE

        findings.push({
          category: PRMCategory.SAFETY,
          riskLevel,
          title: `${interaction.severity === 'contraindicated' ? '🚫 CONTRAINDICADO' : '⚠️ Precaução grave'}: ${med.activeIngredient} + ${interaction.conditionLabel}`,
          description: `${med.activeIngredient} apresenta ${interaction.severity === 'contraindicated' ? 'contraindicação absoluta' : 'interação grave'} com a condição clínica "${interaction.conditionLabel}". ${interaction.mechanism}`,
          clinicalEvidence: `Medicamento: ${med.activeIngredient} | Condição: ${interaction.conditionLabel} | Mecanismo: ${interaction.mechanism}`,
          potentialImpact: interaction.clinicalRisk,
          pharmacistConduct: interaction.pharmacistConduct,
          patientGuidance: interaction.patientGuidance,
          needsReferral: interaction.severity === 'contraindicated',
          needsPrescriberContact: true,
          monitoring: interaction.monitoringRequired,
          reevaluationPeriod: interaction.severity === 'contraindicated' ? 'Imediato' : '7 dias',
          confidenceLevel: 'high',
          validationNote: interaction.alternative
            ? `Alternativa terapêutica sugerida: ${interaction.alternative}`
            : 'Avaliar risco-benefício individualmente com o prescritor.',
          interventionDeadline: interaction.severity === 'contraindicated' ? 'Imediato — contato com prescritor obrigatório' : 'Próxima consulta',
          medicationId: med.id,
        })
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

// ─── Findings guiados por exames laboratoriais ────────────────────────────────

/** Extrai o primeiro número de uma string de valor laboratorial ("8,5%", "150 mg/dL"). */
function parseLabValue(value: string): number | null {
  if (!value) return null
  const m = value.replace(',', '.').match(/-?\d+(\.\d+)?/)
  return m ? parseFloat(m[0]) : null
}

/** Retorna o valor numérico do primeiro exame cujo nome casa com algum dos termos. */
function getLab(context: PatientContext, ...nameKeywords: string[]): number | null {
  for (const lab of context.labResults) {
    const n = norm(lab.examName)
    if (nameKeywords.some(k => n.includes(norm(k)))) {
      const v = parseLabValue(lab.value)
      if (v !== null) return v
    }
  }
  return null
}

function findLabBasedPRMs(context: PatientContext): PRMFindingResult[] {
  const findings: PRMFindingResult[] = []
  if (context.labResults.length === 0) return findings

  const medText = context.medications.map(m => norm(m.activeIngredient)).join(' ')
  const hasMed = (...keys: string[]) => keys.some(k => medText.includes(norm(k)))
  const diagText = expandDiagnosesWithSynonyms(
    [...context.diagnoses.map(d => norm(d.name)), ...context.comorbidities.map(c => norm(c.name))].join(' ')
  )
  const hasDiag = (...keys: string[]) => keys.some(k => diagText.includes(norm(k)))

  // HbA1c elevada — inefetividade do tratamento do diabetes
  const hba1c = getLab(context, 'hba1c', 'hemoglobina glicada', 'glicada', 'a1c')
  if (hba1c !== null && hba1c >= 7 && hba1c <= 20) {
    const grave = hba1c >= 9
    findings.push({
      category: PRMCategory.EFFECTIVENESS,
      riskLevel: grave ? RiskLevel.HIGH : RiskLevel.MODERATE,
      title: `HbA1c acima da meta (${hba1c}%) — controle glicêmico inadequado`,
      description: `Hemoglobina glicada de ${hba1c}% indica controle glicêmico ${grave ? 'gravemente inadequado' : 'fora da meta usual (<7% para a maioria dos adultos)'}.`,
      clinicalEvidence: `HbA1c = ${hba1c}%. Meta individualizada (geralmente <7%; <8% em idosos frágeis). Fonte: ADA/SBD 2024.`,
      potentialImpact: 'Risco aumentado de complicações micro e macrovasculares (retinopatia, nefropatia, neuropatia, DCV).',
      pharmacistConduct: 'Revisar adesão, técnica e doses dos antidiabéticos. Avaliar com o prescritor intensificação/otimização (metformina em dose plena, adição de iSGLT2/GLP-1 conforme comorbidades).',
      patientGuidance: 'Seu açúcar no sangue está acima da meta. Use os medicamentos corretamente e converse com a equipe sobre ajustes e dieta.',
      needsReferral: false,
      needsPrescriberContact: true,
      monitoring: `HbA1c em 3 meses após ajuste. Meta individualizada.`,
      suggestedExams: 'HbA1c, glicemia de jejum, perfil lipídico.',
      reevaluationPeriod: '90 dias',
      confidenceLevel: 'high',
      validationNote: 'Confirmar meta individualizada (idade, fragilidade, expectativa de vida) com o prescritor.',
      interventionDeadline: grave ? '7 dias' : 'Próxima consulta',
    })
  }

  // HbA1c baixa em idoso sob hipoglicemiante de risco — supertratamento ("less is more")
  const idoso = context.isElderly || (context.age != null && context.age >= 65)
  const hipoRisco = hasMed('glibenclamida', 'glipizida', 'glimepirida', 'gliclazida', 'clorpropamida', 'insulina', 'nph', 'regular', 'glargina', 'degludeca', 'lispro', 'aspart', 'repaglinida', 'nateglinida')
  if (hba1c !== null && hba1c > 0 && hba1c < 7 && idoso && hipoRisco) {
    const muitoBaixa = hba1c < 6.5
    findings.push({
      category: PRMCategory.SAFETY,
      riskLevel: muitoBaixa ? RiskLevel.HIGH : RiskLevel.MODERATE,
      title: `Controle glicêmico excessivo no idoso (HbA1c ${hba1c}%) com hipoglicemiante de risco`,
      description: `HbA1c de ${hba1c}% em idoso em uso de sulfonilureia/insulina sugere supertratamento — meta excessivamente restrita aumenta o risco de hipoglicemia, sem benefício adicional.`,
      clinicalEvidence: `HbA1c = ${hba1c}%. Em idosos (especialmente frágeis), a meta usual é 7,5–8,0% (até 8,5% se múltiplas comorbidades). Sulfonilureias e insulina são as principais causas de hipoglicemia grave. Fonte: ADA 2024 / Beers 2023 / Choosing Wisely.`,
      potentialImpact: 'Hipoglicemia grave: quedas, fraturas, arritmias, déficit cognitivo e hospitalização.',
      pharmacistConduct: 'Avaliar com o prescritor a desintensificação (reduzir/suspender sulfonilureia ou ajustar insulina) e relaxar a meta de HbA1c conforme idade/fragilidade. Preferir agentes de baixo risco de hipoglicemia (metformina, iDPP-4, iSGLT2/GLP-1).',
      patientGuidance: 'Açúcar muito baixo também é perigoso em idosos. Relate tremores, suor frio, tontura ou confusão. Converse com a equipe sobre ajustar a meta e os remédios.',
      needsReferral: false,
      needsPrescriberContact: true,
      monitoring: 'Glicemias capilares (atenção a hipoglicemias), episódios sintomáticos. Reavaliar HbA1c em 3 meses.',
      suggestedExams: 'HbA1c, glicemia capilar, função renal.',
      reevaluationPeriod: '90 dias',
      confidenceLevel: 'high',
      validationNote: 'Confirmar meta individualizada e histórico de hipoglicemia. Desintensificação deve ser pactuada com o prescritor.',
      interventionDeadline: 'Próxima consulta',
    })
  }

  // Hipercalemia — agravada por bloqueadores do SRAA / poupadores de potássio
  const potassio = getLab(context, 'potassio', 'potassio serico', 'k+', 'kalemia', 'caliemia')
  if (potassio !== null && potassio >= 5.5) {
    const grave = potassio >= 6
    const onRaas = hasMed('enalapril', 'captopril', 'lisinopril', 'ramipril', 'perindopril', 'losartana', 'valsartana', 'candesartana', 'espironolactona', 'amilorida', 'eplerenona')
    findings.push({
      category: PRMCategory.SAFETY,
      riskLevel: grave ? RiskLevel.URGENT : RiskLevel.HIGH,
      title: `${grave ? 'URGENTE — ' : ''}Hipercalemia (K⁺ = ${potassio} mEq/L)${onRaas ? ' com medicamento que retém potássio' : ''}`,
      description: `Potássio sérico de ${potassio} mEq/L${grave ? ' (hipercalemia grave)' : ' acima do limite superior'}.${onRaas ? ' Paciente em uso de bloqueador do SRAA ou poupador de potássio.' : ''}`,
      clinicalEvidence: `K⁺ = ${potassio} mEq/L (normal 3,5–5,0). ${onRaas ? 'IECA/BRA, espironolactona e poupadores de K⁺ reduzem a excreção renal de potássio.' : ''}`,
      potentialImpact: 'Arritmias cardíacas graves, bloqueios de condução e parada cardíaca (assistolia/FV), sobretudo com K⁺ > 6,5.',
      pharmacistConduct: grave
        ? 'URGENTE: comunicar ao prescritor imediatamente e encaminhar para avaliação. Revisar/suspender medicamentos que retêm potássio e suplementos de K⁺.'
        : 'Comunicar ao prescritor. Revisar dose/uso de IECA/BRA/espironolactona e suplementos de K⁺. Orientar dieta e repetir dosagem.',
      patientGuidance: 'Seu potássio está alto. Evite suplementos e sais com potássio e procure orientação; busque atendimento se sentir fraqueza intensa ou palpitações.',
      needsReferral: grave,
      needsPrescriberContact: true,
      monitoring: 'K⁺ e ECG. Repetir potássio após intervenção. K⁺ > 6,5 = emergência.',
      suggestedExams: 'Potássio, creatinina, ECG.',
      reevaluationPeriod: grave ? 'Imediato' : '48-72h',
      confidenceLevel: 'high',
      validationNote: 'Descartar hemólise da amostra (pseudo-hipercalemia). Correlacionar com função renal.',
      interventionDeadline: grave ? 'Imediato' : '24-48h',
    })
  }

  // Hipocalemia (K⁺ baixo) — potencializa toxicidade da digoxina e prolongamento de QT
  if (potassio !== null && potassio > 0 && potassio < 3.5) {
    const graveK = potassio < 3.0
    const comDigoxina = hasMed('digoxina')
    const comQt = context.medications.some(m =>
      [...QT_HIGH_RISK, ...QT_MODERATE_RISK].some(d => norm(m.activeIngredient).includes(norm(d)))
    )
    const comEspoliador = hasMed('furosemida', 'hidroclorotiazida', 'clortalidona', 'indapamida', 'bumetanida')
    if (comDigoxina || comQt || comEspoliador) {
      findings.push({
        category: PRMCategory.SAFETY,
        riskLevel: graveK || comDigoxina ? RiskLevel.HIGH : RiskLevel.MODERATE,
        title: `Hipocalemia (K⁺ = ${potassio} mEq/L)${comDigoxina ? ' em uso de digoxina' : comQt ? ' com prolongador de QT' : ''}`,
        description: `Potássio sérico de ${potassio} mEq/L${graveK ? ' (hipocalemia grave)' : ' abaixo do limite inferior'}.${comDigoxina ? ' A hipocalemia potencializa a toxicidade da digoxina.' : comQt ? ' A hipocalemia aumenta o risco de arritmia com fármacos que prolongam o QT.' : ' Possivelmente espoliada por diurético.'}`,
        clinicalEvidence: `K⁺ = ${potassio} mEq/L (normal 3,5–5,0). ${comDigoxina ? 'Hipocalemia + digoxina → maior risco de arritmias digitálicas.' : comQt ? 'Hipocalemia é fator de risco para Torsades de Pointes com prolongadores de QT.' : 'Diuréticos de alça/tiazídicos espoliam potássio.'}`,
        potentialImpact: 'Arritmias cardíacas (extrassístoles, TV, Torsades), fraqueza muscular e câimbras; risco maior com digoxina ou QT longo.',
        pharmacistConduct: 'Comunicar ao prescritor. Corrigir o potássio (reposição) e investigar a causa (diurético espoliador, vômitos/diarreia). Reavaliar dose do diurético e monitorar ECG se digoxina/QT. Corrigir também magnésio se baixo.',
        patientGuidance: 'Seu potássio está baixo. Relate palpitações, fraqueza intensa ou câimbras. Siga a orientação sobre reposição e dieta.',
        needsReferral: false,
        needsPrescriberContact: true,
        monitoring: 'Potássio e magnésio séricos; ECG se digoxina ou prolongador de QT. Repetir após reposição.',
        suggestedExams: 'Potássio, magnésio, ECG, digoxinemia se aplicável.',
        reevaluationPeriod: graveK ? '24-48h' : '7 dias',
        confidenceLevel: 'high',
        validationNote: 'Correlacionar com magnésio (hipomagnesemia dificulta a correção) e com a causa da perda de potássio.',
        interventionDeadline: graveK || comDigoxina ? '24-48h' : '7 dias',
      })
    }
  }

  // INR fora da faixa em uso de varfarina
  const inr = getLab(context, 'inr', 'rni', 'razao normalizada')
  if (inr !== null && hasMed('warfarina', 'varfarina')) {
    if (inr > 4) {
      findings.push({
        category: PRMCategory.SAFETY,
        riskLevel: inr >= 5 ? RiskLevel.URGENT : RiskLevel.HIGH,
        title: `${inr >= 5 ? 'URGENTE — ' : ''}INR supraterapêutico (${inr}) em uso de varfarina`,
        description: `INR de ${inr} acima da faixa terapêutica usual (2,0–3,0) — risco hemorrágico elevado.`,
        clinicalEvidence: `INR = ${inr}. Risco de sangramento cresce de forma acentuada acima de 4,0–5,0.`,
        potentialImpact: 'Hemorragia maior (gastrintestinal, intracraniana).',
        pharmacistConduct: 'Comunicar ao prescritor com urgência. Avaliar suspensão de dose(s) de varfarina, conduta conforme INR/sangramento (vitamina K se indicado) e checar interações/fármacos recém-introduzidos.',
        patientGuidance: 'Seu exame de coagulação está alterado, com risco de sangramento. Procure orientação imediatamente e relate sangramentos ou hematomas.',
        needsReferral: inr >= 5,
        needsPrescriberContact: true,
        monitoring: 'INR seriado. Sinais de sangramento.',
        suggestedExams: 'INR/TP, hemograma.',
        reevaluationPeriod: 'Imediato',
        confidenceLevel: 'high',
        validationNote: 'Conduta depende de sangramento ativo e do valor do INR (diretriz de anticoagulação).',
        interventionDeadline: 'Imediato',
      })
    } else if (inr < 2) {
      findings.push({
        category: PRMCategory.EFFECTIVENESS,
        riskLevel: RiskLevel.HIGH,
        title: `INR subterapêutico (${inr}) em uso de varfarina`,
        description: `INR de ${inr} abaixo da faixa terapêutica (2,0–3,0) — anticoagulação insuficiente.`,
        clinicalEvidence: `INR = ${inr}. Abaixo da meta usual de 2,0–3,0 (2,5–3,5 em próteses mecânicas).`,
        potentialImpact: 'Risco trombótico/tromboembólico (AVC, TEV) por anticoagulação inadequada.',
        pharmacistConduct: 'Comunicar ao prescritor para ajuste de dose. Investigar adesão, interações (alimentos ricos em vitamina K, fármacos) e mudanças recentes.',
        patientGuidance: 'Sua anticoagulação está abaixo do ideal. Use a varfarina conforme prescrito, mantenha dieta estável e não falte aos exames de INR.',
        needsReferral: false,
        needsPrescriberContact: true,
        monitoring: 'INR conforme protocolo. Reavaliar após ajuste.',
        suggestedExams: 'INR/TP.',
        reevaluationPeriod: '7 dias',
        confidenceLevel: 'high',
        validationNote: 'Meta de INR depende da indicação (FA, TEV, prótese valvar).',
        interventionDeadline: '7 dias',
      })
    }
  }

  // Hiponatremia — agravada por ISRS ou tiazídico
  const sodio = getLab(context, 'sodio', 'sodio serico', 'na+', 'natremia')
  if (sodio !== null && sodio < 130) {
    const culpados = hasMed('fluoxetina', 'sertralina', 'paroxetina', 'citalopram', 'escitalopram', 'hidroclorotiazida', 'clortalidona', 'indapamida', 'carbamazepina', 'oxcarbazepina')
    findings.push({
      category: PRMCategory.SAFETY,
      riskLevel: sodio < 125 ? RiskLevel.URGENT : RiskLevel.HIGH,
      title: `${sodio < 125 ? 'URGENTE — ' : ''}Hiponatremia (Na⁺ = ${sodio} mEq/L)${culpados ? ' possivelmente medicamentosa' : ''}`,
      description: `Sódio sérico de ${sodio} mEq/L${sodio < 125 ? ' (hiponatremia grave)' : ''}.${culpados ? ' Paciente em uso de ISRS, tiazídico ou outro fármaco associado a SIADH/hiponatremia.' : ''}`,
      clinicalEvidence: `Na⁺ = ${sodio} mEq/L (normal 135–145). ${culpados ? 'ISRS e tiazídicos são causas medicamentosas frequentes (SIADH), especialmente em idosos.' : ''}`,
      potentialImpact: 'Confusão, quedas, convulsões e, na forma grave/aguda, edema cerebral.',
      pharmacistConduct: 'Comunicar ao prescritor. Revisar fármacos associados a hiponatremia (ISRS, tiazídicos). Investigar volemia e outras causas. Não corrigir o sódio rapidamente (risco de mielinólise).',
      patientGuidance: 'Seu sódio está baixo. Relate confusão, dor de cabeça forte, náuseas ou desmaios e siga as orientações sobre líquidos.',
      needsReferral: sodio < 125,
      needsPrescriberContact: true,
      monitoring: 'Sódio seriado (correção lenta). Estado neurológico.',
      suggestedExams: 'Sódio, osmolaridade sérica e urinária, função renal e tireoidiana.',
      reevaluationPeriod: sodio < 125 ? 'Imediato' : '48h',
      confidenceLevel: 'moderate',
      validationNote: 'Avaliar volemia e causas não medicamentosas. Correção do Na⁺ deve ser gradual.',
      interventionDeadline: sodio < 125 ? 'Imediato' : '24-48h',
    })
  }

  // LDL elevado em alto risco cardiovascular sem estatina
  const ldl = getLab(context, 'ldl', 'ldl-c', 'colesterol ldl')
  if (ldl !== null && ldl >= 100) {
    const onStatin = hasMed('sinvastatina', 'atorvastatina', 'rosuvastatina', 'pravastatina', 'pitavastatina', 'fluvastatina', 'lovastatina')
    const altoRisco = hasDiag('diabetes', 'infarto', 'doenca coronariana', 'avc', 'doenca arterial periferica', 'doenca cardiovascular', 'doenca renal cronica')
    if (!onStatin && (altoRisco || ldl >= 190)) {
      findings.push({
        category: PRMCategory.NECESSITY,
        riskLevel: ldl >= 190 ? RiskLevel.HIGH : RiskLevel.MODERATE,
        title: `LDL elevado (${ldl} mg/dL) em alto risco CV sem estatina`,
        description: `LDL-colesterol de ${ldl} mg/dL ${ldl >= 190 ? '(muito elevado)' : 'em paciente de alto risco cardiovascular'} sem terapia com estatina identificada.`,
        clinicalEvidence: `LDL = ${ldl} mg/dL. ${altoRisco ? 'Paciente de alto/muito alto risco (diabetes/DCV/DRC).' : 'LDL ≥ 190 caracteriza dislipidemia grave.'} Fonte: ESC/AHA 2023.`,
        potentialImpact: 'Risco aumentado de eventos cardiovasculares ateroscleróticos (IAM, AVC).',
        pharmacistConduct: 'Avaliar com o prescritor início de estatina de intensidade adequada ao risco e metas de LDL. Reforçar medidas de estilo de vida.',
        patientGuidance: 'Seu colesterol LDL está alto. Converse com o médico sobre tratamento e adote alimentação saudável e atividade física.',
        needsReferral: false,
        needsPrescriberContact: true,
        monitoring: 'Perfil lipídico 6-12 semanas após início/ajuste. Transaminases conforme protocolo.',
        suggestedExams: 'Perfil lipídico, ALT/AST, CK se sintomas musculares.',
        reevaluationPeriod: '90 dias',
        confidenceLevel: 'moderate',
        validationNote: 'Meta de LDL depende da estratificação de risco individual. Confirmar ausência de estatina e contraindicações.',
        interventionDeadline: 'Próxima consulta',
      })
    }
  }

  // TSH fora da faixa em uso de levotiroxina
  const tsh = getLab(context, 'tsh', 'hormonio tireoestimulante', 'tireoestimulante')
  if (tsh !== null && hasMed('levotiroxina', 'tiroxina', 't4')) {
    if (tsh > 4.5) {
      findings.push({
        category: PRMCategory.EFFECTIVENESS,
        riskLevel: tsh >= 10 ? RiskLevel.HIGH : RiskLevel.MODERATE,
        title: `TSH elevado (${tsh} mUI/L) — reposição de levotiroxina possivelmente insuficiente`,
        description: `TSH de ${tsh} mUI/L acima da faixa usual (0,4–4,5) em paciente em uso de levotiroxina — sugere dose subterapêutica ou problema de adesão/absorção.`,
        clinicalEvidence: `TSH = ${tsh} mUI/L. Hipotireoidismo subtratado eleva o TSH. Fonte: diretrizes de tireoide (ATA/SBEM).`,
        potentialImpact: 'Sintomas de hipotireoidismo persistentes (fadiga, ganho de peso, dislipidemia, bradicardia).',
        pharmacistConduct: 'Verificar adesão e técnica de administração (jejum, 30–60 min antes do café, longe de cálcio/ferro/IBP). Avaliar com o prescritor ajuste de dose. Repetir TSH em 6–8 semanas.',
        patientGuidance: 'Tome a levotiroxina em jejum, com água, e aguarde antes de comer. Não tome junto de cálcio, ferro ou omeprazol. Converse com o médico sobre a dose.',
        needsReferral: false,
        needsPrescriberContact: true,
        monitoring: 'TSH (± T4 livre) em 6–8 semanas após ajuste.',
        suggestedExams: 'TSH, T4 livre.',
        reevaluationPeriod: '60 dias',
        confidenceLevel: 'high',
        validationNote: 'Confirmar adesão e interações de absorção antes de atribuir à dose.',
        interventionDeadline: 'Próxima consulta',
      })
    } else if (tsh < 0.4) {
      findings.push({
        category: PRMCategory.SAFETY,
        riskLevel: RiskLevel.MODERATE,
        title: `TSH suprimido (${tsh} mUI/L) — possível superdosagem de levotiroxina`,
        description: `TSH de ${tsh} mUI/L abaixo da faixa usual em uso de levotiroxina — sugere dose excessiva (tireotoxicose iatrogênica).`,
        clinicalEvidence: `TSH = ${tsh} mUI/L. Supressão do TSH por excesso de levotiroxina, com risco de fibrilação atrial e perda de massa óssea, sobretudo em idosos.`,
        potentialImpact: 'Fibrilação atrial, osteoporose, palpitações e perda de peso (hipertireoidismo iatrogênico).',
        pharmacistConduct: 'Avaliar com o prescritor redução de dose. Atenção redobrada em idosos e cardiopatas. Repetir TSH em 6–8 semanas.',
        patientGuidance: 'Sua dose do hormônio da tireoide pode estar alta. Relate palpitações ou tremores e converse com o médico sobre ajuste.',
        needsReferral: false,
        needsPrescriberContact: true,
        monitoring: 'TSH em 6–8 semanas. ECG se sintomas cardíacos.',
        suggestedExams: 'TSH, T4 livre.',
        reevaluationPeriod: '60 dias',
        confidenceLevel: 'high',
        validationNote: 'Em supressão intencional (ex.: pós-câncer de tireoide), pode ser conduta deliberada — confirmar com prescritor.',
        interventionDeadline: 'Próxima consulta',
      })
    }
  }

  // Função renal reduzida (TFG/clearance) com nefrotóxicos / fármacos de ajuste renal
  const tfg = getLab(context, 'tfg', 'tfge', 'egfr', 'clearance', 'ritmo de filtracao', 'filtracao glomerular', 'depuracao')
  if (tfg !== null && tfg > 0 && tfg < 60) {
    if (hasMed('metformina') && tfg < 30) {
      findings.push({
        category: PRMCategory.SAFETY,
        riskLevel: RiskLevel.HIGH,
        title: `Metformina com TFG ${tfg} mL/min — contraindicada (<30)`,
        description: `Metformina em uso com taxa de filtração glomerular de ${tfg} mL/min/1,73m². Contraindicada com TFG < 30 pelo risco de acidose lática.`,
        clinicalEvidence: `TFG = ${tfg} mL/min. Metformina contraindicada < 30 e exige redução de dose entre 30–45. Fonte: ANVISA/FDA/SBD.`,
        potentialImpact: 'Acidose lática (rara, porém potencialmente fatal) por acúmulo de metformina.',
        pharmacistConduct: 'Comunicar ao prescritor para suspensão/substituição da metformina. Considerar alternativas com segurança renal (iDPP-4 com ajuste, insulina, iSGLT2 conforme TFG).',
        patientGuidance: 'Sua função renal exige rever a metformina. Não suspenda por conta própria; procure orientação. Suspenda em caso de desidratação, vômitos ou diarreia intensa.',
        needsReferral: false,
        needsPrescriberContact: true,
        monitoring: 'TFG/creatinina, lactato se suspeita de acidose.',
        suggestedExams: 'Creatinina, TFGe, eletrólitos.',
        reevaluationPeriod: 'Imediato',
        confidenceLevel: 'high',
        validationNote: 'Confirmar TFG atual e estabilidade da função renal.',
        interventionDeadline: '24-48h',
      })
    }
    const aineMed = membersOfClass('AINE', context.medications)[0]
    if (aineMed) {
      findings.push({
        category: PRMCategory.SAFETY,
        riskLevel: RiskLevel.HIGH,
        title: `AINE (${aineMed.activeIngredient}) com função renal reduzida (TFG ${tfg})`,
        description: `Uso de AINE com TFG de ${tfg} mL/min — risco de piora da função renal, retenção hídrica e hipercalemia.`,
        clinicalEvidence: `TFG = ${tfg} mL/min. AINEs reduzem a perfusão glomerular (inibição de prostaglandinas) e devem ser evitados com TFG < 60, sobretudo < 30. Beers 2023.`,
        potentialImpact: 'Lesão renal aguda sobre crônica, hipercalemia e retenção hidrossalina.',
        pharmacistConduct: 'Comunicar ao prescritor. Suspender/substituir o AINE (preferir paracetamol). Evitar uso crônico em DRC.',
        patientGuidance: 'Anti-inflamatórios podem prejudicar seus rins. Para dor, prefira paracetamol e evite ibuprofeno/diclofenaco sem orientação.',
        needsReferral: false,
        needsPrescriberContact: true,
        monitoring: 'Creatinina, TFG e K⁺ após suspensão.',
        suggestedExams: 'Creatinina, TFGe, potássio.',
        reevaluationPeriod: '7 dias',
        confidenceLevel: 'high',
        validationNote: 'Avaliar duração do uso e indicação do AINE.',
        interventionDeadline: '24-48h',
        medicationId: aineMed.id,
      })
    }
    // Anticoagulante oral direto (DOAC) com função renal reduzida
    if (tfg < 30) {
      const doac = context.medications.find(m =>
        ['dabigatrana', 'rivaroxabana', 'apixabana', 'edoxabana'].some(d => norm(m.activeIngredient).includes(norm(d)))
      )
      if (doac) {
        const isDabigatrana = norm(doac.activeIngredient).includes('dabigatrana')
        findings.push({
          category: PRMCategory.SAFETY,
          riskLevel: tfg < 15 || isDabigatrana ? RiskLevel.URGENT : RiskLevel.HIGH,
          title: `${tfg < 15 || isDabigatrana ? 'URGENTE — ' : ''}DOAC (${doac.activeIngredient}) com função renal reduzida (TFG ${tfg})`,
          description: `${doac.activeIngredient} em uso com TFG de ${tfg} mL/min. DOACs têm eliminação renal (dabigatrana ~80%) — TFG < 30 exige ajuste/contraindicação pelo risco de acúmulo e sangramento.`,
          clinicalEvidence: `TFG = ${tfg} mL/min. ${isDabigatrana ? 'Dabigatrana contraindicada com TFG < 30.' : 'Rivaroxabana/apixabana/edoxabana exigem redução de dose com TFG < 50 e cautela/contraindicação < 30 (< 15 contraindicados).'} Fonte: bulário/diretrizes de anticoagulação.`,
          potentialImpact: 'Acúmulo do anticoagulante e hemorragia maior.',
          pharmacistConduct: 'Comunicar ao prescritor com urgência. Avaliar ajuste de dose conforme TFG ou troca de anticoagulante (ex.: varfarina com monitorização de INR em DRC avançada). Conferir a dose prescrita versus a faixa de TFG.',
          patientGuidance: 'Sua função renal exige rever o anticoagulante. Não suspenda por conta própria; procure orientação e relate sangramentos ou hematomas.',
          needsReferral: tfg < 15,
          needsPrescriberContact: true,
          monitoring: 'TFG/creatinina, hemograma e sinais de sangramento.',
          suggestedExams: 'Creatinina, TFGe, hemograma.',
          reevaluationPeriod: tfg < 15 ? 'Imediato' : '48-72h',
          confidenceLevel: 'high',
          validationNote: 'Confirmar a dose prescrita e a TFG atual; o ajuste depende do DOAC específico e da indicação.',
          interventionDeadline: tfg < 15 || isDabigatrana ? 'Imediato' : '24-48h',
          medicationId: doac.id,
        })
      }
    }
  }

  // Nível sérico de digoxina elevado (toxicidade)
  const digoxinemia = getLab(context, 'digoxina', 'digoxinemia', 'nivel de digoxina')
  if (digoxinemia !== null && digoxinemia >= 2 && digoxinemia <= 20 && hasMed('digoxina')) {
    findings.push({
      category: PRMCategory.SAFETY,
      riskLevel: RiskLevel.URGENT,
      title: `URGENTE — Nível sérico de digoxina tóxico (${digoxinemia} ng/mL)`,
      description: `Digoxinemia de ${digoxinemia} ng/mL acima da faixa terapêutica (0,5–0,9 ng/mL na IC; até ~2,0 limite). Risco de intoxicação digitálica.`,
      clinicalEvidence: `Digoxina = ${digoxinemia} ng/mL. Janela terapêutica estreita; toxicidade favorecida por hipocalemia, hipomagnesemia e disfunção renal. Fonte: bulário/AHA.`,
      potentialImpact: 'Arritmias graves, bloqueios, náuseas/vômitos, alterações visuais e distúrbios de condução.',
      pharmacistConduct: 'Comunicar ao prescritor imediatamente. Avaliar suspensão/redução da digoxina, dosar K⁺/Mg²⁺/função renal, revisar interações (amiodarona, verapamil, claritromicina) e considerar encaminhamento.',
      patientGuidance: 'O nível do seu remédio para o coração está alto. Relate náuseas, visão amarelada, palpitações ou tontura e procure atendimento.',
      needsReferral: true,
      needsPrescriberContact: true,
      monitoring: 'Digoxinemia, K⁺, Mg²⁺, função renal e ECG.',
      suggestedExams: 'Digoxinemia, potássio, magnésio, creatinina, ECG.',
      reevaluationPeriod: 'Imediato',
      confidenceLevel: 'high',
      validationNote: 'Colher a amostra ≥ 6 h após a dose. Correlacionar com sintomas e eletrólitos.',
      interventionDeadline: 'Imediato',
    })
  }

  // Transaminases elevadas (>3× LSN ≈ 120 U/L) com fármaco hepatotóxico
  const tgp = getLab(context, 'alt', 'tgp', 'alanina aminotransferase')
  const tgo = getLab(context, 'ast', 'tgo', 'aspartato aminotransferase')
  const transaminaseMax = Math.max(tgp ?? 0, tgo ?? 0)
  if (transaminaseMax >= 120) {
    const hepatoMed = context.medications.find(m =>
      ['sinvastatina', 'atorvastatina', 'rosuvastatina', 'metotrexato', 'isoniazida', 'amiodarona', 'cetoconazol', 'paracetamol', 'nimesulida', 'valproato', 'acido valproico'].some(d => norm(m.activeIngredient).includes(norm(d)))
    )
    if (hepatoMed) {
      findings.push({
        category: PRMCategory.SAFETY,
        riskLevel: RiskLevel.HIGH,
        title: `Transaminases elevadas (${transaminaseMax} U/L) com fármaco hepatotóxico (${hepatoMed.activeIngredient})`,
        description: `Transaminases acima de 3× o limite superior em uso de ${hepatoMed.activeIngredient}, potencialmente hepatotóxico.`,
        clinicalEvidence: `ALT/AST ≈ ${transaminaseMax} U/L (LSN ~40). Elevação > 3× LSN exige reavaliação do fármaco hepatotóxico. Fonte: bulário/diretrizes de hepatotoxicidade.`,
        potentialImpact: 'Lesão hepática medicamentosa (DILI), podendo evoluir para insuficiência hepática.',
        pharmacistConduct: 'Comunicar ao prescritor. Avaliar suspensão/redução do fármaco hepatotóxico e investigar outras causas (viral, álcool). Repetir provas hepáticas.',
        patientGuidance: 'Suas enzimas do fígado estão alteradas. Evite álcool, relate icterícia/dor abdominal/náuseas e converse com o médico sobre o medicamento.',
        needsReferral: false,
        needsPrescriberContact: true,
        monitoring: 'ALT, AST, bilirrubinas e fosfatase alcalina seriadas.',
        suggestedExams: 'ALT, AST, GGT, bilirrubinas, INR.',
        reevaluationPeriod: '7-14 dias',
        confidenceLevel: 'moderate',
        validationNote: 'Correlacionar com bilirrubinas (lei de Hy), outras causas e cronologia do fármaco.',
        interventionDeadline: '7 dias',
        medicationId: hepatoMed.id,
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
  } ${context.renalFunction ? `Função renal: ${labelRenal(context.renalFunction)}${context.creatinineClearance ? ` (ClCr: ${context.creatinineClearance} mL/min)` : ''}. ` : ''
  }${context.hepaticFunction ? `Função hepática: ${labelHepatic(context.hepaticFunction)}.` : ''}`

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

// ─── Findings sensíveis a DOSE e DURAÇÃO (#5) ─────────────────────────────────

function dosesPerDay(med: MedicationContext): number | null {
  if (med.frequencyHours && med.frequencyHours > 0) return 24 / med.frequencyHours
  const f = norm(med.frequency || '')
  if (!f) return null
  if (/(sos|se necessari|quando necessari|s\/n)/.test(f)) return 0 // PRN
  const each = f.match(/(\d+)\s*\/\s*(\d+)\s*h/) // "8/8h"
  if (each) return 24 / parseInt(each[2])
  const xday = f.match(/(\d+)\s*x/) // "3x/dia"
  if (xday) return parseInt(xday[1])
  if (/1x|uma vez|1 vez/.test(f)) return 1
  return null
}

function durationDays(med: MedicationContext): number | null {
  const d = norm(med.durationOfUse || '')
  if (!d) return null
  if (/(cronico|continuo|uso continuo|indefinid)/.test(d)) return 9999
  const m = d.match(/(\d+)\s*(dia|semana|mes|mês|mes|ano)/)
  if (!m) return null
  const n = parseInt(m[1]); const u = m[2]
  if (u.startsWith('dia')) return n
  if (u.startsWith('semana')) return n * 7
  if (u.startsWith('ano')) return n * 365
  return n * 30 // mês/meses
}
const isPRN = (m: MedicationContext) => dosesPerDay(m) === 0
const CORTICOIDES = ['prednisona', 'prednisolona', 'dexametasona', 'metilprednisolona', 'betametasona', 'deflazacorte']

function findDoseDurationPRMs(context: PatientContext): PRMFindingResult[] {
  const findings: PRMFindingResult[] = []
  const frail = context.isElderly || (context.age != null && context.age >= 65)
  const hepato = !!context.hepaticFunction && context.hepaticFunction !== 'normal'

  for (const med of context.medications) {
    const n = norm(med.activeIngredient)

    // Paracetamol acima do limite diário
    if (n.includes('paracetamol') && med.dose && !isPRN(med)) {
      const dpd = dosesPerDay(med)
      if (dpd && dpd > 0) {
        const daily = med.dose * dpd
        const limit = frail || hepato ? 3000 : 4000
        if (daily > limit) {
          findings.push({
            category: PRMCategory.SAFETY,
            riskLevel: daily > 4000 ? RiskLevel.HIGH : RiskLevel.MODERATE,
            title: `Paracetamol acima do limite diário (~${daily} mg/dia)`,
            description: `Dose diária estimada de paracetamol (~${daily} mg) acima do recomendado (${limit} mg/dia${frail || hepato ? ' — idoso/hepatopata' : ''}). Risco de hepatotoxicidade.`,
            clinicalEvidence: `Limite usual: 4 g/dia (3 g/dia em idosos, hepatopatas ou etilistas). Estimativa: ${med.dose} mg × ${dpd}/dia.`,
            potentialImpact: 'Lesão hepática (hepatotoxicidade dose-dependente).',
            pharmacistConduct: 'Revisar dose/frequência total (somar apresentações combinadas com paracetamol). Reduzir para ≤ limite e orientar não exceder.',
            patientGuidance: 'Não passe da dose máxima de paracetamol por dia e cuidado com remédios de gripe que já contêm paracetamol. Evite álcool.',
            needsReferral: false, needsPrescriberContact: true,
            monitoring: 'Transaminases se uso elevado/prolongado; sinais de hepatotoxicidade.',
            reevaluationPeriod: '7 dias', confidenceLevel: 'moderate',
            validationNote: 'Estimativa baseada em dose×frequência; confirmar apresentações ocultas com paracetamol.',
            interventionDeadline: '24-48h', medicationId: med.id,
          })
        }
      }
    }

    // AINE de uso crônico
    if (drugInClass(med.activeIngredient, 'AINE') && !isPRN(med) && (durationDays(med) ?? 0) >= 30) {
      findings.push({
        category: PRMCategory.SAFETY, riskLevel: RiskLevel.MODERATE,
        title: `Uso crônico de AINE: ${med.activeIngredient}`,
        description: `${med.activeIngredient} em uso contínuo/prolongado — risco GI, renal e cardiovascular cumulativo.`,
        clinicalEvidence: 'AINEs em uso crônico aumentam risco de úlcera/sangramento GI, lesão renal e eventos CV. Beers/STOPP recomendam menor dose e duração.',
        potentialImpact: 'Hemorragia digestiva, lesão renal, hipertensão e eventos cardiovasculares.',
        pharmacistConduct: 'Reavaliar necessidade do uso crônico; preferir menor dose/menor duração; associar IBP se mantido; considerar analgésico alternativo (paracetamol).',
        patientGuidance: 'Anti-inflamatórios de uso contínuo podem prejudicar estômago e rins. Converse sobre alternativas e tempo de uso.',
        needsReferral: false, needsPrescriberContact: true,
        monitoring: 'Creatinina, PA, sinais de sangramento GI.',
        reevaluationPeriod: '30 dias', confidenceLevel: 'moderate',
        validationNote: 'Confirmar duração real e indicação.', interventionDeadline: 'Próxima consulta', medicationId: med.id,
      })
    }

    // Benzodiazepínico / Hipnótico Z > 4 semanas
    if ((drugInClass(med.activeIngredient, 'Benzodiazepínico') || drugInClass(med.activeIngredient, 'Hipnótico Z')) && (durationDays(med) ?? 0) > 28) {
      findings.push({
        category: PRMCategory.SAFETY, riskLevel: RiskLevel.MODERATE,
        title: `Uso prolongado (>4 semanas) de ${med.activeIngredient}`,
        description: `${med.activeIngredient} em uso por mais de 4 semanas — risco de dependência, tolerância, quedas e declínio cognitivo (sobretudo idosos).`,
        clinicalEvidence: 'STOPP/Beers: benzodiazepínicos e hipnóticos Z não devem ser usados >4 semanas; planejar desmame gradual.',
        potentialImpact: 'Dependência, quedas/fraturas, comprometimento cognitivo, acidentes.',
        pharmacistConduct: 'Planejar desmame gradual com o prescritor; medidas não farmacológicas para insônia/ansiedade.',
        patientGuidance: 'Esse calmante/indutor do sono não deve ser usado por muito tempo seguido. Não pare de repente; converse sobre reduzir aos poucos.',
        needsReferral: false, needsPrescriberContact: true,
        monitoring: 'Sintomas de abstinência durante o desmame; risco de quedas.',
        reevaluationPeriod: '30 dias', confidenceLevel: 'high',
        validationNote: 'Confirmar duração e indicação atual.', interventionDeadline: 'Próxima consulta', medicationId: med.id,
      })
    }

    // Corticoide sistêmico crônico (>3 meses) → proteção óssea/gástrica
    if (CORTICOIDES.some(c => n.includes(c)) && (durationDays(med) ?? 0) >= 90) {
      findings.push({
        category: PRMCategory.NECESSITY, riskLevel: RiskLevel.MODERATE,
        title: `Corticoide sistêmico crônico (>3 meses): ${med.activeIngredient}`,
        description: `Uso prolongado de corticoide sistêmico — necessária profilaxia de osteoporose induzida por glicocorticoide e atenção gástrica/glicêmica.`,
        clinicalEvidence: 'Diretrizes: corticoide sistêmico ≥3 meses requer cálcio + vitamina D ± bifosfonato; monitorar glicemia e PA.',
        potentialImpact: 'Osteoporose/fraturas, hiperglicemia, hipertensão, supressão adrenal.',
        pharmacistConduct: 'Avaliar com o prescritor cálcio + vitamina D ± bifosfonato; monitorar glicemia/PA/densitometria; não suspender abruptamente.',
        patientGuidance: 'Uso prolongado de corticoide exige proteção dos ossos. Não pare sozinho. Faça os exames recomendados.',
        needsReferral: false, needsPrescriberContact: true,
        monitoring: 'Densitometria óssea, glicemia, PA, vitamina D.',
        suggestedExams: 'Glicemia, vitamina D, densitometria óssea.',
        reevaluationPeriod: '90 dias', confidenceLevel: 'moderate',
        validationNote: 'Confirmar duração e dose; corticoide inalatório/tópico não conta.', interventionDeadline: 'Próxima consulta', medicationId: med.id,
      })
    }
  }
  return findings
}

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
    ...findLabBasedPRMs(context),
    ...findDoseDurationPRMs(context),
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

// ─── Consulta de interações (módulo "Interações Medicamentosas") ───────────────
// Reusa a base determinística (KNOWN_INTERACTIONS + CLASS_INTERACTIONS + dedup por
// severidade) de forma reutilizável fora do fluxo de análise completa.

const SEVERITY_LABEL: Record<KnownInteraction['severity'], string> = {
  contraindicated: 'Contraindicada', major: 'Grave', moderate: 'Moderada', minor: 'Leve',
}

export interface DdiInteractionResult {
  drugs: [string, string]
  severity: KnownInteraction['severity']
  severityLabel: string
  severityRank: number
  riskLevel: RiskLevel
  mechanism: string
  clinicalEffect: string
  management: string
  contextFlags: string[]   // amplificadores de risco ajustados ao paciente (idade/TFG/gestação)
}

export interface DdiCheckResult {
  interactions: DdiInteractionResult[]
  globalRisk: KnownInteraction['severity'] | null
  globalLabel: string
}

export interface DdiPatientContext { age?: number | null; tfg?: number | null; pregnant?: boolean }

function drugInClass(name: string, className: string): boolean {
  const ks = CLASS_KEYWORDS[className] || []
  const n = norm(name)
  return ks.some(k => n.includes(norm(k)))
}
const RENAL_SENSITIVE = ['ibuprofeno', 'naproxeno', 'diclofenaco', 'meloxicam', 'indometacina', 'celecoxibe', 'nimesulida', 'cetorolaco', 'piroxicam', 'enalapril', 'captopril', 'lisinopril', 'ramipril', 'perindopril', 'losartana', 'valsartana', 'candesartana', 'irbesartana', 'telmisartana', 'olmesartana', 'espironolactona', 'eplerenona', 'amilorida', 'metformina', 'dabigatrana', 'rivaroxabana', 'apixabana', 'edoxabana', 'digoxina', 'litio', 'lítio', 'gabapentina', 'pregabalina']
const ELDERLY_CNS_CLASSES = ['Benzodiazepínico', 'Opioide', 'Hipnótico Z', 'Antipsicótico', 'Antidepressivo tricíclico']

/** Flags de amplificação de risco pelo contexto do paciente (não altera a severidade curada). */
function contextFlagsFor(a: string, b: string, ctx?: DdiPatientContext): string[] {
  if (!ctx) return []
  const flags: string[] = []
  const pair = [a, b]
  if (ctx.age != null && ctx.age >= 65 && pair.some(d => ELDERLY_CNS_CLASSES.some(c => drugInClass(d, c)))) {
    flags.push('Idoso: maior risco de sedação, quedas e declínio cognitivo — priorizar revisão.')
  }
  if (ctx.tfg != null && ctx.tfg < 60 && pair.some(d => RENAL_SENSITIVE.some(k => norm(d).includes(norm(k))))) {
    flags.push(ctx.tfg < 30
      ? `Função renal muito reduzida (TFG ${ctx.tfg}): alto risco de acúmulo/hipercalemia/nefrotoxicidade — revisar dose/contraindicação.`
      : `Função renal reduzida (TFG ${ctx.tfg}): risco aumentado — reavaliar dose e monitorar.`)
  }
  if (ctx.pregnant) {
    flags.push('Gestante: reavaliar segurança/contraindicação na gestação.')
  }
  return flags
}

/** Cruza ≥2 medicamentos (por princípio ativo/nome) e retorna as interações da base. */
export function checkInteractions(drugNames: string[], ctx?: DdiPatientContext): DdiCheckResult {
  const meds: MedicationContext[] = drugNames
    .map(n => canonicalizeDrug(n)).filter(Boolean)
    .map((activeIngredient, i) => ({
      id: `ddi-${i}`, tradeName: null, activeIngredient, dose: null, doseUnit: null,
      pharmaceuticalForm: null, route: 'ORAL' as MedicationContext['route'], frequency: null,
      frequencyHours: null, indication: null, isPrescribed: true, isSelfMedication: false,
      durationOfUse: null, adherence: AdherenceLevel.UNKNOWN, adverseEffects: null,
    }))

  const interactions: DdiInteractionResult[] = findInteractions(meds)
    .map(r => ({
      drugs: [r.med1.activeIngredient, r.med2.activeIngredient] as [string, string],
      severity: r.interaction.severity,
      severityLabel: SEVERITY_LABEL[r.interaction.severity],
      severityRank: SEVERITY_RANK[r.interaction.severity],
      riskLevel: r.interaction.severity === 'contraindicated' ? RiskLevel.URGENT
        : r.interaction.severity === 'major' ? RiskLevel.HIGH
        : r.interaction.severity === 'moderate' ? RiskLevel.MODERATE : RiskLevel.LOW,
      mechanism: r.interaction.mechanism,
      clinicalEffect: r.interaction.clinicalEffect,
      management: r.interaction.management,
      contextFlags: contextFlagsFor(r.med1.activeIngredient, r.med2.activeIngredient, ctx),
    }))
    .sort((a, b) => b.severityRank - a.severityRank)

  const top = interactions[0]?.severity ?? null
  return { interactions, globalRisk: top, globalLabel: top ? SEVERITY_LABEL[top] : 'Nenhuma interação na base disponível' }
}

// ─── Interações com SUPLEMENTOS / fitoterápicos (reusa o tipo FoodDrugInteraction) ───
const SUPPLEMENT_INTERACTIONS: FoodDrugInteraction[] = [
  { food: 'Ginkgo biloba', emoji: '🌿', drugs: ['varfarina', 'acido acetilsalicilico', 'clopidogrel', 'ticagrelor', 'rivaroxabana', 'apixabana', 'dabigatrana'], severity: 'major', mechanism: 'Ginkgo inibe a agregação plaquetária (fator ativador de plaquetas)', clinicalEffect: 'Risco aumentado de sangramento com anticoagulantes/antiagregantes', management: 'Evitar a associação; orientar sobre sinais de sangramento.', patientGuidance: 'Evite ginkgo biloba enquanto usa anticoagulante/antiagregante — aumenta o risco de sangramento.' },
  { food: 'Erva-de-são-joão (Hypericum perforatum)', emoji: '🌼', drugs: ['fluoxetina', 'sertralina', 'paroxetina', 'citalopram', 'escitalopram', 'venlafaxina', 'duloxetina', 'tramadol'], severity: 'major', mechanism: 'Efeito serotoninérgico aditivo', clinicalEffect: 'Risco de síndrome serotoninérgica', management: 'Evitar com ISRS/IRSN/tramadol; orientar sinais (agitação, tremor, hipertermia).', patientGuidance: 'Não use erva-de-são-joão com antidepressivos — risco de reação grave.' },
  { food: 'Erva-de-são-joão (Hypericum)', emoji: '🌼', drugs: ['ciclosporina', 'tacrolimo', 'tacrolimus', 'digoxina', 'etinilestradiol'], severity: 'major', mechanism: 'Indução de CYP3A4 e P-glicoproteína', clinicalEffect: 'Redução da eficácia (rejeição de transplante, falha contraceptiva, perda de efeito)', management: 'Contraindicada com imunossupressores/anticoncepcional; revisar.', patientGuidance: 'Erva-de-são-joão reduz o efeito de vários remédios. Avise seu farmacêutico se usa.' },
  { food: 'Alho (suplemento em altas doses)', emoji: '🧄', drugs: ['varfarina', 'acido acetilsalicilico', 'clopidogrel', 'rivaroxabana', 'apixabana'], severity: 'moderate', mechanism: 'Efeito antiplaquetário/antitrombótico', clinicalEffect: 'Aumento do risco de sangramento', management: 'Cautela com suplementos de alho em anticoagulados.', patientGuidance: 'Suplementos concentrados de alho podem aumentar sangramento com anticoagulantes.' },
  { food: 'Ômega-3 / óleo de peixe (altas doses)', emoji: '🐟', drugs: ['varfarina', 'acido acetilsalicilico', 'clopidogrel', 'rivaroxabana', 'apixabana'], severity: 'moderate', mechanism: 'Efeito antiplaquetário em doses altas', clinicalEffect: 'Possível aumento do risco de sangramento', management: 'Cautela em doses altas com anticoagulantes/antiagregantes.', patientGuidance: 'Doses altas de ômega-3 podem somar ao efeito do anticoagulante.' },
  { food: 'Vitamina E (altas doses)', emoji: '💊', drugs: ['varfarina', 'acido acetilsalicilico', 'clopidogrel'], severity: 'moderate', mechanism: 'Efeito antiplaquetário em altas doses', clinicalEffect: 'Aumento do risco de sangramento', management: 'Evitar altas doses de vitamina E em anticoagulados.', patientGuidance: 'Evite altas doses de vitamina E com anticoagulante.' },
  { food: 'Ginseng', emoji: '🌱', drugs: ['varfarina', 'glibenclamida', 'gliclazida', 'glimepirida', 'insulina', 'metformina'], severity: 'moderate', mechanism: 'Reduz INR (varfarina); efeito hipoglicemiante aditivo', clinicalEffect: 'Redução da anticoagulação ou hipoglicemia', management: 'Monitorar INR/glicemia se uso de ginseng.', patientGuidance: 'Ginseng pode mexer com a coagulação e o açúcar no sangue — avise a equipe.' },
  { food: 'Valeriana / Kava-kava', emoji: '🌿', drugs: ['diazepam', 'alprazolam', 'clonazepam', 'lorazepam', 'zolpidem', 'zopiclona', 'fenobarbital'], severity: 'moderate', mechanism: 'Depressão aditiva do SNC', clinicalEffect: 'Sedação excessiva', management: 'Evitar com sedativos/hipnóticos; atenção a quedas.', patientGuidance: 'Valeriana/kava com calmantes aumentam a sonolência — cuidado.' },
  { food: 'Vitamina K (suplemento)', emoji: '💊', drugs: ['varfarina', 'varfarina'], severity: 'major', mechanism: 'Antagoniza o efeito da varfarina', clinicalEffect: 'Redução do INR e da anticoagulação', management: 'Manter ingestão de vitamina K estável; evitar suplementação não planejada.', patientGuidance: 'Não inicie suplemento de vitamina K por conta própria se usa varfarina.' },
]

export interface FoodSupplementHit {
  agent: string
  emoji: string
  type: 'alimento' | 'álcool' | 'suplemento'
  severity: 'major' | 'moderate'
  severityLabel: string
  drugs: string[]
  mechanism: string
  clinicalEffect: string
  management: string
  patientGuidance: string
}

/** Detecta interações dos fármacos informados com ALIMENTOS, ÁLCOOL e SUPLEMENTOS. */
export function checkFoodAndSupplements(drugNames: string[]): FoodSupplementHit[] {
  const names = drugNames.map(d => canonicalizeDrug(d)).filter(Boolean)
  const hits: FoodSupplementHit[] = []
  const scan = (list: FoodDrugInteraction[], kind: 'food' | 'supp') => {
    for (const it of list) {
      const matched = names.filter(n => it.drugs.some(d => n.includes(norm(d)) || norm(d).includes(n)))
      if (matched.length === 0) continue
      const type: FoodSupplementHit['type'] = kind === 'supp' ? 'suplemento' : (/alcool|álcool/i.test(norm(it.food)) ? 'álcool' : 'alimento')
      hits.push({
        agent: it.food, emoji: it.emoji, type, severity: it.severity,
        severityLabel: it.severity === 'major' ? 'Grave' : 'Moderada',
        drugs: Array.from(new Set(matched)), mechanism: it.mechanism,
        clinicalEffect: it.clinicalEffect, management: it.management, patientGuidance: it.patientGuidance,
      })
    }
  }
  scan(FOOD_DRUG_INTERACTIONS, 'food')
  scan(SUPPLEMENT_INTERACTIONS, 'supp')
  const rank = { major: 0, moderate: 1 }
  return hits.sort((a, b) => rank[a.severity] - rank[b.severity])
}
