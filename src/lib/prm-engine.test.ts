import { describe, it, expect } from 'vitest'
import { analyzePRM, checkInteractions } from '@/lib/prm-engine'
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

  it('STOPP: antimuscarínico em HPB/retenção urinária (idoso)', () => {
    const c = { ...ctx([med('oxibutinina')]), isElderly: true, age: 75, diagnoses: [diag('hiperplasia prostatica')] }
    const ok = analyzePRM(c).findings.some(f => /stopp/i.test(f.title) && /oxibutinina/i.test(f.title))
    expect(ok).toBe(true)
  })

  it('STOPP: anticolinérgico em glaucoma de ângulo fechado (idoso)', () => {
    const c = { ...ctx([med('amitriptilina')]), isElderly: true, age: 75, diagnoses: [diag('glaucoma de angulo fechado')] }
    const ok = analyzePRM(c).findings.some(f => /stopp/i.test(f.title) && /amitriptilina/i.test(f.title))
    expect(ok).toBe(true)
  })

  it('STOPP HPB: NÃO dispara sem o anticolinérgico', () => {
    const c = { ...ctx([med('losartana')]), isElderly: true, age: 75, diagnoses: [diag('hiperplasia prostatica')] }
    const ok = analyzePRM(c).findings.some(f => /stopp/i.test(f.title) && /retencao urinaria|hiperplasia/i.test(f.title))
    expect(ok).toBe(false)
  })

  it('detecta betabloqueador + BCC não-diidropiridínico (verapamil)', () => {
    expect(hasFinding([med('atenolol'), med('verapamil')], 'atenolol', 'verapamil')).toBe(true)
  })

  it('NÃO dispara betabloqueador + di-hidropiridínico (amlodipina é segura)', () => {
    const findings = analyzePRM(ctx([med('atenolol'), med('amlodipina')])).findings
    const bradi = findings.some(f => /intera/i.test(f.title) && /atenolol/i.test(f.title) && /amlodipina/i.test(f.title))
    expect(bradi).toBe(false)
  })

  it('detecta suplemento de potássio + IECA (retenção de K+)', () => {
    expect(hasFinding([med('cloreto de potassio'), med('enalapril')], 'cloreto de potassio', 'enalapril')).toBe(true)
  })

  it('detecta suplemento de potássio + espironolactona', () => {
    expect(hasFinding([med('cloreto de potassio'), med('espironolactona')], 'cloreto de potassio', 'espironolactona')).toBe(true)
  })

  it('NÃO dispara suplemento de potássio sem fármaco que retém K+', () => {
    expect(hasFinding([med('cloreto de potassio'), med('furosemida')], 'suplemento de potassio com')).toBe(false)
  })

  it('detecta AINE + anticoagulante oral (DOAC) — sangramento', () => {
    expect(hasFinding([med('diclofenaco'), med('rivaroxabana')], 'diclofenaco', 'rivaroxabana')).toBe(true)
  })

  it('detecta AINE + antiagregante', () => {
    expect(hasFinding([med('naproxeno'), med('clopidogrel')], 'naproxeno', 'clopidogrel')).toBe(true)
  })

  it('detecta anticoagulante oral + antiagregante (terapia combinada)', () => {
    expect(hasFinding([med('apixabana'), med('clopidogrel')], 'apixabana', 'clopidogrel')).toBe(true)
  })

  it('lab: hipocalemia + digoxina → toxicidade digitálica', () => {
    expect(hasFindingLab([med('digoxina')], [lab('Potássio', '3.1')], [], 'hipocalemia', 'digoxina')).toBe(true)
  })

  it('lab: hipocalemia + diurético espoliador (furosemida)', () => {
    expect(hasFindingLab([med('furosemida')], [lab('Potássio', '2.9')], [], 'hipocalemia')).toBe(true)
  })

  it('lab: hipocalemia isolada sem fármaco de risco NÃO dispara', () => {
    expect(hasFindingLab([med('paracetamol')], [lab('Potássio', '3.1')], [], 'hipocalemia')).toBe(false)
  })

  it('detecta indutor + anticoncepcional → falha contraceptiva (rifampicina)', () => {
    expect(hasFinding([med('rifampicina'), med('etinilestradiol')], 'rifampicina', 'etinilestradiol')).toBe(true)
  })

  it('detecta carbamazepina + anticoncepcional', () => {
    expect(hasFinding([med('carbamazepina'), med('etinilestradiol')], 'carbamazepina', 'etinilestradiol')).toBe(true)
  })

  it('detecta erva-de-são-joão + varfarina', () => {
    expect(hasFinding([med('hiperico'), med('varfarina')], 'hiperico', 'varfarina')).toBe(true)
  })

  it('detecta metotrexato + sulfametoxazol (pancitopenia)', () => {
    expect(hasFinding([med('metotrexato'), med('sulfametoxazol')], 'metotrexato', 'sulfametoxazol')).toBe(true)
  })

  it('detecta metotrexato + naproxeno (AINE)', () => {
    expect(hasFinding([med('metotrexato'), med('naproxeno')], 'metotrexato', 'naproxeno')).toBe(true)
  })

  it('detecta DOAC + inibidor CYP3A4/P-gp (rivaroxabana + itraconazol)', () => {
    expect(hasFinding([med('rivaroxabana'), med('itraconazol')], 'rivaroxabana', 'itraconazol')).toBe(true)
  })

  it('detecta estatina + genfibrozila (rabdomiólise)', () => {
    expect(hasFinding([med('sinvastatina'), med('genfibrozila')], 'sinvastatina', 'genfibrozila')).toBe(true)
  })

  it('detecta quelação ciprofloxacino + sulfato ferroso', () => {
    expect(hasFinding([med('ciprofloxacino'), med('sulfato ferroso')], 'ciprofloxacino', 'ferroso')).toBe(true)
  })

  it('detecta bifosfonato + cálcio (absorção)', () => {
    expect(hasFinding([med('alendronato'), med('carbonato de calcio')], 'alendronato', 'calcio')).toBe(true)
  })

  it('dedup: par com entradas duplicadas gera UMA interação, na maior severidade', () => {
    // clopidogrel+omeprazol tinha 2 entradas (major e moderate) em KNOWN_INTERACTIONS
    const findings = analyzePRM(ctx([med('clopidogrel'), med('omeprazol')])).findings
    const interacoes = findings.filter(f => /intera/i.test(f.title) && /clopidogrel/i.test(f.title) && /omeprazol/i.test(f.title))
    expect(interacoes.length).toBe(1)
    expect(interacoes[0].riskLevel).toBe('HIGH') // major → HIGH (não rebaixa para moderate)
  })

  it('não dispara interação para combinação inócua', () => {
    expect(hasFinding([med('paracetamol'), med('loratadina')], 'paracetamol', 'loratadina')).toBe(false)
  })

  // ── Dose/duração-aware (#5) ──
  it('paracetamol acima do limite diário (1000mg 4/4h = 6000)', () => {
    const c = ctx([medWith('paracetamol', { dose: 1000, doseUnit: 'mg', frequencyHours: 4 })])
    expect(analyzePRM(c).findings.some(f => /paracetamol acima do limite/i.test(f.title))).toBe(true)
  })

  it('paracetamol em dose normal (750mg 8/8h = 2250) NÃO dispara', () => {
    const c = ctx([medWith('paracetamol', { dose: 750, doseUnit: 'mg', frequencyHours: 8 })])
    expect(analyzePRM(c).findings.some(f => /paracetamol acima do limite/i.test(f.title))).toBe(false)
  })

  it('AINE de uso crônico dispara', () => {
    const c = ctx([medWith('ibuprofeno', { dose: 600, frequencyHours: 8, durationOfUse: '6 meses' })])
    expect(analyzePRM(c).findings.some(f => /aine/i.test(f.title) && /ibuprofeno/i.test(f.title))).toBe(true)
  })

  it('benzodiazepínico > 4 semanas dispara', () => {
    const c = ctx([medWith('clonazepam', { dose: 2, frequency: '1x/dia', durationOfUse: '8 meses' })])
    expect(analyzePRM(c).findings.some(f => /uso prolongado/i.test(f.title) && /clonazepam/i.test(f.title))).toBe(true)
  })

  it('corticoide sistêmico crônico dispara proteção óssea', () => {
    const c = ctx([medWith('prednisona', { dose: 20, frequency: '1x/dia', durationOfUse: '6 meses' })])
    expect(analyzePRM(c).findings.some(f => /corticoide/i.test(f.title) && /prednisona/i.test(f.title))).toBe(true)
  })

  // ── Módulo de consulta de interações (checkInteractions) ──
  it('checkInteractions: detecta par grave e calcula risco global', () => {
    const r = checkInteractions(['varfarina', 'ibuprofeno'])
    expect(r.interactions.length).toBeGreaterThanOrEqual(1)
    expect(r.globalRisk).toBe('major')
    expect(r.globalLabel).toBe('Grave')
  })

  it('checkInteractions: ordena por severidade e usa a maior como risco global', () => {
    const r = checkInteractions(['isossorbida', 'sildenafila', 'paracetamol'])
    expect(r.globalRisk).toBe('contraindicated')
    expect(r.interactions[0].severity).toBe('contraindicated') // contraindicada vem primeiro
  })

  it('checkInteractions: par inócuo retorna vazio e sem risco', () => {
    const r = checkInteractions(['paracetamol', 'loratadina'])
    expect(r.interactions).toHaveLength(0)
    expect(r.globalRisk).toBeNull()
  })

  it('checkInteractions: contexto idoso adiciona flag em par sedativo', () => {
    const semCtx = checkInteractions(['morfina', 'diazepam'])
    expect(semCtx.interactions[0].contextFlags).toHaveLength(0)
    const idoso = checkInteractions(['morfina', 'diazepam'], { age: 78 })
    expect(idoso.interactions[0].contextFlags.some(f => /idoso/i.test(f))).toBe(true)
  })

  it('checkInteractions: TFG baixa adiciona flag renal', () => {
    const r = checkInteractions(['enalapril', 'espironolactona'], { tfg: 25 })
    expect(r.interactions[0].contextFlags.some(f => /renal/i.test(f))).toBe(true)
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
