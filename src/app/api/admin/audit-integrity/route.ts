import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * GET /api/admin/audit-integrity — estado da cadeia de auditoria (lacuna 09).
 *
 * O recálculo usa a função SQL `audit_logs_hash`, a mesma que o trigger usa ao
 * gravar. Reimplementar o SHA-256 aqui criaria uma segunda fórmula, e duas
 * fórmulas divergem — passaria a acusar quebra onde não há, ou a ignorar onde há.
 */

export const dynamic = 'force-dynamic'

interface LinhaVerificacao {
  sequencia: bigint
  action: string
  hash: string | null
  hashAnterior: string | null
  recalculado: string | null
  hashDaAnterior: string | null
  createdAt: Date
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })
  }

  try {
    const linhas = await prisma.$queryRaw<LinhaVerificacao[]>`
      SELECT
        a."sequencia", a."action", a."hash", a."hashAnterior", a."createdAt",
        "audit_logs_hash"(a."sequencia", a."id", a."userId", a."action", a."resource",
                          a."resourceId", a."details"::text, a."createdAt", a."hashAnterior") AS "recalculado",
        lag(a."hash") OVER (ORDER BY a."sequencia") AS "hashDaAnterior"
      FROM "audit_logs" a
      ORDER BY a."sequencia" ASC
    `

    const problemas: Array<{ sequencia: string; tipo: string; detalhe: string }> = []
    for (const r of linhas) {
      if (!r.hash) {
        problemas.push({
          sequencia: String(r.sequencia),
          tipo: 'Sem hash',
          detalhe: 'gravado antes do encadeamento ou com o trigger desativado',
        })
        continue
      }
      if (r.hash !== r.recalculado) {
        problemas.push({
          sequencia: String(r.sequencia),
          tipo: 'Conteúdo adulterado',
          detalhe: `${r.action} — o hash gravado não corresponde ao conteúdo atual`,
        })
      }
      const esperado = r.hashDaAnterior ?? 'genesis'
      if (r.hashAnterior !== esperado) {
        problemas.push({
          sequencia: String(r.sequencia),
          tipo: 'Elo rompido',
          detalhe: 'linha anterior removida ou reordenada',
        })
      }
    }

    const ponta = linhas[linhas.length - 1]
    return NextResponse.json({
      total: linhas.length,
      integra: problemas.length === 0,
      problemas: problemas.slice(0, 20),
      totalProblemas: problemas.length,
      ancora: ponta?.hash ?? null,
      sequenciaPonta: ponta ? String(ponta.sequencia) : null,
      verificadoEm: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[AUDIT_INTEGRITY]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Falha ao verificar a trilha' }, { status: 500 })
  }
}
