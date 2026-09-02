'use client'

import { useState } from 'react'
import { Copy, Check, ExternalLink, Send, Loader2, AlertTriangle } from 'lucide-react'
import { apiErrorMessage } from '@/lib/utils'
import type { CampoFicha } from '@/lib/evento-adverso'

/** Formulário aberto do VigiMed — não exige cadastro para profissional de saúde. */
const URL_VIGIMED = 'https://www.gov.br/anvisa/pt-br/assuntos/fiscalizacao-e-monitoramento/notificacoes/vigimed'

/**
 * Ficha pronta para transcrição no VigiMed, e o registro de que foi notificada.
 *
 * O sistema NÃO submete: o VigiMed não expõe API pública para notificação por
 * profissional. O que a tela entrega é não redigitar, não esquecer campo
 * obrigatório, e guardar o protocolo — para "isso foi notificado?" ter resposta
 * que não dependa da memória de alguém.
 */
export function FichaVigimed({
  eventoId,
  ficha,
  pendencias,
  textoFicha,
  notificadoEm,
  protocolo,
}: {
  eventoId: string
  ficha: CampoFicha[]
  pendencias: string[]
  textoFicha: string
  notificadoEm: string | null
  protocolo: string | null
}) {
  const [copiado, setCopiado] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [estado, setEstado] = useState<{ notificadoEm: string | null; protocolo: string | null }>({
    notificadoEm, protocolo,
  })
  const [campoProtocolo, setCampoProtocolo] = useState(protocolo ?? '')

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(textoFicha)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch { /* área de transferência bloqueada — a ficha segue visível */ }
  }

  const marcar = async (notificado: boolean) => {
    setSalvando(true)
    setErro(null)
    try {
      const res = await fetch(`/api/eventos-adversos/${eventoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificado, protocoloVigimed: campoProtocolo || null }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(apiErrorMessage(json, 'Não foi possível salvar.'))
      setEstado({ notificadoEm: json.data.notificadoEm, protocolo: json.data.protocoloVigimed })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-4">
      {pendencias.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="flex gap-2">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
            <span>
              <b>{pendencias.length} campo(s) obrigatório(s) em branco:</b> {pendencias.join(', ')}.
              O VigiMed recusa a notificação sem eles — complete no cadastro do paciente antes de enviar.
            </span>
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-border">
            {ficha.map(c => (
              <tr key={c.rotulo} className={c.faltando ? 'bg-amber-50 dark:bg-amber-950/20' : ''}>
                <td className="w-56 px-3 py-2 align-top text-xs font-medium text-muted-foreground">
                  {c.rotulo}{c.obrigatorio && <span className="text-red-600 dark:text-red-400"> *</span>}
                </td>
                <td className="px-3 py-2 text-foreground">
                  {c.valor || <span className="text-amber-700 dark:text-amber-400">— em branco</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={copiar}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted">
          {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copiado ? 'Ficha copiada' : 'Copiar ficha'}
        </button>
        <a
          href={URL_VIGIMED}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-800 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-900">
          Abrir o VigiMed <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="rounded-lg border border-border bg-muted p-4">
        {estado.notificadoEm ? (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-green-800 dark:text-green-300">
              <Check className="h-4 w-4" />
              Notificado em {new Date(estado.notificadoEm).toLocaleDateString('pt-BR')}
              {estado.protocolo && ` · protocolo ${estado.protocolo}`}
            </p>
            <button
              onClick={() => marcar(false)}
              disabled={salvando}
              className="text-xs text-muted-foreground underline hover:text-foreground disabled:opacity-50">
              desfazer marcação
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground">Já enviou pelo portal da ANVISA?</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={campoProtocolo}
                onChange={e => setCampoProtocolo(e.target.value)}
                placeholder="Protocolo do VigiMed (opcional)"
                aria-label="Protocolo do VigiMed"
                className="flex-1 min-w-48 rounded-lg border border-input bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-brand-800"
              />
              <button
                onClick={() => marcar(true)}
                disabled={salvando}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50">
                {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Registrar notificação
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              O PRM Care não envia ao VigiMed — não existe API pública para notificação por
              profissional. O envio é seu, pelo portal; aqui fica o registro de que foi feito.
            </p>
          </div>
        )}
        {erro && <p className="mt-2 text-xs text-red-700 dark:text-red-400">{erro}</p>}
      </div>
    </div>
  )
}
