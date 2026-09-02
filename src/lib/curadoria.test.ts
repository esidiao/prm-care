import { describe, it, expect } from 'vitest'
import { avaliarRegra, resumirCuradoria, MESES_ATE_VENCER } from '@/lib/curadoria'
import { inventariarRegras } from '@/lib/prm-engine'

const AGORA = new Date('2026-09-01T12:00:00Z')

function regra(over: Partial<Parameters<typeof avaliarRegra>[0]> = {}) {
  return {
    grupo: 'Interação' as const,
    identificacao: 'varfarina + ibuprofeno',
    ...over,
  }
}

describe('Situação de uma regra', () => {
  it('sem data de revisão é "sem_registro", não "em dia"', () => {
    const r = avaliarRegra(regra(), AGORA)
    expect(r.situacao).toBe('sem_registro')
    expect(r.mesesDesdeRevisao).toBeNull()
  })

  it('data ilegível conta como ausência de registro', () => {
    expect(avaliarRegra(regra({ revisadoEm: 'ontem' }), AGORA).situacao).toBe('sem_registro')
  })

  it('revisada há poucos meses está em dia', () => {
    const r = avaliarRegra(regra({ revisadoEm: '2026-06-01' }), AGORA)
    expect(r.situacao).toBe('em_dia')
    expect(r.mesesDesdeRevisao).toBe(3)
  })

  it('vence exatamente no limite de meses', () => {
    const r = avaliarRegra(regra({ revisadoEm: '2025-09-01' }), AGORA)
    expect(r.mesesDesdeRevisao).toBe(MESES_ATE_VENCER)
    expect(r.situacao).toBe('vencida')
  })

  it('um dia antes do limite ainda está em dia', () => {
    const r = avaliarRegra(regra({ revisadoEm: '2025-09-02' }), AGORA)
    expect(r.situacao).toBe('em_dia')
  })
})

describe('Resumo da curadoria — o retrato honesto de hoje', () => {
  const resumo = resumirCuradoria(AGORA)

  it('inventaria todas as regras do motor', () => {
    expect(resumo.total).toBe(inventariarRegras().length)
    expect(resumo.total).toBeGreaterThan(200)
  })

  it('as partes somam o total', () => {
    expect(resumo.semRegistro + resumo.vencidas + resumo.emDia).toBe(resumo.total)
  })

  // Este teste é o retrato do problema. Quando a curadoria começar, ele muda —
  // e a mudança é justamente o sinal de progresso.
  it('hoje NENHUMA regra tem revisão registrada — cobertura 0%', () => {
    expect(resumo.semRegistro).toBe(resumo.total)
    expect(resumo.coberturaPct).toBe(0)
  })

  it('agrupa por tipo de regra, do maior para o menor', () => {
    expect(resumo.porGrupo.length).toBeGreaterThan(1)
    const totais = resumo.porGrupo.map(g => g.total)
    expect([...totais].sort((a, b) => b - a)).toEqual(totais)
    expect(resumo.porGrupo.reduce((s, g) => s + g.total, 0)).toBe(resumo.total)
  })

  it('a fila de prioridade traz só o que precisa de trabalho', () => {
    expect(resumo.prioridade.every(r => r.situacao !== 'em_dia')).toBe(true)
    expect(resumo.prioridade.length).toBeLessThanOrEqual(50)
  })

  it('sem registro vem antes de vencida na fila', () => {
    const situacoes = resumo.prioridade.map(r => r.situacao)
    const ultimoSemRegistro = situacoes.lastIndexOf('sem_registro')
    const primeiraVencida = situacoes.indexOf('vencida')
    if (ultimoSemRegistro !== -1 && primeiraVencida !== -1) {
      expect(ultimoSemRegistro).toBeLessThan(primeiraVencida)
    }
  })
})

describe('Inventário não vaza conteúdo clínico', () => {
  it('expõe identificação e procedência, não mecanismo nem conduta', () => {
    const amostra = inventariarRegras()[0]
    expect(amostra).toHaveProperty('identificacao')
    expect(amostra).toHaveProperty('grupo')
    expect(amostra).not.toHaveProperty('mechanism')
    expect(amostra).not.toHaveProperty('management')
    expect(amostra).not.toHaveProperty('clinicalEffect')
  })
})
