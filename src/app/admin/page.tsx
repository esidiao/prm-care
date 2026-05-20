import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import {
  Users, Coins, FlaskConical, FileText, TrendingUp,
  AlertTriangle, BookOpen, Activity, ArrowUpRight, Crown,
  Shield, UserCheck, GraduationCap, Building2,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { AdminCharts } from '@/components/admin/AdminCharts'

export default async function AdminPage() {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') redirect('/dashboard')

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const twelveWeeksAgo = new Date(now.getTime() - 84 * 24 * 60 * 60 * 1000)

  const [
    totalUsers,
    activeUsers,
    totalAnalyses,
    totalReports,
    pendingKnowledge,
    recentUsers,
    topFindings,
    payments,
    tokensSold,
    tokensConsumed,
    usersByPlan,
    newUsersLast12w,
    analysesLast12w,
    totalFindings,
    resolvedFindings,
    aiFindings,
    topCategories,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true, lastLoginAt: { gte: thirtyDaysAgo } } }),
    prisma.pRMAnalysis.count(),
    prisma.report.count(),
    prisma.knowledgeBase.count({ where: { status: 'PENDING' } }),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true, name: true, email: true, role: true, plan: true,
        createdAt: true, tokenBalance: true, isActive: true,
        _count: { select: { patients: true, analyses: true } },
      },
    }),
    prisma.pRMFinding.groupBy({
      by: ['title'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 6,
    }),
    prisma.payment.aggregate({ where: { status: 'completed' }, _sum: { amountInCents: true } }),
    prisma.tokenTransaction.aggregate({ where: { type: 'PURCHASE' }, _sum: { amount: true } }),
    prisma.tokenTransaction.aggregate({ where: { type: 'CONSUMPTION' }, _sum: { amount: true } }),
    // Users by plan
    prisma.user.groupBy({ by: ['plan'], _count: { id: true }, orderBy: { _count: { id: 'desc' } } }),
    // New users last 12 weeks
    prisma.user.findMany({
      where: { createdAt: { gte: twelveWeeksAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    // Analyses last 12 weeks
    prisma.pRMAnalysis.findMany({
      where: { createdAt: { gte: twelveWeeksAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    // Platform resolution stats
    prisma.pRMFinding.count(),
    prisma.pRMFinding.count({ where: { isResolved: true } }),
    // AI-generated PRMs (title starts with [IA])
    prisma.pRMFinding.count({ where: { title: { startsWith: '[IA]' } } }),
    // PRMs by category
    prisma.pRMFinding.groupBy({
      by: ['category'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    }),
  ])

  // ── Build weekly chart data ────────────────────────────────────────────────

  function groupByWeek(items: { createdAt: Date }[]) {
    const map = new Map<string, number>()
    for (const item of items) {
      const d = new Date(item.createdAt)
      const weekStart = new Date(d)
      weekStart.setDate(d.getDate() - d.getDay())
      const key = weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  }

  const userWeeks = groupByWeek(newUsersLast12w)
  const analysisWeeks = groupByWeek(analysesLast12w)
  const allWeeks = Array.from(new Set([...Array.from(userWeeks.keys()), ...Array.from(analysisWeeks.keys())])).sort()

  const weeklyGrowth = allWeeks.map(w => ({
    week: w,
    usuarios: userWeeks.get(w) ?? 0,
    analises: analysisWeeks.get(w) ?? 0,
  }))

  // ── Platform stats ────────────────────────────────────────────────────────

  const avgPRMsPerAnalysis = totalAnalyses > 0 ? totalFindings / totalAnalyses : 0
  const resolutionRate = totalFindings > 0 ? Math.round((resolvedFindings / totalFindings) * 100) : 0
  const aiUsageRate = totalFindings > 0 ? Math.round((aiFindings / totalFindings) * 100) : 0

  const platformStats = {
    totalUsers, activeUsers30d: activeUsers, totalAnalyses,
    avgPRMsPerAnalysis, resolutionRate, aiUsageRate,
    totalFindings, resolvedFindings,
  }

  const usersByPlanData = usersByPlan.map(p => ({ plan: p.plan, count: p._count.id }))
  const topCategoriesData = topCategories.map(c => ({
    category: c.category as string,
    count: c._count.id,
  }))

  // ── Labels ────────────────────────────────────────────────────────────────

  const ROLE_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    ADMIN: { label: 'Admin', icon: Shield, color: 'text-red-600 bg-red-50' },
    PROFESSIONAL: { label: 'Profissional', icon: UserCheck, color: 'text-blue-600 bg-blue-50' },
    STUDENT: { label: 'Estudante', icon: GraduationCap, color: 'text-purple-600 bg-purple-50' },
    INSTITUTIONAL_MANAGER: { label: 'Gestor', icon: Building2, color: 'text-teal-600 bg-teal-50' },
  }
  const PLAN_LABELS: Record<string, string> = {
    FREE: 'Gratuito', BASIC: 'Básico', PROFESSIONAL: 'Profissional',
    INSTITUTIONAL: 'Institucional', ENTERPRISE: 'Enterprise',
  }

  const stats = [
    { label: 'Total de usuários', value: totalUsers, icon: Users, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20', sub: `${activeUsers} ativos (30d)` },
    { label: 'Tokens vendidos', value: tokensSold._sum.amount ?? 0, icon: Coins, color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20', sub: `${Math.abs(tokensConsumed._sum.amount ?? 0)} consumidos` },
    { label: 'Análises realizadas', value: totalAnalyses, icon: FlaskConical, color: 'text-green-600 bg-green-50 dark:bg-green-900/20', sub: `Média ${avgPRMsPerAnalysis.toFixed(1)} PRMs` },
    { label: 'Relatórios gerados', value: totalReports, icon: FileText, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20', sub: 'Total histórico' },
    { label: 'Receita estimada', value: formatCurrency(payments._sum.amountInCents ?? 0), icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20', sub: 'Simulada' },
    { label: 'Base pendente', value: pendingKnowledge, icon: BookOpen, color: pendingKnowledge > 0 ? 'text-orange-600 bg-orange-50 dark:bg-orange-900/20' : 'text-gray-600 bg-gray-50 dark:bg-gray-700', sub: 'Validação necessária' },
  ]

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Painel Administrativo</h1>
        <p className="text-gray-500 dark:text-gray-400">Métricas e gestão da plataforma PRM Care</p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((s, i) => (
          <div key={i} className="stat-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{s.label}</p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{s.value}</p>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{s.sub}</p>
              </div>
              <div className={`rounded-xl p-2.5 ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pending knowledge alert */}
      {pendingKnowledge > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-950/30">
          <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-orange-800 dark:text-orange-300">
              {pendingKnowledge} entrada{pendingKnowledge > 1 ? 's' : ''} da base de conhecimento pendente{pendingKnowledge > 1 ? 's' : ''} de validação
            </p>
            <p className="text-sm text-orange-700 dark:text-orange-400">Revise e valide para manter a qualidade das análises clínicas.</p>
            <Link href="/admin/knowledge" className="mt-1 inline-block text-sm font-medium text-orange-800 dark:text-orange-300 underline">
              Gerenciar base clínica →
            </Link>
          </div>
        </div>
      )}

      {/* Charts */}
      <AdminCharts
        usersByPlan={usersByPlanData}
        weeklyGrowth={weeklyGrowth}
        platformStats={platformStats}
        topCategories={topCategoriesData}
      />

      {/* Recent users + top findings */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent users */}
        <div className="card">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-5 py-4">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Usuários recentes</h2>
            <Link href="/admin/users"
              className="flex items-center gap-1 text-sm text-[#1e3a5f] dark:text-blue-400 hover:underline">
              Ver todos <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {recentUsers.map(user => {
              const role = ROLE_LABELS[user.role]
              const RoleIcon = role?.icon ?? UserCheck
              return (
                <div key={user.id}
                  className={`flex items-center justify-between px-5 py-3 ${!user.isActive ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#1e3a5f] dark:bg-blue-700 text-xs font-bold text-white">
                      {(user.name || user.email)[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{user.name || '—'}</p>
                      <p className="truncate text-xs text-gray-400 dark:text-gray-500">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {role && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${role.color} dark:bg-opacity-20`}>
                        <RoleIcon className="h-3 w-3" />
                        {role.label}
                      </span>
                    )}
                    <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-300">
                      {PLAN_LABELS[user.plan] ?? user.plan}
                    </span>
                    <div className="flex items-center gap-0.5 text-xs text-yellow-600 dark:text-yellow-400">
                      <Coins className="h-3 w-3" /> {user.tokenBalance}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top PRM findings */}
        <div className="card">
          <div className="border-b border-gray-100 dark:border-gray-700 px-5 py-4">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">PRMs mais frequentes (plataforma)</h2>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {topFindings.map((f, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    i === 0 ? 'bg-amber-100 text-amber-700' :
                    i === 1 ? 'bg-gray-200 text-gray-600' :
                    i === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {i + 1}
                  </span>
                  <p className="truncate text-sm text-gray-700 dark:text-gray-300 max-w-xs">{f.title}</p>
                </div>
                <span className="flex-shrink-0 text-sm font-semibold text-gray-900 dark:text-gray-100 ml-2">
                  {f._count.id}×
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Ações rápidas
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Gerenciar usuários', href: '/admin/users', icon: Users, sub: `${totalUsers} cadastrados` },
            { label: 'Base de conhecimento', href: '/admin/knowledge', icon: BookOpen, sub: pendingKnowledge > 0 ? `${pendingKnowledge} pendentes` : 'Atualizada' },
            { label: 'Pacotes de tokens', href: '/admin/tokens', icon: Coins, sub: 'Planos e preços' },
            { label: 'Logs de auditoria', href: '/admin/logs', icon: Activity, sub: 'Atividades do sistema' },
          ].map((a, i) => (
            <Link key={i} href={a.href}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 hover:shadow-md transition-all group dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#eff6ff] group-hover:bg-[#1e3a5f] transition-colors dark:bg-[#1e3a5f]/30">
                <a.icon className="h-5 w-5 text-[#1e3a5f] group-hover:text-white transition-colors dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{a.label}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{a.sub}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
