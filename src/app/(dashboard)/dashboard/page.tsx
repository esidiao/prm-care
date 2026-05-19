import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import {
  FlaskConical, Users, FileText, Coins, TrendingUp,
  AlertTriangle, Plus, ArrowRight, Clock, Activity
} from 'lucide-react'
import { formatRelative } from '@/lib/utils'
import { RiskLevel } from '@prisma/client'

async function getDashboardData(userId: string) {
  const [user, recentAnalyses, totalPatients, totalReports, urgentFindings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { tokenBalance: true, plan: true, demonstrationUsed: true },
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
  ])
  return { user, recentAnalyses, totalPatients, totalReports, urgentFindings }
}

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) return null

  const { user, recentAnalyses, totalPatients, totalReports, urgentFindings } =
    await getDashboardData(session.user.id)

  const firstName = session.user.name?.split(' ')[0] || 'Farmacêutico(a)'

  const stats = [
    {
      label: 'Tokens disponíveis',
      value: user?.tokenBalance ?? 0,
      icon: Coins,
      gradient: 'from-blue-500 to-blue-700',
      bg: 'bg-blue-50',
      text: 'text-blue-600',
      action: { href: '/tokens', label: 'Comprar tokens' },
    },
    {
      label: 'Pacientes ativos',
      value: totalPatients,
      icon: Users,
      gradient: 'from-violet-500 to-violet-700',
      bg: 'bg-violet-50',
      text: 'text-violet-600',
      action: { href: '/patients', label: 'Ver todos' },
    },
    {
      label: 'Análises realizadas',
      value: recentAnalyses.length,
      icon: FlaskConical,
      gradient: 'from-emerald-500 to-emerald-700',
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      action: { href: '/analysis/new', label: 'Nova análise' },
    },
    {
      label: 'Relatórios gerados',
      value: totalReports,
      icon: FileText,
      gradient: 'from-orange-500 to-orange-700',
      bg: 'bg-orange-50',
      text: 'text-orange-600',
      action: { href: '/reports', label: 'Ver todos' },
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Olá, {firstName} 👋
        </h1>
        <p className="mt-1 text-sm text-gray-500">Painel de seguimento farmacoterapêutico — Método Dáder</p>
      </div>

      {/* Urgent alert */}
      {urgentFindings > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-red-50/50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-800">
                {urgentFindings} alerta{urgentFindings > 1 ? 's' : ''} de alto risco ou urgência
              </p>
              <p className="text-xs text-red-600">Requerem intervenção imediata ou prioritária</p>
            </div>
          </div>
          <Link href="/reports"
            className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors shadow-sm">
            Ver alertas <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <div key={i} className="stat-card group">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{stat.label}</p>
                <p className="mt-2 text-3xl font-bold text-gray-900 tabular-nums">{stat.value}</p>
              </div>
              <div className={`rounded-xl p-2.5 ${stat.bg}`}>
                <stat.icon className={`h-5 w-5 ${stat.text}`} />
              </div>
            </div>
            <Link href={stat.action.href}
              className={`mt-4 inline-flex items-center gap-1 text-xs font-semibold ${stat.text} hover:underline`}>
              {stat.action.label} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ))}
      </div>

      {/* Quick actions + recent analyses */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick actions */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Ações rápidas</h2>

          <Link href="/analysis/new"
            className="flex items-center gap-4 rounded-2xl border-2 border-dashed border-[#1e3a5f]/20 bg-white p-4 hover:border-[#1e3a5f]/50 hover:bg-[#eff6ff]/50 transition-all group">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#1e3a5f] text-white shadow-sm group-hover:scale-105 transition-transform">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 group-hover:text-[#1e3a5f]">Nova análise PRM</p>
              <p className="text-xs text-gray-500">Seguimento farmacoterapêutico</p>
            </div>
          </Link>

          <Link href="/patients/new"
            className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 hover:shadow-md hover:border-gray-200 transition-all group">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-violet-50 group-hover:scale-105 transition-transform">
              <Users className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Cadastrar paciente</p>
              <p className="text-xs text-gray-500">{totalPatients} paciente{totalPatients !== 1 ? 's' : ''} ativo{totalPatients !== 1 ? 's' : ''}</p>
            </div>
          </Link>

          <Link href="/reports"
            className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 hover:shadow-md hover:border-gray-200 transition-all group">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-orange-50 group-hover:scale-105 transition-transform">
              <FileText className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Relatórios PDF</p>
              <p className="text-xs text-gray-500">{totalReports} relatório{totalReports !== 1 ? 's' : ''} gerado{totalReports !== 1 ? 's' : ''}</p>
            </div>
          </Link>

          <Link href="/tokens"
            className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 hover:shadow-md hover:border-gray-200 transition-all group">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 group-hover:scale-105 transition-transform">
              <Coins className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Comprar tokens</p>
              <p className="text-xs text-gray-500">Saldo: {user?.tokenBalance ?? 0} tokens</p>
            </div>
          </Link>
        </div>

        {/* Recent analyses */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900">Análises recentes</h2>
            </div>
            <Link href="/patients" className="text-xs font-medium text-[#1e3a5f] hover:underline">
              Ver todos
            </Link>
          </div>

          {recentAnalyses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 mb-4">
                <FlaskConical className="h-7 w-7 text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-600">Nenhuma análise ainda</p>
              <p className="mt-1 text-xs text-gray-400">Cadastre um paciente e inicie o seguimento</p>
              <Link href="/analysis/new"
                className="btn-primary mt-5 text-xs">
                <Plus className="h-3.5 w-3.5" /> Iniciar análise
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentAnalyses.map((analysis) => (
                <Link key={analysis.id} href={`/analysis/${analysis.id}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/80 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#1e3a5f]/10 text-[#1e3a5f] text-xs font-bold">
                      {(analysis.patient.code || 'P').slice(0, 3)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 group-hover:text-[#1e3a5f] transition-colors">
                        {analysis.patient.name || analysis.patient.code}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-gray-400">
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
                    <span className="text-xs font-medium text-gray-500">{analysis.totalPRMs} PRM</span>
                    <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upgrade banner */}
      {user?.plan === 'FREE' && (
        <div className="rounded-2xl bg-gradient-to-r from-[#1e3a5f] to-[#2563eb] p-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/10">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold">Plano gratuito — {user.demonstrationUsed ?? 0}/2 análises usadas</p>
                <p className="mt-1 text-sm text-blue-200">
                  Faça upgrade para análises ilimitadas, relatórios PDF e histórico completo.
                </p>
              </div>
            </div>
            <Link href="/tokens"
              className="flex-shrink-0 flex items-center gap-1.5 rounded-xl bg-white/15 hover:bg-white/25 px-4 py-2 text-sm font-semibold text-white transition-colors border border-white/20">
              Upgrade <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
