import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { addTokens } from '@/lib/token-service'
import { TransactionType } from '@prisma/client'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { packageId } = await req.json()

    const pkg = await prisma.tokenPackage.findUnique({ where: { id: packageId, isActive: true } })
    if (!pkg) return NextResponse.json({ error: 'Pacote não encontrado' }, { status: 404 })

    // TODO: Integrate with Stripe/Mercado Pago — for now, simulate successful payment

    // Simulate payment record
    const payment = await prisma.payment.create({
      data: {
        userId: session.user.id,
        amountInCents: pkg.priceInCents,
        currency: pkg.currency,
        status: 'completed', // simulated
        method: 'simulated',
        gateway: 'demo',
        externalId: `demo_${Date.now()}`,
        paidAt: new Date(),
      },
    })

    // Add tokens to user
    const result = await addTokens(
      session.user.id,
      pkg.tokens,
      TransactionType.PURCHASE,
      `Compra de pacote: ${pkg.name} (${pkg.tokens} tokens)`,
      packageId,
      payment.id,
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'PURCHASE_TOKENS',
        resource: 'token_package',
        resourceId: packageId,
        details: { tokens: pkg.tokens, amount: pkg.priceInCents, paymentId: payment.id },
      },
    })

    return NextResponse.json({
      success: true,
      data: { tokensAdded: pkg.tokens, newBalance: result.newBalance },
    })
  } catch (err: any) {
    console.error('[PURCHASE_TOKENS]', err)
    return NextResponse.json({ error: 'Erro ao processar compra.' }, { status: 500 })
  }
}
