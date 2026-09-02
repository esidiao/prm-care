import { test, expect } from '@playwright/test'
import { semear, CONTA_TESTE } from './seed'

/**
 * Autenticação — o fluxo que ninguém conseguiu completar em 01–02/09/2026.
 *
 * Estes testes existem porque o login falhou duas vezes sem que houvesse como
 * distinguir credencial errada de defeito do sistema. Um teste que faz login de
 * verdade responde essa pergunta em segundos.
 */

test.beforeAll(async () => {
  await semear()
})

test('a tela de login não promete login por CPF', async ({ page }) => {
  // Regressão direta: a tela anunciava "CPF ou E-mail" em quatro lugares, e o
  // authorize() busca só por email. Quem digitava CPF culpava a própria senha.
  await page.goto('/login')
  await expect(page.getByLabel('E-mail')).toBeVisible()
  await expect(page.locator('body')).not.toContainText('CPF')
})

test('o campo aceita valor que não é e-mail', async ({ page }) => {
  // A conta administrativa real tem um CPF gravado NO CAMPO de e-mail. Trocar o
  // input para type="email" quebraria justamente ela — já quase aconteceu.
  await page.goto('/login')
  const campo = page.getByLabel('E-mail')
  await campo.fill('90919912168')
  expect(await campo.evaluate((el: HTMLInputElement) => el.checkValidity())).toBe(true)
})

test('credencial errada mostra erro visível, e não tela em branco', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(CONTA_TESTE.email)
  await page.getByLabel('Senha').fill('senha-errada-de-proposito')
  await page.getByRole('button', { name: /entrar/i }).click()

  await expect(page.getByText(/incorretos/i)).toBeVisible({ timeout: 15_000 })
  await expect(page).toHaveURL(/\/login/)
})

test('credencial correta entra e chega ao painel', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(CONTA_TESTE.email)
  await page.getByLabel('Senha').fill(CONTA_TESTE.senha)
  await page.getByRole('button', { name: /entrar/i }).click()

  await page.waitForURL(/\/dashboard/, { timeout: 30_000 })
  await expect(page.locator('body')).not.toContainText(/incorretos/i)
})

test('rota protegida redireciona quem não tem sessão', async ({ page }) => {
  await page.context().clearCookies()
  await page.goto('/patients')
  await expect(page).toHaveURL(/\/login|\/$/, { timeout: 15_000 })
})
