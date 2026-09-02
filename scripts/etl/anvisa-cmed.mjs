/**
 * ETL — ANVISA (medicamentos registrados) + CMED (lista de preços).
 *
 * Alimenta a monografia de medicamento (lacuna 02) e o comparativo de custo
 * (lacuna 17). Fontes de dados abertos do poder público: uso comercial livre,
 * sem cláusula NonCommercial — ver docs/PARECER_FONTES_MONOGRAFIA_MEDICAMENTO.md.
 *
 * ARMADILHAS DOS ARQUIVOS (verificadas rodando, em 01/09/2026 — não presumidas):
 *   - ENCODINGS DIFERENTES entre os dois: o da ANVISA e latin-1 e o da CMED e
 *     UTF-8. Fixar um corrompe o outro em silencio ("restriÃ§Ã£o"). Detectado.
 *   - a CMED grafa colunas COM ACENTO (SUBSTANCIA com circunflexo); ler a versao
 *     sem acento devolve undefined sem erro. Cabecalho e canonizado.
 *   - separador ';'
 *   - o CSV da CMED tem ~59 linhas de preambulo em prosa antes do cabecalho
 *   - a CMED repete PF e PMC por aliquota de ICMS (60 das 74 colunas)
 *
 * Uso:
 *   node scripts/etl/anvisa-cmed.mjs --dry-run    baixa, parseia e relata
 *   node scripts/etl/anvisa-cmed.mjs              idem + grava no banco
 */

import { createWriteStream } from 'node:fs'
import { readFile, mkdir, stat } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import path from 'node:path'

const FONTES = {
  medicamentos: {
    url: 'https://dados.anvisa.gov.br/dados/DADOS_ABERTOS_MEDICAMENTOS.csv',
    arquivo: 'DADOS_ABERTOS_MEDICAMENTOS.csv',
  },
  precos: {
    url: 'https://dados.anvisa.gov.br/dados/TA_PRECO_MEDICAMENTO.csv',
    arquivo: 'TA_PRECO_MEDICAMENTO.csv',
  },
}

const CACHE = path.join(process.cwd(), '.etl-cache')

// ── Download com cache local ────────────────────────────────────────────────
// São ~25 MB somados. Sem cache, cada iteração do parser rebaixa tudo.

