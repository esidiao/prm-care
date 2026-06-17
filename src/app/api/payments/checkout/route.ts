import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { preference } from '@/lib/mercadopago'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { packageId } = await req.json()

    if (!packageId) {
      return NextResponse.json({ error: 'packageId é obrigatório' }, { status: 400 })
    }

    const pkg = await prisma.tokenPackage.findUnique({
      where: { id: packageId, isActive: true },
    })

    if (!pkg) {
      return NextResponse.json({ error: 'Pacote não encontrado' }, { status: 404 })
    }

    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const result = await preference.create({
      body: {
        items: [
          {
            id: pkg.id,
            title: `PRM Care — ${pkg.name} (${pkg.tokens} tokens)`,
            quantity: 1,
            unit_price: pkg.priceInCents / 100,
            currency_id: 'BRL',
          },
        ],
        payer: {
          email: session.user.email,
        },
        back_urls: {
          success: `${baseUrl}/tokens?status=success`,
          failure: `${baseUrl}/tokens?status=failure`,
          pending: `${baseUrl}/tokens?status=pending`,
        },
        auto_return: 'approved',
        notification_url: `${baseUrl}/api/payments/webhook`,
        // IMPORTANTE: O Mercado Pago converte automaticamente as chaves de metadata
        // de camelCase para snake_case ao salvar. Portanto, "userId" vira "user_id"
        // e "packageId" vira "package_id" quando lido no webhook via mpPayment.get().
        // O webhook já lê com snake_case — não altere sem sincronizar os dois arquivos.
        metadata: {
          userId: session.user.id,
          packageId: pkg.id,
        },
        statement_descriptor: 'PRM Care',
      },
    })

    return NextResponse.json({
      success: true,
      preferenceId: result.id,
      initPoint: result.init_point,
    })
  } catch (err) {
    console.error('[PAYMENTS_CHECKOUT]', err)
    return NextResponse.json({ error: 'Erro ao criar preferência de pagamento.' }, { status: 500 })
  }
}
