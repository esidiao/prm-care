import { describe, it, expect } from 'vitest'
import { analyzePRM } from '@/lib/prm-engine'
import type { PatientContext, MedicationContext } from '@/types'

function med(activeIngredient: string, id = activeIngredient): MedicationContext {
  return {
    id,
    tradeName: null,
    activeIngredient,
    dose: null,
    doseUnit: null,
    pharmaceuticalForm: null,
    route: 'ORAL' as MedicationContext['route'],
    frequency: null,
    frequencyHours: null,
    indication: null,
    isPrescribed: true,
    isSelfMedication: false,
    durationOfUse: null,
    adherence: 'GOOD' as MedicationContext['adherence'],
    adverseEffects: null,
  }
}

function medWith(activeIngredient: string, overrides: Partial<MedicationContext>): MedicationContext {
  return { ...med(activeIngredient), ...overrides }
}

function ctx(meds: MedicationContext[]): PatientContext {
  return {
    id: 'p1',
    age: 60,
    sex: null,
    weight: null,
    height: null,
    isPregnant: false,
    gestationalAge: null,
    isLactating: false,
    isElderly: false,
    renalFunction: null,
    creatinineClearance: null,
    hepaticFunction: null,
    comorbidities: [],
    allergies: [],
    diagnoses: [],
    labResults: [],
    medications: meds,
    chiefComplaint: null,
    clinicalHistory: null,
  }
}

/** Há algum finding cujo título contenha todos os termos (case-insensitive)? */
function hasFinding(meds: MedicationContext[], ...terms: string[]): boolean {
  const findings = analyzePRM(ctx(meds)).findings
  return findings.some(f => {
    const t = f.title.toLowerCase()
    return terms.every(term => t.includes(term.toLowerCase()))
  })
}

function diag(name: string): { name: string; icd10Code?: string | null; isPrimary: boolean } {
  return { name, isPrimary: false }
}

function lab(examName: string, value: string): { examName: string; value: string; unit?: string | null; isAbnormal: boolean } {
  return { examName, value, isAbnormal: true }
}

/** Há finding (título+descrição) com todos os termos, dado contexto com exames (e diagnósticos)? */
function hasFindingLab(
  meds: MedicationContext[],
  labResults: { examName: string; value: string; unit?: string | null; isAbnormal: boolean }[],
  diagnoses: { name: string; icd10Code?: string | null; isPrimary: boolean }[],
  ...terms: string[]
): boolean {
  const findings = analyzePRM({ ...ctx(meds), labResults, diagnoses }).findings
  return findings.some(f => {
    const t = `${f.title} ${f.description}`.toLowerCase()
    return terms.every(term => t.includes(term.toLowerCase()))
  })
}

/** Há finding (título+descrição) com todos os termos, dado um contexto com diagnósticos? */
function hasFindingDx(
  meds: MedicationContext[],
  diagnoses: { name: string; icd10Code?: string | null; isPrimary: boolean }[],
  ...terms: string[]
): boolean {
  const findings = analyzePRM({ ...ctx(meds), diagnoses }).findings
  return findings.some(f => {
    const t = `${f.title} ${f.description}`.toLowerCase()
    return terms.every(term => t.includes(term.toLowerCase()))
  })
}

