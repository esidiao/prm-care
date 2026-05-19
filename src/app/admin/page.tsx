import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import {
  Users, Coins, FlaskConical, FileText, TrendingUp,
  AlertTriangle, BookOpen, Activity, ArrowUpRight
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export default async function AdminPage() {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') redirect('/dashboard')

  const [
    totalUsers, activeUsers, totalAnalyses, totalReports,
    pendingKnowledge, recentUsers, topFindings, payments
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true, lastLoginAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
    prisma.pRMAnalysis.count(),
    prisma.report.count(),
    prisma.knowledgeBase.count({ where: { status: 'PENDING' } }),
    prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, name: true, email: true, role: true, plan: true, createdAt: true, tokenBalance: true } }),
    prisma.pRMFinding.groupBy({ by: ['title'], _count: { id: true }, orderBy: { _count: { id: 'desc' } }, take: 6 }),
    prisma.payment.aggregate({ where: { status: 'completed' }, _sum: { amountInCents: true } }),
  ])

  const tokensSold = await prisma.tokenTransaction.aggregate({
    where: { type: 'PURCHASE' }, _sum: { amount: true },
  })
  const tokensConsumed = await prisma.tokenTransaction.aggregate({
    where: { type: 'CONSUMPTION' }, _sum: { amount: true },
  })

  const stats = [
    { label: 'Total de usuários', value: totalUsers, icon: Users, color: 'text-blue-600 bg-blue-50', change: `${activeUsers} ativos (30d)` },
    { label: 'Tokens vendidos', value: tokensSold._sum.amount || 0, icon: Coins, color: 'text-yellow-600 bg-yellow-50', change: `${Math.abs(tokensConsumed._sum.amount || 0)} consumidos` },
    { label: 'Análises realizadas', value: totalAnalyses, icon: FlaskConical, color: 'text-green-600 bg-green-50', change: 'Total histórico' },
    { label: 'Relatórios gerados', value: totalReports, icon: FileText, color: 'text-purple-600 bg-purple-50', change: 'Total histórico' },
    { label: 'Receita estimada', value: formatCurrency(payments._sum.amountInCents || 0), icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50', change: 'Simulada' },
    { label: 'Base pendente', value: pendingKnowledge, icon: BookOpen, color: pendingKnowledge > 0 ? 'text-orange-600 bg-orange-50' : 'text-gray-600 bg-gray-50', change: 'Validação necessária' },
  ]

  const ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Admin', PROFESSIONAL: 'Profissional', STUDENT: 'Estudante', INSTITUTIONAL_MANAGER: 'Gestor',
  }
  const PLAN_LABELS: Record<string, string> = {
    FREE: 'Gratuito', BASIC: 'Básico', PROFESSIONAL: 'Profissional', INSTITUTIONAL: 'Institucional',
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="text-2xl font-bold text-gray-900">Painel Administrativo</h1>
        <p className="text-gray-500">Métricas e gestão da plataforma PRM Care</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((s, i) => (
          <div key={i} className="stat-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{s.label}</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">{s.value}</p>
                <p className="mt-1 text-xs text-gray-400">{s.change}</p>
              </div>
              <div className={`rounded-lg p-2.5 ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {pendingKnowledge > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4">
          <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
          <div>
            <p className="font-semibold text-orange-800">{pendingKnowledge} entrada(s) da base de conhecimento pendente(s) de validação</p>
            <p className="text-sm text-orange-700">Revise e valide para manter a qualidade das análises clínicas.</p>
            <a href="/admin/knowledge" className="mt-1 inline-block text-sm font-medium text-orange-800 underline">Gerenciar base clínica →</a>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent users */}
        <div className="rounded-xl border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="font-semibold text-gray-900">Usuários recentes</h2>
            <a href="/admin/users" className="text-sm text-[#1e3a5f] hover:underline flex items-center gap-1">
              Ver todos <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
          <div className="divide-y">
            {recentUsers.map(user => (
              <div key={user.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1e3a5f] text-xs font-bold text-white">
                    {(user.name || user.email)[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{user.name || '—'}</p>
                    <p className="text-xs text-gray-400">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-[#1e3a5f]">{ROLE_LABELS[user.role]}</span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{PLAN_LABELS[user.plan]}</span>
                  <div className="flex items-center gap-0.5 text-xs text-yellow-600">
                    <Coins className="h-3 w-3" /> {user.tokenBalance}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top PRM findings */}
        <div className="rounded-xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold text-gray-900">Alertas mais frequentes</h2>
          </div>
          <div className="divide-y">
            {topFindings.map((f, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                    {i + 1}
                  </span>
                  <p className="text-sm text-gray-700 truncate max-w-xs">{f.title}</p>
                </div>
                <span className="text-sm font-semibold text-gray-900">{f._count.id}x</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Gerenciar usuários', href: '/admin/users', icon: Users },
          { label: 'Base de conhecimento', href: '/admin/knowledge', icon: BookOpen },
          { label: 'Pacotes de tokens', href: '/admin/tokens', icon: Coins },
          { label: 'Logs de auditoria', href: '/admin/logs', icon: Activity },
        ].map((a, i) => (
          <a key={i} href={a.href}
            className="flex items-center gap-3 rounded-xl border bg-white p-4 hover:shadow-md transition-all">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#eff6ff]">
              <a.icon className="h-5 w-5 text-[#1e3a5f]" />
            </div>
            <span className="text-sm font-medium text-gray-900">{a.label}</span>
          </a>
        ))}
      </div>
    </div>
  )
}
