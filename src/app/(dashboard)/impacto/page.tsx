import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import {
  TrendingUp, CheckCircle2, AlertTriangle, Phone, Clock,
  Stethoscope, FlaskConical, ArrowRight,
} from 'lucide-react'
import { RiskLevel } from '@prisma/client'

/**
 * Painel de impacto clínico.
 *
 * Responde "o que este trabalho mudou", não "quanto o sistema foi usado" — a
 * diferença entre defender a renovação de um contrato e mostrar log de acesso.
 *
 * Tudo aqui é agregação sobre dado que já existia e não era somado:
 * `PRMFinding.isResolved/resolvedAt` e `DdiDecision.intervened/contactedMD`.
 * Nenhuma métrica é estimada — ver a nota de método no rodapé da página.
 */

const JANELA_DIAS = 365

function pct(parte: number, total: number): number {
  return total === 0 ? 0 : Math.round((parte / total) * 100)
}

const RISCO_ORDEM: RiskLevel[] = ['URGENT', 'HIGH', 'MODERATE', 'LOW']
const RISCO_ROTULO: Record<RiskLevel, string> = {
  URGENT: 'Urgente', HIGH: 'Alto', MODERATE: 'Moderado', LOW: 'Baixo',
}
const RISCO_COR: Record<RiskLevel, string> = {
  URGENT: 'bg-red-500', HIGH: 'bg-orange-500', MODERATE: 'bg-amber-500', LOW: 'bg-green-600',
}

function Cartao({ icone: Icone, rotulo, valor, sufixo, detalhe, destaque }: {
  icone: React.ElementType; rotulo: string; valor: string | number
  sufixo?: string; detalhe?: string; destaque?: boolean
}) {
  return (
    <div className={`rounded-xl border p-5 ${destaque ? 'border-brand-800/30 bg-brand-50 dark:bg-brand-900/10' : 'border-border bg-card'}`}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icone className="h-4 w-4" />
        <p className="text-xs font-medium uppercase tracking-wide">{rotulo}</p>
      </div>
      <p className="mt-2 text-3xl font-bold text-foreground tabular-nums">
        {valor}{sufixo && <span className="ml-1 text-lg font-normal text-muted-foreground">{sufixo}</span>}
      </p>
      {detalhe && <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>}
    </div>
  )
}

