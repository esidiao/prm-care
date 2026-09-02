/**
 * Suspeita de reação adversa a medicamento — ficha para o VigiMed (lacuna 10).
 *
 * O QUE ISTO FAZ E NÃO FAZ: monta a ficha com os campos que o VigiMed exige, a
 * partir do que já está no prontuário. **Não submete.** O VigiMed não expõe API
 * pública para notificação por profissional — o envio segue pelo formulário
 * aberto da ANVISA, que não exige cadastro. O ganho é não redigitar e não
 * esquecer campo obrigatório, além de o registro ficar no prontuário.
 *
 * PRIVACIDADE: a ficha leva INICIAIS do paciente, nunca o nome. É o que a norma
 * pede, e evita expor identidade num documento que sai do sistema.
 */

export type Gravidade =
  | 'NAO_GRAVE' | 'OBITO' | 'AMEACA_VIDA' | 'HOSPITALIZACAO'
  | 'INCAPACIDADE' | 'ANOMALIA_CONGENITA' | 'CLINICAMENTE_RELEVANTE'

export type Desfecho =
  | 'RECUPERADO' | 'RECUPERANDO' | 'NAO_RECUPERADO' | 'SEQUELA' | 'OBITO' | 'DESCONHECIDO'

export type AcaoTomada =
  | 'SUSPENSO' | 'DOSE_REDUZIDA' | 'DOSE_AUMENTADA' | 'MANTIDO' | 'DESCONHECIDO'

export type Reexposicao = 'REAPARECEU' | 'NAO_REAPARECEU' | 'NAO_APLICA' | 'DESCONHECIDO'

export const GRAVIDADE_ROTULO: Record<Gravidade, string> = {
  NAO_GRAVE: 'Não grave',
  OBITO: 'Óbito',
  AMEACA_VIDA: 'Ameaça à vida',
  HOSPITALIZACAO: 'Hospitalização ou prolongamento de internação',
  INCAPACIDADE: 'Incapacidade persistente ou significativa',
  ANOMALIA_CONGENITA: 'Anomalia congênita',
  CLINICAMENTE_RELEVANTE: 'Outro evento clinicamente relevante',
}

export const DESFECHO_ROTULO: Record<Desfecho, string> = {
  RECUPERADO: 'Recuperado / resolvido',
  RECUPERANDO: 'Recuperando / em resolução',
  NAO_RECUPERADO: 'Não recuperado',
  SEQUELA: 'Recuperado com sequela',
  OBITO: 'Óbito',
  DESCONHECIDO: 'Desconhecido',
}

export const ACAO_ROTULO: Record<AcaoTomada, string> = {
  SUSPENSO: 'Medicamento suspenso',
  DOSE_REDUZIDA: 'Dose reduzida',
  DOSE_AUMENTADA: 'Dose aumentada',
  MANTIDO: 'Mantido sem alteração',
  DESCONHECIDO: 'Desconhecido',
}

export const REEXPOSICAO_ROTULO: Record<Reexposicao, string> = {
  REAPARECEU: 'Reexposição: reação reapareceu',
  NAO_REAPARECEU: 'Reexposição: reação não reapareceu',
  NAO_APLICA: 'Não houve reexposição',
  DESCONHECIDO: 'Desconhecido',
}

/** Gravidades que o VigiMed trata como evento GRAVE — prioridade de notificação. */
const GRAVES: Gravidade[] = [
  'OBITO', 'AMEACA_VIDA', 'HOSPITALIZACAO', 'INCAPACIDADE',
  'ANOMALIA_CONGENITA', 'CLINICAMENTE_RELEVANTE',
]

export function ehGrave(g: Gravidade): boolean {
  return GRAVES.includes(g)
}

/**
 * Iniciais do paciente, como o VigiMed pede.
 *
 * Ignora partículas ("de", "da", "dos") porque elas não são iniciais de nome e
 * poluiriam a sigla. Sem nome cadastrado — paciente anonimizado — devolve null,
 * e a ficha usa o código do paciente no lugar.
 */
const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])

export function iniciaisDoNome(nome: string | null | undefined): string | null {
  if (!nome?.trim()) return null
  const partes = nome.trim().split(/\s+/)
    .filter(p => !PARTICULAS.has(p.toLowerCase()))
    .filter(Boolean)
  if (partes.length === 0) return null
  return partes.map(p => p[0].toUpperCase()).join('.') + '.'
}

