import { TrendingDown, Info } from 'lucide-react'
import { formatarCents } from '@/lib/preco-referencia'
import type { OportunidadePaciente } from '@/lib/oportunidade-preco'

/**
 * Oportunidade de economia nos medicamentos do paciente.
 *
 * Diz "esta é a opção mais econômica nesta dose", NUNCA "você economiza X" — o
 * prontuário não guarda qual apresentação o paciente compra, então afirmar
 * economia realizada seria inventar. A distinção está no texto da tela, não só
 * no comentário do código.
 */
export function OportunidadePreco({ oportunidades }: { oportunidades: OportunidadePaciente[] }) {
  if (oportunidades.length === 0) return null

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border bg-muted px-5 py-3">
        <TrendingDown className="h-4 w-4 text-brand-800" />
        <h2 className="text-sm font-semibold text-foreground">Opções mais econômicas</h2>
        <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">CMED · preço por unidade</span>
      </div>

      <div className="divide-y divide-border">
        {oportunidades.map(o => (
          <div key={`${o.medicamento}-${o.dose}`} className="px-5 py-3.5">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <p className="text-sm font-semibold text-foreground">{o.medicamento} {o.dose}</p>
              <span className="text-xs text-muted-foreground">
                {o.opcoes} apresentações · variação de {o.amplitudePct.toFixed(0)}%
              </span>
            </div>
            <div className="mt-1.5 grid gap-1.5 text-xs sm:grid-cols-2">
              <p className="text-green-800 dark:text-green-300">
                <b>Mais econômica:</b> {o.maisBarata.produto} ({o.maisBarata.tipoProduto})
                {' — '}{formatarCents(o.maisBarata.centsPorUnidade, 3)}/unidade
                <span className="text-muted-foreground"> · {o.maisBarata.laboratorio}</span>
              </p>
              <p className="text-muted-foreground">
                <b>Mais cara:</b> {o.maisCara.produto} — {formatarCents(o.maisCara.centsPorUnidade, 3)}/unidade
              </p>
            </div>
          </div>
        ))}
      </div>

      <p className="flex gap-2 border-t border-border bg-muted px-5 py-3 text-[11px] text-muted-foreground">
        <Info className="mt-px h-3.5 w-3.5 shrink-0" />
        <span>
          O prontuário registra princípio ativo e dose, não a apresentação que o paciente compra —
          por isso a comparação mostra <b>a opção mais econômica disponível</b>, e não quanto o
          paciente deixaria de gastar. Preço por unidade, na mesma dose, a partir do preço máximo ao
          consumidor da CMED. Confirme forma farmacêutica e intercambialidade antes de propor troca.
        </span>
      </p>
    </div>
  )
}
