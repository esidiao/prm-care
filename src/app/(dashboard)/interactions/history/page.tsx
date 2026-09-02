import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import { ArrowLeft, ChevronRight, AlertTriangle, CheckCircle } from 'lucide-react'

const RISK: Record<string, { label: string; cls: string }> = {
  contraindicated: { label: 'Contraindicada', cls: 'bg-red-100 text-red-800' },
  major: { label: 'Grave', cls: 'bg-orange-100 text-orange-800' },
  moderate: { label: 'Moderada', cls: 'bg-amber-100 text-amber-800' },
  minor: { label: 'Leve', cls: 'bg-green-100 text-green-800' },
}

export default async function InteractionsHistoryPage() {
  const session = await getSession()
  if (!session) return null

  const queries = await prisma.ddiQuery.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  const decided = new Set(
    (await prisma.ddiDecision.findMany({ where: { queryId: { in: queries.map(q => q.id) } }, select: { queryId: true } })).map(d => d.queryId),
  )

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/interactions" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Interações</Link>
      <h1 className="mt-2 text-2xl font-bold text-foreground">Histórico de consultas de interação</h1>

      {queries.length === 0 ? (
        <p className="mt-6 rounded-xl border border-border bg-muted px-4 py-6 text-center text-sm text-muted-foreground">Nenhuma consulta salva ainda. Faça uma consulta em Interações e clique em “Salvar consulta”.</p>
      ) : (
        <div className="mt-5 space-y-2">
          {queries.map(q => {
            const drugs = Array.isArray(q.inputDrugs) ? (q.inputDrugs as string[]) : []
            const r = q.globalRisk ? RISK[q.globalRisk] : null
            return (
              <Link key={q.id} href={`/interactions/${q.id}`} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {r && <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${r.cls}`}>{r.label}</span>}
                    <span className="truncate text-sm font-semibold text-foreground">{drugs.join(' + ') || '—'}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{new Date(q.createdAt).toLocaleString('pt-BR')}</span>
                    <span>· {q.count} interação(ões)</span>
                    {decided.has(q.id) && <span className="inline-flex items-center gap-0.5 text-emerald-700"><CheckCircle className="h-3 w-3" /> decidida</span>}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