export default async function ImpactoPage() {
  const session = await getSession()
  if (!session) return null
  const userId = session.user.id
  const desde = new Date(Date.now() - JANELA_DIAS * 24 * 60 * 60 * 1000)

  // `DdiDecision` não tem relação declarada com `DdiQuery` no schema — só a coluna
  // `queryId`. Resolvemos os ids do usuário primeiro em vez de alterar o schema
  // (o banco é compartilhado com o marketing).
  const consultasDoUsuario = await prisma.ddiQuery.findMany({
    where: { userId, createdAt: { gte: desde } },
    select: { id: true },
  })
  const idsConsulta = consultasDoUsuario.map(q => q.id)

  const [porRisco, resolvidos, contatoNecessario, contatoFeito, decisoes, amostraTempo, analises] =
    await Promise.all([
      // PRMs identificados por gravidade
      prisma.pRMFinding.groupBy({
        by: ['riskLevel'],
        where: { analysis: { userId, createdAt: { gte: desde } } },
        _count: { _all: true },
      }),
      // ...e quantos foram resolvidos, na mesma janela
      prisma.pRMFinding.groupBy({
        by: ['riskLevel'],
        where: { analysis: { userId, createdAt: { gte: desde } }, isResolved: true },
        _count: { _all: true },
      }),
      prisma.pRMFinding.count({
        where: { analysis: { userId, createdAt: { gte: desde } }, needsPrescriberContact: true },
      }),
      idsConsulta.length
        ? prisma.ddiDecision.count({ where: { contactedMD: true, queryId: { in: idsConsulta } } })
        : Promise.resolve(0),
      idsConsulta.length
        ? prisma.ddiDecision.count({ where: { intervened: true, queryId: { in: idsConsulta } } })
        : Promise.resolve(0),
      // Tempo até a resolução — calculado em JS porque o Prisma não subtrai colunas
      prisma.pRMFinding.findMany({
        where: {
          analysis: { userId, createdAt: { gte: desde } },
          isResolved: true,
          resolvedAt: { not: null },
        },
        select: { resolvedAt: true, analysis: { select: { createdAt: true } } },
        take: 500,
      }),
      prisma.pRMAnalysis.count({ where: { userId, createdAt: { gte: desde } } }),
    ])

  const totalPRM = porRisco.reduce((s, r) => s + r._count._all, 0)
  const totalResolvidos = resolvidos.reduce((s, r) => s + r._count._all, 0)
  const resolvidosPorRisco = new Map(resolvidos.map(r => [r.riskLevel, r._count._all]))
  const contagemPorRisco = new Map(porRisco.map(r => [r.riskLevel, r._count._all]))

  const graves = (contagemPorRisco.get('URGENT') ?? 0) + (contagemPorRisco.get('HIGH') ?? 0)
  const gravesResolvidos = (resolvidosPorRisco.get('URGENT') ?? 0) + (resolvidosPorRisco.get('HIGH') ?? 0)

  // Mediana, não média: uma resolução esquecida por meses distorce a média e
  // faria o painel mentir a favor do próprio número.
  const dias = amostraTempo
    .map(f => (f.resolvedAt!.getTime() - f.analysis.createdAt.getTime()) / 86_400_000)
    .filter(d => d >= 0)
    .sort((a, b) => a - b)
  const medianaDias = dias.length
    ? Math.round(dias.length % 2 ? dias[(dias.length - 1) / 2] : (dias[dias.length / 2 - 1] + dias[dias.length / 2]) / 2)
    : null

  const semDados = totalPRM === 0 && decisoes === 0

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <TrendingUp className="h-6 w-6 text-brand-800" /> Impacto clínico
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O que o seu trabalho mudou nos últimos 12 meses — não quanto o sistema foi usado.
        </p>
      </div>

      {semDados ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <FlaskConical className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-semibold text-foreground">Ainda não há desfecho registrado</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Este painel soma PRMs resolvidos e intervenções registradas. Faça uma análise e marque os
            achados conforme forem resolvidos — o impacto aparece aqui.
          </p>
          <Link href="/analysis/new" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900 transition-colors">
            Nova análise <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Cartao icone={CheckCircle2} rotulo="PRMs resolvidos" valor={totalResolvidos}
              detalhe={`de ${totalPRM} identificados · ${pct(totalResolvidos, totalPRM)}% de resolução`} destaque />
            <Cartao icone={AlertTriangle} rotulo="Graves resolvidos" valor={gravesResolvidos}
              detalhe={`de ${graves} urgentes/altos · ${pct(gravesResolvidos, graves)}%`} />
            <Cartao icone={Stethoscope} rotulo="Intervenções" valor={decisoes}
              detalhe="registradas em consultas de interação" />
            <Cartao icone={Clock} rotulo="Tempo até resolver" valor={medianaDias ?? '—'}
              sufixo={medianaDias !== null ? 'dias' : undefined}
              detalhe={medianaDias !== null ? `mediana de ${dias.length} achados resolvidos` : 'sem achados resolvidos ainda'} />
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="border-b border-border bg-muted px-5 py-3.5">
              <h2 className="text-sm font-semibold text-foreground">Resolução por gravidade</h2>
              <p className="text-xs text-muted-foreground">Onde o achado grave está sendo efetivamente fechado</p>
            </div>
            <div className="divide-y divide-border">
              {RISCO_ORDEM.map(risco => {
                const total = contagemPorRisco.get(risco) ?? 0
                if (total === 0) return null
                const feito = resolvidosPorRisco.get(risco) ?? 0
                const p = pct(feito, total)
                return (
                  <div key={risco} className="flex items-center gap-4 px-5 py-3">
                    <span className="w-24 text-sm font-medium text-foreground">{RISCO_ROTULO[risco]}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full rounded-full ${RISCO_COR[risco]}`} style={{ width: `${p}%` }} />
                    </div>
                    <span className="w-28 text-right text-sm tabular-nums text-muted-foreground">
                      {feito}/{total} · {p}%
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                <p className="text-xs font-medium uppercase tracking-wide">Contato com prescritor</p>
              </div>
              <p className="mt-2 text-3xl font-bold text-foreground tabular-nums">{contatoFeito}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                registrados · {contatoNecessario} achados sinalizaram necessidade de contato
              </p>
              {contatoNecessario > contatoFeito && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  Há mais achados pedindo contato do que contatos registrados. A diferença pode ser
                  contato feito e não registrado — o registro é o que sustenta o indicador.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <FlaskConical className="h-4 w-4" />
                <p className="text-xs font-medium uppercase tracking-wide">Análises no período</p>
              </div>
              <p className="mt-2 text-3xl font-bold text-foreground tabular-nums">{analises}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {analises > 0 ? `${(totalPRM / analises).toFixed(1)} PRMs identificados por análise` : '—'}
              </p>
            </div>
          </div>
        </>
      )}

      <div className="rounded-xl border border-border bg-muted p-5 text-xs text-muted-foreground space-y-1.5">
        <p className="font-semibold text-foreground">Como estes números são apurados</p>
        <p>Janela de 12 meses, contando apenas registros do seu usuário. &quot;Resolvido&quot; é o achado
          marcado como tal na tela da análise; o tempo até resolver usa a <b>mediana</b>, não a média —
          um achado esquecido por meses distorceria a média a favor do próprio indicador.</p>
        <p><b>Não há estimativa de custo evitado.</b> O sistema não armazena preço de medicamento nem
          custo de internação, e projetar economia sem esses dados seria número inventado. Fechar essa
          lacuna depende de ingerir a tabela CMED — está registrado como pendência.</p>
      </div>
    </div>
  )
}
