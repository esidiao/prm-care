import { NextRequest, NextResponse } from 'next/server'
import { montarResumos, montarEmail } from '@/lib/follow-up'
import { enviarEmail, emailConfigurado } from '@/lib/mailer'
import { logAudit } from '@/lib/audit'

/**
 * GET /api/cron/follow-up — disparo diário do resumo de acompanhamento.
 *
 * Agendado em vercel.json. A Vercel envia `Authorization: Bearer $CRON_SECRET`
 * quando a variável existe no projeto; sem o segredo configurado a rota RECUSA
 * tudo, em vez de ficar aberta — um endpoint que dispara e-mail para toda a base
 * não pode depender de "ninguém descobriu a URL".
 *
 * Roda em Node (não Edge) porque o nodemailer precisa de socket TCP.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function autorizado(req: NextRequest): boolean {
  const segredo = process.env.CRON_SECRET
  if (!segredo) return false
  return req.headers.get('authorization') === `Bearer ${segredo}`
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) {
    // 404 e não 401: não confirmamos a existência da rota para quem sonda.
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  }

  const baseUrl = process.env.NEXTAUTH_URL || 'https://prm-care-pi.vercel.app'

  try {
    const resumos = await montarResumos()

    // Sem credencial de SMTP, relata o que SERIA enviado em vez de falhar em
    // silêncio — assim o cron é observável antes de a credencial existir.
    if (!emailConfigurado()) {
      console.warn(`[cron/follow-up] SMTP não configurado — ${resumos.length} resumo(s) não enviados`)
      return NextResponse.json({
        ok: true,
        emailConfigurado: false,
        destinatarios: resumos.length,
        itens: resumos.reduce((s, r) => s + r.itens.length, 0),
        aviso: 'EMAIL_SERVER_USER e EMAIL_SERVER_PASSWORD ausentes — nada foi enviado.',
      })
    }

    let enviados = 0, falhas = 0
    for (const resumo of resumos) {
      const { assunto, html, texto } = montarEmail(resumo, baseUrl)
      const r = await enviarEmail({ para: resumo.email, assunto, html, texto })
      if (r.status === 'sent') {
        enviados++
        // Comunicação com o profissional sobre dado clínico deixa rastro.
        await logAudit({
          userId: resumo.userId,
          action: 'FOLLOWUP_EMAIL_SENT',
          resource: 'follow_up',
          details: { itens: resumo.itens.length },
        })
      } else if (r.status === 'error') {
        falhas++
      }
    }

    return NextResponse.json({
      ok: true, emailConfigurado: true, destinatarios: resumos.length, enviados, falhas,
    })
  } catch (err) {
    console.error('[cron/follow-up]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Falha ao processar o acompanhamento' }, { status: 500 })
  }
}