/**
 * Idade no momento da reação — o VigiMed aceita data de nascimento OU idade, e
 * a idade que importa é a da reação, não a de hoje.
 */
export function idadeNaReacao(
  dataNascimento: Date | null | undefined,
  idadeRegistrada: number | null | undefined,
  dataInicio: Date,
): number | null {
  if (dataNascimento) {
    let anos = dataInicio.getUTCFullYear() - dataNascimento.getUTCFullYear()
    const mes = dataInicio.getUTCMonth() - dataNascimento.getUTCMonth()
    if (mes < 0 || (mes === 0 && dataInicio.getUTCDate() < dataNascimento.getUTCDate())) anos--
    return anos >= 0 ? anos : null
  }
  return idadeRegistrada ?? null
}

export const SEXO_ROTULO: Record<string, string> = {
  MALE: 'Masculino', FEMALE: 'Feminino', OTHER: 'Outro',
}

export interface DadosFicha {
  paciente: { nome: string | null; code: string; sexo: string | null; dataNascimento: Date | null; idade: number | null }
  notificador: { nome: string | null; email: string; crf: string | null; especializacao: string | null }
  medicamentos: string
  reacao: string
  dataInicio: Date
  dataFim: Date | null
  gravidade: Gravidade
  desfecho: Desfecho
  acaoTomada: AcaoTomada
  reexposicao: Reexposicao
  historicoRelevante: string | null
  observacoes: string | null
}

export interface CampoFicha {
  rotulo: string
  valor: string
  obrigatorio: boolean
  /** Vazio num campo obrigatório é o que impede a notificação de ser aceita. */
  faltando: boolean
}

function d(data: Date | null): string {
  return data ? data.toISOString().slice(0, 10).split('-').reverse().join('/') : ''
}

/**
 * Monta a ficha na ordem em que o formulário do VigiMed pede, para a
 * transcrição ser mecânica.
 */
export function montarFicha(dados: DadosFicha): CampoFicha[] {
  const iniciais = iniciaisDoNome(dados.paciente.nome)
  const idade = idadeNaReacao(dados.paciente.dataNascimento, dados.paciente.idade, dados.dataInicio)

  const campo = (rotulo: string, valor: string | null, obrigatorio = false): CampoFicha => ({
    rotulo,
    valor: valor?.trim() || '',
    obrigatorio,
    faltando: obrigatorio && !valor?.trim(),
  })

  return [
    // Identificação do paciente — iniciais, nunca o nome
    campo('Iniciais do paciente', iniciais ?? `(anonimizado — código ${dados.paciente.code})`, true),
    campo('Sexo', dados.paciente.sexo ? SEXO_ROTULO[dados.paciente.sexo] ?? dados.paciente.sexo : null, true),
    campo('Data de nascimento', d(dados.paciente.dataNascimento)),
    campo('Idade na data da reação', idade !== null ? `${idade} anos` : null, true),

    // Evento
    campo('Medicamento(s) suspeito(s)', dados.medicamentos, true),
    campo('Descrição do evento adverso', dados.reacao, true),
    campo('Data de início da reação', d(dados.dataInicio), true),
    campo('Data de término', d(dados.dataFim)),
    campo('Gravidade', GRAVIDADE_ROTULO[dados.gravidade], true),
    campo('Desfecho', DESFECHO_ROTULO[dados.desfecho], true),
    campo('Ação tomada com o medicamento', ACAO_ROTULO[dados.acaoTomada], true),
    campo('Reexposição', REEXPOSICAO_ROTULO[dados.reexposicao]),

    // Contexto — opcional no VigiMed
    campo('Doença prévia / atual relevante', dados.historicoRelevante),
    campo('Comentários adicionais', dados.observacoes),

    // Notificador
    campo('Profissão', 'Farmacêutico(a)', true),
    campo('Nome do notificador', dados.notificador.nome),
    campo('CRF', dados.notificador.crf),
    campo('E-mail para contato', dados.notificador.email, true),
  ]
}

/** Campos obrigatórios ainda vazios — a ficha não deve ser dada como pronta. */
export function pendenciasDaFicha(ficha: CampoFicha[]): string[] {
  return ficha.filter(c => c.faltando).map(c => c.rotulo)
}

/** Versão em texto, para copiar e colar no formulário da ANVISA. */
export function fichaEmTexto(ficha: CampoFicha[]): string {
  return ficha
    .filter(c => c.valor)
    .map(c => `${c.rotulo}: ${c.valor}`)
    .join('\n')
}
