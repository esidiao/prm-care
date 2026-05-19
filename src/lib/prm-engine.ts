/**
 * PRM Care — Motor Clínico de Análise Farmacoterapêutica
 * Baseado no Método Dáder de Seguimento Farmacoterapêutico
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

// ─── Interaction Database (simplified — production would use licensed DB) ──────

interface KnownInteraction {
  drug1: string
  drug2: string
  severity: 'minor' | 'moderate' | 'major' | 'contraindicated'
  mechanism: string
  clinicalEffect: string
  management: string
}

const KNOWN_INTERACTIONS: KnownInteraction[] = [
  {
    drug1: 'warfarina',
    drug2: 'ácido acetilsalicílico',
    severity: 'major',
    mechanism: 'Sinergismo anticoagulante e antiagregante plaquetário',
    clinicalEffect: 'Aumento do risco de sangramento, incluindo hemorragia grave',
    management: 'Monitorar INR rigorosamente. Considerar uso de inibidor de bomba de prótons. Avaliar risco-benefício.',
  },
  {
    drug1: 'warfarina',
    drug2: 'ibuprofeno',
    severity: 'major',
    mechanism: 'AINEs inibem síntese de tromboxano e podem deslocar warfarina de proteínas plasmáticas',
    clinicalEffect: 'Potencialização do efeito anticoagulante e risco de sangramento gastrointestinal',
    management: 'Evitar combinação. Se necessário, usar paracetamol. Monitorar INR.',
  },
  {
    drug1: 'metformina',
    drug2: 'contraste iodado',
    severity: 'major',
    mechanism: 'Contraste iodado pode causar insuficiência renal aguda, acumulando metformina',
    clinicalEffect: 'Risco de acidose lática potencialmente fatal',
    management: 'Suspender metformina 48h antes e após uso de contraste. Monitorar função renal.',
  },
  {
    drug1: 'enalapril',
    drug2: 'espironolactona',
    severity: 'moderate',
    mechanism: 'Ambos retêm potássio por mecanismos distintos',
    clinicalEffect: 'Risco de hipercalemia',
    management: 'Monitorar potássio sérico regularmente. Ajuste de doses conforme necessário.',
  },
  {
    drug1: 'sinvastatina',
    drug2: 'amiodarona',
    severity: 'major',
    mechanism: 'Amiodarona inibe CYP3A4, reduzindo metabolismo da sinvastatina',
    clinicalEffect: 'Aumento do nível sérico de sinvastatina com risco de miopatia e rabdomiólise',
    management: 'Limitar sinvastatina a 20 mg/dia. Considerar troca por pravastatina ou rosuvastatina.',
  },
  {
    drug1: 'fluoxetina',
    drug2: 'tramadol',
    severity: 'major',
    mechanism: 'Inibição da recaptação de serotonina por ambos',
    clinicalEffect: 'Risco de síndrome serotoninérgica',
    management: 'Evitar combinação. Se necessário, monitorar sinais de síndrome serotoninérgica (agitação, tremores, hipertermia).',
  },
  {
    drug1: 'metronidazol',
    drug2: 'álcool',
    severity: 'major',
    mechanism: 'Inibição do acetaldeído desidrogenase',
    clinicalEffect: 'Reação tipo dissulfiram: rubor, náusea, vômito, taquicardia',
    management: 'Orientar abstinência alcoólica durante o tratamento e 48h após.',
  },
  {
    drug1: 'ácido acetilsalicílico',
    drug2: 'ibuprofeno',
    severity: 'moderate',
    mechanism: 'AINE pode bloquear o sítio de ação do AAS na COX-1',
    clinicalEffect: 'Redução do efeito antiagregante do AAS em doses cardioprotetoras',
    management: 'Administrar AAS pelo menos 2h antes do ibuprofeno. Considerar alternativas.',
  },
  {
    drug1: 'levofloxacino',
    drug2: 'omeprazol',
    severity: 'moderate',
    mechanism: 'Inibição do CYP2C19 pelo omeprazol pode alterar metabolismo do levofloxacino',
    clinicalEffect: 'Possível aumento da concentração plasmática do antibiótico',
    management: 'Monitorar efeitos adversos do levofloxacino, especialmente prolongamento do QT.',
  },
  {
    drug1: 'digoxina',
    drug2: 'amiodarona',
    severity: 'major',
    mechanism: 'Amiodarona inibe P-glicoproteína e CYP3A4, reduzindo clearance da digoxina',
    clinicalEffect: 'Toxicidade digitálica: náusea, vômito, arritmias, distúrbios visuais',
    management: 'Reduzir dose de digoxina em 50% ao iniciar amiodarona. Monitorar nível sérico e ECG.',
  },
  {
    drug1: 'captopril',
    drug2: 'ácido acetilsalicílico',
    severity: 'moderate',
    mechanism: 'AINEs podem reduzir efeito anti-hipertensivo dos IECA',
    clinicalEffect: 'Redução do controle pressórico',
    management: 'Monitorar pressão arterial. Considerar substituição do AAS quando possível.',
  },
  {
    drug1: 'metformina',
    drug2: 'álcool',
    severity: 'moderate',
    mechanism: 'Álcool potencializa efeito da metformina na redução de lactato hepático',
    clinicalEffect: 'Risco aumentado de acidose lática',
    management: 'Orientar sobre consumo moderado de álcool. Evitar ingestão excessiva.',
  },
]

// ─── Renal Dosage Adjustment Flags ───────────────────────────────────────────

const RENAL_ADJUSTMENT_REQUIRED: Record<string, string> = {
  metformina: 'Contraindicada se ClCr < 30 mL/min. Cautela se ClCr 30-45 mL/min.',
  digoxina: 'Ajuste de dose necessário em insuficiência renal. Risco de toxicidade.',
  gabapentina: 'Redução de dose necessária conforme clearance de creatinina.',
  pregabalina: 'Ajuste de dose obrigatório em IRC.',
  atenolol: 'Redução de dose se ClCr < 35 mL/min.',
  ciprofloxacino: 'Ajuste de intervalo se ClCr < 30 mL/min.',
  levofloxacino: 'Ajuste de dose necessário em IR moderada a grave.',
  alopurinol: 'Redução significativa de dose em IR.',
  aciclovir: 'Ajuste de dose e intervalo em IR. Risco de cristalúria e toxicidade renal.',
  amoxicilina: 'Ajuste de intervalo em IR grave (ClCr < 30 mL/min).',
}

// ─── Hepatic Dosage Adjustment Flags ──────────────────────────────────────────

const HEPATIC_ADJUSTMENT_REQUIRED: Record<string, string> = {
  paracetamol: 'Cautela em hepatopatia. Dose máxima reduzida (2g/dia em hepatopatas).',
  estatinas: 'Contraindicadas em doença hepática ativa.',
  sinvastatina: 'Contraindicada em doença hepática ativa ou aumento persistente de transaminases.',
  atorvastatina: 'Contraindicada em doença hepática ativa.',
  metformina: 'Cautela em hepatopatia grave pelo risco de acidose lática.',
  isoniazida: 'Monitorar enzimas hepáticas. Suspender se elevação significativa.',
}

// ─── Pregnancy Risk Flags ─────────────────────────────────────────────────────

const PREGNANCY_CONTRAINDICATED: string[] = [
  'warfarina', 'ácido valproico', 'isotretinoína', 'metotrexato',
  'talidomida', 'estatinas', 'sinvastatina', 'atorvastatina',
  'enalapril', 'lisinopril', 'captopril', 'losartana', 'valsartana',
  'amiodarona', 'tetraciclina', 'doxiciclina', 'fluoroquinolonas',
  'ciprofloxacino', 'levofloxacino', 'misoprostol',
]

const PREGNANCY_CAUTION: string[] = [
  'ácido acetilsalicílico', 'ibuprofeno', 'naproxeno', 'diclofenaco',
  'benzodiazepínicos', 'alprazolam', 'diazepam', 'clonazepam',
  'opioides', 'tramadol', 'codeína', 'lítio',
]

// ─── Elderly Risk Flags ───────────────────────────────────────────────────────

const BEERS_CRITERIA_DRUGS: Record<string, string> = {
  'diazepam': 'Critérios de Beers: Benzodiazepínico - risco de quedas, sedação excessiva e delirium em idosos.',
  'alprazolam': 'Critérios de Beers: Benzodiazepínico - risco aumentado de eventos adversos em idosos.',
  'clonazepam': 'Critérios de Beers: Benzodiazepínico - evitar uso crônico em idosos.',
  'zolpidem': 'Critérios de Beers: Hipnótico - risco de quedas, fraturas e delirium em idosos.',
  'amitriptilina': 'Critérios de Beers: Antidepressivo tricíclico - efeitos anticolinérgicos podem causar confusão mental, retenção urinária, quedas.',
  'difenidramina': 'Critérios de Beers: Antihistamínico de primeira geração - alto potencial anticolinérgico em idosos.',
  'prometazina': 'Critérios de Beers: Antihistamínico - anticolinérgico, risco de sedação excessiva.',
  'metoclopramida': 'Critérios de Beers: Risco de efeitos extrapiramidais prolongados em idosos.',
  'ibuprofeno': 'Critérios de Beers: AINE - risco de sangramento gastrointestinal, insuficiência renal e elevação pressórica em idosos.',
  'naproxeno': 'Critérios de Beers: AINE - prefira paracetamol para analgesia em idosos.',
  'glibenclamida': 'Critérios de Beers: Sulfonilureia de longa ação - risco de hipoglicemia grave em idosos.',
  'nitrofurantoína': 'Critérios de Beers: Evitar em idosos com ClCr < 30 mL/min - risco de toxicidade pulmonar.',
}

// ─── Utility Functions ────────────────────────────────────────────────────────

function normalizeDrug(name: string): string {
  return name.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function drugNameContains(medication: MedicationContext, keyword: string): boolean {
  const normalized = normalizeDrug(keyword)
  const activeIngredient = normalizeDrug(medication.activeIngredient)
  const tradeName = medication.tradeName ? normalizeDrug(medication.tradeName) : ''
  return activeIngredient.includes(normalized) || tradeName.includes(normalized)
}

function findInteractions(medications: MedicationContext[]): Array<{
  med1: MedicationContext
  med2: MedicationContext
  interaction: KnownInteraction
}> {
  const results: Array<{ med1: MedicationContext; med2: MedicationContext; interaction: KnownInteraction }> = []

  for (let i = 0; i < medications.length; i++) {
    for (let j = i + 1; j < medications.length; j++) {
      for (const interaction of KNOWN_INTERACTIONS) {
        const med1Name = normalizeDrug(medications[i].activeIngredient)
        const med2Name = normalizeDrug(medications[j].activeIngredient)
        const d1 = normalizeDrug(interaction.drug1)
        const d2 = normalizeDrug(interaction.drug2)

        if (
          (med1Name.includes(d1) && med2Name.includes(d2)) ||
          (med1Name.includes(d2) && med2Name.includes(d1))
        ) {
          results.push({ med1: medications[i], med2: medications[j], interaction })
        }
      }
    }
  }

  return results
}

function checkDuplicateTherapy(medications: MedicationContext[]): Array<{
  group: MedicationContext[]
  reason: string
}> {
  const duplicates: Array<{ group: MedicationContext[]; reason: string }> = []

  // Group medications by pharmacological class keywords
  const classGroups: Record<string, MedicationContext[]> = {}

  const classKeywords: Record<string, string[]> = {
    AINE: ['ibuprofeno', 'naproxeno', 'diclofenaco', 'celecoxibe', 'meloxicam', 'indometacina'],
    Benzodiazepínico: ['diazepam', 'alprazolam', 'clonazepam', 'lorazepam', 'midazolam'],
    IECA: ['enalapril', 'captopril', 'lisinopril', 'ramipril', 'perindopril'],
    'BRA-II': ['losartana', 'valsartana', 'irbesartana', 'candesartana', 'olmesartana'],
    Estatina: ['sinvastatina', 'atorvastatina', 'rosuvastatina', 'pravastatina', 'fluvastatina'],
    'IBP': ['omeprazol', 'pantoprazol', 'lansoprazol', 'esomeprazol', 'rabeprazol'],
    'Antidiabético oral': ['metformina', 'glibenclamida', 'glipizida', 'glimepirida', 'sitagliptina'],
    'Antihistamínico H1': ['loratadina', 'cetirizina', 'fexofenadina', 'desloratadina'],
  }

  for (const [className, keywords] of Object.entries(classKeywords)) {
    const matching = medications.filter(med =>
      keywords.some(kw => normalizeDrug(med.activeIngredient).includes(normalizeDrug(kw)))
    )
    if (matching.length > 1) {
      classGroups[className] = matching
    }
  }

  for (const [className, group] of Object.entries(classGroups)) {
    duplicates.push({
      group,
      reason: `Possível duplicidade terapêutica: ${group.length} medicamentos da classe ${className} em uso simultâneo.`,
    })
  }

  return duplicates
}

// ─── PRM Finders ──────────────────────────────────────────────────────────────

function findNecessityPRMs(context: PatientContext): PRMFindingResult[] {
  const findings: PRMFindingResult[] = []

  // Self-medication without indication
  const selfMedications = context.medications.filter(m => m.isSelfMedication && !m.indication)
  for (const med of selfMedications) {
    findings.push({
      category: PRMCategory.NECESSITY,
      riskLevel: RiskLevel.MODERATE,
      title: `Automedicação sem indicação registrada: ${med.activeIngredient}`,
      description: `O paciente usa ${med.activeIngredient} por automedicação sem indicação clínica documentada.`,
      clinicalEvidence: `Medicamento "${med.activeIngredient}" marcado como automedicação sem indicação terapêutica associada.`,
      potentialImpact: 'Uso de medicamento potencialmente desnecessário, risco de efeitos adversos sem benefício terapêutico justificado.',
      pharmacistConduct: 'Investigar o motivo da automedicação. Orientar sobre riscos. Verificar se há problema de saúde não tratado profissionalmente. Discutir com o prescritor se necessário.',
      patientGuidance: 'Evite tomar medicamentos sem orientação profissional. Informe seu farmacêutico ou médico sobre todos os medicamentos que usa, incluindo os sem receita.',
      needsReferral: false,
      needsPrescriberContact: true,
      monitoring: 'Verificar evolução clínica e necessidade terapêutica real.',
      reevaluationPeriod: '30 dias',
      confidenceLevel: 'moderate',
      validationNote: 'Análise baseada nos dados informados. Verificar com o paciente o motivo real do uso e histórico clínico completo.',
      interventionDeadline: 'Próxima consulta',
      medicationId: med.id,
    })
  }

  // Duplicate therapy
  const duplicates = checkDuplicateTherapy(context.medications)
  for (const dup of duplicates) {
    findings.push({
      category: PRMCategory.NECESSITY,
      riskLevel: RiskLevel.MODERATE,
      title: `Possível duplicidade terapêutica`,
      description: dup.reason,
      clinicalEvidence: `Medicamentos da mesma classe em uso simultâneo: ${dup.group.map(m => m.activeIngredient).join(', ')}.`,
      potentialImpact: 'Risco aumentado de efeitos adversos sem benefício terapêutico adicional. Possível interação de classe.',
      pharmacistConduct: 'Verificar se a combinação é intencional (ex: politerapia justificada por diretrizes). Caso contrário, discutir com o prescritor a necessidade de manutenção de ambos.',
      patientGuidance: 'Informe ao seu médico que está usando múltiplos medicamentos semelhantes. Não interrompa nenhum medicamento sem orientação.',
      needsReferral: false,
      needsPrescriberContact: true,
      monitoring: 'Avaliar resposta terapêutica e racionalização do esquema.',
      reevaluationPeriod: '30 dias',
      confidenceLevel: 'moderate',
      validationNote: 'Duplicidade aparente baseada nos nomes dos princípios ativos. Confirmar com prescritor se a combinação é intencional (ex: IECA + BRA em proteinúria pode ser justificado em contextos específicos).',
      interventionDeadline: 'Próxima consulta',
    })
  }

  // Untreated condition (condition without medication)
  const diagnosesNames = context.diagnoses.map(d => d.name.toLowerCase())
  const medicationIndications = context.medications.map(m => (m.indication || '').toLowerCase())

  const untreatedDiagnoses = [
    { condition: 'hipertensão', keywords: ['hipertens', 'pressão alta'], treatmentKeywords: ['anti-hipertensivo', 'enalapril', 'losartana', 'amlodipina', 'hidroclorotiazida', 'atenolol', 'captopril'] },
    { condition: 'diabetes', keywords: ['diabet', 'hiperglicemi'], treatmentKeywords: ['metformina', 'insulina', 'glibenclamida', 'sitagliptina', 'antidiabético'] },
    { condition: 'dislipidemia', keywords: ['dislipidemi', 'hipercolesterol', 'hipertrigliceri'], treatmentKeywords: ['estatina', 'sinvastatina', 'atorvastatina', 'fibrato', 'ezetimiba'] },
  ]

  for (const item of untreatedDiagnoses) {
    const hasDiagnosis = diagnosesNames.some(d => item.keywords.some(k => d.includes(k)))
    const hasTreatment = medicationIndications.some(ind =>
      item.treatmentKeywords.some(kw => ind.includes(kw))
    ) || context.medications.some(med =>
      item.treatmentKeywords.some(kw => normalizeDrug(med.activeIngredient).includes(normalizeDrug(kw)))
    )

    if (hasDiagnosis && !hasTreatment) {
      findings.push({
        category: PRMCategory.NECESSITY,
        riskLevel: RiskLevel.MODERATE,
        title: `Possível necessidade terapêutica não atendida: ${item.condition}`,
        description: `Diagnóstico de ${item.condition} registrado sem medicamento específico para essa condição identificado no prontuário.`,
        clinicalEvidence: `Diagnóstico presente: ${item.condition}. Nenhum medicamento da classe habitual para este diagnóstico foi localizado na lista de medicamentos do paciente.`,
        potentialImpact: 'Condição de saúde potencialmente não tratada, com risco de progressão da doença e complicações.',
        pharmacistConduct: 'Verificar com o prescritor se há tratamento não-farmacológico exclusivo, medicamento não listado ou se o tratamento está pendente. Não iniciar terapia sem prescrição.',
        patientGuidance: 'Informe ao seu médico sobre todos os medicamentos que você usa. Pergunte se precisa de medicamento para tratar esta condição.',
        needsReferral: false,
        needsPrescriberContact: true,
        monitoring: 'Acompanhar evolução clínica da condição.',
        reevaluationPeriod: '15-30 dias',
        confidenceLevel: 'low',
        validationNote: 'Esta suspeita é baseada nos dados inseridos. Pode haver medicamentos não listados ou tratamento não-farmacológico estabelecido. Confirmar com o prescritor.',
        interventionDeadline: 'Próxima consulta',
      })
    }
  }

  return findings
}

function findEffectivenessPRMs(context: PatientContext): PRMFindingResult[] {
  const findings: PRMFindingResult[] = []

  // Poor adherence
  const poorAdherenceMeds = context.medications.filter(
    m => m.adherence === AdherenceLevel.POOR || m.adherence === AdherenceLevel.MODERATE
  )

  for (const med of poorAdherenceMeds) {
    const isPoor = med.adherence === AdherenceLevel.POOR
    findings.push({
      category: PRMCategory.EFFECTIVENESS,
      riskLevel: isPoor ? RiskLevel.HIGH : RiskLevel.MODERATE,
      title: `${isPoor ? 'Baixa' : 'Adesão moderada'} ao tratamento: ${med.activeIngredient}`,
      description: `Paciente apresenta ${isPoor ? 'baixa' : 'adesão moderada'} ao uso de ${med.activeIngredient}.`,
      clinicalEvidence: `Adesão registrada como "${med.adherence}" para ${med.activeIngredient}${med.indication ? ` (indicado para: ${med.indication})` : ''}.`,
      potentialImpact: 'Falha terapêutica por uso irregular. Risco de agravamento da condição de saúde tratada.',
      pharmacistConduct: 'Investigar barreiras à adesão (custo, efeitos adversos, esquema complexo, falta de compreensão). Aplicar estratégias motivacionais. Simplificar esquema se possível. Orientar importância da regularidade.',
      patientGuidance: 'Use seu medicamento regularmente como prescrito. Informe ao seu farmacêutico ou médico se tiver dificuldades para usar o medicamento todos os dias.',
      needsReferral: false,
      needsPrescriberContact: isPoor,
      monitoring: 'Reavaliar adesão a cada consulta. Considerar ferramentas de monitoramento (alarmes, caixinhas organizadoras).',
      suggestedExams: 'Avaliar parâmetros clínicos relacionados à condição tratada para verificar efetividade.',
      reevaluationPeriod: isPoor ? '15 dias' : '30 dias',
      confidenceLevel: 'high',
      validationNote: 'Baseado na informação de adesão fornecida. Verificar com o paciente os motivos específicos e adequar a intervenção.',
      interventionDeadline: isPoor ? 'Imediato' : 'Próxima consulta',
      medicationId: med.id,
    })
  }

  // Complex regimen (multiple daily doses)
  const complexMeds = context.medications.filter(m => m.frequencyHours && m.frequencyHours <= 6)
  if (complexMeds.length > 0) {
    findings.push({
      category: PRMCategory.EFFECTIVENESS,
      riskLevel: RiskLevel.LOW,
      title: 'Esquema posológico complexo — risco de adesão comprometida',
      description: `${complexMeds.length} medicamento(s) com frequência de 4x/dia ou maior, podendo dificultar a adesão.`,
      clinicalEvidence: `Medicamentos com intervalo ≤ 6h: ${complexMeds.map(m => m.activeIngredient).join(', ')}.`,
      potentialImpact: 'Esquemas complexos reduzem a adesão ao tratamento e, consequentemente, a efetividade terapêutica.',
      pharmacistConduct: 'Verificar se é possível simplificar o esquema (formulações de liberação prolongada, ajuste de horários). Orientar sobre organização dos horários.',
      patientGuidance: 'Use um organizador de medicamentos ou alarmes para não esquecer as doses. Converse com seu médico sobre a possibilidade de simplificar o horário dos medicamentos.',
      needsReferral: false,
      needsPrescriberContact: true,
      monitoring: 'Avaliar adesão e efetividade após simplificação do esquema, se realizada.',
      reevaluationPeriod: '30 dias',
      confidenceLevel: 'moderate',
      validationNote: 'A complexidade do esquema é um fator de risco para não adesão, mas não implica falha atual. Avaliar contexto individual do paciente.',
      interventionDeadline: 'Próxima consulta',
    })
  }

  // Many medications overall
  if (context.medications.length >= 5) {
    findings.push({
      category: PRMCategory.EFFECTIVENESS,
      riskLevel: context.medications.length >= 8 ? RiskLevel.MODERATE : RiskLevel.LOW,
      title: `Polifarmácia — ${context.medications.length} medicamentos em uso`,
      description: `Paciente em uso de ${context.medications.length} medicamentos simultaneamente.`,
      clinicalEvidence: `Total de ${context.medications.length} medicamentos listados: ${context.medications.map(m => m.activeIngredient).join(', ')}.`,
      potentialImpact: 'Polifarmácia aumenta o risco de interações, erros de medicação, redução da adesão e internações. Recomenda-se revisão sistemática do esquema.',
      pharmacistConduct: 'Realizar revisão abrangente da farmacoterapia (reconciliação medicamentosa). Identificar medicamentos que podem ser descontinuados ou substituídos. Verificar interações.',
      patientGuidance: 'Leve sempre a lista de todos os seus medicamentos a cada consulta médica e farmacêutica. Não tome medicamentos adicionais sem orientação.',
      needsReferral: false,
      needsPrescriberContact: context.medications.length >= 8,
      monitoring: 'Revisar lista de medicamentos periodicamente, especialmente após internações ou mudanças clínicas.',
      reevaluationPeriod: '60-90 dias',
      confidenceLevel: 'high',
      validationNote: 'Polifarmácia não implica necessariamente inadequação. Pode ser justificada pela complexidade clínica. Análise individual de cada medicamento é necessária.',
      interventionDeadline: 'Próxima consulta',
    })
  }

  return findings
}

function findSafetyPRMs(context: PatientContext): PRMFindingResult[] {
  const findings: PRMFindingResult[] = []

  // Drug interactions
  const interactions = findInteractions(context.medications)
  for (const { med1, med2, interaction } of interactions) {
    const riskLevel = interaction.severity === 'contraindicated' || interaction.severity === 'major'
      ? (interaction.severity === 'contraindicated' ? RiskLevel.URGENT : RiskLevel.HIGH)
      : interaction.severity === 'moderate' ? RiskLevel.MODERATE : RiskLevel.LOW

    findings.push({
      category: PRMCategory.SAFETY,
      riskLevel,
      title: `Interação medicamentosa: ${med1.activeIngredient} + ${med2.activeIngredient}`,
      description: `Identificada interação ${interaction.severity === 'contraindicated' ? 'contraindicada' : interaction.severity === 'major' ? 'grave' : interaction.severity === 'moderate' ? 'moderada' : 'menor'} entre ${med1.activeIngredient} e ${med2.activeIngredient}.`,
      clinicalEvidence: `Mecanismo: ${interaction.mechanism}. Efeito esperado: ${interaction.clinicalEffect}.`,
      potentialImpact: interaction.clinicalEffect,
      pharmacistConduct: interaction.management,
      patientGuidance: 'Não interrompa ou altere seus medicamentos por conta própria. Informe seu médico sobre esta interação para avaliação. Fique atento a sintomas incomuns.',
      needsReferral: riskLevel === RiskLevel.URGENT,
      needsPrescriberContact: riskLevel === RiskLevel.HIGH || riskLevel === RiskLevel.URGENT,
      monitoring: 'Monitorar sinais e sintomas de toxicidade ou falha terapêutica conforme a interação específica.',
      reevaluationPeriod: riskLevel === RiskLevel.URGENT ? 'Imediato' : '7-15 dias',
      confidenceLevel: 'high',
      validationNote: 'Interação identificada com base em dados publicados. A relevância clínica depende de fatores individuais do paciente. Avaliação profissional é essencial.',
      interventionDeadline: riskLevel === RiskLevel.URGENT ? 'Imediato' : riskLevel === RiskLevel.HIGH ? '24-48h' : 'Próxima consulta',
      medicationId: med1.id,
    })
  }

  // Pregnancy contraindications
  if (context.isPregnant) {
    for (const med of context.medications) {
      const normalizedName = normalizeDrug(med.activeIngredient)
      const isContraindicated = PREGNANCY_CONTRAINDICATED.some(
        drug => normalizedName.includes(normalizeDrug(drug))
      )
      const isCaution = !isContraindicated && PREGNANCY_CAUTION.some(
        drug => normalizedName.includes(normalizeDrug(drug))
      )

      if (isContraindicated) {
        findings.push({
          category: PRMCategory.SAFETY,
          riskLevel: RiskLevel.URGENT,
          title: `Medicamento contraindicado na gravidez: ${med.activeIngredient}`,
          description: `${med.activeIngredient} é classificado como contraindicado ou de alto risco durante a gestação.`,
          clinicalEvidence: `Paciente gestante${context.gestationalAge ? ` (${context.gestationalAge} semanas)` : ''} em uso de ${med.activeIngredient}, medicamento com potencial teratogênico ou risco gestacional documentado.`,
          potentialImpact: 'Risco potencial ao feto: malformações, restrição de crescimento, complicações obstétricas ou neonatais, dependendo do medicamento e período gestacional.',
          pharmacistConduct: 'URGENTE: Comunicar ao prescritor imediatamente. Não suspender por conta própria sem orientação médica. Discutir alternativas terapêuticas seguras na gestação.',
          patientGuidance: 'Informe seu médico IMEDIATAMENTE que está grávida e em uso deste medicamento. Não interrompa por conta própria.',
          needsReferral: true,
          needsPrescriberContact: true,
          monitoring: 'Acompanhamento obstétrico rigoroso. Monitorar desenvolvimento fetal com ultrassom conforme indicação.',
          reevaluationPeriod: 'Imediato',
          confidenceLevel: 'high',
          validationNote: 'Baseado em dados de segurança conhecidos para este medicamento na gestação. Avaliar individualmente com obstetrícia e farmacologia clínica.',
          interventionDeadline: 'Imediato — 24 horas',
          medicationId: med.id,
        })
      } else if (isCaution) {
        findings.push({
          category: PRMCategory.SAFETY,
          riskLevel: RiskLevel.HIGH,
          title: `Cautela na gestação: ${med.activeIngredient}`,
          description: `${med.activeIngredient} requer avaliação cuidadosa do risco-benefício durante a gestação.`,
          clinicalEvidence: `Paciente gestante${context.gestationalAge ? ` (${context.gestationalAge} semanas)` : ''} em uso de ${med.activeIngredient}, medicamento com dados de segurança gestacional limitados ou uso com cautela recomendado.`,
          potentialImpact: 'Possível risco ao feto dependendo do trimestre, dose e duração de uso.',
          pharmacistConduct: 'Revisar indicação e necessidade. Discutir com o prescritor a avaliação do risco-benefício. Verificar alternativas mais seguras na gestação.',
          patientGuidance: 'Informe ao seu médico obstetra todos os medicamentos em uso. Não interrompa sem orientação.',
          needsReferral: false,
          needsPrescriberContact: true,
          monitoring: 'Acompanhamento pré-natal rigoroso com avaliação do desenvolvimento fetal.',
          reevaluationPeriod: '7 dias',
          confidenceLevel: 'moderate',
          validationNote: 'A segurança na gestação depende do trimestre, dose e condição clínica. Avaliação individualizada pelo obstetra é imprescindível.',
          interventionDeadline: '48-72 horas',
          medicationId: med.id,
        })
      }
    }
  }

  // Elderly risks (Beers Criteria)
  if (context.isElderly) {
    for (const med of context.medications) {
      const normalizedName = normalizeDrug(med.activeIngredient)
      for (const [drug, warning] of Object.entries(BEERS_CRITERIA_DRUGS)) {
        if (normalizedName.includes(normalizeDrug(drug))) {
          findings.push({
            category: PRMCategory.SAFETY,
            riskLevel: RiskLevel.HIGH,
            title: `Medicamento potencialmente inapropriado para idosos: ${med.activeIngredient}`,
            description: warning,
            clinicalEvidence: `Paciente idoso (${context.age ? `${context.age} anos` : 'idade ≥ 60 anos'}) em uso de ${med.activeIngredient}, medicamento listado nos Critérios de Beers da American Geriatrics Society.`,
            potentialImpact: 'Risco aumentado de efeitos adversos graves em idosos: quedas, fraturas, delirium, hospitalização, dependência.',
            pharmacistConduct: 'Revisar necessidade do medicamento. Avaliar alternativas mais seguras para a faixa etária. Discutir com prescritor. Iniciar processo de desprescrição gradual se indicado.',
            patientGuidance: 'Informe ao seu médico e farmacêutico todos os medicamentos que usa. Não interrompa por conta própria, mas peça uma revisão dos seus medicamentos.',
            needsReferral: false,
            needsPrescriberContact: true,
            monitoring: 'Avaliar risco de quedas, estado cognitivo e função renal periodicamente.',
            suggestedExams: 'Avaliação da força muscular, equilíbrio, função cognitiva (MEEM), função renal (creatinina, ClCr).',
            reevaluationPeriod: '30 dias',
            confidenceLevel: 'high',
            validationNote: 'Baseado nos Critérios de Beers (AGS, 2023). A aplicabilidade individual deve ser avaliada com o prescritor considerando o contexto clínico.',
            interventionDeadline: 'Próxima consulta',
            medicationId: med.id,
          })
          break
        }
      }
    }
  }

  // Renal function check
  if (context.renalFunction && context.renalFunction !== 'normal') {
    for (const med of context.medications) {
      const normalizedName = normalizeDriver(med.activeIngredient)
      for (const [drug, warning] of Object.entries(RENAL_ADJUSTMENT_REQUIRED)) {
        if (normalizedName.includes(normalizeDriver(drug))) {
          findings.push({
            category: PRMCategory.SAFETY,
            riskLevel: context.renalFunction === 'severe_impairment' || context.renalFunction === 'failure'
              ? RiskLevel.HIGH : RiskLevel.MODERATE,
            title: `Ajuste de dose necessário em insuficiência renal: ${med.activeIngredient}`,
            description: warning,
            clinicalEvidence: `Função renal: ${context.renalFunction}${context.creatinineClearance ? ` (ClCr: ${context.creatinineClearance} mL/min)` : ''}. Medicamento em uso: ${med.activeIngredient}.`,
            potentialImpact: 'Acúmulo do medicamento por redução do clearance renal, com risco de toxicidade.',
            pharmacistConduct: 'Verificar se a dose e o intervalo estão adequados para a função renal atual. Consultar tabelas de ajuste de dose. Comunicar ao prescritor.',
            patientGuidance: 'Informe sempre ao seu médico sobre problemas nos rins. Não altere a dose sem orientação.',
            needsReferral: false,
            needsPrescriberContact: true,
            monitoring: 'Monitorar função renal (creatinina, ureia, ClCr). Avaliar sinais de toxicidade específicos do medicamento.',
            suggestedExams: 'Creatinina sérica, ureia, clearance de creatinina calculado, eletrólitos.',
            reevaluationPeriod: '15-30 dias',
            confidenceLevel: 'moderate',
            validationNote: 'Verificar dados atualizados de função renal. O ajuste de dose deve ser calculado individualmente com base no ClCr atual.',
            interventionDeadline: '48 horas',
            medicationId: med.id,
          })
          break
        }
      }
    }
  }

  // Hepatic function check
  if (context.hepaticFunction && context.hepaticFunction !== 'normal') {
    for (const med of context.medications) {
      const normalizedName = normalizeDriver(med.activeIngredient)
      for (const [drug, warning] of Object.entries(HEPATIC_ADJUSTMENT_REQUIRED)) {
        if (normalizedName.includes(normalizeDriver(drug))) {
          findings.push({
            category: PRMCategory.SAFETY,
            riskLevel: context.hepaticFunction === 'severe_impairment'
              ? RiskLevel.HIGH : RiskLevel.MODERATE,
            title: `Cautela em hepatopatia: ${med.activeIngredient}`,
            description: warning,
            clinicalEvidence: `Função hepática comprometida (${context.hepaticFunction}). Paciente em uso de ${med.activeIngredient}, com metabolização hepática relevante.`,
            potentialImpact: 'Risco de acúmulo e hepatotoxicidade adicional ou toxicidade sistêmica por redução do metabolismo de primeira passagem.',
            pharmacistConduct: 'Verificar dose máxima adequada para a função hepática. Avaliar alternativas com menor metabolismo hepático. Comunicar ao prescritor.',
            patientGuidance: 'Informe ao seu médico sobre problemas no fígado. Evite automedicação, especialmente com paracetamol e anti-inflamatórios.',
            needsReferral: false,
            needsPrescriberContact: true,
            monitoring: 'Monitorar enzimas hepáticas (TGO, TGP, GGT, bilirrubinas). Sinais de insuficiência hepática.',
            suggestedExams: 'TGO, TGP, GGT, bilirrubinas, TP/INR, albumina.',
            reevaluationPeriod: '30 dias',
            confidenceLevel: 'moderate',
            validationNote: 'Ajuste baseado em grau de comprometimento hepático. Utilizar escore de Child-Pugh para orientar ajustes quando disponível.',
            interventionDeadline: 'Próxima consulta',
            medicationId: med.id,
          })
          break
        }
      }
    }
  }

  // Allergy check
  for (const allergy of context.allergies) {
    for (const med of context.medications) {
      const allergyNorm = normalizeDriver(allergy.substance)
      const medNorm = normalizeDriver(med.activeIngredient)
      const tradeNorm = med.tradeName ? normalizeDriver(med.tradeName) : ''

      if (medNorm.includes(allergyNorm) || allergyNorm.includes(medNorm) ||
          (tradeNorm && (tradeNorm.includes(allergyNorm) || allergyNorm.includes(tradeNorm)))) {
        findings.push({
          category: PRMCategory.SAFETY,
          riskLevel: allergy.severity === 'anaphylaxis' ? RiskLevel.URGENT : RiskLevel.HIGH,
          title: `ALERTA: Possível uso de medicamento com alergia registrada — ${med.activeIngredient}`,
          description: `Paciente possui alergia registrada a "${allergy.substance}" e está em uso de "${med.activeIngredient}".`,
          clinicalEvidence: `Alergia registrada: ${allergy.substance} (Reação: ${allergy.reaction || 'não especificada'}, Gravidade: ${allergy.severity || 'não especificada'}). Medicamento em uso: ${med.activeIngredient}.`,
          potentialImpact: 'Risco de reação alérgica que pode variar de leve a anafilaxia, com risco de vida.',
          pharmacistConduct: 'URGENTE: Verificar se há relação real entre a alergia registrada e o medicamento em uso. Comunicar ao prescritor imediatamente. Revisar histórico de alergias cruzadas.',
          patientGuidance: 'Informe IMEDIATAMENTE ao seu médico que tem alergia a este medicamento. Não tome o medicamento sem confirmação do seu médico.',
          needsReferral: allergy.severity === 'anaphylaxis',
          needsPrescriberContact: true,
          monitoring: 'Monitorar sinais de reação alérgica: urticária, angioedema, broncoespasmo, hipotensão.',
          reevaluationPeriod: 'Imediato',
          confidenceLevel: 'high',
          validationNote: 'A correlação entre a alergia e o medicamento deve ser confirmada clinicamente. Podem existir reações cruzadas ou confusão de nomenclatura. Avaliação profissional urgente.',
          interventionDeadline: 'Imediato',
          medicationId: med.id,
        })
      }
    }
  }

  return findings
}

function normalizeDriver(name: string): string {
  return name.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function findAdherencePRMs(context: PatientContext): PRMFindingResult[] {
  const findings: PRMFindingResult[] = []

  // High cost medications (check by self-report adverseEffects mentioning cost)
  const costIssues = context.medications.filter(m =>
    m.adverseEffects && (
      m.adverseEffects.toLowerCase().includes('caro') ||
      m.adverseEffects.toLowerCase().includes('custo') ||
      m.adverseEffects.toLowerCase().includes('preço') ||
      m.adverseEffects.toLowerCase().includes('acesso')
    )
  )

  for (const med of costIssues) {
    findings.push({
      category: PRMCategory.ADHERENCE,
      riskLevel: RiskLevel.MODERATE,
      title: `Barreira financeira ao tratamento: ${med.activeIngredient}`,
      description: 'Paciente relata dificuldade financeira ou de acesso ao medicamento.',
      clinicalEvidence: `Registro de queixa relacionada a custo/acesso para: ${med.activeIngredient}.`,
      potentialImpact: 'Descontinuação do tratamento por barreira financeira, com impacto na efetividade terapêutica.',
      pharmacistConduct: 'Orientar sobre programas de acesso a medicamentos (Farmácia Popular, programas de pacientes, genéricos equivalentes). Verificar possibilidade de prescrição de medicamento equivalente de menor custo.',
      patientGuidance: 'Pergunte ao farmacêutico sobre versões genéricas ou programas de assistência para obter seu medicamento com menor custo. Verifique a Farmácia Popular do Brasil.',
      needsReferral: false,
      needsPrescriberContact: true,
      monitoring: 'Confirmar que o paciente está acessando o medicamento regularmente.',
      reevaluationPeriod: '30 dias',
      confidenceLevel: 'moderate',
      validationNote: 'Baseado no relato do paciente. Verificar alternativas terapêuticas com o prescritor.',
      interventionDeadline: 'Próxima consulta',
      medicationId: med.id,
    })
  }

  // Inconvenient pharmaceutical form
  const formIssues = context.medications.filter(m =>
    m.adverseEffects && (
      m.adverseEffects.toLowerCase().includes('engolir') ||
      m.adverseEffects.toLowerCase().includes('comprimido') ||
      m.adverseEffects.toLowerCase().includes('forma') ||
      m.adverseEffects.toLowerCase().includes('dificuldade')
    )
  )

  for (const med of formIssues) {
    findings.push({
      category: PRMCategory.ADHERENCE,
      riskLevel: RiskLevel.LOW,
      title: `Dificuldade com forma farmacêutica: ${med.activeIngredient}`,
      description: 'Paciente relata dificuldade relacionada à forma farmacêutica do medicamento.',
      clinicalEvidence: `Relato de dificuldade para uso de ${med.activeIngredient} (${med.pharmaceuticalForm || 'forma não especificada'}).`,
      potentialImpact: 'Não adesão por dificuldade de uso, com risco de falha terapêutica.',
      pharmacistConduct: 'Verificar disponibilidade de outras formas farmacêuticas (solução oral, formulações manipuladas). Orientar sobre técnica de administração correta.',
      patientGuidance: 'Informe ao seu farmacêutico ou médico sobre a dificuldade. Pode haver outras formas do medicamento disponíveis.',
      needsReferral: false,
      needsPrescriberContact: true,
      monitoring: 'Verificar se a alternativa resolve o problema de adesão.',
      reevaluationPeriod: '30 dias',
      confidenceLevel: 'moderate',
      validationNote: 'Verificar disponibilidade e custo de alternativas farmacêuticas antes de recomendar mudança.',
      interventionDeadline: 'Próxima consulta',
      medicationId: med.id,
    })
  }

  return findings
}

// ─── SOAP Generator ───────────────────────────────────────────────────────────

function generateSOAP(context: PatientContext, findings: PRMFindingResult[]): SOAPSuggestion {
  const urgent = findings.filter(f => f.riskLevel === RiskLevel.URGENT)
  const high = findings.filter(f => f.riskLevel === RiskLevel.HIGH)

  const subjective = `Paciente ${context.age ? `de ${context.age} anos` : ''}${context.sex ? `, ${context.sex === 'MALE' ? 'sexo masculino' : context.sex === 'FEMALE' ? 'sexo feminino' : 'outro sexo'}` : ''}. ${
    context.diagnoses.length > 0 ? `Diagnósticos referidos: ${context.diagnoses.map(d => d.name).join(', ')}. ` : ''
  }${
    context.isPregnant ? `Gestante${context.gestationalAge ? ` (${context.gestationalAge} semanas)` : ''}. ` : ''
  }${
    context.isLactating ? 'Em período de lactação. ' : ''
  }Em uso de ${context.medications.length} medicamento(s). ${
    context.medications.some(m => m.adherence === AdherenceLevel.POOR) ?
    'Relata dificuldade de adesão a alguns medicamentos. ' : ''
  }${
    context.allergies.length > 0 ? `Alergias relatadas: ${context.allergies.map(a => a.substance).join(', ')}. ` : ''
  }`

  const objective = `Medicamentos em uso: ${context.medications.map(m =>
    `${m.activeIngredient}${m.dose ? ` ${m.dose}${m.doseUnit || ''}` : ''}${m.frequency ? ` (${m.frequency})` : ''}`
  ).join('; ')}. ${
    context.labResults.length > 0 ?
    `Exames laboratoriais: ${context.labResults.map(l => `${l.examName}: ${l.value}${l.unit || ''}${l.isAbnormal ? ' (ALTERADO)' : ''}`).join('; ')}.` : 'Exames laboratoriais: não informados.'
  } ${
    context.renalFunction ? `Função renal: ${context.renalFunction}${context.creatinineClearance ? ` (ClCr: ${context.creatinineClearance} mL/min)` : ''}.` : ''
  } ${
    context.hepaticFunction ? `Função hepática: ${context.hepaticFunction}.` : ''
  }`

  const assessment = `Identificados ${findings.length} Problema(s) Relacionado(s) a Medicamentos (PRM). ${
    urgent.length > 0 ? `URGENTE: ${urgent.map(f => f.title).join('; ')}. ` : ''
  }${
    high.length > 0 ? `Alto risco: ${high.map(f => f.title).join('; ')}. ` : ''
  }${
    findings.filter(f => f.category === 'NECESSITY').length > 0 ?
    `PRMs de Necessidade (${findings.filter(f => f.category === 'NECESSITY').length}): envolvem inadequação de indicação ou necessidade não atendida. ` : ''
  }${
    findings.filter(f => f.category === 'EFFECTIVENESS').length > 0 ?
    `PRMs de Efetividade (${findings.filter(f => f.category === 'EFFECTIVENESS').length}): envolvem potencial falha terapêutica. ` : ''
  }${
    findings.filter(f => f.category === 'SAFETY').length > 0 ?
    `PRMs de Segurança (${findings.filter(f => f.category === 'SAFETY').length}): envolvem risco de eventos adversos. ` : ''
  }${
    findings.filter(f => f.category === 'ADHERENCE').length > 0 ?
    `PRMs de Adesão (${findings.filter(f => f.category === 'ADHERENCE').length}): envolvem barreiras ao uso correto. ` : ''
  }Análise gerada por ferramenta de apoio — deve ser validada por profissional habilitado.`

  const urgentInterventions = findings.filter(f =>
    f.riskLevel === RiskLevel.URGENT || f.riskLevel === RiskLevel.HIGH
  ).map(f => `• ${f.title}: ${f.pharmacistConduct}`)

  const plan = `Intervenções farmacêuticas propostas (validação profissional obrigatória):\n${
    urgentInterventions.length > 0 ? urgentInterventions.join('\n') : '• Sem intervenções urgentes identificadas.'
  }\n\n${
    findings.some(f => f.needsPrescriberContact) ?
    'Comunicação com prescritor recomendada para os seguintes PRMs: ' +
    findings.filter(f => f.needsPrescriberContact).map(f => f.title).join('; ') + '.\n' : ''
  }${
    findings.some(f => f.needsReferral) ?
    'Encaminhamento recomendado para: ' +
    findings.filter(f => f.needsReferral).map(f => f.title).join('; ') + '.\n' : ''
  }Reavaliação recomendada em ${findings.some(f => f.riskLevel === RiskLevel.URGENT) ? '24-48 horas' : findings.some(f => f.riskLevel === RiskLevel.HIGH) ? '7 dias' : '30 dias'}.`

  return { subjective, objective, assessment, plan }
}

// ─── Data Quality Checks ──────────────────────────────────────────────────────

function checkDataQuality(context: PatientContext): string[] {
  const warnings: string[] = []

  if (!context.age) warnings.push('Idade do paciente não informada — análise de risco etário limitada.')
  if (!context.sex) warnings.push('Sexo biológico não informado — algumas análises de risco podem estar incompletas.')
  if (!context.renalFunction) warnings.push('Função renal não informada — não foi possível avaliar ajuste de dose renal.')
  if (!context.hepaticFunction) warnings.push('Função hepática não informada — não foi possível avaliar ajuste de dose hepático.')
  if (context.diagnoses.length === 0) warnings.push('Nenhum diagnóstico registrado — análise de necessidade terapêutica pode estar incompleta.')
  if (context.medications.some(m => !m.dose)) warnings.push('Dose não informada para um ou mais medicamentos — análise de dosagem não realizada.')
  if (context.medications.some(m => m.adherence === AdherenceLevel.UNKNOWN)) warnings.push('Adesão desconhecida para um ou mais medicamentos — análise de adesão pode estar subestimada.')
  if (context.labResults.length === 0) warnings.push('Nenhum exame laboratorial registrado — monitoramento farmacoterapêutico pode estar limitado.')

  return warnings
}

// ─── Main Analysis Function ───────────────────────────────────────────────────

export function analyzePRM(context: PatientContext): AnalysisResult {
  if (context.medications.length === 0) {
    return {
      findings: [],
      summary: 'Nenhum medicamento registrado para análise. Cadastre os medicamentos do paciente para realizar a análise farmacoterapêutica.',
      totalPRMs: 0,
      urgentPRMs: 0,
      highRiskPRMs: 0,
      moderatePRMs: 0,
      lowRiskPRMs: 0,
      soapSuggestion: { subjective: '', objective: '', assessment: 'Dados insuficientes para análise.', plan: '' },
      dataQualityWarnings: ['Nenhum medicamento registrado.'],
    }
  }

  const necessityFindings = findNecessityPRMs(context)
  const effectivenessFindings = findEffectivenessPRMs(context)
  const safetyFindings = findSafetyPRMs(context)
  const adherenceFindings = findAdherencePRMs(context)

  // De-duplicate (same med + same category)
  const allFindings = [...necessityFindings, ...effectivenessFindings, ...safetyFindings, ...adherenceFindings]

  // Sort by severity
  const sortOrder: Record<RiskLevel, number> = {
    URGENT: 0, HIGH: 1, MODERATE: 2, LOW: 3,
  }
  allFindings.sort((a, b) => sortOrder[a.riskLevel] - sortOrder[b.riskLevel])

  const urgentPRMs = allFindings.filter(f => f.riskLevel === RiskLevel.URGENT).length
  const highRiskPRMs = allFindings.filter(f => f.riskLevel === RiskLevel.HIGH).length
  const moderatePRMs = allFindings.filter(f => f.riskLevel === RiskLevel.MODERATE).length
  const lowRiskPRMs = allFindings.filter(f => f.riskLevel === RiskLevel.LOW).length

  const dataQualityWarnings = checkDataQuality(context)
  const soapSuggestion = generateSOAP(context, allFindings)

  let summary = `Análise farmacoterapêutica concluída. `
  if (allFindings.length === 0) {
    summary += 'Nenhum PRM identificado com as informações disponíveis. Isso não exclui a existência de problemas não detectáveis com os dados informados.'
  } else {
    summary += `Identificados ${allFindings.length} PRM(s): `
    if (urgentPRMs > 0) summary += `${urgentPRMs} urgente(s), `
    if (highRiskPRMs > 0) summary += `${highRiskPRMs} de alto risco, `
    if (moderatePRMs > 0) summary += `${moderatePRMs} moderado(s), `
    if (lowRiskPRMs > 0) summary += `${lowRiskPRMs} de baixo risco. `
    summary = summary.replace(/, $/, '.')
    if (urgentPRMs > 0) summary += ' ATENÇÃO: Há PRMs urgentes que requerem intervenção imediata.'
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
    soapSuggestion,
    dataQualityWarnings,
  }
}

export function getTokenCostForAnalysis(
  medicationCount: number,
  hasLabResults: boolean
): { type: string; cost: number; label: string } {
  if (hasLabResults || medicationCount > 10) {
    return { type: 'advanced', cost: 5, label: 'Análise Avançada (com exames laboratoriais)' }
  }
  if (medicationCount > 3) {
    return { type: 'complete', cost: 3, label: 'Análise Completa (até 10 medicamentos)' }
  }
  return { type: 'basic', cost: 1, label: 'Análise Básica (até 3 medicamentos)' }
}
