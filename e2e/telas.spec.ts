import { test, expect, type Page } from '@playwright/test'
import { semear, CONTA_TESTE, CONTA_ADMIN } from './seed'

/**
 * As telas construídas em 31/08–02/09/2026 e nunca clicadas (lacuna 20).
 *
 * Todas passaram em `tsc`, teste unitário e build. Nenhuma foi aberta. Estes
 * testes verificam o que aquelas checagens não alcançam: se a página renderiza,
 * se o dado chega nela, e se as ressalvas que a tornam honesta continuam ali.
 */

async function entrar(page: Page, conta = CONTA_TESTE) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(conta.email)
  await page.getByLabel('Senha').fill(conta.senha)
  await page.getByRole('button', { name: /entrar/i }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 })
}

test.beforeAll(async () => {
  await semear()
})

test.describe('Calculadoras', () => {
  test.beforeEach(async ({ page }) => { await entrar(page) })

  test('as seis abas existem — o tour já anunciou calculadoras inexistentes', async ({ page }) => {
    await page.goto('/calculators')
    for (const nome of ['CKD-EPI', 'Cockcroft-Gault', 'Charlson', 'Risco Cardiovascular', 'CHA2DS2-VASc', 'HAS-BLED']) {
      await expect(page.getByRole('button', { name: new RegExp(nome, 'i') })).toBeVisible()
    }
  })

  test('CHA2DS2-VASc: o limiar sobe para 3 em mulheres', async ({ page }) => {
    await page.goto('/calculators')
    await page.getByRole('button', { name: /CHA2DS2-VASc/i }).click()

    // Hipertensão (1) + sexo feminino (1) = 2 pontos. Em homem indicaria
    // anticoagulação; em mulher, não — o ponto do sexo é modificador de risco.
    await page.getByRole('checkbox').nth(1).check()   // Hipertensão
    await page.getByRole('checkbox').nth(7).check()   // Sexo feminino
    await expect(page.getByText(/não indicada apenas pelo escore/i)).toBeVisible()
  })

  test('HAS-BLED: escore alto não é apresentado como contraindicação', async ({ page }) => {
    await page.goto('/calculators')
    await page.getByRole('button', { name: /HAS-BLED/i }).click()
    for (const i of [0, 1, 2]) await page.getByRole('checkbox').nth(i).check()

    await expect(page.getByText(/Risco alto de sangramento/i)).toBeVisible()
    await expect(page.getByText(/não é contraindicação/i)).toBeVisible()
  })
})

test.describe('Medicamentos e monografia', () => {
  test.beforeEach(async ({ page }) => { await entrar(page) })

  test('a busca agrupa por substância e mostra o menor preço', async ({ page }) => {
    await page.goto('/medicamentos?q=sinvastatina')
    await expect(page.getByText('SINVASTATINA', { exact: false }).first()).toBeVisible()
    await expect(page.getByText(/a partir de/i).first()).toBeVisible()
  })

  test('associação aparece separada do monofármaco', async ({ page }) => {
    await page.goto('/medicamentos?q=sinvastatina')
    // EZETIMIBA;SINVASTATINA é outra substância — não pode ser diluída na lista
    // da sinvastatina isolada.
    await expect(page.getByText(/EZETIMIBA/i)).toBeVisible()
  })

  test('a monografia mostra apresentações e declara a fonte', async ({ page }) => {
    await page.goto('/medicamentos/sinvastatina')
    await expect(page.getByRole('heading', { name: /SINVASTATINA/i })).toBeVisible()
    await expect(page.getByText(/Gen[ée]rico/i).first()).toBeVisible()
    await expect(page.getByText(/ANVISA/i).first()).toBeVisible()
    // A ressalva que impede a página de passar por bula
    await expect(page.getByText(/não reproduz o texto da bula/i)).toBeVisible()
  })

  test('associação exibe o nome legível, não o ponto-e-vírgula cru', async ({ page }) => {
    await page.goto('/medicamentos/ezetimiba%3Bsinvastatina')
    await expect(page.getByRole('heading', { name: /EZETIMIBA \+ SINVASTATINA/i })).toBeVisible()
  })
})

test.describe('Impacto clínico', () => {
  test('declara que não estima custo evitado', async ({ page }) => {
    await entrar(page)
    await page.goto('/impacto')
    await expect(page.getByRole('heading', { name: /Impacto clínico/i })).toBeVisible()
    // A honestidade da página é parte do produto: sem dado de custo, não há
    // projeção em reais. Se alguém remover isso, o teste acusa.
    await expect(page.getByText(/não é economia realizada|não estima|oportunidade/i).first()).toBeVisible()
  })
})

test.describe('Reações adversas', () => {
  test('a tela declara que não submete ao VigiMed', async ({ page }) => {
    await entrar(page)
    await page.goto('/eventos-adversos')
    await expect(page.getByRole('heading', { name: /Reações adversas/i })).toBeVisible()
    await expect(page.getByText(/não submete/i)).toBeVisible()
  })
})

test.describe('Curadoria — só ADMIN', () => {
  test('farmacêutico comum não acessa', async ({ page }) => {
    await entrar(page, CONTA_TESTE)
    await page.goto('/admin/curadoria')
    await expect(page).not.toHaveURL(/\/admin\/curadoria/, { timeout: 15_000 })
  })

  test('admin vê o retrato da base e a cobertura', async ({ page }) => {
    await entrar(page, CONTA_ADMIN)
    await page.goto('/admin/curadoria')
    await expect(page.getByRole('heading', { name: /Curadoria/i })).toBeVisible()
    await expect(page.getByText(/Sem registro/i).first()).toBeVisible()
    await expect(page.getByText(/não edita regra/i)).toBeVisible()
  })
})

test.describe('PWA', () => {
  test('manifest e ícones são alcançáveis SEM sessão', async ({ page }) => {
    // Regressão: o manifest devolvia 307 (middleware) e os ícones, 404.
    await page.context().clearCookies()
    for (const [rota, tipo] of [
      ['/manifest.json', /application\/json/],
      ['/sw.js', /javascript/],
      ['/icons/icon-192.png', /image\/png/],
    ] as const) {
      const res = await page.request.get(rota)
      expect(res.status(), `${rota} deve responder 200`).toBe(200)
      expect(res.headers()['content-type']).toMatch(tipo)
    }
  })

  test('a página offline diz o que funciona sem rede', async ({ page }) => {
    await page.goto('/offline')
    await expect(page.getByText(/Sem conexão/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /calculadoras/i })).toBeVisible()
  })
})
