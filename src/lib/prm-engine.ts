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
  { drug1: 'fluconazol', drug2: 'sildenafila', severity: 'major', mechanism: 'Inibição de CYP3A4 e CYP2C9 eleva nível de sildenafila', clinicalEffect: 'Hipotensão grave, priapismo e toxicidade sistêmica', management: 'Reduzir dose de sildenafila para 25 mg. Monitorar PA.' },
  { drug1: 'itraconazol', drug2: 'sinvastatina', severity: 'major', mechanism: 'Inibição intensa de CYP3A4', clinicalEffect: 'Elevação > 10x dos níveis de sinvastatina — rabdomiólise', management: 'Contraindicado. Suspender sinvastatina durante itraconazol.' },
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
  { drug1: 'lítio', drug2: 'enalapril', severity: 'major', mechanism: 'IECA reduz excreção renal de lítio', clinicalEffect: 'Toxicidade por lítio: tremor, confusão, insuficiência renal', management: 'Monitorar litemias semanalmente no início. Ajustar dose de lítio.' },
  { drug1: 'lítio', drug2: 'hidroclorotiazida', severity: 'major', mechanism: 'Tiazídico reduz excreção renal de lítio', clinicalEffect: 'Toxicidade por lítio grave', management: 'Preferir furosemida se diurético necessário. Monitorar litemias.' },
  { drug1: 'alopurinol', drug2: 'azatioprina', severity: 'major', mechanism: 'Alopurinol inibe xantina oxidase — impede inativação da azatioprina', clinicalEffect: 'Toxicidade grave por azatioprina: leucopenia, infecções oportunistas', management: 'Contraindicado. Se inevitável, reduzir azatioprina em 75%. Monitorar hemograma semanalmente.' },
  { drug1: 'metotrexato', drug2: 'trimetoprima', severity: 'major', mechanism: 'Inibição aditiva do folato', clinicalEffect: 'Toxicidade hematológica grave: pancitopenia', management: 'Evitar combinação. Monitorar hemograma se impossível evitar.' },
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
    conditionKeywords: ['diabetes tipo 2', 'dm2', 'insuficiencia cardiaca', 'doenca renal cronica'],
    recommendation: 'START v3: iSGLT2 (empagliflozina, dapagliflozina) indicados no DM2 com DCV estabelecida ou DRC — reduzem mortalidade cardiovascular e progressão renal.',
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
