import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle, Phone, Stethoscope } from 'lucide-react'
import { DDI_ATTRIBUTION } from '@/lib/ddi-attribution'

const COR: Record<string, string> = { contraindicated: 'border-red-300', major: 'border-orange-300', moderate: 'border-amber-300', minor: 'border-green-300' }
const CHIP: Record<string, string> = { contraindicated: 'bg-red-100 text-red-800', major: 'bg-orange-100 text-orange-800', moderate: 'bg-amber-100 text-amber-800', minor: 'bg-green-100 text-green-800' }

export default async function InteractionsDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return null

  const query = await prisma.ddiQuery.findFirst({ where: { id: params.id, userId: session.user.id } })
  if (!query) notFound()

  const [results, decision] = await Promise.all([
    prisma.ddiResult.findMany({ where: { queryId: query.id } }),
    prisma.ddiDecision.findUnique({ where: { queryId: query.id } }),
  ])
  const drugs = Array.isArray(query.inputDrugs) ? (query.inputDrugs as string[]) : []

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/interactions/history" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Histórico</Link>
      <h1 className="mt-2 text-2xl font-bold text-foreground">Consulta de interações</h1>
      <p className="mt-1 text-sm text-muted-foreground">{new Date(query.createdAt).toLocaleString('pt-BR')} · {drugs.join(' + ')}</p>

      <div className="mt-4 space-y-3">
        {results.map(r => {
          const p = (r.payload || {}) as { drugs?: string[]; severityLabel?: string; mechanism?: string; clinicalEffect?: string; management?: string }
          return (
            <div key={r.id} className={`rounded-xl border bg-card p-4 ${COR[r.severity] || 'border-border'}`}>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${CHIP[r.severity] || 'bg-muted text-foreground'}`}>{p.severityLabel || r.severity}</span>
                <span className="font-semibold text-foreground">{(p.drugs || []).join(' + ')}</span>
              </div>
              {p.mechanism && <p className="mt-2 text-sm text-foreground"><b>Mecanismo:</b> {p.mechanism}</p>}
              {p.clinicalEffect && <p className="text-sm text-foreground"><b>Efeito clínico:</b> {p.clinicalEffect}</p>}
              {p.management && <p className="text-sm text-foreground"><b>Conduta:</b> {p.management}</p>}
            </div>
          )
        })}
        {results.length === 0 && <p className="text-sm text-muted-foreground">Sem interações registradas nesta consulta.</p>}

        {/* Atribuição obrigatória — esta página distribui resultados da base externa */}
        <p className="mt-4 border-t border-border pt-3 text-[11px] text-muted-foreground">{DDI_ATTRIBUTION}</p>
      </div>

      {decision && (
        <div className="mt-5 rounded-xl border border-border bg-muted p-4">
          <h2 className="text-sm font-semibold text-foreground">Decisão clínica registrada</h2>
          {decision.note && <p className="mt-1 text-sm text-foreground">{decision.note}</p>}
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {decision.intervened && <span className="inline-flex items-center gap-1"><Stethoscope className="h-3.5 w-3.5" /> Intervenção farmacêutica</span>}
            {decision.contactedMD && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> Contato com prescritor</span>}
            {decision.outcome && <span>Desfecho: {decision.outcome}</span>}
          </div>
        </div>
      )}

      <p className="mt-5 flex items-start gap-1 rounded-lg bg-teal-50 px-4 py-3 text-xs text-teal-900">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Registro histórico — apoio à decisão. A conduta final cabe ao farmacêutico, considerando o contexto clínico atual.
      </p>
    </div>
  )
}
