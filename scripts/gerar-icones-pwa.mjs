/**
 * Gera os ícones PWA a partir de `public/icon.svg`, a fonte da verdade da marca.
 *
 * POR QUE ESTE SCRIPT EXISTE: o `manifest.json` referenciava oito ícones que
 * NUNCA foram criados — todos davam 404 em produção. Um manifest que aponta para
 * arquivo inexistente não instala direito, e o navegador cai num ícone genérico.
 *
 * DUAS VARIANTES, de propósito:
 *   • "any"      — usa o SVG como está, com os cantos arredondados da marca.
 *   • "maskable" — fundo QUADRADO e logo a 80%. O sistema operacional aplica a
 *                  própria máscara (círculo, squircle); cantos arredondados no
 *                  arquivo ficam recortados de forma estranha, e conteúdo fora da
 *                  zona segura de 80% é cortado. Declarar o mesmo arquivo como
 *                  "any maskable" é o erro comum — as duas exigências brigam.
 *
 * Usa Chrome headless: não há biblioteca de imagem instalada, e acrescentar uma
 * dependência de runtime para gerar arquivo estático uma vez não se justifica.
 *
 * Uso: node scripts/gerar-icones-pwa.mjs
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const RAIZ = process.cwd()
const SVG = path.join(RAIZ, 'public', 'icon.svg')
const SAIDA = path.join(RAIZ, 'public', 'icons')

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find(p => existsSync(p))

if (!CHROME) {
  console.error('Chrome não encontrado. Ajuste o caminho no script.')
  process.exit(1)
}
if (!existsSync(SVG)) {
  console.error(`Fonte ausente: ${SVG}`)
  process.exit(1)
}

const TAMANHOS = [72, 96, 128, 144, 152, 192, 384, 512]
const MASKABLE = [192, 512]

const svg = readFileSync(SVG, 'utf8')
const trabalho = path.join(tmpdir(), `prm-icons-${Date.now()}`)
mkdirSync(trabalho, { recursive: true })
mkdirSync(SAIDA, { recursive: true })

/**
 * `escala` < 1 encolhe o logo dentro do quadro, deixando margem — é o que a zona
 * segura do maskable exige. `fundo` preenche a área toda, sem canto arredondado.
 */
function paginaHtml(tamanho, { escala = 1, fundo = null } = {}) {
  return `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;width:${tamanho}px;height:${tamanho}px;overflow:hidden}
  body{background:${fundo ?? 'transparent'};display:flex;align-items:center;justify-content:center}
  svg{width:${Math.round(tamanho * escala)}px;height:${Math.round(tamanho * escala)}px;display:block}
</style>
${svg}`
}

function renderizar(nomeArquivo, tamanho, opcoes) {
  const html = path.join(trabalho, `${nomeArquivo}.html`)
  const png = path.join(SAIDA, `${nomeArquivo}.png`)
  writeFileSync(html, paginaHtml(tamanho, opcoes), 'utf8')

  execFileSync(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    // Caminho ABSOLUTO na saída e perfil em temp: sem isso o Chrome devolve
    // "Acesso negado" no Windows.
    `--user-data-dir=${path.join(trabalho, `perfil-${nomeArquivo}`)}`,
    '--default-background-color=00000000',
    `--window-size=${tamanho},${tamanho}`,
    `--screenshot=${png}`,
    `file:///${html.replace(/\\/g, '/')}`,
  ], { stdio: 'pipe', timeout: 60_000 })

  return png
}

console.log('Gerando ícones PWA a partir de public/icon.svg\n')

let gerados = 0
for (const t of TAMANHOS) {
  const png = renderizar(`icon-${t}`, t)
  const bytes = statSync(png).size
  console.log(`  any       icon-${String(t).padEnd(3)} ${String(t).padStart(3)}x${t}  ${String(bytes).padStart(6)} bytes`)
  gerados++
}

for (const t of MASKABLE) {
  // 80% = zona segura do maskable; fundo quadrado porque o SO aplica a máscara.
  const png = renderizar(`icon-maskable-${t}`, t, { escala: 0.8, fundo: '#0f2744' })
  const bytes = statSync(png).size
  console.log(`  maskable  icon-maskable-${t}  ${t}x${t}  ${String(bytes).padStart(6)} bytes`)
  gerados++
}

rmSync(trabalho, { recursive: true, force: true })
console.log(`\n${gerados} ícones gravados em public/icons/`)
