/**
 * Service worker do PRM Care — escopo offline HONESTO (lacuna 19).
 *
 * O QUE FUNCIONA SEM REDE, e por quê:
 *   /calculators — computação pura no cliente. Clearance de creatinina, CKD-EPI,
 *   Charlson, risco cardiovascular, CHA₂DS₂-VASc e HAS-BLED não consultam o
 *   servidor. É o caso de uso real: à beira do leito e em visita domiciliar,
 *   onde falta sinal.
 *
 * O QUE NÃO FUNCIONA, e por que não fingimos que funciona:
 *   Paciente, análise, interações, monografia e impacto são renderizados no
 *   servidor a partir do banco. Servir cópia em cache mostraria dado clínico
 *   possivelmente vencido sem o usuário saber — pior que não mostrar. Essas
 *   rotas caem numa página que diz que está sem conexão e oferece as
 *   calculadoras.
 *
 * NUNCA CACHEAR: /api/*, /login e qualquer coisa sob autenticação. Guardar
 * resposta de API com dado de paciente no cache do navegador é exposição
 * desnecessária, e a sessão pode ter mudado.
 */

const VERSAO = 'prm-care-v1'
const CACHE_ESTATICO = `${VERSAO}-estatico`
const CACHE_PAGINAS = `${VERSAO}-paginas`

/** Assets que valem pré-carregar na instalação. */
const PRE_CACHE = [
  '/calculators',
  '/offline',
  '/icon.svg',
  '/manifest.json',
]

self.addEventListener('install', evento => {
  evento.waitUntil(
    caches.open(CACHE_ESTATICO)
      // `reload` evita gravar no cache uma resposta que já veio do cache HTTP.
      .then(c => c.addAll(PRE_CACHE.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
      // Falha de pré-cache não pode impedir a instalação: sem SW, o app fica
      // pior do que com um SW parcialmente povoado.
      .catch(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', evento => {
  evento.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(
        nomes.filter(n => !n.startsWith(VERSAO)).map(n => caches.delete(n)),
      ))
      .then(() => self.clients.claim()),
  )
})

function ehCacheavel(url) {
  if (url.origin !== self.location.origin) return false
  if (url.pathname.startsWith('/api/')) return false      // dado de paciente e sessão
  if (url.pathname.startsWith('/login')) return false     // fluxo de autenticação
  if (url.pathname.startsWith('/admin')) return false
  return true
}

/** Rotas que realmente funcionam offline. */
function funcionaOffline(url) {
  return url.pathname === '/calculators' || url.pathname === '/offline'
}

self.addEventListener('fetch', evento => {
  const req = evento.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (!ehCacheavel(url)) return

  // Estáticos do Next: imutáveis por hash no nome — cache primeiro é seguro.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    evento.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok) {
          const copia = res.clone()
          caches.open(CACHE_ESTATICO).then(c => c.put(req, copia))
        }
        return res
      })),
    )
    return
  }

  // Navegação: rede primeiro, para o dado clínico ser sempre o atual.
  if (req.mode === 'navigate') {
    evento.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok && funcionaOffline(url)) {
            const copia = res.clone()
            caches.open(CACHE_PAGINAS).then(c => c.put(req, copia))
          }
          return res
        })
        .catch(async () => {
          const doCache = await caches.match(req)
          if (doCache) return doCache
          // Sem rede e sem cópia: a página offline explica o que dá para fazer.
          return (await caches.match('/offline'))
            ?? new Response('Sem conexão.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
        }),
    )
  }
})
