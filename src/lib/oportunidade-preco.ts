import prisma from '@/lib/prisma'
import {
  menorPrecoPorDose, tornarComparavel, composicaoCompativel, type Comparavel,
} from '@/lib/preco-referencia'

/**
 * Oportunidade de economia para os medicamentos de um paciente.
 *
 * LIMITE QUE DEFINE O QUE PODEMOS AFIRMAR: o prontuário guarda princípio ativo,
 * dose e unidade — NÃO guarda qual apresentação (GGREM) o paciente compra.
 * Portanto é impossível dizer "você paga X, troque e economize Y".
 *
 * O que dá para afirmar com honestidade: qual é a opção mais econômica
 * disponível naquela dose, e qual a distância entre a mais barata e a mais cara.
 * Isso é oportunidade identificada, não economia realizada — e a interface tem
 * que dizer isso com essas palavras.
 */

export interface OportunidadePaciente {
  medicamento: string
  dose: string
  maisBarata: Comparavel
  maisCara: Comparavel
  /** Quantas apresentações existem naquela dose */
  opcoes: number
  /** Percentual entre a mais cara e a mais barata, por unidade */
  amplitudePct: number
}

function norm(s: string): string {
  return s.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** "20" + "mg" -> "20 MG", no mesmo formato da chave de dose. */
function chaveDose(dose: number | null, unidade: string | null): string | null {
  if (dose === null || dose === undefined || !unidade) return null
  const u = unidade.trim().toUpperCase()
  if (!['MG', 'MCG', 'G', 'ML', 'UI', '%'].includes(u)) return null
  // 20 -> "20", 0.5 -> "0.5" (mesma normalização de extrairDose)
  return `${Number.isInteger(dose) ? dose : dose} ${u}`
}

export async function buscarOportunidades(
  medicamentos: Array<{ activeIngredient: string; dose: number | null; doseUnit: string | null }>,
  amplitudeMinimaPct = 20,
): Promise<OportunidadePaciente[]> {
  const resultado: OportunidadePaciente[] = []

  for (const med of medicamentos) {
    const alvo = chaveDose(med.dose, med.doseUnit)
    if (!alvo) continue   // sem dose registrada não há comparação honesta

    const candidatas = await prisma.refApresentacao.findMany({
      where: { substanciaNorm: { contains: norm(med.activeIngredient) } },
      select: {
        ggrem: true, produto: true, apresentacao: true, laboratorio: true,
        tipoProduto: true, pmcSemImpostosCents: true, substanciaNorm: true,
      },
      take: 400,
    })
    if (candidatas.length === 0) continue

    // CONTAMINACAO POR ASSOCIACAO: `contains` puxa produtos combinados. No dado
    // real, "omeprazol" trazia OMEPRAMIX (kit para H. pylori com amoxicilina e
    // claritromicina) a R$ 186,85/unidade, gerando "variacao de 29.375%"; e
    // "losartana" trazia LOSARTANA + HIDROCLOROTIAZIDA. Comparar monofarmaco com
    // associacao nao e so ruido — sugeriria troca clinicamente errada.
    const mesmaComposicao = candidatas.filter(c =>
      composicaoCompativel(med.activeIngredient, c.substanciaNorm))

    const naDose = mesmaComposicao
      .map(tornarComparavel)
      .filter((c): c is Comparavel => !!c && c.dose === alvo)

    if (naDose.length < 2) continue   // uma opção só não é escolha

    const ordenadas = [...naDose].sort((a, b) => a.centsPorUnidade - b.centsPorUnidade)
    const maisBarata = ordenadas[0]
    const maisCara = ordenadas[ordenadas.length - 1]
    const amplitudePct = ((maisCara.centsPorUnidade - maisBarata.centsPorUnidade) / maisBarata.centsPorUnidade) * 100

    if (amplitudePct < amplitudeMinimaPct) continue   // mercado homogêneo, nada a decidir

    resultado.push({
      medicamento: med.activeIngredient,
      dose: alvo,
      maisBarata,
      maisCara,
      opcoes: naDose.length,
      amplitudePct,
    })
  }

  return resultado.sort((a, b) => b.amplitudePct - a.amplitudePct)
}

/** Só a contagem — usada no painel de impacto, sem projetar valor em reais. */
export async function contarOportunidades(userId: string): Promise<{ medicamentos: number; pacientes: number }> {
  const meds = await prisma.medication.findMany({
    where: { isActive: true, patient: { userId, isActive: true } },
    select: { activeIngredient: true, dose: true, doseUnit: true, patientId: true },
    take: 2000,
  })
  if (meds.length === 0) return { medicamentos: 0, pacientes: 0 }

  const ops = await buscarOportunidades(meds)
  const chaves = new Set(ops.map(o => `${norm(o.medicamento)}|${o.dose}`))

  const pacientes = new Set(
    meds
      .filter(m => {
        const d = chaveDose(m.dose, m.doseUnit)
        return d && chaves.has(`${norm(m.activeIngredient)}|${d}`)
      })
      .map(m => m.patientId),
  )

  return { medicamentos: chaves.size, pacientes: pacientes.size }
}