async function baixar(fonte) {
  await mkdir(CACHE, { recursive: true })
  const destino = path.join(CACHE, fonte.arquivo)
  try {
    const s = await stat(destino)
    if (s.size > 0) {
      console.log(`  cache: ${fonte.arquivo} (${(s.size / 1048576).toFixed(1)} MB)`)
      return destino
    }
  } catch { /* não há cache, segue para o download */ }

  console.log(`  baixando ${fonte.url}`)
  const res = await fetch(fonte.url)
  if (!res.ok) throw new Error(`${fonte.url} devolveu HTTP ${res.status}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(destino))
  const s = await stat(destino)
  console.log(`  ok: ${(s.size / 1048576).toFixed(1)} MB`)
  return destino
}

// ── Parsing ─────────────────────────────────────────────────────────────────

/** Divide uma linha CSV em ';' respeitando aspas duplas. */
function dividir(linha) {
  const campos = []
  let atual = '', dentroDeAspas = false
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i]
    if (c === '"') {
      // "" dentro de campo entre aspas representa uma aspa literal
      if (dentroDeAspas && linha[i + 1] === '"') { atual += '"'; i++ }
      else dentroDeAspas = !dentroDeAspas
    } else if (c === ';' && !dentroDeAspas) {
      campos.push(atual); atual = ''
    } else {
      atual += c
    }
  }
  campos.push(atual)
  return campos.map(c => c.trim())
}

/**
 * Os dois arquivos NÃO têm o mesmo encoding — verificado em 01/09/2026:
 * DADOS_ABERTOS_MEDICAMENTOS.csv é latin-1 e TA_PRECO_MEDICAMENTO.csv é UTF-8.
 * Fixar um dos dois corrompe o outro em silêncio: vira "restriÃ§Ã£o" no lugar
 * de "restrição", e o dado entra torto no banco sem nenhum erro.
 * Detecta: UTF-8 estrito falha em bytes latin-1; latin-1 nunca falha.
 */
async function lerTexto(caminho) {
  const buf = await readFile(caminho)
  try {
    const txt = new TextDecoder('utf-8', { fatal: true }).decode(buf)
    return { texto: txt, encoding: 'utf-8' }
  } catch {
    return { texto: new TextDecoder('latin1').decode(buf), encoding: 'latin-1' }
  }
}

/**
 * Acha a linha do cabeçalho: a primeira com pelo menos `minColunas` campos
 * preenchidos. A CMED enterra o cabeçalho sob prosa explicativa, e a posição
 * muda a cada publicação — procurar é mais robusto que fixar o número da linha.
 */
function acharCabecalho(linhas, minColunas) {
  for (let i = 0; i < Math.min(linhas.length, 200); i++) {
    const campos = dividir(linhas[i]).filter(Boolean)
    if (campos.length >= minColunas) return i
  }
  throw new Error(`cabeçalho não encontrado (esperava >= ${minColunas} colunas)`)
}

/**
 * Nome de coluna canônico: sem acento, maiúsculo, separado por '_'.
 * SUBSTÂNCIA -> SUBSTANCIA · APRESENTAÇÃO -> APRESENTACAO · PMC 12 % ALC -> PMC_12_ALC
 * A CMED grafa colunas com acento, e ler `r.SUBSTANCIA` de um cabeçalho
 * `SUBSTÂNCIA` devolve undefined silenciosamente — foi assim que o cruzamento
 * com a base clínica deu zero na primeira execução.
 */
function canonizar(nome) {
  return (nome || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function parsear(texto, minColunas) {
  const linhas = texto.split(/\r?\n/)
  const iCab = acharCabecalho(linhas, minColunas)
  const cabecalho = dividir(linhas[iCab]).map(canonizar)
  const registros = []
  for (let i = iCab + 1; i < linhas.length; i++) {
    if (!linhas[i].trim()) continue
    const campos = dividir(linhas[i])
    if (campos.length < minColunas) continue   // rodapé/nota solta
    const obj = {}
    cabecalho.forEach((nome, j) => { if (nome) obj[nome] = campos[j] ?? '' })
    registros.push(obj)
  }
  return { linhaCabecalho: iCab + 1, colunas: cabecalho.filter(Boolean), registros }
}

/** "1.234,56" -> 1234.56 · vazio/"-" -> null */
function moeda(v) {
  if (!v) return null
  const limpo = v.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
  if (!limpo || limpo === '-') return null
  const n = Number(limpo)
  return Number.isFinite(n) ? n : null
}

const norm = s => (s || '').toLowerCase().trim()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')

// ── Normalização por fonte ──────────────────────────────────────────────────

function normalizarMedicamentos(registros) {
  return registros.map(r => ({
    registro: r.NUMERO_REGISTRO_PRODUTO || null,
    produto: r.NOME_PRODUTO || null,
    principioAtivo: r.PRINCIPIO_ATIVO || null,
    principioAtivoNorm: norm(r.PRINCIPIO_ATIVO),
    classeTerapeutica: r.CLASSE_TERAPEUTICA || null,
    categoriaRegulatoria: r.CATEGORIA_REGULATORIA || null,
    empresa: (r.EMPRESA_DETENTORA_REGISTRO || '').split(' - ').slice(1).join(' - ') || r.EMPRESA_DETENTORA_REGISTRO || null,
    situacao: r.SITUACAO_REGISTRO || null,
  })).filter(r => r.produto)
}

function normalizarPrecos(registros) {
  const col = registros[0] ? Object.keys(registros[0]) : []
  // Faixas de ICMS guardadas em bloco, nao em 60 colunas: a lista muda a cada
  // publicacao e a aliquota certa depende do estado de quem consulta.
  const colsPmc = col.filter(c => /^PMC_\d/.test(c))
  const colComerc = col.find(c => /^COMERCIALIZ/.test(c)) || null

  return registros.map(r => {
    const faixas = {}
    for (const c of colsPmc) {
      const v = moeda(r[c])
      if (v !== null) faixas[c.replace(/^PMC_/, '').replace(/_/g, ' ')] = v
    }
    return {
      registro: r.REGISTRO || null,
      ggrem: r.CODIGO_GGREM || null,
      ean: r.EAN_1 || null,
      substancia: r.SUBSTANCIA || null,
      substanciaNorm: norm(r.SUBSTANCIA),
      produto: r.PRODUTO || null,
      apresentacao: r.APRESENTACAO || null,
      laboratorio: r.LABORATORIO || null,
      classeTerapeutica: r.CLASSE_TERAPEUTICA || null,
      tipoProduto: r.TIPO_DE_PRODUTO_STATUS_DO_PRODUTO || null,
      tarja: r.TARJA || null,
      restricaoHospitalar: /sim/i.test(r.RESTRICAO_HOSPITALAR || ''),
      comercializado: colComerc ? /sim/i.test(r[colComerc] || '') : false,
      pfSemImpostos: moeda(r.PF_SEM_IMPOSTOS),
      pmcSemImpostos: moeda(r.PMC_SEM_IMPOSTOS),
      pmcPorAliquota: faixas,
    }
  }).filter(r => r.produto)
}

// ── Relatório ───────────────────────────────────────────────────────────────

function contar(lista, chave) {
  const m = new Map()
  for (const r of lista) {
    const v = r[chave] || '(vazio)'
    m.set(v, (m.get(v) || 0) + 1)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  console.log(`ETL ANVISA + CMED ${dryRun ? '(dry-run — nada é gravado)' : ''}\n`)

  console.log('[1/4] ANVISA — medicamentos registrados')
  const fMed = await baixar(FONTES.medicamentos)
  const tMed = await lerTexto(fMed)
  const pMed = parsear(tMed.texto, 8)
  const meds = normalizarMedicamentos(pMed.registros)
  console.log(`  encoding ${tMed.encoding} · cabecalho na linha ${pMed.linhaCabecalho} · ${pMed.colunas.length} colunas`)
  console.log(`  ${pMed.registros.length} linhas -> ${meds.length} normalizadas`)
  console.log('  situação do registro:')
  for (const [v, n] of contar(meds, 'situacao').slice(0, 5)) console.log(`     ${String(n).padStart(7)}  ${v}`)

  console.log('\n[2/4] CMED — lista de preços')
  const fPre = await baixar(FONTES.precos)
  const tPre = await lerTexto(fPre)
  const pPre = parsear(tPre.texto, 20)
  const precos = normalizarPrecos(pPre.registros)
  console.log(`  encoding ${tPre.encoding} · cabecalho na linha ${pPre.linhaCabecalho} · ${pPre.colunas.length} colunas`)
  console.log(`  ${pPre.registros.length} linhas -> ${precos.length} normalizadas`)
  console.log(`  com PMC sem impostos: ${precos.filter(p => p.pmcSemImpostos !== null).length}`)
  console.log(`  comercializados:      ${precos.filter(p => p.comercializado).length}`)
  console.log('  tarja:')
  for (const [v, n] of contar(precos, 'tarja').slice(0, 5)) console.log(`     ${String(n).padStart(7)}  ${v}`)

  console.log('\n[3/4] Prova de integridade — acentuação e valores')
  const comAcento = meds.find(m => /[áéíóúâêôãõç]/i.test(m.produto || ''))
  console.log(`  acento preservado: ${comAcento ? `"${comAcento.produto}"` : 'NENHUM — encoding suspeito'}`)
  const caro = [...precos].filter(p => p.pmcSemImpostos).sort((a, b) => b.pmcSemImpostos - a.pmcSemImpostos)[0]
  if (caro) console.log(`  maior PMC: ${caro.produto} = R$ ${caro.pmcSemImpostos.toLocaleString('pt-BR')}`)
  const comFaixa = precos.find(p => Object.keys(p.pmcPorAliquota).length > 3)
  if (comFaixa) console.log(`  faixas de ICMS capturadas: ${Object.keys(comFaixa.pmcPorAliquota).length} em "${comFaixa.produto}"`)

  console.log('\n[4/4] Cruzamento com a base clínica própria')
  const ativos = new Set(precos.filter(p => p.comercializado).map(p => p.substanciaNorm).filter(Boolean))
  console.log(`  princípios ativos distintos comercializados: ${ativos.size}`)
  for (const alvo of ['varfarina', 'omeprazol', 'sinvastatina', 'clopidogrel', 'amiodarona']) {
    const achados = precos.filter(p => p.substanciaNorm.includes(alvo) && p.comercializado)
    const menor = achados.filter(p => p.pmcSemImpostos).sort((a, b) => a.pmcSemImpostos - b.pmcSemImpostos)[0]
    console.log(`     ${alvo.padEnd(14)} ${String(achados.length).padStart(4)} apresentações` +
      (menor ? ` · menor PMC R$ ${menor.pmcSemImpostos.toFixed(2)} (${menor.laboratorio || '?'})` : ''))
  }

  if (dryRun) {
    console.log('\nDry-run concluido — nenhuma escrita no banco.')
    return
  }

  // ── Gravacao ──────────────────────────────────────────────────────────────
  // Guardamos so o que o farmaceutico usa: registro ATIVO e apresentacao
  // COMERCIALIZADA. Registro caduco nao pode aparecer como opcao terapeutica, e
  // produto fora de comercio so gera recomendacao impossivel de cumprir.
  // Ancorado de proposito: /ativo/i casa com "Inativo" e deixaria passar os
  // 26.175 registros caducos como se fossem opcao terapeutica valida.
  const medsAtivos = meds.filter(m => /^ativo$/i.test((m.situacao || '').trim()))
  const precosVivos = precos.filter(p => p.comercializado)

  console.log(`\n[5/5] Gravando (filtrado: ${medsAtivos.length} registros ativos, ${precosVivos.length} apresentacoes comercializadas)`)

  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()

  // Dinheiro em centavos: float acumula erro ao somar/ordenar preco.
  const cents = v => (v === null || v === undefined) ? null : Math.round(v * 100)

  try {
    // Substituicao atomica: a lista da CMED e republicada inteira a cada
    // edicao, entao apagar-e-inserir dentro de uma transacao e mais correto (e
    // mais rapido) que reconciliar linha a linha. Se falhar, nada muda.
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe('DELETE FROM "ref_medicamentos"')
      await tx.$executeRawUnsafe('DELETE FROM "ref_apresentacoes"')

      const LOTE = 1000
      for (let i = 0; i < medsAtivos.length; i += LOTE) {
        const lote = medsAtivos.slice(i, i + LOTE)
        await tx.refMedicamento.createMany({
          data: lote.map((m, j) => ({
            id: m.registro ? `${m.registro}-${i + j}` : `sem-registro-${i + j}`,
            registro: m.registro,
            produto: m.produto,
            principioAtivo: m.principioAtivo,
            principioAtivoNorm: m.principioAtivoNorm || null,
            classeTerapeutica: m.classeTerapeutica,
            categoriaRegulatoria: m.categoriaRegulatoria,
            empresa: m.empresa,
          })),
          skipDuplicates: true,
        })
      }

      for (let i = 0; i < precosVivos.length; i += LOTE) {
        const lote = precosVivos.slice(i, i + LOTE)
        await tx.refApresentacao.createMany({
          data: lote
            .filter(p => p.ggrem)
            .map(p => ({
              ggrem: p.ggrem,
              registro: p.registro,
              ean: p.ean,
              substancia: p.substancia,
              substanciaNorm: p.substanciaNorm || null,
              produto: p.produto,
              apresentacao: p.apresentacao,
              laboratorio: p.laboratorio,
              classeTerapeutica: p.classeTerapeutica,
              tipoProduto: p.tipoProduto,
              tarja: p.tarja,
              restricaoHospitalar: p.restricaoHospitalar,
              pfSemImpostosCents: cents(p.pfSemImpostos),
              pmcSemImpostosCents: cents(p.pmcSemImpostos),
            })),
          skipDuplicates: true,
        })
      }
    }, { timeout: 120000 })

    const [nMed, nApr] = await Promise.all([
      prisma.refMedicamento.count(),
      prisma.refApresentacao.count(),
    ])
    console.log(`  gravado: ${nMed} medicamentos, ${nApr} apresentacoes`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(e => { console.error('FALHA:', e.message); process.exit(1) })
