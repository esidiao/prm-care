import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import {
  FlaskConical, Users, FileText, Coins, TrendingUp,
  AlertTriangle, Plus, ArrowRight, Clock, Activity,
  ShieldAlert, CheckCircle2, Target, Download, History
} from 'lucide-react'
import { formatRelative } from '@/lib/utils'
import { PRMCategory, RiskLevel } from '@prisma/client'
import { DashboardCharts } from '@/components/dashboard/DashboardCharts'
import { HighRiskPatients } from '@/components/dashboard/HighRiskPatients'
import { UpcomingReviews } from '@/components/dashboard/UpcomingReviews'
import { WelcomeBanner } from '@/components/onboarding/WelcomeBanner'
import { OnboardingChecklist } from '@/components/onboarding/OnboardingChecklist'
import { GuidedTour } from '@/components/onboarding/GuidedTour'

async function getDashboardData(userId: string) {
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const [
    user,
    recentAnalyses,
    totalPatients,
    totalReports,
    urgentFindings,
    allFindings,
    analysesLast90Days,
    resolvedCount,
    totalFindingsCount,
    topCategories,
    highRiskPatients,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { tokenBalance: true, plan: true, demonstrationUsed: true, crfNumber: true },
    }),
    prisma.pRMAnalysis.findMany({
      where: { userId },
      include: { patient: { select: { code: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    prisma.patient.count({ where: { userId, isActive: true } }),
    prisma.report.count({ where: { userId } }),
    prisma.pRMFinding.count({
      where: {
        analysis: { userId },
        riskLevel: { in: [RiskLevel.URGENT, RiskLevel.HIGH] },
        isResolved: false,
      },
    }),
    prisma.pRMFinding.findMany({
      where: { analysis: { userId } },
      select: { category: true, riskLevel: true, isResolved: true },
    }),
    prisma.pRMAnalysis.findMany({
      where: { userId, createdAt: { gte: ninetyDaysAgo } },
      select: { createdAt: true, totalPRMs: true, urgentPRMs: true, highRiskPRMs: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.pRMFinding.count({ where: { analysis: { userId }, isResolved: true } }),
    prisma.pRMFinding.count({ where: { analysis: { userId } } }),
    prisma.pRMFinding.groupBy({
      by: ['category'],
      where: { analysis: { userId } },
      _count: { category: true },
      orderBy: { _count: { category: 'desc' } },
    }),
    prisma.patient.findMany({
      where: {
        userId,
        isActive: true,
        analyses: {
          some: {
            findings: {
              some: { riskLevel: { in: [RiskLevel.URGENT, RiskLevel.HIGH] }, isResolved: false },
            },
          },
        },
      },
      select: {
        id: true, name: true, code: true,
        analyses: {
          where: {
            findings: { some: { riskLevel: { in: [RiskLevel.URGENT, RiskLevel.HIGH] }, isResolved: false } },
          },
          select: { id: true, createdAt: true, urgentPRMs: true, highRiskPRMs: true, _count: { select: { findings: true } } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      take: 5,
    }),
  ])

  return {
    user, recentAnalyses, totalPatients, totalReports, urgentFindings,
    allFindings, analysesLast90Days, resolvedCount, totalFindingsCount,
    topCategories, highRiskPatients,
  }
}

const CATEGORY_LABELS: Record<PRMCategory, string> = {
  NECESSITY: 'Necessidade',
  EFFECTIVENESS: 'Efetividade',
  SAFETY: 'Segurança',
  ADHERENCE: 'Adesão',
}

const RISK_LABELS: Record<RiskLevel, string> = {
  URGENT: 'Urgente',
  HIGH: 'Alto',
  MODERATE: 'Moderado',
  LOW: 'Baixo',
}

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) return null

  const {
    user, recentAnalyses, totalPatients, totalReports, urgentFindings,
    allFindings, analysesLast90Days, resolvedCount, totalFindingsCount,
    topCategories, highRiskPatients,
  } = await getDashboardData(session.user.id)

  const firstName = session.user.name?.split(' ')[0] || 'Farmacêutico(a)'

  // Prepare chart data
  const riskCounts: Record<string, number> = { URGENT: 0, HIGH: 0, MODERATE: 0, LOW: 0 }
  const categoryCounts: Record<string, number> = { NECESSITY: 0, EFFECTIVENESS: 0, SAFETY: 0, ADHERENCE: 0 }
  for (const f of allFindings) {
    riskCounts[f.riskLevel] = (riskCounts[f.riskLevel] || 0) + 1
    categoryCounts[f.category] = (categoryCounts[f.category] || 0) + 1
  }

  const riskChartData = [
    { name: 'Urgente',  value: riskCounts.URGENT,   color: '#dc2626' },
    { name: 'Alto',     value: riskCounts.HIGH,      color: '#ea580c' },
    { name: 'Moderado', value: riskCounts.MODERATE,  color: '#d97706' },
    { name: 'Baixo',    value: riskCounts.LOW,        color: '#16a34a' },
  ].filter(d => d.value > 0)

  const categoryChartData = [
    { name: 'Segurança',    value: categoryCounts.SAFETY,        color: '#dc2626' },
    { name: 'Efetividade',  value: categoryCounts.EFFECTIVENESS, color: '#2563eb' },
    { name: 'Necessidade',  value: categoryCounts.NECESSITY,     color: '#7c3aed' },
    { name: 'Adesão',       value: categoryCounts.ADHERENCE,     color: '#d97706' },
  ].filter(d => d.value > 0)

  const weekMap = new Map<string, { analyses: number; prms: number }>()
  for (const a of analysesLast90Days) {
    const d = new Date(a.createdAt)
    const weekStart = new Date(d)
    weekStart.setDate(d.getDate() - d.getDay())
    const key = weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    const existing = weekMap.get(key) || { analyses: 0, prms: 0 }
    weekMap.set(key, { analyses: existing.analyses + 1, prms: existing.prms + a.totalPRMs })
  }
  const timelineData = Array.from(weekMap.entries()).map(([week, data]) => ({
    week,
    análises: data.analyses,
    PRMs: data.prms,
  }))

  const resolutionRate = totalFindingsCount > 0
    ? Math.round((resolvedCount / totalFindingsCount) * 100)
    : 0

  const totalAnalyses = await prisma.pRMAnalysis.count({ where: { userId: session.user.id } })

  const stats = [
    {
      label: 'Pacientes ativos',
      value: totalPatients,
      icon: Users,
      iconBg: 'bg-violet-100 dark:bg-violet-900/30',
      iconColor: 'text-violet-600 dark:text-violet-400',
      action: { href: '/patients', label: 'Ver pacientes' },
    },
    {
      label: 'Análises realizadas',
      value: totalAnalyses,
      icon: FlaskConical,
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      action: { href: '/analysis/new', label: 'Nova análise' },
    },
    {
      label: 'PRMs identificados',
      value: totalFindingsCount,
      icon: ShieldAlert,
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      iconColor: 'text-red-600 dark:text-red-400',
      action: { href: '/reports', label: 'Ver relatórios' },
    },
    {
      label: 'Taxa de resolução',
      value: `${resolutionRate}%`,
      icon: CheckCircle2,
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      action: { href: '/reports', label: 'Ver PRMs' },
    },
  ]

  const isNewUser = totalPatients === 0 && recentAnalyses.length === 0

  return (
    <div className="space-y-6">
      {/* Header */}
      {isNewUser ? (
        <WelcomeBanner firstName={firstName} tokenBalance={user?.tokenBalance ?? 0} />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="heading-lg">Olá, {firstName} 👋</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Painel de seguimento farmacoterapêutico — Método Dáder
            </p>
          </div>
          <GuidedTour />
        </div>
      )}

      {/* Onboarding checklist */}
      {!isNewUser && (
        <OnboardingChecklist
          hasPatient={totalPatients > 0}
          hasAnalysis={recentAnalyses.length > 0}
          hasReport={totalReports > 0}
          hasProfile={!!user?.crfNumber}
        />
      )}

      {/* Urgent alert */}
      {urgentFindings > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50/70 px-5 py-4 dark:border-red-500/20 dark:bg-red-500/10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-500/20">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                {urgentFindings} alerta{urgentFindings > 1 ? 's' : ''} de alto risco ou urgência sem resolução
              </p>
              <p className="text-xs text-red-600 dark:text-red-400">Requerem intervenção imediata ou prioritária</p>
            </div>
          </div>
          <Link
            href="/reports"
            className="flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700 shadow-sm"
          >
            Ver alertas <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <div key={i} className="stat-card group">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="section-label">{stat.label}</p>
                <p className="mt-2 font-sans text-3xl font-bold tabular-nums text-foreground">{stat.value}</p>
              </div>
              <div className={`flex-shrink-0 rounded-xl p-2.5 ${stat.iconBg}`}>
                <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
              </div>
            </div>
            <Link
              href={stat.action.href}
              className={`mt-4 inline-flex items-center gap-1 text-xs font-semibold ${stat.iconColor} hover:underline`}
            >
              {stat.action.label} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ))}
      </div>

      {/* Charts */}
      {totalFindingsCount > 0 && (
        <DashboardCharts
          riskChartData={riskChartData}
          categoryChartData={categoryChartData}
          timelineData={timelineData}
          totalFindingsCount={totalFindingsCount}
          resolvedCount={resolvedCount}
          resolutionRate={resolutionRate}
        />
      )}

      {/* Upcoming reviews */}
      <div className="grid gap-6 lg:grid-cols-3">
        <UpcomingReviews />
      </div>

      {/* High-risk patients + Recent analyses */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-red-500" />
              <h2 className="text-sm font-semibold text-foreground">Pacientes em risco</h2>
            </div>
            <Link href="/patients" className="text-xs font-medium text-brand-800 hover:underline dark:text-brand-400">
              Ver todos
            </Link>
          </div>
          <HighRiskPatients patients={highRiskPatients} />
        </div>

        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Análises recentes</h2>
            </div>
            <Link href="/patients" className="text-xs font-medium text-brand-800 hover:underline dark:text-brand-400">
              Ver todos
            </Link>
          </div>

          {recentAnalyses.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <FlaskConical className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">Nenhuma análise ainda</p>
              <p className="mt-1 text-xs text-muted-foreground">Cadastre um paciente e inicie o seguimento</p>
              <Link href="/analysis/new" className="btn-primary mt-5 text-xs">
                <Plus className="h-3.5 w-3.5" /> Iniciar análise
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentAnalyses.map((analysis) => {
                const topRisk = analysis.urgentPRMs > 0
                  ? 'urgent'
                  : analysis.highRiskPRMs > 0
                  ? 'high'
                  : null
                return (
                  <Link
                    key={analysis.id}
                    href={`/analysis/${analysis.id}`}
                    className={`flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-muted/40 group ${topRisk ? `card-risk-${topRisk}` : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-800 text-xs font-bold dark:bg-brand-900/30 dark:text-brand-400">
                        {(analysis.patient.code || 'P').slice(0, 3)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground group-hover:text-brand-800 dark:group-hover:text-brand-400 transition-colors">
                          {analysis.patient.name || analysis.patient.code}
                        </p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatRelative(analysis.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {analysis.urgentPRMs > 0 && (
                        <span className="risk-badge-urgent">{analysis.urgentPRMs} urgente</span>
                      )}
                      {analysis.highRiskPRMs > 0 && (
                        <span className="risk-badge-high">{analysis.highRiskPRMs} alto</span>
                      )}
                      <span className="text-xs font-medium text-muted-foreground">{analysis.totalPRMs} PRM</span>
                      <ArrowRight className="h-3.5 w-3.5 text-border group-hover:text-muted-foreground transition-colors" />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Export strip */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-3 shadow-xs">
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Exportar dados</span>
        </div>
        <div className="flex gap-2">
          <a
            href="/api/export/patients"
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-muted/50"
          >
            ⬇️ Pacientes CSV
          </a>
          <a
            href="/api/export/prms"
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-muted/50"
          >
            ⬇️ PRMs CSV
          </a>
          <Link
            href="/analyses"
            className="flex items-center gap-1.5 rounded-lg bg-brand-50 border border-brand-800/20 px-3 py-1.5 text-xs font-medium text-brand-800 transition-colors hover:bg-brand-50/80 dark:bg-brand-900/20 dark:text-brand-400 dark:border-brand-700/30"
          >
            <History className="h-3.5 w-3.5" /> Histórico completo
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <p className="section-label mb-3">Ações rápidas</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/analysis/new"
            className="group flex items-center gap-3 rounded-2xl border-2 border-dashed border-brand-800/20 bg-card p-4 transition-all hover:border-brand-800/50 hover:bg-brand-50/50 dark:hover:bg-brand-900/20"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-800 text-white shadow-sm transition-transform group-hover:scale-105">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground group-hover:text-brand-800 dark:group-hover:text-brand-400">Nova análise PRM</p>
              <p className="text-xs text-muted-foreground">Seguimento farmacoterapêutico</p>
            </div>
          </Link>
          <Link
            href="/patients/new"
            className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:shadow-md"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-violet-100 transition-transform group-hover:scale-105 dark:bg-violet-900/30">
              <Users className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Cadastrar paciente</p>
              <p className="text-xs text-muted-foreground">{totalPatients} ativo{totalPatients !== 1 ? 's' : ''}</p>
            </div>
          </Link>
          <Link
            href="/reports"
            className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:shadow-md"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-orange-100 transition-transform group-hover:scale-105 dark:bg-orange-900/30">
              <FileText className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Relatórios PDF</p>
              <p className="text-xs text-muted-foreground">{totalReports} gerado{totalReports !== 1 ? 's' : ''}</p>
            </div>
          </Link>
          <Link
            href="/tokens"
            className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:shadow-md"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100 transition-transform group-hover:scale-105 dark:bg-blue-900/30">
              <Coins className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Tokens</p>
              <p className="text-xs text-muted-foreground">Saldo: {user?.tokenBalance ?? 0}</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Upgrade banner */}
      {user?.plan === 'FREE' && (
        <div className="rounded-2xl bg-gradient-to-r from-brand-900 to-brand-600 p-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/10">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold">Plano gratuito — {user.demonstrationUsed ?? 0}/2 análises usadas</p>
                <p className="mt-1 text-sm text-white/70">
                  Faça upgrade para análises ilimitadas, relatórios PDF e histórico completo.
                </p>
              </div>
            </div>
            <Link
              href="/tokens"
              className="flex flex-shrink-0 items-center gap-1.5 rounded-xl border border-white/20 bg-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/25"
            >
              Upgrade <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
