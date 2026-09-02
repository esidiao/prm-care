import { inventariarRegras, type RegraInventariada } from '@/lib/prm-engine'

/**
 * Relatório de curadoria da base clínica (lacuna 04).
 *
 * O problema que isto resolve: as regras clínicas viviam no código sem NENHUM
 * registro de quando foram revisadas ou por quem. Uma regra desatualizada só
 * seria descoberta por acaso — e "por acaso" numa ferramenta que decide conduta
 * é o pior modo de descobrir.
 *
 * Isto NÃO move as regras para o banco. `analyzePRM` continua função pura e
 * síncrona, com as regras versionadas e cobertas por teste. O que muda é que a
 * ausência de revisão passa a ser um número na tela em vez de silêncio.
 */

/** Além disto, a regra é considerada vencida. */
export const MESES_ATE_VENCER = 12

export type SituacaoRegra = 'sem_registro' | 'vencida' | 'em_dia'

export interface RegraAvaliada extends RegraInventariada {
  situacao: SituacaoRegra
  /** Meses desde a última revisão; null quando nunca houve */
  mesesDesdeRevisao: number | null
}

export interface ResumoCuradoria {
  total: number
  semRegistro: number
  vencidas: number
  emDia: number
  /** Percentual do total com revisão registrada e dentro do prazo */
  coberturaPct: number
  porGrupo: Array<{ grupo: string; total: number; semRegistro: number; vencidas: number }>
  /** As mais antigas primeiro — a fila de trabalho do revisor */
  prioridade: RegraAvaliada[]
}

/**
 * 'YYYY-MM-DD' em partes numéricas.
 *
 * Parsear com `new Date('2025-09-02')` produz meia-noite UTC; comparar isso com
 * `getDate()`/`getMonth()` locais faz a data retroceder um dia a oeste de
 * Greenwich, e uma regra é declarada vencida um dia antes do prazo. Comparar
 * pelas partes elimina o fuso da conta — que não deveria participar dela.
 */
function partesISO(iso: string): { ano: number; mes: number; dia: number } | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  const ano = Number(m[1]), mes = Number(m[2]) - 1, dia = Number(m[3])
  if (mes < 0 || mes > 11 || dia < 1 || dia > 31) return null
  return { ano, mes, dia }
}

function mesesEntre(
  desde: { ano: number; mes: number; dia: number },
  ate: { ano: number; mes: number; dia: number },
): number {
  return (ate.ano - desde.ano) * 12 + (ate.mes - desde.mes) - (ate.dia < desde.dia ? 1 : 0)
}

export function avaliarRegra(r: RegraInventariada, agora = new Date()): RegraAvaliada {
  if (!r.revisadoEm) return { ...r, situacao: 'sem_registro', mesesDesdeRevisao: null }

  const partes = partesISO(r.revisadoEm)
  // Data ilegível é tratada como ausência de registro: é o que ela de fato é.
  if (!partes) return { ...r, situacao: 'sem_registro', mesesDesdeRevisao: null }

  const meses = mesesEntre(partes, {
    ano: agora.getUTCFullYear(), mes: agora.getUTCMonth(), dia: agora.getUTCDate(),
  })
  return {
    ...r,
    mesesDesdeRevisao: meses,
    situacao: meses >= MESES_ATE_VENCER ? 'vencida' : 'em_dia',
  }
}

export function resumirCuradoria(agora = new Date()): ResumoCuradoria {
  const avaliadas = inventariarRegras().map(r => avaliarRegra(r, agora))

  const total = avaliadas.length
  const semRegistro = avaliadas.filter(r => r.situacao === 'sem_registro').length
  const vencidas = avaliadas.filter(r => r.situacao === 'vencida').length
  const emDia = avaliadas.filter(r => r.situacao === 'em_dia').length

  const grupos = Array.from(new Set(avaliadas.map(r => r.grupo)))
  const porGrupo = grupos.map(grupo => {
    const doGrupo = avaliadas.filter(r => r.grupo === grupo)
    return {
      grupo,
      total: doGrupo.length,
      semRegistro: doGrupo.filter(r => r.situacao === 'sem_registro').length,
      vencidas: doGrupo.filter(r => r.situacao === 'vencida').length,
    }
  }).sort((a, b) => b.total - a.total)

  // Fila de trabalho: sem registro primeiro (risco maior, porque não se sabe
  // nada), depois as vencidas há mais tempo.
  const prioridade = avaliadas
    .filter(r => r.situacao !== 'em_dia')
    .sort((a, b) => {
      if (a.situacao !== b.situacao) return a.situacao === 'sem_registro' ? -1 : 1
      return (b.mesesDesdeRevisao ?? 0) - (a.mesesDesdeRevisao ?? 0)
    })
    .slice(0, 50)

  return {
    total, semRegistro, vencidas, emDia,
    coberturaPct: total === 0 ? 0 : Math.round((emDia / total) * 100),
    porGrupo, prioridade,
  }
}
