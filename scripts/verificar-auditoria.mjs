/**
 * Verificador da trilha de auditoria (lacuna 09).
 *
 * Percorre `audit_logs` em ordem de sequência, recalcula o hash de cada linha e
 * confere se ela aponta para o hash da anterior. Alteração retroativa quebra a
 * cadeia a partir do ponto adulterado, e a quebra aparece aqui.
 *
 * O RECÁLCULO USA A PRÓPRIA FUNÇÃO SQL `audit_logs_hash`, de propósito.
 * Reimplementar o SHA-256 em JS criaria uma segunda fórmula, e duas fórmulas
 * divergem — o verificador passaria a acusar quebra onde não há, ou pior, a
 * ignorar onde há.
 *
 * O QUE ISTO NÃO PROVA:
 *   • Não impede alteração; detecta.
 *   • Quem tem escrita no banco pode recalcular a cadeia inteira e ficar
 *     consistente. A defesa é ancorar o hash da ponta FORA do banco — este
 *     script imprime esse hash justamente para permitir a âncora.
 *   • As linhas anteriores a 02/09/2026 foram encadeadas retroativamente: estão
 *     protegidas daqui para a frente, e nada se prova sobre o que houve antes.
 *
 * Uso:  node scripts/verificar-auditoria.mjs
 * Saída: código 0 se íntegra, 1 se houver quebra.
 */

import fs from 'node:fs'
import pg from 'pg'

for (const linha of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = linha.match(/^([A-Z_]+)=["']?(.*?)["']?$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const client = new pg.Client({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
})

await client.connect()

const { rows } = await client.query(`
  SELECT
    a."sequencia", a."id", a."action", a."resource", a."createdAt",
    a."hash", a."hashAnterior",
    "audit_logs_hash"(a."sequencia", a."id", a."userId", a."action", a."resource",
                      a."resourceId", a."details"::text, a."createdAt", a."hashAnterior") AS recalculado,
    lag(a."hash") OVER (ORDER BY a."sequencia") AS hash_da_anterior
  FROM "audit_logs" a
  ORDER BY a."sequencia" ASC
`)

if (rows.length === 0) {
  console.log('Trilha vazia — nada a verificar.')
  await client.end()
  process.exit(0)
}

const problemas = []
for (const r of rows) {
  if (!r.hash) {
    problemas.push({ seq: r.sequencia, tipo: 'sem hash', detalhe: 'linha gravada antes do encadeamento ou com trigger desativado' })
    continue
  }
  if (r.hash !== r.recalculado) {
    problemas.push({ seq: r.sequencia, tipo: 'CONTEÚDO ADULTERADO', detalhe: `${r.action} em ${r.resource} — o hash gravado não corresponde ao conteúdo atual` })
  }
  const esperado = r.hash_da_anterior ?? 'genesis'
  if (r.hashAnterior !== esperado) {
    problemas.push({ seq: r.sequencia, tipo: 'ELO ROMPIDO', detalhe: `aponta para ${String(r.hashAnterior).slice(0, 12)}…, mas a anterior tem ${String(esperado).slice(0, 12)}… — linha removida ou reordenada` })
  }
}

const ponta = rows[rows.length - 1]

console.log('VERIFICAÇÃO DA TRILHA DE AUDITORIA\n')
console.log(`  registros:  ${rows.length}`)
console.log(`  período:    ${rows[0].createdAt.toISOString().slice(0, 10)} a ${ponta.createdAt.toISOString().slice(0, 10)}`)
console.log(`  ponta:      #${ponta.sequencia}`)
console.log(`  hash âncora: ${ponta.hash}`)

if (problemas.length === 0) {
  console.log('\n  ✓ CADEIA ÍNTEGRA — nenhuma alteração retroativa detectada.')
  console.log('\n  Guarde o hash âncora acima fora do banco. Sem essa cópia externa,')
  console.log('  quem tiver escrita pode recalcular a cadeia inteira sem ser notado.')
  await client.end()
  process.exit(0)
}

console.log(`\n  ✗ ${problemas.length} PROBLEMA(S) — a trilha NÃO é confiável a partir do primeiro:\n`)
for (const p of problemas.slice(0, 20)) {
  console.log(`   #${String(p.seq).padStart(5)}  ${p.tipo}`)
  console.log(`          ${p.detalhe}`)
}
if (problemas.length > 20) console.log(`   ... e mais ${problemas.length - 20}`)

await client.end()
process.exit(1)
