import { defineConfig, devices } from '@playwright/test'

/**
 * Testes de fluxo (lacuna 20).
 *
 * O PROBLEMA QUE ISTO RESOLVE: `tsc`, testes unitários e build passaram verdes
 * em cima de defeitos que só apareciam ao usar o app — calculadoras anunciadas
 * e inexistentes, login por CPF sem implementação, ícones referenciados e nunca
 * criados, manifest inalcançável, rota de cron barrada pelo middleware. Nenhum
 * desses aparece em teste unitário.
 *
 * ⚠️ EXIGE `DATABASE_URL` APONTANDO PARA O BANCO DE TESTE.
 * O `.env` do projeto aponta para o Supabase de PRODUÇÃO. Os testes criam e
 * apagam paciente, análise e evento adverso — contra produção, destruiriam
 * registro clínico. A verificação abaixo falha ANTES de subir o servidor.
 *
 * Preparar o banco:  node scripts/preparar-banco-teste.mjs
 * Rodar (PowerShell):
 *   $env:DATABASE_URL = 'postgresql://postgres:SENHA@localhost:5432/prm_care_teste'
 *   npx playwright test
 */

const URL_BANCO = process.env.DATABASE_URL ?? ''

if (!URL_BANCO) {
  throw new Error(
    'DATABASE_URL não definida.\n' +
    'Aponte para o banco de TESTE antes de rodar — nunca para produção.',
  )
}
{
  const u = new URL(URL_BANCO)
  const local = ['localhost', '127.0.0.1', '::1'].includes(u.hostname)
  const nomeDeTeste = /teste|test/i.test(u.pathname)
  if (!local || !nomeDeTeste) {
    throw new Error(
      `RECUSADO: DATABASE_URL aponta para "${u.hostname}${u.pathname}".\n` +
      'Os testes apagam e recriam dados. Só rodam contra banco local com "teste" no nome.',
    )
  }
}

const PORTA = 3100
const BASE = `http://localhost:${PORTA}`

export default defineConfig({
  testDir: './e2e',
  // Um fluxo por vez: os testes compartilham o mesmo banco semeado, e paralelizar
  // faria um apagar o paciente que o outro está usando.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: BASE,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    // Só guarda rastro do que falhou: rastro de teste verde é lixo que ninguém lê.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    // `next dev` e não `build && start`: o ciclo de correção fica curto, e o
    // objetivo aqui é exercitar comportamento, não medir desempenho de produção.
    command: 'npx next dev -p ' + PORTA,
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      // Repassado explicitamente: o servidor precisa herdar o banco de TESTE,
      // e não o DATABASE_URL do .env, que aponta para produção.
      DATABASE_URL: URL_BANCO,
      DIRECT_URL: URL_BANCO,
      NEXTAUTH_URL: BASE,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? 'segredo-apenas-para-teste-local',
      NODE_ENV: 'development',
    },
  },
})
