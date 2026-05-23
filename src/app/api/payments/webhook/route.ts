import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { payment as mpPayment } from '@/lib/mercadopago'
import prisma from '@/lib/prisma'
import { addTokens } from '@/lib/token-service'
import { TransactionType } from '@prisma/client'

// ── Verificação de assinatura HMAC-SHA256 do Mercado Pago ────────────────────
// Documentação: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
//
// CAMADAS DE SEGURANÇA (em ordem de execução):
//   1. HMAC-SHA256 via x-signature (quando MP_WEBHOOK_SECRET configurado no painel MP)
//   2. Verificação via API do MP — buscamos o pagamento diretamente no MP e conferimos
//      status, userId e packageId — isso garante que o paymentId é genuíno
//   3. Idempotência — não processamos o mesmo paymentId duas vezes
//   4. Validação de ownership — userId e packageId devem existir no nosso banco
function verifyMPSignature(req: NextRequest): boolean {
  const webhookSecret = process.env.MP_WEBHOOK_SECRET
  // Secret não configurado — camadas 2-4 são suficientes para segurança
  if (!webhookSecret) return true

  // MP envia: x-signature: ts=<timestamp>,v1=<hmac_hex>
  const sig = req.headers.get('x-signature') ?? ''
  const reqId = req.headers.get('x-request-id') ?? ''
  const { searchParams } = new URL(req.url)
  const dataId = searchParams.get('data.id') ?? ''

  const tsPart = sig.split(',').find(s => s.startsWith('ts='))
  const v1Part = sig.split(',').find(s => s.startsWith('v1='))
  const ts = tsPart?.split('=')?.[1] ?? ''
  const v1 = v1Part?.split('=')?.[1] ?? ''

  if (!ts || !v1) return false

  // Template assinado: id:<data.id>;request-id:<x-request-id>;ts:<timestamp>;
  const signedTemplate = `id:${dataId};request-id:${reqId};ts:${ts};`
  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(signedTemplate)
    .digest('hex')

  // Comparação segura contra timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(v1, 'hex'),
      Buffer.from(expected, 'hex'),
    )
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()

    // ── 1. Verificar assinatura HMAC quando secret configurado ─────────────
    if (!verifyMPSignature(req)) {
      console.warn('[WEBHOOK] Assinatura inválida — requisição rejeitada')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const body = JSON.parse(rawBody)

    // MP envia diferentes tipos de eventos; só processamos pagamentos
    if (body.type !== 'payment') {
      return NextResponse.json({ received: true })
    }

    const paymentId = body.data?.id
    if (!paymentId) {
      return NextResponse.json({ received: true })
    }

    // ── 2. Buscar detalhes do pagamento na API do MP (source of truth) ─────
    const mpPaymentData = await mpPayment.get({ id: String(paymentId) })

    if (mpPaymentData.status !== 'approved') {
      return NextResponse.json({ received: true })
    }

    const metadata = mpPaymentData.metadata as { user_id?: string; package_id?: string } | undefined
    const userId = metadata?.user_id
    const packageId = metadata?.package_id

    if (!userId || !packageId) {
      // Log sem expor dados sensíveis
      console.error('[WEBHOOK] Metadata ausente no pagamento MP:', paymentId)
      return NextResponse.json({ received: true })
    }

    // ── 3. Validar que userId e packageId existem no banco ─────────────────
    const [userExists, pkg] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, isActive: true } }),
      prisma.tokenPackage.findUnique({ where: { id: packageId }, select: { id: true, name: true, tokens: true } }),
    ])

    if (!userExists || !userExists.isActive) {
      console.error('[WEBHOOK] Usuário inválido ou inativo:', userId)
      return NextResponse.json({ received: true })
    }

    if (!pkg) {
      console.error('[WEBHOOK] Pacote não encontrado:', packageId)
      return NextResponse.json({ received: true })
    }

    // ── 4. Idempotência: não processar o mesmo pagamento duas vezes ─────────
    const existing = await prisma.payment.findFirst({
      where: { externalId: String(paymentId) },
    })
    if (existing) {
      return NextResponse.json({ received: true })
    }

    // ── 5. Registrar pagamento e creditar tokens ────────────────────────────
    const paymentRecord = await prisma.payment.create({
      data: {
        userId,
        amountInCents: Math.round((mpPaymentData.transaction_amount ?? 0) * 100),
        currency: mpPaymentData.currency_id ?? 'BRL',
        status: 'completed',
        method: mpPaymentData.payment_type_id ?? null,
        gateway: 'mercadopago',
        externalId: String(paymentId),
        paidAt: mpPaymentData.date_approved ? new Date(mpPaymentData.date_approved) : new Date(),
        // Não salvar body completo no metadata — pode conter dados sensíveis do comprador
        metadata: { type: body.type, paymentId } as object,
      },
    })

    await addTokens(
      userId,
      pkg.tokens,
      TransactionType.PURCHASE,
      `Compra de pacote: ${pkg.name} (${pkg.tokens} tokens) via Mercado Pago`,
      packageId,
      paymentRecord.id,
    )

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'PURCHASE_TOKENS',
        resource: 'token_package',
        resourceId: packageId,
        details: {
          tokens: pkg.tokens,
          amountInCents: paymentRecord.amountInCents,
          paymentId: paymentRecord.id,
          mpPaymentId: paymentId,
        },
      },
    })

    return NextResponse.json({ received: true })
  } catch (err) {
    // Sempre retornar 200 para o MP não retentar infinitamente
    console.error('[PAYMENTS_WEBHOOK]', err instanceof Error ? err.message : 'Erro desconhecido')
    return NextResponse.json({ received: true })
  }
}
