import { Syringe, ExternalLink, AlertTriangle } from 'lucide-react'
import type { PreparoInjetavel as Preparo } from '@/lib/drug-lookup-service'

/**
 * Preparo e administração do injetável — texto da bula, citado, não interpretado.
 *
 * DUAS COISAS QUE ESTA TELA PRECISA DIZER, E DIZ:
 *
 * 1. NÃO é compatibilidade em Y. É fármaco × veículo (diluente, pH, material),
 *    não fármaco × fármaco. Não existe base livre e licenciável de Y-site —
 *    ver docs/PARECER_FONTES_COMPATIBILIDADE_IV.md. Deixar o farmacêutico
 *    acreditar que checou compatibilidade seria pior que não ter a seção.
 *
 * 2. A bula é NORTE-AMERICANA. O produto registrado na ANVISA pode ter
 *    excipiente, diluente e apresentação diferentes.
 *
 * O texto é exibido VERBATIM de propósito: extrair afirmações da bula por
 * palavra-chave inventa incompatibilidade que não existe.
 */
export function PreparoInjetavelSecao({
  preparo,
  substancia,
}: {
  preparo: Preparo
  substancia: string
}) {
  const secoes = [
    { titulo: 'Posologia e administração', texto: preparo.administracao },
    { titulo: 'Apresentação e conservação', texto: preparo.conservacao },
    { titulo: 'Descrição do produto', texto: preparo.descricao },
  ].filter(s => s.texto?.trim())

  if (secoes.length === 0) return null

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted px-5 py-3">
        <Syringe className="h-4 w-4 text-brand-800" />
        <h2 className="text-sm font-semibold text-foreground">Preparo e administração do injetável</h2>
        <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
          bula FDA · texto original
        </span>
      </div>

      <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <p className="flex gap-2">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>
            <b>Isto não é checagem de compatibilidade em Y.</b> O conteúdo abaixo trata de diluente,
            pH, material e conservação — fármaco e veículo, não fármaco com fármaco. Para
            compatibilidade entre dois injetáveis na mesma via, consulte fonte específica.
          </span>
        </p>
      </div>

      <div className="divide-y divide-border">
        {secoes.map(s => (
          <div key={s.titulo} className="px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{s.titulo}</p>
            <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-foreground">{s.texto}</p>
          </div>
        ))}
      </div>

      <p className="border-t border-border bg-muted px-5 py-3 text-[11px] text-muted-foreground">
        Texto reproduzido da bula norte-americana de <b>{preparo.resolvedName}</b> (FDA/DailyMed,
        domínio público), sem edição nossa. <b>O produto registrado na ANVISA pode diferir</b> em
        excipiente, diluente e apresentação — confirme na bula brasileira de {substancia}.{' '}
        <a
          href={`https://consultas.anvisa.gov.br/#/bulario/q/?nomeProduto=${encodeURIComponent(substancia)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 underline">
          Bulário da ANVISA <ExternalLink className="h-3 w-3" />
        </a>
      </p>
    </div>
  )
}
