import { describe, it, expect } from 'vitest'
import { lookupPgx, pgxForDrugs } from '@/lib/pgx'

describe('Farmacogenômica (CPIC)', () => {
  it('clopidogrel → CYP2C19', () => {
    const r = lookupPgx('clopidogrel')
    expect(r.length).toBeGreaterThanOrEqual(1)
    expect(r[0].gene).toContain('CYP2C19')
  })

  it('codeína e tramadol → CYP2D6', () => {
    expect(lookupPgx('codeina')[0].gene).toBe('CYP2D6')
    expect(lookupPgx('tramadol')[0].gene).toBe('CYP2D6')
  })

  it('varfarina → CYP2C9/VKORC1', () => {
    expect(lookupPgx('varfarina').some(g => g.gene.includes('VKORC1'))).toBe(true)
  })

  it('abacavir → HLA-B*57:01 (contraindicação)', () => {
    const r = lookupPgx('abacavir')
    expect(r[0].gene).toContain('57:01')
    expect(r[0].recommendations.some(x => /contraindicad/i.test(x.action))).toBe(true)
  })

  it('medicamento sem diretriz na base → vazio', () => {
    expect(lookupPgx('paracetamol')).toHaveLength(0)
  })

  it('pgxForDrugs agrega sem duplicar', () => {
    const r = pgxForDrugs(['clopidogrel', 'sinvastatina', 'paracetamol'])
    expect(r.length).toBe(2)
  })
})
