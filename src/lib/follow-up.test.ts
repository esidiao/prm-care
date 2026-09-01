import { describe, it, expect } from 'vitest'
import { montarEmail, type ResumoFarmaceutico, type ItemResumo } from '@/lib/follow-up'

function item(over: Partial<ItemResumo> = {}): ItemResumo {
  return {
    tipo: 'revisao_vencida',
    titulo: 'Revisão de farmacoterapia',
    codigoPaciente: 'PT-0042',
    detalhe: 'vencida há 3 dias',
    href: '/patients/abc',
    ...over,
  }
}

function resumo(itens: ItemResumo[], nome: string | null = 'Ana Paula Souza'): ResumoFarmaceutico {
  return { userId: 'u1', nome, email: 'ana@example.com', itens }
}

const BASE = 'https://prm-care-pi.vercel.app'

describe('Resumo de acompanhamento — e-mail', () => {
  it('o assunto traz a contagem e concorda em número', () => {
    expect(montarEmail(resumo([item()]), BASE).assunto).toContain('1 pendência')
    expect(montarEmail(resumo([item(), item()]), BASE).assunto).toContain('2 pendências')
  })

  it('trata o farmacêutico pelo primeiro nome', () => {
    expect(montarEmail(resumo([item()]), BASE).html).toContain('Olá, Ana')
  })

  it('sem nome cadastrado, não quebra nem escreve "null"', () => {
    const html = montarEmail(resumo([item()], null), BASE).html
    expect(html).toContain('Farmacêutico(a)')
    expect(html).not.toContain('null')
  })

  // ── Privacidade: a regra mais fácil de reverter sem perceber ──────────────
  it('identifica o paciente por CÓDIGO', () => {
    const { html, texto } = montarEmail(resumo([item({ codigoPaciente: 'PT-0042' })]), BASE)
    expect(html).toContain('PT-0042')
    expect(texto).toContain('PT-0042')
  })

  it('escapa conteúdo que vem do banco (título de revisão é texto livre)', () => {
    const html = montarEmail(resumo([item({ titulo: '<img src=x onerror=alert(1)>' })]), BASE).html
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img')
  })

  it('declara ao leitor que não há dado clínico no e-mail', () => {
    expect(montarEmail(resumo([item()]), BASE).html).toMatch(/identificados por código/i)
  })

  // ── Agrupamento e ordem ───────────────────────────────────────────────────
  it('achado grave vem antes de revisão vencida', () => {
    const { html } = montarEmail(resumo([
      item({ tipo: 'revisao_vencida', titulo: 'REV' }),
      item({ tipo: 'achado_grave', titulo: 'ACH' }),
    ]), BASE)
    expect(html.indexOf('ACH')).toBeLessThan(html.indexOf('REV'))
  })

  it('só rende seção de grupo que tem item', () => {
    const { html } = montarEmail(resumo([item({ tipo: 'achado_grave' })]), BASE)
    expect(html).toContain('Achados graves')
    expect(html).not.toContain('Revisões de hoje')
  })

  it('acima de 15 itens, corta e diz quantos sobraram', () => {
    const muitos = Array.from({ length: 20 }, (_, i) => item({ codigoPaciente: `PT-${i}` }))
    const { html } = montarEmail(resumo(muitos), BASE)
    expect(html).toContain('e mais 5')
  })

  it('a versão texto acompanha a HTML', () => {
    const { texto } = montarEmail(resumo([item({ codigoPaciente: 'PT-7' })]), BASE)
    expect(texto).toContain('PT-7')
    expect(texto).toContain(BASE)
  })
})
