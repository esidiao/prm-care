import nodemailer from 'nodemailer'

/**
 * Envio de e-mail por SMTP.
 *
 * FALHA SEGURA: sem `EMAIL_SERVER_USER`/`EMAIL_SERVER_PASSWORD` a função não
 * lança — registra e devolve `skipped`. O disparo de acompanhamento roda em cron
 * e não pode derrubar a rota inteira porque a credencial não foi provisionada.
 *
 * Estado em 01/09/2026: produção tem HOST, PORT e FROM configurados, mas NÃO tem
 * USER nem PASSWORD. Enquanto isso, todo envio é registrado e descartado — o que
 * é o comportamento correto, e o log diz exatamente o que falta.
 */

export type ResultadoEnvio =
  | { status: 'sent'; messageId: string }
  | { status: 'skipped'; motivo: string }
  | { status: 'error'; motivo: string }

function credenciaisFaltando(): string | null {
  const faltando = (['EMAIL_SERVER_HOST', 'EMAIL_SERVER_USER', 'EMAIL_SERVER_PASSWORD', 'EMAIL_FROM'] as const)
    .filter(k => !process.env[k]?.trim())
  return faltando.length ? faltando.join(', ') : null
}

/** Há credencial suficiente para enviar? Usado para relatar estado sem tentar envio. */
export function emailConfigurado(): boolean {
  return credenciaisFaltando() === null
}

let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_SERVER_HOST,
      port: Number(process.env.EMAIL_SERVER_PORT || 587),
      // 587 usa STARTTLS (secure=false); 465 é TLS direto.
      secure: Number(process.env.EMAIL_SERVER_PORT || 587) === 465,
      auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
      },
    })
  }
  return transporter
}

export async function enviarEmail(params: {
  para: string
  assunto: string
  html: string
  texto: string
}): Promise<ResultadoEnvio> {
  const faltando = credenciaisFaltando()
  if (faltando) {
    console.warn(`[mailer] envio ignorado — variáveis ausentes: ${faltando}`)
    return { status: 'skipped', motivo: `variáveis ausentes: ${faltando}` }
  }

  try {
    const info = await getTransporter().sendMail({
      from: process.env.EMAIL_FROM,
      to: params.para,
      subject: params.assunto,
      text: params.texto,
      html: params.html,
    })
    return { status: 'sent', messageId: info.messageId }
  } catch (err) {
    // Nunca propagar: o cron processa vários farmacêuticos e a falha de um
    // e-mail não pode interromper os demais.
    const motivo = err instanceof Error ? err.message : String(err)
    console.error('[mailer] falha no envio:', motivo)
    return { status: 'error', motivo }
  }
}
