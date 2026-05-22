import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logAudit, getClientIp } from '@/lib/audit'

const CURRENT_VERSION = '1.0'

/** GET — check if user has given all required consents */
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const required = ['TERMS_OF_USE', 'PRIVACY_POLICY', 'DATA_PROCESSING', 'CLINICAL_DISCLAIMER']

  const records = await prisma.consentRecord.findMany({
    where: {
      userId:   session.user.id,
      accepted: true,
      version:  CURRENT_VERSION,
    },
    select: { type: true },
  }).catch(() => [])

  const given = new Set(records.map(r => r.type))
  const allGiven = required.every(t => given.has(t as any))

  return NextResponse.json({ allGiven, given: [...given], required })
}

/** POST — record consent for one or all types */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const ip        = getClientIp(req)
  const userAgent = req.headers.get('user-agent') ?? undefined
  const body      = await req.json().catch(() => ({}))
  const { types, accepted = true } = body as { types?: string[]; accepted?: boolean }

  const allTypes = ['TERMS_OF_USE', 'PRIVACY_POLICY', 'DATA_PROCESSING', 'CLINICAL_DISCLAIMER']
  const toProcess = (types ?? allTypes) as any[]

  await Promise.all(
    toProcess.map(type =>
      prisma.consentRecord.create({
        data: {
          userId:    session.user.id,
          type,
          version:   CURRENT_VERSION,
          accepted,
          ipAddress: ip,
          userAgent,
        },
      })
    )
  ).catch(() => null)

  await logAudit({
    userId:  session.user.id,
    action:  accepted ? 'CONSENT_GIVEN' : 'CONSENT_REVOKED',
    resource: 'consent',
    details: { types: toProcess, version: CURRENT_VERSION },
    ipAddress: ip,
  })

  return NextResponse.json({ ok: true })
}
