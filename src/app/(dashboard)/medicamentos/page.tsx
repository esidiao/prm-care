import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import { Pill, Search, ArrowRight, Info } from 'lucide-react'

/**
 * Busca de medicamento — a consulta mais frequente do dia, e a que até agora
 * fazia o farmacêutico sair do sistema.
 *
 * Agrupa por SUBSTÂNCIA, não por produto: quem atende pergunta "o que existe de
 * sinvastatina", não "quantas caixas de Sinvasmax". A contagem de apresentações
 * e o menor preço já aparecem aqui, para a triagem acontecer antes do clique.
 */

const LIMITE = 40

function norm(s: string) {
  return s.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export default async function MedicamentosPage({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  const session = await getSession()
  if (!session) return null

  const termo = (searchParams.q || '').trim()
  const busca = norm(termo)

  const linhas = busca.length >= 3
    ? await prisma.refApresentacao.findMany({
        where: {
          OR: [
            { substanciaNorm: { contains: busca } },
            { produto: { contains: termo, mode: 'insensitive' } },
          ],
        },
        select: {
          substancia: true, substanciaNorm: true, classeTerapeutica: true,
          pmcSemImpostosCents: true, tipoProduto: true,
        },
        take: 4000,
      })
    : []

  // Agrupa por substância no servidor: o Prisma não faz groupBy com agregação
  // condicional sobre nulo do jeito que precisamos aqui, e 4 mil linhas em
  // memória são baratas comparadas a uma segunda ida ao banco.
  const porSubstancia = new Map<string, {
    substancia: string
    classe: string | null
    apresentacoes: number
    menorPreco: number | null
    temGenerico: boolean
  }>()

  for (const l of linhas) {
    if (!l.substancia) continue
    const chave = l.substanciaNorm || norm(l.substancia)
    const atual = porSubstancia.get(chave)
    const preco = l.pmcSemImpostosCents
    if (atual) {
      atual.apresentacoes++
      if (preco !== null && (atual.menorPreco === null || preco < atual.menorPreco)) atual.menorPreco = preco
      if (/gen[eé]rico/i.test(l.tipoProduto || '')) atual.temGenerico = true
    } else {
      porSubstancia.set(chave, {
        substancia: l.substancia,
        classe: l.classeTerapeutica,
        apresentacoes: 1,
        menorPreco: preco,
        temGenerico: /gen[eé]rico/i.test(l.tipoProduto || ''),
      })
    }
  }

  const resultados = Array.from(porSubstancia.entries())
    .map(([chave, v]) => ({ chave, ...v }))
    .sort((a, b) => b.apresentacoes - a.apresentacoes)
    .slice(0, LIMITE)

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Pill className="h-6 w-6 text-brand-800" /> Medicamentos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Apresentações registradas e comercializadas no Brasil, com preço regulado.
        </p>
      </div>

      <form method="get" className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          name="q"
          defaultValue={termo}
          placeholder="Princípio ativo ou nome comercial — ex.: sinvastatina, Losartana"
          aria-label="Buscar medicamento"
          className="w-full rounded-xl border border-input bg-card py-2.5 pl-10 pr-4 text-sm text-foreground outline-none transition-colors focus:border-brand-800"
        />
      </form>

      {termo.length > 0 && termo.length < 3 && (
        <p className="text-sm text-muted-foreground">Digite ao menos 3 caracteres.</p>
      )}

      {busca.length >= 3 && resultados.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Search className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-semibold text-foreground">Nada encontrado para “{termo}”</p>
          <p className="mt-1 text-sm text-muted-foreground">
            A base cobre apresentações <b>comercializadas</b> com preço regulado pela CMED.
            Medicamento descontinuado, manipulado ou de uso hospitalar exclusivo pode não constar.
          </p>
        </div>
      )}

      {resultados.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="divide-y divide-border">
            {resultados.map(r => (
              <Link
                key={r.chave}
                href={`/medicamentos/${encodeURIComponent(r.chave)}`}
                className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted group">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{r.substancia}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.classe || 'classe não informada'} · {r.apresentacoes} apresentaç{r.apresentacoes === 1 ? 'ão' : 'ões'}
                    {r.temGenerico && ' · tem genérico'}
                  </p>
                </div>
                {r.menorPreco !== null && (
                  <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                    a partir de <b className="text-foreground">R$ {(r.menorPreco / 100).toFixed(2)}</b>
                  </span>
                )}
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {busca.length < 3 && (
        <div className="rounded-xl border border-border bg-muted p-5 text-sm text-muted-foreground">
          <p className="flex items-center gap-1.5 font-semibold text-foreground">
            <Info className="h-4 w-4" /> O que esta base responde
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Quais apresentações do princípio ativo existem no mercado brasileiro</li>
            <li>Se há genérico e quanto custa cada alternativa (preço máximo ao consumidor)</li>
            <li>Tarja, restrição hospitalar e laboratório de cada apresentação</li>
          </ul>
          <p className="mt-3">
            Não substitui a bula: para posologia aprovada e contraindicações completas,
            consulte o Bulário Eletrônico da ANVISA.
          </p>
        </div>
      )}
    </div>
  )
}
