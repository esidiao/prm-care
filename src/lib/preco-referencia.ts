/**
 * Comparação de preço entre apresentações equivalentes (lacuna 17).
 *
 * A REGRA QUE TORNA ISTO HONESTO: só compara apresentações da mesma substância
 * E da mesma dose, e sempre por UNIDADE — nunca por preço de caixa.
 *
 * Sem isso a feature é ativamente prejudicial. No dado real da CMED convivem,
 * para sinvastatina 20 mg:
 *   R$ 15,58 em caixa de 30  -> R$ 0,519 por comprimido
 *   R$ 30,02 em caixa de 10  -> R$ 3,002 por comprimido
 * Ordenar por preço de caixa apresentaria a caixa pequena como alternativa
 * barata. E uma embalagem hospitalar de 750 unidades a R$ 664,54 pareceria
 * absurdamente cara, quando por comprimido é competitiva.
 *
 * Quando dose ou quantidade não puderem ser extraídas do texto livre da
 * apresentação (17,5% dos registros, medidos em 01/09/2026 — soluções orais,
 * pomadas, injetáveis), NÃO comparamos. Não mostrar é melhor que mostrar errado.
 */

/** "20 MG COM REV CT BL AL PLAS TRANS X 30" -> "20 MG" */
const RE_DOSE = /^\s*([\d.,]+)\s*(MG|MCG|G|ML|UI|%)\b/i

/** Último "X <n>" da string — é onde a CMED põe a quantidade da embalagem. */
const RE_QTD = /\bX\s*(\d+)\b(?!.*\bX\s*\d+\b)/i

export interface ApresentacaoComparavel {
  ggrem: string
  produto: string
  apresentacao: string | null
  laboratorio: string | null
  tipoProduto: string | null
  pmcSemImpostosCents: number | null
}

export interface Comparavel extends ApresentacaoComparavel {
  /** Dose normalizada, ex.: "20 MG" — chave de agrupamento */
  dose: string
  /** Unidades na embalagem */
  quantidade: number
  /** Centavos por unidade — é por aqui que se ordena */
  centsPorUnidade: number
}

export function extrairDose(apresentacao: string | null): string | null {
  const m = (apresentacao || '').match(RE_DOSE)
  if (!m) return null
  // Vírgula decimal do padrão brasileiro vira ponto para a chave ficar estável
  return `${m[1].replace(',', '.')} ${m[2].toUpperCase()}`
}

export function extrairQuantidade(apresentacao: string | null): number | null {
  const m = (apresentacao || '').match(RE_QTD)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Descarta o que não dá para comparar com honestidade. */
export function tornarComparavel(a: ApresentacaoComparavel): Comparavel | null {
  if (a.pmcSemImpostosCents === null || a.pmcSemImpostosCents <= 0) return null
  const dose = extrairDose(a.apresentacao)
  const quantidade = extrairQuantidade(a.apresentacao)
  if (!dose || !quantidade) return null
  return { ...a, dose, quantidade, centsPorUnidade: a.pmcSemImpostosCents / quantidade }
}

export interface OportunidadeEconomia {
  dose: string
  atual: Comparavel
  maisBarata: Comparavel
  /** Economia por unidade, em centavos */
  economiaPorUnidadeCents: number
  /** Percentual de redução */
  reducaoPct: number
}

/**
 * Dada a apresentação em uso e as demais da mesma substância, devolve a
 * alternativa mais barata POR UNIDADE dentro da MESMA DOSE.
 *
 * Devolve null quando não há ganho real — não inventa oportunidade para ter o
 * que mostrar.
 */
export function encontrarAlternativa(
  emUso: ApresentacaoComparavel,
  candidatas: ApresentacaoComparavel[],
  economiaMinimaPct = 10,
): OportunidadeEconomia | null {
  const atual = tornarComparavel(emUso)
  if (!atual) return null

  const mesmaDose = candidatas
    .map(tornarComparavel)
    .filter((c): c is Comparavel => !!c && c.dose === atual.dose && c.ggrem !== atual.ggrem)

  if (mesmaDose.length === 0) return null

  const maisBarata = mesmaDose.reduce((a, b) => (b.centsPorUnidade < a.centsPorUnidade ? b : a))
  if (maisBarata.centsPorUnidade >= atual.centsPorUnidade) return null

  const economiaPorUnidadeCents = atual.centsPorUnidade - maisBarata.centsPorUnidade
  const reducaoPct = (economiaPorUnidadeCents / atual.centsPorUnidade) * 100

  // Diferença marginal não justifica sugerir troca ao prescritor.
  if (reducaoPct < economiaMinimaPct) return null

  return { dose: atual.dose, atual, maisBarata, economiaPorUnidadeCents, reducaoPct }
}

/**
 * Menor preço por unidade de uma substância, por dose.
 * Usado no painel de impacto para dimensionar a oportunidade agregada.
 */
export function menorPrecoPorDose(candidatas: ApresentacaoComparavel[]): Map<string, Comparavel> {
  const porDose = new Map<string, Comparavel>()
  for (const c of candidatas) {
    const comp = tornarComparavel(c)
    if (!comp) continue
    const atual = porDose.get(comp.dose)
    if (!atual || comp.centsPorUnidade < atual.centsPorUnidade) porDose.set(comp.dose, comp)
  }
  return porDose
}

export function formatarCents(cents: number, casas = 2): string {
  return `R$ ${(cents / 100).toFixed(casas).replace('.', ',')}`
}

/**
 * Monofármaco e associação não se comparam.
 *
 * A CMED grava associação com ';' ("EZETIMIBA;SINVASTATINA") e alguns produtos
 * com '+'. Sem esta checagem, uma busca por `contains` traz o kit OMEPRAMIX
 * (omeprazol + amoxicilina + claritromicina) como "alternativa" de omeprazol —
 * o que não é ruído de preço, é sugestão de troca clinicamente errada.
 */
export function ehAssociacao(substancia: string | null | undefined): boolean {
  return /[;+]/.test(substancia ?? '')
}

export function composicaoCompativel(a: string | null | undefined, b: string | null | undefined): boolean {
  return ehAssociacao(a) === ehAssociacao(b)
}
