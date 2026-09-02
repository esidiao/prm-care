import Link from 'next/link'
import { WifiOff, Calculator, ArrowRight } from 'lucide-react'

/**
 * Página servida pelo service worker quando não há rede (lacuna 19).
 *
 * Diz o que dá e o que não dá para fazer, em vez de "você está offline" e ponto.
 * Fica FORA do grupo (dashboard) de propósito: aquele layout consulta a sessão
 * no servidor, e sem rede não há servidor para consultar.
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <WifiOff className="h-7 w-7 text-muted-foreground" />
        </div>

        <h1 className="mt-4 text-xl font-bold text-foreground">Sem conexão</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Prontuário, análises e interações precisam do servidor — mostrar uma cópia guardada
          poderia exibir dado clínico vencido sem você perceber.
        </p>

        <Link
          href="/calculators"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-800 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-900">
          <Calculator className="h-4 w-4" />
          Abrir as calculadoras
          <ArrowRight className="h-4 w-4" />
        </Link>

        <p className="mt-3 text-xs text-muted-foreground">
          Funcionam sem rede: clearance de creatinina, CKD-EPI, Charlson, risco cardiovascular,
          CHA₂DS₂-VASc e HAS-BLED — todas calculam no próprio aparelho.
        </p>

        <p className="mt-8 text-xs text-muted-foreground">
          O restante volta assim que houver sinal. Nada do que você digitou foi perdido.
        </p>
      </div>
    </div>
  )
}
