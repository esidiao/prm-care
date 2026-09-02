import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ShieldCheck, AlertTriangle, CircleHelp, Info } from 'lucide-react'
import { resumirCuradoria, MESES_ATE_VENCER } from '@/lib/curadoria'

/**
 * Governança da base clínica (lacuna 04).
 *
 * Converte um risco invisível em número medido: até 01/09/2026 nenhuma regra do
 * motor tinha registro de quando foi revisada nem por quem, e uma regra
 * desatualizada só seria descoberta por acaso.
 *
 * A tela é deliberadamente somente-leitura. As regras seguem no código, com
 * controle de versão, revisão por diff e cobertura de teste — o que se ganha
 * aqui é visibilidade e uma fila de trabalho, não um editor.
 */

export const dynamic = 'force-dynamic'

const CHIP: Record<string, string> = {
  sem_registro: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  vencida: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  em_dia: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
}
const ROTULO: Record<string, string> = {
  sem_registro: 'Sem registro',
  vencida: 'Vencida',
  em_dia: 'Em dia',
}

export default async function CuradoriaPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.user.role !== 'ADMIN') redirect('/dashboard')

  const r = resumirCuradoria()

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <ShieldCheck className="h-6 w-6 text-brand-800" /> Curadoria da base clínica
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quando cada regra do motor foi revisada, e por quem. Regra sem revisão há mais de{' '}
          {MESES_ATE_VENCER} meses conta como vencida.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Regras no motor</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{r.total}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-amber-800 dark:text-amber-300">
            <CircleHelp className="h-3.5 w-3.5" /> Sem registro
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-amber-900 dark:text-amber-200">{r.semRegistro}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/30">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-red-800 dark:text-red-300">
            <AlertTriangle className="h-3.5 w-3.5" /> Vencidas
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-red-900 dark:text-red-200">{r.vencidas}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cobertura</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{r.coberturaPct}%</p>
          <p className="mt-1 text-xs text-muted-foreground">{r.emDia} em dia</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border bg-muted px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">Por tipo de regra</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">Tipo</th>
                <th className="px-3 py-2.5 text-right font-medium">Total</th>
                <th className="px-3 py-2.5 text-right font-medium">Sem registro</th>
                <th className="px-5 py-2.5 text-right font-medium">Vencidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {r.porGrupo.map(g => (
                <tr key={g.grupo}>
                  <td className="px-5 py-2.5 font-medium text-foreground">{g.grupo}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{g.total}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-amber-700 dark:text-amber-400">{g.semRegistro}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-red-700 dark:text-red-400">{g.vencidas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {r.prioridade.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border bg-muted px-5 py-3">
            <h2 className="text-sm font-semibold text-foreground">Fila de revisão</h2>
            <p className="text-xs text-muted-foreground">
              Sem registro primeiro — não se sabe nada sobre elas —, depois as vencidas há mais tempo.
              Mostrando {r.prioridade.length} de {r.semRegistro + r.vencidas}.
            </p>
          </div>
          <div className="divide-y divide-border">
            {r.prioridade.map((regra, i) => (
              <div key={`${regra.grupo}-${regra.identificacao}-${i}`} className="flex items-center gap-3 px-5 py-2.5">
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${CHIP[regra.situacao]}`}>
                  {ROTULO[regra.situacao]}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{regra.grupo}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{regra.identificacao}</span>
                {regra.mesesDesdeRevisao !== null && (
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    há {regra.mesesDesdeRevisao} meses
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-muted p-5 text-xs text-muted-foreground space-y-1.5">
        <p className="flex items-center gap-1.5 font-semibold text-foreground">
          <Info className="h-4 w-4" /> Por que esta tela não edita regra
        </p>
        <p>
          As regras clínicas vivem no código, versionadas e cobertas por teste — cada alteração passa
          por revisão de diff antes de chegar ao paciente. Um formulário de edição livre trocaria essa
          barreira por nenhuma. O que faltava não era autonomia para editar, e sim <b>saber o que está
          vencido</b>: até 01/09/2026 nenhuma regra registrava data de revisão, e uma regra
          desatualizada só apareceria por acaso.
        </p>
        <p>
          Para registrar uma revisão, preencha <code>revisadoEm</code>, <code>revisor</code> e{' '}
          <code>fonte</code> na regra em <code>src/lib/prm-engine.ts</code>. O número acima sobe sozinho.
        </p>
      </div>
    </div>
  )
}
