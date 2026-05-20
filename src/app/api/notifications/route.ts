import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const now = new Date()

  try {
    const [urgentFindings, overdueReviews, todayReviews] = await Promise.all([
      // Unresolved URGENT/HIGH findings not resolved, from analyses in last 7 days
      prisma.pRMFinding.findMany({
        where: {
          isResolved: false,
          riskLevel: { in: ['URGENT', 'HIGH'] },
          analysis: {
            userId,
            status: 'COMPLETED',
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        },
        select: {
          id: true,
          title: true,
          riskLevel: true,
          analysis: {
            select: {
              id: true,
              patient: { select: { id: true, name: true, code: true } },
            },
          },
        },
        orderBy: { riskLevel: 'asc' },
        take: 10,
      }),

      // Overdue reviews (past due, still PENDING)
      prisma.patientReview.findMany({
        where: {
          userId,
          status: 'PENDING',
          scheduledDate: { lt: now },
        },
        select: {
          id: true,
          title: true,
          scheduledDate: true,
          type: true,
          patient: { select: { id: true, name: true, code: true } },
        },
        orderBy: { scheduledDate: 'asc' },
        take: 10,
      }),

      // Reviews scheduled for today
      prisma.patientReview.findMany({
        where: {
          userId,
          status: 'PENDING',
          scheduledDate: {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
          },
        },
        select: {
          id: true,
          title: true,
          scheduledDate: true,
          type: true,
          patient: { select: { id: true, name: true, code: true } },
        },
        orderBy: { scheduledDate: 'asc' },
        take: 5,
      }),
    ])

    const alerts = [
      ...urgentFindings.map((f) => ({
        id: `prm-${f.id}`,
        type: 'PRM_UNRESOLVED' as const,
        severity: f.riskLevel === 'URGENT' ? 'urgent' : 'high',
        title: f.riskLevel === 'URGENT' ? 'PRM Urgente não resolvido' : 'PRM de alto risco não resolvido',
        description: f.title,
        patientName: f.analysis.patient.name || f.analysis.patient.code,
        patientId: f.analysis.patient.id,
        href: `/analysis/${f.analysis.id}`,
      })),
      ...overdueReviews.map((r) => {
        const daysLate = Math.ceil((now.getTime() - new Date(r.scheduledDate).getTime()) / 86400000)
        return {
          id: `review-${r.id}`,
          type: 'REVIEW_OVERDUE' as const,
          severity: 'warning' as const,
          title: `Revisão atrasada há ${daysLate}d`,
          description: r.title,
          patientName: r.patient.name || r.patient.code,
          patientId: r.patient.id,
          href: `/patients/${r.patient.id}`,
        }
      }),
      ...todayReviews.map((r) => ({
        id: `today-${r.id}`,
        type: 'REVIEW_TODAY' as const,
        severity: 'info' as const,
        title: 'Revisão agendada para hoje',
        description: r.title,
        patientName: r.patient.name || r.patient.code,
        patientId: r.patient.id,
        href: `/patients/${r.patient.id}`,
      })),
    ]

    return NextResponse.json({ alerts, total: alerts.length })
  } catch {
    return NextResponse.json({ alerts: [], total: 0 })
  }
}
