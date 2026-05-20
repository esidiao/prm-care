import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

// GET /api/alerts/count
// Returns counts of unresolved urgent and high-risk PRMs for the current user
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const [urgent, high] = await Promise.all([
    prisma.pRMFinding.count({
      where: {
        isResolved: false,
        riskLevel: 'URGENT',
        analysis: { userId: session.user.id },
      },
    }),
    prisma.pRMFinding.count({
      where: {
        isResolved: false,
        riskLevel: 'HIGH',
        analysis: { userId: session.user.id },
      },
    }),
  ])

  return NextResponse.json({ urgent, high, total: urgent + high })
}
