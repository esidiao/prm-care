import { NextRequest, NextResponse } from 'next/server'
import { payment as mpPayment } from '@/lib/mercadopago'
import prisma from '@/lib/prisma'
import { addTokens } from '@/lib/token-service'
import { TransactionType } from '@prisma/client'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // MP sends different event types; we only care about payment events
    if (body.type !== 'payment') {
      return NextResponse.json({ received: true })
    }

    const paymentId = body.data?.id
    if (!paymentId) {
      return NextResponse.json({ received: true })
    }

    // Fetch payment details from MP
    const mpPaymentData = await mpPayment.get({ id: String(paymentId) })

    if (mpPaymentData.status !== 'approved') {
      return NextResponse.json({ received: true })
    }

    const metadata = mpPaymentData.metadata as { user_id?: string; package_id?: string } | undefined
    const userId = metadata?.user_id
    const packageId = metadata?.package_id

    if (!userId || !packageId) {
      console.error('[WEBHOOK] Missing metadata:', metadata)
      return NextResponse.json({ received: true })
    }

    // Idempotency: check if this payment was already processed
    const existing = await prisma.payment.findFirst({
      where: { externalId: String(paymentId) },
    })

    if (existing) {
      return NextResponse.json({ received: true })
    }

    const pkg = await prisma.tokenPackage.findUnique({
      where: { id: packageId },
    })

    if (!pkg) {
      console.error('[WEBHOOK] Package not found:', packageId)
      return NextResponse.json({ received: true })
    }

    // Create payment record
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
        metadata: body as object,
      },
    })

    // Credit tokens
    await addTokens(
      userId,
      pkg.tokens,
      TransactionType.PURCHASE,
      `Compra de pacote: ${pkg.name} (${pkg.tokens} tokens) via Mercado Pago`,
      packageId,
      paymentRecord.id,
    )

    // Audit log
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
    console.error('[PAYMENTS_WEBHOOK]', err)
    // Always return 200 to MP so it doesn't retry
    return NextResponse.json({ received: true })
  }
}
