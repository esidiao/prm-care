import { describe, it, expect } from 'vitest'
import {
  extrairDose, extrairQuantidade, tornarComparavel, encontrarAlternativa,
  menorPrecoPorDose, ehAssociacao, composicaoCompativel, type ApresentacaoComparavel,
} from '@/lib/preco-referencia'

function apr(over: Partial<ApresentacaoComparavel> = {}): ApresentacaoComparavel {
  return {
    ggrem: 'g1',
    produto: 'SINVASTATINA',
    apresentacao: '20 MG COM REV CT BL AL PLAS TRANS X 30',
    laboratorio: 'LAB A',
    tipoProduto: 'Genérico',
    pmcSemImpostosCents: 1558,
    ...over,
  }
}

describe('Extração de dose e quantidade', () => {
  it('extrai a dose do início da apresentação', () => {
    expect(extrairDose('20 MG COM REV CT BL AL PLAS TRANS X 30')).toBe('20 MG')
    expect(extrairDose('0,5 MG COM CT BL X 20')).toBe('0.5 MG')
    expect(extrairDose('500 MCG SOL INJ X 5')).toBe('500 MCG')
  })

  it('devolve null quando não há dose reconhecível', () => {
    expect(extrairDose('SOL OR FR PLAS OPC X 500ML (SABOR UVA)')).toBeNull()
    expect(extrairDose(null)).toBeNull()
  })

  it('pega o ÚLTIMO "X n" — a quantidade da embalagem', () => {
    expect(extrairQuantidade('20 MG COM REV CT BL AL PLAS TRANS X 30')).toBe(30)
    // "CT 50 BG" no meio não é a quantidade; a da embalagem é a final
    expect(extrairQuantidade('1,2 U/G POM DERM CT 50 BG AL X 30 G')).toBe(30)
  })

  it('devolve null quando não há quantidade', () => {
    expect(extrairQuantidade('SOL OR FR PLAS OPC X 500ML')).toBeNull()
  })
})

describe('Comparabilidade — o que se recusa a comparar', () => {
  it('descarta apresentação sem preço', () => {
    expect(tornarComparavel(apr({ pmcSemImpostosCents: null }))).toBeNull()
  })
  it('descarta apresentação sem dose extraível', () => {
    expect(tornarComparavel(apr({ apresentacao: 'SOL OR FR PLAS X 500ML' }))).toBeNull()
  })
  it('calcula centavos por unidade, não por caixa', () => {
    const c = tornarComparavel(apr({ pmcSemImpostosCents: 1558, apresentacao: '20 MG COM X 30' }))
    expect(c?.centsPorUnidade).toBeCloseTo(1558 / 30, 4)
  })
})

