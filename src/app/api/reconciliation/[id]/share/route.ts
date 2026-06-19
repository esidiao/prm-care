import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * POST /api/reconciliation/[id]/share
 * Registra o consentimento e o evento de compartilhamento (ex.: WhatsApp) do relatório.
 * Body: { channel: 'WHATSAPP'|'DOWNLOAD'|'PRINT', variant: 'TECNICA'|'SIMPLIFICADA', anonymized?: boolean, consent?: boolean }
 * O envio em si (link wa.me) é montado no cliente; aqui só registramos consentimento/auditoria.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // SECURITY: a conciliação deve pertencer ao usuário
  const rec = await prisma.reconciliation.findFirst({ where: { id: params.id, userId: session.user.id }, select: { id: true } })
  if (!rec) return NextResponse.json({ error: 'Conciliação não encontrada.' }, { status: 404 })

  const b = await req.json().catch(() => ({}))
  const channel = ['WHATSAPP', 'DOWNLOAD', 'PRINT'].includes(b?.channel) ? b.channel : 'DOWNLOAD'
  const variant = b?.variant === 'SIMPLIFICADA' ? 'SIMPLIFICADA' : 'TECNICA'

  // Compartilhamento ao paciente (WhatsApp) exige consentimento explícito
  if (channel === 'WHATSAPP' && !b?.consent) {
    return NextResponse.json({ error: 'Consentimento do paciente é obrigatório para envio por WhatsApp.' }, { status: 400 })
  }

  const now = new Date()
  const report = await prisma.reconciliationReport.create({
    data: {
      reconciliationId: rec.id,
      variant,
      format: channel === 'WHATSAPP' ? 'WHATSAPP' : 'PDF',
      sharedChannel: channel,
      anonymized: !!b?.anonymized,
      consentGiven: !!b?.consent,
      consentAt: b?.consent ? now : null,
      sharedAt: now,
    },
  })
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: 'RECON_SHARE', resource: 'reconciliation', resourceId: rec.id, details: { channel, variant, anonymized: !!b?.anonymized, consent: !!b?.consent } },
  }).catch(() => null)

  return NextResponse.json({ ok: true, reportId: report.id })
}
