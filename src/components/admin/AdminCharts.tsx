'use client'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
  Legend,
} from 'recharts'
import { Users, FlaskConical, TrendingUp, Brain } from 'lucide-react'

interface Props {
  usersByPlan: { plan: string; count: number }[]
  weeklyGrowth: { week: string; usuarios: number; analises: number }[]
  platformStats: {
    totalUsers: number
    activeUsers30d: number
    totalAnalyses: number
    avgPRMsPerAnalysis: number
    resolutionRate: number
    aiUsageRate: number
    totalFindings: number
    resolvedFindings: number
  }
  topCategories: { category: string; count: number }[]
}

const PLAN_COLORS: Record<string, string> = {
  FREE: '#9ca3af',
  BASIC: '#3b82f6',
  PROFESSIONAL: '#7c3aed',
  INSTITUTIONAL: '#059669',
  ENTERPRISE: '#d97706',
}

const PLAN_LABELS: Record<string, string> = {
  FREE: 'Gratuito',
  BASIC: 'Básico',
  PROFESSIONAL: 'Profissional',
  INSTITUTIONAL: 'Institucional',
  ENTERPRISE: 'Enterprise',
}

const CATEGORY_COLORS: Record<string, string> = {
  SAFETY: '#dc2626',
  EFFECTIVENESS: '#2563eb',
  NECESSITY: '#7c3aed',
  ADHERENCE: '#d97706',
}
const CATEGORY_LABELS: Record<string, string> = {
  SAFETY: 'Segurança',
  EFFECTIVENESS: 'Efetividade',
  NECESSITY: 'Necessidade',
  ADHERENCE: 'Adesão',
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg text-xs dark:border-gray-700 dark:bg-gray-800">
      {label && <p className="mb-1 font-semibold text-gray-700 dark:text-gray-200">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.stroke ?? p.fill }} className="font-medium">
          {p.name}: <span className="tabular-nums">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg text-xs dark:border-gray-700 dark:bg-gray-800">
      <p className="font-semibold" style={{ color: item.payload.fill }}>{item.name}</p>
      <p className="text-gray-600 dark:text-gray-400">{item.value} usuários ({Math.round(item.payload.percent * 100)}%)</p>
    </div>
  )
}

function MetricTile({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; color: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{value}</p>
        {sub && <p className="text-[11px] text-gray-400 dark:text-gray-500">{sub}</p>}
      </div>
    </div>
  )
}

export function AdminCharts({ usersByPlan, weeklyGrowth, platformStats, topCategories }: Props) {
  const planData = usersByPlan.map(p => ({
    name: PLAN_LABELS[p.plan] ?? p.plan,
    value: p.count,
    fill: PLAN_COLORS[p.plan] ?? '#6b7280',
    percent: 0,
  }))

  const categoryData = topCategories.map(c => ({
    name: CATEGORY_LABELS[c.category] ?? c.category,
    value: c.count,
    fill: CATEGORY_COLORS[c.category] ?? '#6b7280',
  }))

  const resolutionColor =
    platformStats.resolutionRate >= 70 ? '#16a34a' :
    platformStats.resolutionRate >= 40 ? '#d97706' : '#dc2626'

  return (
    <div className="space-y-4">
      {/* Platform metric tiles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          icon={TrendingUp} label="Taxa de resolução (plataforma)"
          value={`${platformStats.resolutionRate}%`}
          sub={`${platformStats.resolvedFindings} de ${platformStats.totalFindings} PRMs`}
          color="bg-green-50 text-green-600 dark:bg-green-900/20"
        />
        <MetricTile
          icon={Brain} label="PRMs identificados pela IA"
          value={`${platformStats.aiUsageRate}%`}
          sub="do total de PRMs"
          color="bg-purple-50 text-purple-600 dark:bg-purple-900/20"
        />
        <MetricTile
          icon={FlaskConical} label="Média de PRMs por análise"
          value={platformStats.avgPRMsPerAnalysis.toFixed(1)}
          sub={`em ${platformStats.totalAnalyses} análises`}
          color="bg-blue-50 text-blue-600 dark:bg-blue-900/20"
        />
        <MetricTile
          icon={Users} label="Usuários ativos (30 dias)"
          value={platformStats.activeUsers30d}
          sub={`de ${platformStats.totalUsers} total`}
          color="bg-orange-50 text-orange-600 dark:bg-orange-900/20"
        />
      </div>

      {/* Charts row 1: weekly growth + users by plan */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Weekly growth area chart */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-[#1e3a5f] dark:text-blue-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Crescimento semanal (últimas 12 semanas)
            </h3>
          </div>
          {weeklyGrowth.length < 2 ? (
            <p className="py-10 text-center text-xs text-gray-400">Dados insuficientes</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={weeklyGrowth} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1e3a5f" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#1e3a5f" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradAnalises" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                <Area type="monotone" dataKey="usuarios" name="Novos usuários"
                  stroke="#1e3a5f" strokeWidth={2} fill="url(#gradUsers)"
                  dot={{ r: 3, fill: '#1e3a5f', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                <Area type="monotone" dataKey="analises" name="Análises"
                  stroke="#7c3aed" strokeWidth={2} fill="url(#gradAnalises)"
                  dot={{ r: 3, fill: '#7c3aed', strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Users by plan pie */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-[#1e3a5f] dark:text-blue-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Usuários por plano</h3>
          </div>
          {planData.length === 0 ? (
            <p className="py-10 text-center text-xs text-gray-400">Sem dados</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={planData} cx="50%" cy="50%"
                    innerRadius={38} outerRadius={62}
                    paddingAngle={3} dataKey="value"
                  >
                    {planData.map((e, i) => <Cell key={i} fill={e.fill} stroke="none" />)}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1.5">
                {planData.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.fill }} />
                    <span className="flex-1 text-xs text-gray-600 dark:text-gray-400">{item.name}</span>
                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 tabular-nums">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Charts row 2: categories bar + resolution gauge */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* PRMs by category */}
        {categoryData.length > 0 && (
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
              PRMs por categoria (plataforma)
            </h3>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={categoryData} layout="vertical"
                margin={{ top: 0, right: 20, left: 0, bottom: 0 }} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} width={80} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
                <Bar dataKey="value" name="PRMs" radius={[0, 4, 4, 0]}>
                  {categoryData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Resolution health card */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Saúde da plataforma
          </h3>
          <div className="space-y-4">
            {[
              {
                label: 'Taxa de resolução de PRMs',
                value: platformStats.resolutionRate,
                color: resolutionColor,
                sub: `${platformStats.resolvedFindings} resolvidos de ${platformStats.totalFindings}`,
              },
              {
                label: 'Taxa de uso da IA',
                value: platformStats.aiUsageRate,
                color: '#7c3aed',
                sub: `PRMs identificados por IA / total`,
              },
              {
                label: 'Usuários ativos (30d)',
                value: platformStats.totalUsers > 0
                  ? Math.round((platformStats.activeUsers30d / platformStats.totalUsers) * 100)
                  : 0,
                color: '#2563eb',
                sub: `${platformStats.activeUsers30d} de ${platformStats.totalUsers} usuários`,
              },
            ].map((metric, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-600 dark:text-gray-400">{metric.label}</p>
                  <p className="text-xs font-bold tabular-nums" style={{ color: metric.color }}>
                    {metric.value}%
                  </p>
                </div>
                <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(metric.value, 100)}%`, backgroundColor: metric.color }}
                  />
                </div>
                <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">{metric.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
