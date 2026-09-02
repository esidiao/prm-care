'use client'

import { useEffect } from 'react'

/**
 * Registra o service worker (lacuna 19).
 *
 * Sem este registro o `public/sw.js` existe e nunca entra em ação — foi
 * exatamente o estado anterior do `manifest.json`: arquivo presente, efeito
 * nenhum.
 *
 * Só em produção: em desenvolvimento o service worker serve versão em cache e
 * faz parecer que a alteração não subiu, o que custa horas de depuração falsa.
 */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    // Após o load: registrar durante o carregamento disputa banda com o que a
    // página precisa para aparecer.
    const registrar = () => {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        // Falha aqui não pode quebrar o app — offline é melhoria, não requisito.
        console.warn('[sw] registro falhou:', err?.message ?? err)
      })
    }

    if (document.readyState === 'complete') registrar()
    else {
      window.addEventListener('load', registrar)
      return () => window.removeEventListener('load', registrar)
    }
  }, [])

  return null
}