describe('Interações classe×classe', () => {
  it('detecta opioide + benzodiazepínico (membros não enumerados)', () => {
    // oxicodona + lorazepam: nenhum par específico em KNOWN_INTERACTIONS
    expect(hasFinding([med('oxicodona'), med('lorazepam')], 'oxicodona', 'lorazepam')).toBe(true)
  })

  it('detecta opioide + hipnótico Z', () => {
    expect(hasFinding([med('fentanila'), med('zolpidem')], 'fentanila', 'zolpidem')).toBe(true)
  })

  it('detecta nitrato + inibidor de PDE5 como interação', () => {
    expect(hasFinding([med('mononitrato de isossorbida'), med('vardenafila')], 'isossorbida', 'vardenafila')).toBe(true)
  })

  it('detecta duplo bloqueio IECA + BRA', () => {
    expect(hasFinding([med('ramipril'), med('valsartana')], 'ramipril', 'valsartana')).toBe(true)
  })

  it('detecta benzodiazepínico + hipnótico Z', () => {
    expect(hasFinding([med('clonazepam'), med('zopiclona')], 'clonazepam', 'zopiclona')).toBe(true)
  })

  it('detecta "triple whammy" (AINE + IECA/BRA + diurético)', () => {
    expect(hasFinding([med('ibuprofeno'), med('enalapril'), med('hidroclorotiazida')], 'triple whammy')).toBe(true)
    // variação com BRA + diurético de alça
    expect(hasFinding([med('naproxeno'), med('losartana'), med('furosemida')], 'triple whammy')).toBe(true)
  })

  it('não dispara triple whammy faltando uma das 3 classes', () => {
    expect(hasFinding([med('ibuprofeno'), med('enalapril')], 'triple whammy')).toBe(false)
    expect(hasFinding([med('enalapril'), med('hidroclorotiazida')], 'triple whammy')).toBe(false)
  })

  it('detecta cascata BCC di-hidropiridínico → edema → diurético', () => {
    expect(hasFinding([med('amlodipina'), med('furosemida')], 'cascata', 'furosemida', 'amlodipina')).toBe(true)
  })

  it('detecta cascata antipsicótico → EPS → antiparkinsoniano', () => {
    expect(hasFinding([med('haloperidol'), med('biperideno')], 'cascata', 'biperideno', 'haloperidol')).toBe(true)
  })

  it('detecta cascata tiazídico → gota → alopurinol', () => {
    expect(hasFinding([med('hidroclorotiazida'), med('alopurinol')], 'cascata', 'alopurinol')).toBe(true)
  })

  it('detecta cascata IECA → tosse → antitussígeno', () => {
    expect(hasFinding([med('enalapril'), med('dextrometorfano')], 'cascata', 'dextrometorfano')).toBe(true)
  })

  it('não dispara cascata sem o gatilho correspondente', () => {
    expect(hasFinding([med('furosemida'), med('losartana')], 'cascata')).toBe(false)
  })

  it('START iSGLT2: dispara em DM2 + DCV sem iSGLT2', () => {
    expect(hasFindingDx([med('metformina')], [diag('diabetes tipo 2'), diag('doenca coronariana')], 'isglt2')).toBe(true)
  })

  it('START iSGLT2: NÃO dispara em IC isolada sem diabetes (gating composto)', () => {
    expect(hasFindingDx([med('carvedilol')], [diag('insuficiencia cardiaca')], 'isglt2')).toBe(false)
  })

  it('START GLP-1: dispara em DM2 + obesidade sem GLP-1', () => {
    expect(hasFindingDx([med('metformina')], [diag('diabetes tipo 2'), diag('obesidade')], 'glp-1')).toBe(true)
  })

  it('START GLP-1: NÃO dispara em DM2 isolado sem comorbidade', () => {
    expect(hasFindingDx([med('insulina')], [diag('diabetes tipo 2')], 'glp-1')).toBe(false)
  })

  it('lab: HbA1c elevada → controle glicêmico inadequado', () => {
    expect(hasFindingLab([med('metformina')], [lab('HbA1c', '9,2%')], [diag('diabetes tipo 2')], 'hba1c')).toBe(true)
  })

  it('lab: HbA1c na meta não dispara', () => {
    expect(hasFindingLab([med('metformina')], [lab('HbA1c', '6,4%')], [diag('diabetes tipo 2')], 'hba1c acima')).toBe(false)
  })

  it('lab: hipercalemia grave (K+ 6,3) com IECA → URGENTE', () => {
    expect(hasFindingLab([med('enalapril')], [lab('Potássio', '6,3 mEq/L')], [], 'urgente', 'hipercalemia')).toBe(true)
  })

  it('lab: INR supraterapêutico em varfarina', () => {
    expect(hasFindingLab([med('varfarina')], [lab('INR', '5.2')], [], 'inr supraterap')).toBe(true)
  })

  it('lab: INR subterapêutico em varfarina', () => {
    expect(hasFindingLab([med('varfarina')], [lab('INR', '1.4')], [], 'inr subterap')).toBe(true)
  })

  it('lab: INR alterado sem varfarina NÃO dispara', () => {
    expect(hasFindingLab([med('paracetamol')], [lab('INR', '5.2')], [], 'inr')).toBe(false)
  })

  it('lab: hiponatremia grave (Na 122) com ISRS', () => {
    expect(hasFindingLab([med('sertralina')], [lab('Sódio', '122')], [], 'hiponatremia')).toBe(true)
  })

  it('lab: LDL alto em diabético sem estatina', () => {
    expect(hasFindingLab([med('metformina')], [lab('LDL', '160')], [diag('diabetes tipo 2')], 'ldl elevado')).toBe(true)
  })

  it('lab: LDL alto com estatina em uso NÃO dispara', () => {
    expect(hasFindingLab([med('atorvastatina')], [lab('LDL', '160')], [diag('diabetes tipo 2')], 'ldl elevado')).toBe(false)
  })

  it('lab: TSH elevado em levotiroxina → reposição insuficiente', () => {
    expect(hasFindingLab([med('levotiroxina')], [lab('TSH', '12')], [], 'tsh elevado')).toBe(true)
  })

  it('lab: TSH suprimido em levotiroxina → superdosagem', () => {
    expect(hasFindingLab([med('levotiroxina')], [lab('TSH', '0.1')], [], 'tsh suprimido')).toBe(true)
  })

  it('lab: TSH alterado sem levotiroxina NÃO dispara', () => {
    expect(hasFindingLab([med('paracetamol')], [lab('TSH', '12')], [], 'tsh')).toBe(false)
  })

  it('lab: metformina com TFG < 30 → contraindicada', () => {
    expect(hasFindingLab([med('metformina')], [lab('TFG', '22')], [], 'metformina', 'contraindicada')).toBe(true)
  })

  it('lab: AINE com função renal reduzida', () => {
    expect(hasFindingLab([med('ibuprofeno')], [lab('TFGe', '40')], [], 'aine', 'renal reduzida')).toBe(true)
  })

  it('lab: transaminases elevadas com estatina', () => {
    expect(hasFindingLab([med('atorvastatina')], [lab('ALT', '180')], [], 'transaminases elevadas')).toBe(true)
  })

  it('lab: transaminases elevadas sem fármaco hepatotóxico NÃO dispara', () => {
    expect(hasFindingLab([med('losartana')], [lab('ALT', '180')], [], 'transaminases elevadas')).toBe(false)
  })

  it('START gastroproteção: dispara com AINE + gastrite sem IBP', () => {
    expect(hasFindingDx([med('ibuprofeno')], [diag('gastrite')], 'aine com fatores de risco gi')).toBe(true)
  })

  it('START gastroproteção: NÃO dispara em gastrite isolada sem AINE em uso', () => {
    expect(hasFindingDx([med('losartana')], [diag('gastrite')], 'aine com fatores de risco gi')).toBe(false)
  })

  it('adesão: baixa adesão gera PRM de efetividade', () => {
    expect(hasFinding([medWith('losartana', { adherence: 'POOR' as MedicationContext['adherence'] })], 'baixa', 'losartana')).toBe(true)
  })

  it('adesão: barreira financeira relatada gera PRM', () => {
    expect(hasFinding([medWith('rivaroxabana', { adverseEffects: 'medicamento muito caro, não consigo comprar' })], 'barreira financeira')).toBe(true)
  })

  it('adesão: dificuldade com forma farmacêutica gera PRM', () => {
    expect(hasFinding([medWith('amoxicilina', { adverseEffects: 'tenho dificuldade para engolir o comprimido' })], 'dificuldade com forma')).toBe(true)
  })

  it('lab+idade: HbA1c baixa em idoso com sulfonilureia → supertratamento', () => {
    const c = { ...ctx([med('glibenclamida')]), isElderly: true, age: 78, labResults: [lab('HbA1c', '6,1%')] }
    const ok = analyzePRM(c).findings.some(f => /excessivo no idoso/i.test(f.title))
    expect(ok).toBe(true)
  })

  it('lab+idade: HbA1c baixa em adulto jovem NÃO dispara supertratamento', () => {
    const c = { ...ctx([med('glibenclamida')]), isElderly: false, age: 40, labResults: [lab('HbA1c', '6,1%')] }
    const ok = analyzePRM(c).findings.some(f => /excessivo no idoso/i.test(f.title))
    expect(ok).toBe(false)
  })

  it('cascata ISRS → disfunção sexual → PDE5', () => {
    expect(hasFinding([med('sertralina'), med('tadalafila')], 'cascata', 'tadalafila', 'sertralina')).toBe(true)
  })

  it('lab: dabigatrana com TFG < 30 → URGENTE', () => {
    expect(hasFindingLab([med('dabigatrana')], [lab('TFG', '25')], [], 'doac', 'dabigatrana')).toBe(true)
  })

  it('lab: rivaroxabana com TFG < 30 dispara', () => {
    expect(hasFindingLab([med('rivaroxabana')], [lab('TFGe', '28')], [], 'doac', 'rivaroxabana')).toBe(true)
  })

  it('lab: DOAC com TFG normal NÃO dispara', () => {
    expect(hasFindingLab([med('apixabana')], [lab('TFG', '75')], [], 'doac')).toBe(false)
  })

  it('lab: digoxinemia tóxica em uso de digoxina', () => {
    expect(hasFindingLab([med('digoxina')], [lab('Digoxina', '2.6')], [], 'digoxina', 'ng/ml')).toBe(true)
  })

  it('lab: digoxinemia tóxica sem digoxina em uso NÃO dispara', () => {
    expect(hasFindingLab([med('losartana')], [lab('Digoxina', '2.6')], [], 'digoxina')).toBe(false)
  })

  it('não dispara interação para combinação inócua', () => {
    expect(hasFinding([med('paracetamol'), med('loratadina')], 'paracetamol', 'loratadina')).toBe(false)
  })

  it('não duplica par coberto por nome E por classe (morfina + diazepam)', () => {
    // morfina+diazepam existe em KNOWN_INTERACTIONS e também na classe Opioide×Benzo:
    // o dedup deve garantir uma única interação para esse par.
    const findings = analyzePRM(ctx([med('morfina'), med('diazepam')])).findings
    const interações = findings.filter(
      f => /intera/i.test(f.title) && /morfina/i.test(f.title) && /diazepam/i.test(f.title),
    )
    expect(interações.length).toBe(1)
  })
})
