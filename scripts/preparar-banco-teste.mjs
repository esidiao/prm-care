/**
 * Prepara o banco de TESTE local (pré-requisito da lacuna 20, testes E2E).
 *
 * POR QUE ISTO É NECESSÁRIO: o `.env` deste projeto aponta para o Supabase de
 * PRODUÇÃO — `DATABASE_URL` e `DIRECT_URL` levam ao banco real, compartilhado
 * com o prm-care-marketing. Rodar teste que cria paciente, análise ou evento
 * adverso contra esse banco escreveria em cima de dado clínico de verdade.
 *
 * Este script cria um banco separado no PostgreSQL local (porta 5432, já
 * instalado nesta máquina) e aplica o schema com `prisma db push`.
 *
 * ⚠️ `db push` é PROIBIDO contra produção neste projeto. Aqui é seguro e
 * correto: o alvo é um banco descartável, criado por este script, e a proteção
 * abaixo recusa qualquer URL que não seja localhost.
 *
 * Uso:
 *   set DATABASE_URL_TESTE=postgresql://postgres:SENHA@localhost:5432/prm_care_teste
 *   node scripts/preparar-banco-teste.mjs
 *
 * Depois, para rodar testes contra ele:
 *   DATABASE_URL=$DATABASE_URL_TESTE npx playwright test
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

// Resolvido a partir do próprio arquivo: o script tem que funcionar mesmo
// chamado de outro diretório.
const RAIZ_PROJETO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const URL_TESTE = process.env.DATABASE_URL_TESTE

if (!URL_TESTE) {
  console.error(`
Falta DATABASE_URL_TESTE.

  O PostgreSQL 16 já está instalado e escutando em localhost:5432, mas exige
  senha. Defina a variável apontando para o servidor local:

    postgresql://postgres:SUA_SENHA@localhost:5432/prm_care_teste

  O banco \`prm_care_teste\` não precisa existir — este script o cria.
`)
  process.exit(1)
}

// ── Proteção: nunca deixar isto tocar em banco remoto ───────────────────────
// `db push` mais adiante é destrutivo por natureza. Um erro de copiar-e-colar
// que aponte para produção apagaria dado clínico. A checagem é literal, e a
// falha é dura de propósito.
const alvo = new URL(URL_TESTE)
const LOCAIS = ['localhost', '127.0.0.1', '::1']
if (!LOCAIS.includes(alvo.hostname)) {
  console.error(`RECUSADO: DATABASE_URL_TESTE aponta para "${alvo.hostname}".`)
  console.error('Este script só opera em localhost — ele executa `prisma db push`, que é destrutivo.')
  process.exit(1)
}
if (!/teste|test/i.test(alvo.pathname)) {
  console.error(`RECUSADO: o banco "${alvo.pathname.slice(1)}" não tem "teste" no nome.`)
  console.error('Exigimos o nome explícito para evitar apontar para um banco de trabalho por engano.')
  process.exit(1)
}

const nomeBanco = alvo.pathname.slice(1)
console.log(`Preparando banco de teste "${nomeBanco}" em ${alvo.hostname}:${alvo.port}\n`)

// ── 1. Criar o banco, se ainda não existir ──────────────────────────────────
const admin = new pg.Client({
  host: alvo.hostname,
  port: Number(alvo.port || 5432),
  user: decodeURIComponent(alvo.username),
  password: decodeURIComponent(alvo.password),
  database: 'postgres',
  connectionTimeoutMillis: 8000,
})

await admin.connect()
const existe = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [nomeBanco])
if (existe.rows.length) {
  console.log(`  banco já existe — reaproveitando`)
} else {
  // Identificador não parametrizável: vem do nome já validado acima.
  await admin.query(`CREATE DATABASE "${nomeBanco}"`)
  console.log(`  banco criado`)
}
await admin.end()

// ── 2. Extensões que o schema usa ───────────────────────────────────────────
// pgcrypto é exigido pelo encadeamento da trilha de auditoria.
const noBanco = new pg.Client({
  host: alvo.hostname,
  port: Number(alvo.port || 5432),
  user: decodeURIComponent(alvo.username),
  password: decodeURIComponent(alvo.password),
  database: nomeBanco,
  connectionTimeoutMillis: 8000,
})
await noBanco.connect()
// Em PRODUÇÃO o pgcrypto vive no schema `extensions`. Instalar em `public` aqui
// criaria um banco que se comporta diferente — e a diferença só apareceria na
// hora de gravar na trilha de auditoria.
await noBanco.query('CREATE SCHEMA IF NOT EXISTS extensions')
await noBanco.query('CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions')
console.log('  extensão pgcrypto em `extensions` (como em produção)')
await noBanco.end()

// ── 3. Aplicar o schema ─────────────────────────────────────────────────────
console.log('\n  aplicando schema com `prisma db push`…')
execFileSync('npx', ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss'], {
  env: { ...process.env, DATABASE_URL: URL_TESTE, DIRECT_URL: URL_TESTE },
  stdio: 'inherit',
  shell: true,
})

// ── 4. Lógica que o Prisma não expressa ─────────────────────────────────────
// `db push` recria tabelas e índices, e mais nada: CHECKs, funções e triggers
// ficam de fora. Sem este passo o banco de teste ACEITA valor que produção
// rejeita e não encadeia a auditoria — teste passaria aqui e falharia lá.
console.log('\n  aplicando CHECKs, funções e trigger…')
const logica = new pg.Client({
  host: alvo.hostname,
  port: Number(alvo.port || 5432),
  user: decodeURIComponent(alvo.username),
  password: decodeURIComponent(alvo.password),
  database: nomeBanco,
  connectionTimeoutMillis: 8000,
})
await logica.connect()
await logica.query(readFileSync(path.join(RAIZ_PROJETO, 'prisma', 'sql', 'logica-de-banco.sql'), 'utf8'))
const chk = await logica.query(`SELECT count(*)::int AS n FROM pg_constraint WHERE contype='c' AND connamespace='public'::regnamespace`)
const trg = await logica.query(`SELECT count(*)::int AS n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal`)
console.log(`  ${chk.rows[0].n} CHECK constraints · ${trg.rows[0].n} trigger(s)`)
await logica.end()

// ── 5. Conferir ─────────────────────────────────────────────────────────────
const conf = new pg.Client({
  host: alvo.hostname,
  port: Number(alvo.port || 5432),
  user: decodeURIComponent(alvo.username),
  password: decodeURIComponent(alvo.password),
  database: nomeBanco,
  connectionTimeoutMillis: 8000,
})
await conf.connect()
const t = await conf.query(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'`)
console.log(`\n  ${t.rows[0].n} tabelas no banco de teste`)
await conf.end()

// Sem ecoar a senha: a URL completa está na variável que o usuário já definiu.
const urlMascarada = URL_TESTE.replace(/\/\/[^@]+@/, '//***@')
console.log(`
Pronto. Para rodar testes contra ele, aponte DATABASE_URL para o mesmo valor de
DATABASE_URL_TESTE (${urlMascarada}).

O .env do projeto NÃO foi alterado — ele continua apontando para produção, e
mudá-lo automaticamente seria a receita para rodar teste no banco errado.
`)
