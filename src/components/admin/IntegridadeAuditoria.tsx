'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck, ShieldAlert, Loader2, Copy, Check } from 'lucide-react'

/**
 * Estado da cadeia de auditoria (lacuna 09).
 *
 * A tela declara o limite do que a técnica prova. Encadeamento por hash DETECTA
 * alteração retroativa; não a impede, e quem tem escrita no banco pode recalcular
 * a cadeia inteira. Por isso o hash da ponta fica copiável: guardado fora do
 * banco, ele é o que torna o recálculo detectável.
 */

interface Estado {
  total: number
  integra: boolean
  problemas: Array<{ sequencia: string; tipo: string; detalhe: string }>
  totalProblemas: number
  ancora: string | null
  sequenciaPonta: string | null
  verificadoEm: string
}

export function IntegridadeAuditoria() {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    fetch('/api/admin/audit-integrity')
      .then(async r => {
        const j = await r.json().catch(() => null)
        if (!r.ok) throw new Error(j?.error || 'Falha ao verificar')
        setEstado(j)
      })
      .catch(e => setErro(e instanceof Error ? e.message : 'Falha ao verificar'))
  }, [])

  const copiar = async () => {
    if (!estado?.ancora) return
    try {
      await navigator.clipboard.writeText(estado.ancora)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch { /* área de transferência bloqueada — o hash segue visível na tela */ }
  }

  if (erro) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Não foi possível verificar a integridade da trilha: {erro}
      </div>
    )
  }

  if (!estado) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Verificando a cadeia…
      </div>
    )
  }

  const ok = estado.integra

  return (
    <div className={`overflow-hidden rounded-xl border ${ok ? 'border-border bg-card' : 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30'}`}>
      <div className="flex flex-wrap items-center gap-2 px-5 py-3.5">
        {ok
          ? <ShieldCheck className="h-4 w-4 text-green-700 dark:text-green-400" />
          : <ShieldAlert className="h-4 w-4 text-red-700 dark:text-red-400" />}
        <h2 className={`text-sm font-semibold ${ok ? 'text-foreground' : 'text-red-900 dark:text-red-200'}`}>
          {ok ? 'Cadeia íntegra' : `${estado.totalProblemas} problema(s) na cadeia`}
        </h2>
        <span className="text-xs text-muted-foreground">
          {estado.total} registro{estado.total === 1 ? '' : 's'} verificado{estado.total === 1 ? '' : 's'}
        </span>
      </div>

      {!ok && (
        <div className="border-t border-red-200 px-5 py-3 dark:border-red-900">
          <ul className="space-y-1 text-xs text-red-900 dark:text-red-200">
            {estado.problemas.map((p, i) => (
              <li key={i}>
                <b>#{p.sequencia} — {p.tipo}:</b> {p.detalhe}
              </li>
            ))}
          </ul>
        </div>
      )}

      {estado.ancora && (
        <div className="border-t border-border px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Hash âncora (#{estado.sequenciaPonta})</span>
            <button
              onClick={copiar}
              className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted">
              {copiado ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copiado ? 'copiado' : 'copiar'}
            </button>
          </div>
          <code className="mt-1 block break-all font-mono text-[11px] text-foreground">{estado.ancora}</code>
        </div>
      )}

      <p className="border-t border-border bg-muted px-5 py-3 text-[11px] text-muted-foreground">
        O encadeamento por hash <b>detecta</b> alteração retroativa — não a impede. Quem tiver escrita
        no banco pode recalcular a cadeia inteira e ficar consistente:{' '}
        <b>guarde o hash âncora fora do banco</b> (e-mail, repositório, carimbo de tempo) para que esse
        recálculo também fique detectável. Os registros anteriores a 02/09/2026 foram encadeados
        retroativamente — estão protegidos daqui para a frente, e nada se afirma sobre o que houve antes.
      </p>
    </div>
  )
}