describe('Alternativa mais barata — a regra que impede o dano', () => {
  // O caso real da CMED que motivou a regra
  it('NÃO recomenda caixa menor que é mais cara por comprimido', () => {
    const emUso = apr({ ggrem: 'a', pmcSemImpostosCents: 1558, apresentacao: '20 MG COM X 30' })
    const caixaPequena = apr({ ggrem: 'b', pmcSemImpostosCents: 3002, apresentacao: '20 MG COM X 10' })
    expect(encontrarAlternativa(emUso, [caixaPequena])).toBeNull()
  })

  it('reconhece a embalagem grande como mais barata por unidade', () => {
    const emUso = apr({ ggrem: 'a', pmcSemImpostosCents: 3002, apresentacao: '20 MG COM X 10' })
    const grande = apr({ ggrem: 'b', pmcSemImpostosCents: 1558, apresentacao: '20 MG COM X 30' })
    const r = encontrarAlternativa(emUso, [grande])
    expect(r).not.toBeNull()
    expect(r!.maisBarata.ggrem).toBe('b')
  })

  it('NUNCA compara doses diferentes', () => {
    const emUso = apr({ ggrem: 'a', pmcSemImpostosCents: 3088, apresentacao: '40 MG COM X 30' })
    const outraDose = apr({ ggrem: 'b', pmcSemImpostosCents: 1558, apresentacao: '20 MG COM X 30' })
    expect(encontrarAlternativa(emUso, [outraDose])).toBeNull()
  })

  it('ignora diferença marginal — não vale sugerir troca ao prescritor', () => {
    const emUso = apr({ ggrem: 'a', pmcSemImpostosCents: 1576, apresentacao: '20 MG COM X 30' })
    const quaseIgual = apr({ ggrem: 'b', pmcSemImpostosCents: 1558, apresentacao: '20 MG COM X 30' })
    expect(encontrarAlternativa(emUso, [quaseIgual])).toBeNull()  // ~1%
  })

  it('não compara a apresentação com ela mesma', () => {
    const emUso = apr({ ggrem: 'a' })
    expect(encontrarAlternativa(emUso, [apr({ ggrem: 'a' })])).toBeNull()
  })

  it('devolve economia por unidade e percentual quando o ganho é real', () => {
    const emUso = apr({ ggrem: 'a', pmcSemImpostosCents: 3000, apresentacao: '20 MG COM X 30' })
    const barata = apr({ ggrem: 'b', pmcSemImpostosCents: 1500, apresentacao: '20 MG COM X 30' })
    const r = encontrarAlternativa(emUso, [barata])!
    expect(r.reducaoPct).toBeCloseTo(50, 1)
    expect(r.economiaPorUnidadeCents).toBeCloseTo(50, 4)
    expect(r.dose).toBe('20 MG')
  })

  it('sem candidata comparável, não inventa oportunidade', () => {
    const emUso = apr({ ggrem: 'a' })
    const semDose = apr({ ggrem: 'b', apresentacao: 'SOL OR FR X 500ML' })
    expect(encontrarAlternativa(emUso, [semDose])).toBeNull()
  })
})

describe('Menor preço por dose', () => {
  it('agrupa por dose e guarda o mais barato por unidade de cada', () => {
    const m = menorPrecoPorDose([
      apr({ ggrem: 'a', pmcSemImpostosCents: 1558, apresentacao: '20 MG COM X 30' }),
      apr({ ggrem: 'b', pmcSemImpostosCents: 3002, apresentacao: '20 MG COM X 10' }),
      apr({ ggrem: 'c', pmcSemImpostosCents: 3088, apresentacao: '40 MG COM X 30' }),
    ])
    expect(m.size).toBe(2)
    expect(m.get('20 MG')!.ggrem).toBe('a')
    expect(m.get('40 MG')!.ggrem).toBe('c')
  })
})

describe('Monofármaco não se compara com associação', () => {
  it('reconhece associação por ";" e por "+"', () => {
    expect(ehAssociacao('EZETIMIBA;SINVASTATINA')).toBe(true)
    expect(ehAssociacao('LOSARTANA POTASSICA + HIDROCLOROTIAZIDA')).toBe(true)
    expect(ehAssociacao('SINVASTATINA')).toBe(false)
    expect(ehAssociacao(null)).toBe(false)
  })

  // O caso real: buscar "omeprazol" trazia OMEPRAMIX, kit para H. pylori com
  // amoxicilina e claritromicina, a R$ 186,85/unidade
  it('recusa comparar omeprazol com o kit de erradicação', () => {
    expect(composicaoCompativel('omeprazol', 'omeprazol;amoxicilina;claritromicina')).toBe(false)
  })

  it('recusa comparar losartana com losartana + hidroclorotiazida', () => {
    expect(composicaoCompativel('losartana', 'losartana potassica + hidroclorotiazida')).toBe(false)
  })

  it('aceita comparar dois monofármacos', () => {
    expect(composicaoCompativel('sinvastatina', 'sinvastatina')).toBe(true)
  })

  it('aceita comparar duas associações entre si', () => {
    expect(composicaoCompativel('ezetimiba;sinvastatina', 'ezetimiba;sinvastatina')).toBe(true)
  })
})
