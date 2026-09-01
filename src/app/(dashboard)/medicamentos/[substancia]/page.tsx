import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft, Pill, Clock, Utensils, AlertTriangle, ShieldAlert,
  Link2, TrendingDown, Building2,
} from 'lucide-react'
import { getPKProfile } from '@/lib/pharma-pk-db'

/**
 * Monografia de uma substância.
 *
 * Une três camadas com origens diferentes, e a tela deixa isso explícito:
 *   - identidade, apresentações e preço  -> ANVISA/CMED (dado público)
 *   - horário, alimento, meia-vida       -> nossa base farmacocinética própria
 *   - interações                         -> nosso motor clínico
 *
 * NÃO reproduz texto de bula: a bula é redigida pelo titular do registro e o
 * direito autoral é dele — ver docs/PARECER_FONTES_MONOGRAFIA_MEDICAMENTO.md.
 * Para posologia aprovada, a tela remete ao Bulário da ANVISA.
 */

const ROTULO_ALIMENTO: Record<string, string> = {
  jejum: 'Em jejum',
  com_alimento: 'Com alimento',
  sem_restricao: 'Indiferente a alimento',
  antes_refeicao: '30–60 min antes da refeição',
  apos_refeicao: 'Após a refeição',
  com_agua_abundante: 'Com água abundante, ereto por 30 min',
}

const ROTULO_HORARIO: Record<string, string> = {
  manha: 'Manhã', almoco: 'Almoço', tarde: 'Tarde',
  jantar: 'Jantar', noite: 'Noite', deitar: 'Ao deitar', qualquer: 'Horário fixo',
}

function reais(cents: number | null) {
  return cents === null ? '—' : `R$ ${(cents / 100).toFixed(2)}`
}

