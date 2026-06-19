import { describe, it, expect } from 'vitest'
import { canonicalizeDrug } from '@/lib/drug-aliases'
import { checkInteractions } from '@/lib/prm-engine'

describe('Normalização/alias de fármacos', () => {
  it('inglês → PT', () => {
    expect(canonicalizeDrug('Warfarin')).toBe('varfarina')
    expect(canonicalizeDrug('acetaminophen')).toBe('paracetamol')
  })

  it('abreviações e sinônimos', () => {
    expect(canonicalizeDrug('AAS')).toBe('acido acetilsalicilico')
    expect(canonicalizeDrug('aspirina')).toBe('acido acetilsalicilico')
    expect(canonicalizeDrug('Bactrim')).toBe('sulfametoxazol')
  })

  it('nome comercial BR → princípio ativo', () => {
    expect(canonicalizeDrug('Marevan')).toBe('varfarina')
    expect(canonicalizeDrug('Xarelto')).toBe('rivaroxabana')
  })

  it('remove forma salina', () => {
    expect(canonicalizeDrug('Losartana potássica')).toBe('losartana')
  })

  it('marcas BR ampliadas → princípio ativo', () => {
    expect(canonicalizeDrug('Rivotril')).toBe('clonazepam')
    expect(canonicalizeDrug('Voltaren')).toBe('diclofenaco')
    expect(canonicalizeDrug('Ozempic')).toBe('semaglutida')
    expect(canonicalizeDrug('Renitec')).toBe('enalapril')
  })

  it('checkInteractions casa par mesmo com nomes em inglês/comercial', () => {
    // "Coumadin" (varfarina) + "aspirin/AAS" → deve detectar a interação
    const r = checkInteractions(['Marevan', 'AAS'])
    expect(r.interactions.length).toBeGreaterThanOrEqual(1)
  })
})
