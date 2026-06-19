import { describe, it, expect } from 'vitest'
import { analyzeLabTrends, type LabPoint } from '@/lib/lab-trends'

const lab = (examName: string, value: string, daysAgo: number): LabPoint => ({
  examName, value, collectedAt: new Date(Date.now() - daysAgo * 86400000).toISOString(),
})

describe('Monitoramento temporal de exames', () => {
  it('detecta piora de creatinina (subida)', () => {
    const t = analyzeLabTrends([lab('Creatinina', '1.0', 30), lab('Creatinina', '1.6', 1)])
    expect(t.find(x => x.analyte === 'Creatinina')?.direction).toBe('up')
  })

  it('detecta queda de TFG cruzando 60', () => {
    const t = analyzeLabTrends([lab('TFG', '72', 60), lab('TFGe', '45', 2)])
    expect(t.some(x => x.analyte === 'TFG/Clearance' && x.direction === 'down')).toBe(true)
  })

  it('detecta hipercalemia emergente', () => {
    const t = analyzeLabTrends([lab('Potássio', '4.6', 20), lab('Potássio', '5.6', 1)])
    const k = t.find(x => x.analyte === 'Potássio')
    expect(k?.direction).toBe('up'); expect(k?.severity).toBe('warning')
  })

  it('INR fora da faixa (subida) é sinalizado', () => {
    const t = analyzeLabTrends([lab('INR', '2.4', 14), lab('INR', '5.2', 1)])
    expect(t.find(x => x.analyte === 'INR')?.severity).toBe('high')
  })

  it('valores estáveis NÃO geram tendência', () => {
    const t = analyzeLabTrends([lab('Creatinina', '1.0', 30), lab('Creatinina', '1.05', 1)])
    expect(t).toHaveLength(0)
  })

  it('uma única medida não gera tendência', () => {
    expect(analyzeLabTrends([lab('Potássio', '5.8', 1)])).toHaveLength(0)
  })
})