export default async function MonografiaPage({ params }: { params: { substancia: string } }) {
  const session = await getSession()
  if (!session) return null

  const chave = decodeURIComponent(params.substancia)

  const apresentacoes = await prisma.refApresentacao.findMany({
    where: { substanciaNorm: chave },
    orderBy: [{ pmcSemImpostosCents: 'asc' }, { produto: 'asc' }],
    select: {
      ggrem: true, produto: true, apresentacao: true, laboratorio: true,
      tipoProduto: true, tarja: true, restricaoHospitalar: true,
      pmcSemImpostosCents: true, pfSemImpostosCents: true,
      substancia: true, classeTerapeutica: true,
    },
    take: 300,
  })

  if (apresentacoes.length === 0) notFound()

  const substanciaCrua = apresentacoes[0].substancia || chave
  // A CMED separa associacoes por ';' — "EZETIMIBA;SINVASTATINA". Sao 2.304
  // apresentacoes assim; exibir o ponto-e-virgula cru fica ilegivel.
  const componentes = substanciaCrua.split(';').map(c => c.trim()).filter(Boolean)
  const substancia = componentes.join(' + ')
  const classe = apresentacoes.find(a => a.classeTerapeutica)?.classeTerapeutica ?? null

  // Busca o perfil FC de CADA componente: numa associacao, dizer "sem perfil"
  // quando temos os dois seria esconder informacao que existe.
  const perfis = componentes
    .map(c => ({ componente: c, pk: getPKProfile(c.toLowerCase()) }))
    .filter((x): x is { componente: string; pk: NonNullable<ReturnType<typeof getPKProfile>> } => !!x.pk)

  const comPreco = apresentacoes.filter(a => a.pmcSemImpostosCents !== null)
  const maisBarata = comPreco[0] ?? null
  const maisCara = comPreco[comPreco.length - 1] ?? null
  const economia = maisBarata && maisCara && maisCara.pmcSemImpostosCents! > maisBarata.pmcSemImpostosCents!
    ? maisCara.pmcSemImpostosCents! - maisBarata.pmcSemImpostosCents!
    : null

  const genericos = apresentacoes.filter(a => /gen[eé]rico/i.test(a.tipoProduto || '')).length

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-5">
      <Link href="/medicamentos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Medicamentos
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Pill className="h-6 w-6 text-brand-800" /> {substancia}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {classe || 'Classe terapêutica não informada'} · {apresentacoes.length} apresentaç{apresentacoes.length === 1 ? 'ão' : 'ões'} comercializada{apresentacoes.length === 1 ? '' : 's'}
          {genericos > 0 && ` · ${genericos} genérico${genericos === 1 ? '' : 's'}`}
        </p>
      </div>

      {/* ── Oportunidade de economia — a intervenção mais fácil de demonstrar ── */}
      {economia !== null && economia > 0 && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-green-900 dark:text-green-200">
            <TrendingDown className="h-4 w-4" /> Diferença de até {reais(economia)} entre apresentações
          </p>
          <p className="mt-1 text-xs text-green-800 dark:text-green-300">
            Da mais barata ({maisBarata!.produto}, {reais(maisBarata!.pmcSemImpostosCents)}) à mais cara
            ({maisCara!.produto}, {reais(maisCara!.pmcSemImpostosCents)}). Confira se a apresentação é
            equivalente antes de propor a troca — dose e forma farmacêutica variam na lista.
          </p>
        </div>
      )}

      {/* ── Camada própria: farmacocinética e administração ─────────────────── */}
      {perfis.length > 0 ? perfis.map(({ componente, pk }) => (
        <div key={componente} className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border bg-muted px-5 py-3">
            <Clock className="h-4 w-4 text-brand-800" />
            <h2 className="text-sm font-semibold text-foreground">
              Administração e farmacocinética{componentes.length > 1 ? ` — ${componente}` : ''}
            </h2>
            <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">base clínica PRM Care</span>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Utensils className="h-3.5 w-3.5" /> Alimento</p>
              <p className="mt-0.5 text-sm text-foreground">{ROTULO_ALIMENTO[pk.foodEffect] || pk.foodEffect}</p>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Melhor horário</p>
              <p className="mt-0.5 text-sm text-foreground">
                {ROTULO_HORARIO[pk.preferredTime] || pk.preferredTime}
                {pk.idealHours?.length ? ` · ${pk.idealHours.map(h => `${h}h`).join(', ')}` : ''}
              </p>
            </div>
            {pk.halfLifeH !== undefined && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Meia-vida</p>
                <p className="mt-0.5 text-sm text-foreground">{pk.halfLifeH} h</p>
              </div>
            )}
            {pk.highAlert && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Vigilância</p>
                <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-red-700 dark:text-red-400">
                  <ShieldAlert className="h-3.5 w-3.5" /> Alta vigilância / margem estreita
                </p>
              </div>
            )}
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold text-muted-foreground">Orientação ao paciente</p>
              <p className="mt-0.5 text-sm text-foreground">{pk.patientInstruction}</p>
            </div>
            {pk.rationale && (
              <div className="sm:col-span-2">
                <p className="text-xs font-semibold text-muted-foreground">Racional</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{pk.rationale}</p>
              </div>
            )}
            {pk.safetyNotes?.length ? (
              <div className="sm:col-span-2 rounded-lg bg-amber-50 p-3 dark:bg-amber-950/30">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="h-3.5 w-3.5" /> Alertas de segurança
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-amber-900 dark:text-amber-300">
                  {pk.safetyNotes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      )) : (
        <div className="rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">
          Não há perfil farmacocinético próprio para esta substância na base do PRM Care.
          As informações abaixo vêm apenas do registro público.
        </div>
      )}

      <Link
        href={`/interactions?drug=${encodeURIComponent(substancia)}`}
        className="flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-muted">
        <Link2 className="h-4 w-4 text-brand-800" />
        Verificar interações desta substância
      </Link>

      {/* ── Apresentações ───────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border bg-muted px-5 py-3">
          <Building2 className="h-4 w-4 text-brand-800" />
          <h2 className="text-sm font-semibold text-foreground">Apresentações comercializadas</h2>
          <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">ANVISA · CMED</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">Produto</th>
                <th className="px-3 py-2.5 font-medium">Apresentação</th>
                <th className="px-3 py-2.5 font-medium">Tipo</th>
                <th className="px-3 py-2.5 font-medium">Tarja</th>
                <th className="px-5 py-2.5 text-right font-medium">PMC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {apresentacoes.map(a => (
                <tr key={a.ggrem} className="transition-colors hover:bg-muted/60">
                  <td className="px-5 py-2.5">
                    <p className="font-medium text-foreground">{a.produto}</p>
                    <p className="text-xs text-muted-foreground">{a.laboratorio}</p>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{a.apresentacao}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{a.tipoProduto}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {a.tarja}
                    {a.restricaoHospitalar && <span className="ml-1 rounded bg-red-100 px-1 text-[10px] font-semibold text-red-800 dark:bg-red-950 dark:text-red-300">hospitalar</span>}
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-foreground">{reais(a.pmcSemImpostosCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted p-5 text-xs text-muted-foreground space-y-1.5">
        <p className="font-semibold text-foreground">Fonte e limites</p>
        <p>
          Identidade, apresentações e preço vêm dos dados abertos da <b>ANVISA</b> e da lista de
          preços da <b>CMED</b>. PMC é o preço máximo ao consumidor sem impostos — o valor na
          farmácia varia com a alíquota de ICMS do estado.
        </p>
        <p>
          Horário, alimento e farmacocinética são da base clínica própria do PRM Care.
          <b> Esta página não reproduz o texto da bula</b>, cuja autoria é do titular do registro:
          para posologia aprovada e contraindicações completas, consulte o{' '}
          <a href="https://consultas.anvisa.gov.br/#/bulario/" target="_blank" rel="noopener noreferrer" className="underline">
            Bulário Eletrônico da ANVISA
          </a>.
        </p>
      </div>
    </div>
  )
}
