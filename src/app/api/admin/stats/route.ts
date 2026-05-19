import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const [
    totalUsers, activeUsers, tokensSold, tokensConsumed,
    totalAnalyses, totalReports, topAlerts, staleKnowledge,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true, lastLoginAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
    prisma.tokenTransaction.aggregate({ where: { type: 'PURCHASE' }, _sum: { amount: true } }),
    prisma.tokenTransaction.aggregate({ where: { type: 'CONSUMPTION' }, _sum: { amount: true } }),
    prisma.pRMAnalysis.count(),
    prisma.report.count(),
    prisma.pRMFinding.groupBy({ by: ['title'], _count: { id: true }, orderBy: { _count: { id: 'desc' } }, take: 5 }),
    prisma.knowledgeBase.count({ where: { status: 'PENDING' } }),
  ])

  const payments = await prisma.payment.aggregate({
    where: { status: 'completed' },
    _sum: { amountInCents: true },
  })

  return NextResponse.json({
    success: true,
    data: {
      totalUsers,
      activeUsers,
      tokensSold: tokensSold._sum.amount || 0,
      tokensConsumed: Math.abs(tokensConsumed._sum.amount || 0),
      estimatedRevenue: payments._sum.amountInCents || 0,
      totalAnalyses,
      totalReports,
      topAlerts: topAlerts.map(a => ({ title: a.title, count: a._count.id })),
      knowledgeBasePendingUpdate: staleKnowledge,
    },
  })
}
