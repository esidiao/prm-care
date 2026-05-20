import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const thirtyDaysAhead = new Date()
  thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30)

  const reviews = await prisma.patientReview.findMany({
    where: {
      userId: session.user.id,
      status: { in: ['PENDING', 'OVERDUE'] },
      scheduledDate: { lte: thirtyDaysAhead },
    },
    include: { patient: { select: { id: true, name: true, code: true } } },
    orderBy: { scheduledDate: 'asc' },
    take: 10,
  }).catch(() => [])

  const now = new Date()
  return NextResponse.json(reviews.map((r) => ({
    ...r,
    status: r.status === 'PENDING' && new Date(r.scheduledDate) < now ? 'OVERDUE' : r.status,
    scheduledDate: r.scheduledDate.toISOString(),
    completedAt: r.completedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  })))
}
