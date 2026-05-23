import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { packageId, termsVersion } = body

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      req.headers.get('x-real-ip') ??
      'unknown'

    const userAgent = req.headers.get('user-agent') ?? ''

    // Record consent for purchase terms
    await prisma.consentRecord.create({
      data: {
        userId: session.user.id,
        type: 'TERMS_OF_USE',
        version: termsVersion ?? '1.0',
        accepted: true,
        ipAddress: ip,
        userAgent,
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'PURCHASE_CONSENT_ACCEPTED',
        resource: 'token_package',
        resourceId: packageId,
        ipAddress: ip,
        userAgent,
        details: {
          packageId,
          termsVersion: termsVersion ?? '1.0',
          acceptedAt: new Date().toISOString(),
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[PAYMENTS_CONSENT]', err)
    return NextResponse.json({ error: 'Erro ao registrar aceite.' }, { status: 500 })
  }
}
