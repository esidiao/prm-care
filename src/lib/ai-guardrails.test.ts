import { describe, it, expect } from 'vitest'
import { sanitizeAiFindings, dedupeAgainstLocal } from './ai-guardrails'
import type { PatientContext, PRMFindingResult } from '@/types'

// Contexto mínimo: paciente em uso de Losartana e Metformina.
const context = {
  id: 'p1',
  isPregnant: false,
  isLactating: false,
  isElderly: true,
  comorbidities: [],
  allergies: [],
  diagnoses: [{ name: 'Hipertensão', isPrimary: true }],
  labResults: [],
  medications: [
    { id: 'm1', activeIngredient: 'Losartana', route: 'ORAL', isPrescribed: true, isSelfMedication: false, adherence: 'GOOD' },
    { id: 'm2', activeIngredient: 'Metformina', route: 'ORAL', isPrescribed: true, isSelfMedication: false, adherence: 'GOOD' },
  ],
} as unknown as PatientContext

function finding(p: Partial<PRMFindingResult>): PRMFindingResult {
  return {
    category: 'SAFETY',
    riskLevel: 'MODERATE',
    title: 'Achado',
    description: 'Descrição',
    clinicalEvidence: '',
    potentialImpact: '',
    pharmacistConduct: '',
    patientGuidance: '',
    needsReferral: false,
    needsPrescriberContact: false,
    confidenceLevel: 'moderate',
    validationNote: '',
    ...p,
  } as PRMFindingResult
}

describe('sanitizeAiFindings (IA-2 guardrails)', () => {
  it('mantém achado que referencia medicamento do paciente', () => {
    const f = finding({ title: 'Risco com Losartana', description: 'Losartana pode elevar potássio.' })
    const r = sanitizeAiFindings([f], context)
    expect(r.flagged).toBe(0)
    expect(r.findings[0].confidenceLevel).toBe('moderate')
    expect(r.findings[0].title).not.toContain('⚠️')
  })

  it('sinaliza (sem descartar) achado que NÃO referencia medicamentos do paciente', () => {
    const f = finding({ title: 'Risco com Varfarina', description: 'Varfarina exige controle de INR.' })
    const r = sanitizeAiFindings([f], context)
    expect(r.flagged).toBe(1)
    expect(r.findings).toHaveLength(1) // não removido
    expect(r.findings[0].confidenceLevel).toBe('low')
    expect(r.findings[0].title).toContain('⚠️')
    expect(r.findings[0].validationNote).toContain('possível alucinação')
  })

  it('não sinaliza PRM de NECESSIDADE mesmo citando fármaco ausente', () => {
    const f = finding({ category: 'NECESSITY', title: 'Falta estatina', description: 'Considerar atorvastatina.' })
    const r = sanitizeAiFindings([f], context)
    expect(r.flagged).toBe(0)
    expect(r.findings[0].title).not.toContain('⚠️')
  })

  it('remove duplicatas internas pelo título', () => {
    const a = finding({ title: 'Risco com Losartana', description: 'desc a com Losartana' })
    const b = finding({ title: 'Risco com Losartana', description: 'desc b com Losartana' })
    const r = sanitizeAiFindings([a, b], context)
    expect(r.deduped).toBe(1)
    expect(r.findings).toHaveLength(1)
  })

  it('ignora achados sem título/descrição', () => {
    const r = sanitizeAiFindings([finding({ title: '', description: '' })], context)
    expect(r.findings).toHaveLength(0)
  })
})

describe('dedupeAgainstLocal (IA-7)', () => {
  it('remove achado da IA que sobrepõe um achado local', () => {
    const local = [finding({ title: 'Interação Losartana espironolactona hipercalemia' })]
    const ai = [finding({ title: 'Hipercalemia Losartana espironolactona interação' })]
    expect(dedupeAgainstLocal(ai, local)).toHaveLength(0)
  })

  it('mantém achado da IA sem correspondente local', () => {
    const local = [finding({ title: 'Ajuste renal Metformina' })]
    const ai = [finding({ title: 'Cascata prescrição anlodipino edema' })]
    expect(dedupeAgainstLocal(ai, local)).toHaveLength(1)
  })
})
