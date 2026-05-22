import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logAudit, getClientIp } from '@/lib/audit'

/**
 * GET /api/user/my-data
 * Returns all personal data stored for the authenticated user (LGPD Art. 18, II).
 */
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const uid = session.user.id
  const ip  = getClientIp(req)

  const [user, patients, analyses, consents, auditLogs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: uid },
      select: {
        id: true, email: true, name: true, role: true, plan: true,
        crfNumber: true, specialization: true, institution: true,
        createdAt: true, lastLoginAt: true,
      },
    }),
    prisma.patient.findMany({
      where: { userId: uid },
      select: {
        id: true, code: true, name: true, sex: true, age: true, createdAt: true,
        _count: { select: { analyses: true } },
      },
    }),
    prisma.pRMAnalysis.findMany({
      where: { userId: uid },
      select: { id: true, createdAt: true, totalPRMs: true, analysisType: true, tokensConsumed: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.consentRecord.findMany({
      where: { userId: uid },
      select: { type: true, version: true, accepted: true, acceptedAt: true, ipAddress: true },
      orderBy: { acceptedAt: 'desc' },
    }),
    prisma.auditLog.findMany({
      where: { userId: uid },
      select: { action: true, resource: true, createdAt: true, ipAddress: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ])

  await logAudit({
    userId: uid,
    action: 'DATA_PORTABILITY_REQUEST',
    resource: 'user',
    resourceId: uid,
    ipAddress: ip,
  })

  const payload = {
    exportedAt: new Date().toISOString(),
    legalBasis: 'LGPD Art. 18, II — Portabilidade de dados',
    profile: user,
    patients: patients.map(p => ({
      ...p,
      analysisCount: p._count.analyses,
    })),
    analyses,
    consents,
    auditLog: auditLogs,
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="meus-dados-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}

/**
 * POST /api/user/my-data
 * body: { reason: string }
 * Registers a data deletion request (LGPD Art. 18, VI).
 * Actual deletion must be reviewed by admin (healthcare data retention rules apply).
 */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body   = await req.json().catch(() => ({}))
  const reason = body.reason ?? 'Solicitação de exclusão pelo titular'
  const ip     = getClientIp(req)

  await logAudit({
    userId:    session.user.id,
    action:    'DATA_DELETION_REQUEST',
    resource:  'user',
    resourceId: session.user.id,
    details:   { reason },
    ipAddress: ip,
  })

  // TODO: notify admin (e-mail) — for now the audit log serves as the formal request
  return NextResponse.json({
    ok: true,
    message: 'Sua solicitação de exclusão de dados foi registrada e será processada em até 15 dias úteis, conforme Art. 18, VI da LGPD.',
  })
}
