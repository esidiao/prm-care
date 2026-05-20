import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { ReportsTable } from '@/components/reports/ReportsTable'

export default async function ReportsPage() {
  const session = await getSession()
  if (!session) return null

  const userId = session.user.id

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [reports, pendingAnalyses, thisMonthCount, totalTokens] = await Promise.all([
    // All reports — no limit, filters handled client-side
    prisma.report.findMany({
      where: { userId },
      include: {
        analysis: {
          select: {
            id: true,
            totalPRMs: true,
            urgentPRMs: true,
            highRiskPRMs: true,
            createdAt: true,
            patient: { select: { code: true, name: true } },
          },
        },
      },
      orderBy: { generatedAt: 'desc' },
    }),

    // Analyses with no report yet
    prisma.pRMAnalysis.findMany({
      where: { userId, report: null, status: 'COMPLETED' },
      include: { patient: { select: { code: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),

    // Reports this month
    prisma.report.count({
      where: { userId, generatedAt: { gte: startOfMonth } },
    }),

    // Total tokens consumed in reports
    prisma.report.aggregate({
      where: { userId },
      _sum: { tokensConsumed: true },
    }),
  ])

  const stats = {
    total: reports.length,
    thisMonth: thisMonthCount,
    totalTokens: totalTokens._sum.tokensConsumed ?? 0,
    pendingCount: pendingAnalyses.length,
  }

  // Serialize dates for client component
  const serializedReports = reports.map(r => ({
    ...r,
    generatedAt: r.generatedAt,
    analysis: {
      ...r.analysis,
      createdAt: r.analysis.createdAt,
    },
  }))

  const serializedPending = pendingAnalyses.map(a => ({
    id: a.id,
    totalPRMs: a.totalPRMs,
    urgentPRMs: a.urgentPRMs,
    createdAt: a.createdAt,
    patient: a.patient,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Relatórios</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Relatórios PDF gerados pelo seguimento farmacoterapêutico
          </p>
        </div>
        <Link href="/analysis/new" className="btn-primary">
          <Plus className="h-4 w-4" /> Nova análise
        </Link>
      </div>

      <ReportsTable
        reports={serializedReports as any}
        pendingAnalyses={serializedPending}
        stats={stats}
      />
    </div>
  )
}
