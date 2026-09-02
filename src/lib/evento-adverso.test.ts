import { describe, it, expect } from 'vitest'
import {
  iniciaisDoNome, idadeNaReacao, ehGrave, montarFicha, pendenciasDaFicha,
  fichaEmTexto, type DadosFicha,
} from '@/lib/evento-adverso'

function dados(over: Partial<DadosFicha> = {}): DadosFicha {
  return {
    paciente: {
      nome: 'Maria da Silva Santos',
      code: 'PT-0042',
      sexo: 'FEMALE',
      dataNascimento: new Date('1960-03-15T00:00:00Z'),
      idade: null,
    },
    notificador: {
      nome: 'Ana Paula Souza',
      email: 'ana@example.com',
      crf: 'CRF-GO 12345',
      especializacao: 'Farmácia Clínica',
    },
    medicamentos: 'Varfarina 5 mg',
    reacao: 'Equimoses extensas em membros inferiores',
    dataInicio: new Date('2026-08-20T00:00:00Z'),
    dataFim: null,
    gravidade: 'HOSPITALIZACAO',
    desfecho: 'RECUPERANDO',
    acaoTomada: 'SUSPENSO',
    reexposicao: 'NAO_APLICA',
    historicoRelevante: null,
    observacoes: null,
    ...over,
  }
}

describe('Iniciais do paciente — o VigiMed pede iniciais, não o nome', () => {
  it('monta a sigla a partir do nome completo', () => {
    expect(iniciaisDoNome('Maria Santos')).toBe('M.S.')
  })

  it('ignora partículas, que não são iniciais de nome', () => {
    expect(iniciaisDoNome('Maria da Silva Santos')).toBe('M.S.S.')
    expect(iniciaisDoNome('João dos Santos e Souza')).toBe('J.S.S.')
  })

  it('sem nome cadastrado devolve null — paciente anonimizado', () => {
    expect(iniciaisDoNome(null)).toBeNull()
    expect(iniciaisDoNome('   ')).toBeNull()
  })

  it('a ficha NUNCA leva o nome completo', () => {
    const texto = fichaEmTexto(montarFicha(dados()))
    expect(texto).toContain('M.S.S.')
    expect(texto).not.toContain('Maria da Silva Santos')
  })

  it('paciente anonimizado cai no código, não fica em branco', () => {
    const f = montarFicha(dados({ paciente: { ...dados().paciente, nome: null } }))
    const iniciais = f.find(c => c.rotulo === 'Iniciais do paciente')!
    expect(iniciais.valor).toContain('PT-0042')
    expect(iniciais.faltando).toBe(false)
  })
})

describe('Idade na reação — não a de hoje', () => {
  it('calcula pela data de nascimento contra a data do evento', () => {
    expect(idadeNaReacao(new Date('1960-03-15T00:00:00Z'), null, new Date('2026-08-20T00:00:00Z'))).toBe(66)
  })

  it('respeita aniversário ainda não ocorrido no ano do evento', () => {
    expect(idadeNaReacao(new Date('1960-12-31T00:00:00Z'), null, new Date('2026-08-20T00:00:00Z'))).toBe(65)
  })

  it('sem data de nascimento usa a idade registrada', () => {
    expect(idadeNaReacao(null, 72, new Date('2026-08-20T00:00:00Z'))).toBe(72)
  })

  it('sem nenhum dos dois devolve null, e o campo aparece como faltando', () => {
    const f = montarFicha(dados({
      paciente: { ...dados().paciente, dataNascimento: null, idade: null },
    }))
    const idade = f.find(c => c.rotulo === 'Idade na data da reação')!
    expect(idade.faltando).toBe(true)
    expect(pendenciasDaFicha(f)).toContain('Idade na data da reação')
  })
})

describe('Gravidade', () => {
  it('reconhece as gravidades que o VigiMed trata como grave', () => {
    expect(ehGrave('OBITO')).toBe(true)
    expect(ehGrave('HOSPITALIZACAO')).toBe(true)
    expect(ehGrave('CLINICAMENTE_RELEVANTE')).toBe(true)
  })
  it('não grave é o único que não é grave', () => {
    expect(ehGrave('NAO_GRAVE')).toBe(false)
  })
})

describe('Ficha do VigiMed', () => {
  it('traz todos os campos obrigatórios da norma', () => {
    const rotulos = montarFicha(dados()).filter(c => c.obrigatorio).map(c => c.rotulo)
    for (const esperado of [
      'Iniciais do paciente', 'Sexo', 'Idade na data da reação',
      'Medicamento(s) suspeito(s)', 'Descrição do evento adverso',
      'Data de início da reação', 'Profissão', 'E-mail para contato',
    ]) {
      expect(rotulos).toContain(esperado)
    }
  })

  it('ficha completa não tem pendência', () => {
    expect(pendenciasDaFicha(montarFicha(dados()))).toEqual([])
  })

  it('aponta o campo obrigatório vazio em vez de deixar passar', () => {
    const f = montarFicha(dados({ paciente: { ...dados().paciente, sexo: null } }))
    expect(pendenciasDaFicha(f)).toContain('Sexo')
  })

  it('a profissão vai preenchida — é obrigatória e sempre a mesma', () => {
    const p = montarFicha(dados()).find(c => c.rotulo === 'Profissão')!
    expect(p.valor).toBe('Farmacêutico(a)')
    expect(p.faltando).toBe(false)
  })

  it('formata data no padrão brasileiro', () => {
    const texto = fichaEmTexto(montarFicha(dados()))
    expect(texto).toContain('20/08/2026')
  })

  it('o texto omite campo vazio em vez de imprimir rótulo solto', () => {
    const texto = fichaEmTexto(montarFicha(dados({ dataFim: null, observacoes: null })))
    expect(texto).not.toContain('Data de término:')
    expect(texto).not.toContain('Comentários adicionais:')
  })
})
