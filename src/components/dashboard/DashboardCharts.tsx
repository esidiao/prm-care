'use client'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  AreaChart, Area,
} from 'recharts'
import { TrendingUp, ShieldAlert, BarChart3, CheckCircle2 } from 'lucide-react'

interface ChartItem {
  name: string
  value: number
  color: string
}

interface TimelineItem {
  week: string
  análises: number
  PRMs: number
}

interface Props {
  riskChartData: ChartItem[]
  categoryChartData: ChartItem[]
  timelineData: TimelineItem[]
  totalFindingsCount: number
  resolvedCount: number
  resolutionRate: number
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg text-xs">
      {label && <p className="mb-1 font-semibold text-gray-700">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.stroke ?? p.fill ?? p.color }} className="font-medium">
          {p.name}: <span className="tabular-nums">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const pct = item.payload.percent !== undefined ? ` (${Math.round(item.payload.percent * 100)}%)` : ''
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold" style={{ color: item.payload.color }}>{item.name}</p>
      <p className="text-gray-600">{item.value} PRMs{pct}</p>
    </div>
  )
}

// ── Resolution ring ────────────────────────────────────────────────────────────

function ResolutionWidget({
  rate, resolved, total,
}: { rate: number; resolved: number; total: number }) {
  const ringColor = rate >= 70 ? '#16a34a' : rate >= 40 ? '#d97706' : '#dc2626'
  const r = 40
  const circ = 2 * Math.PI * r
  const offset = circ - (rate / 100) * circ

  return (
    <div className="card p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <h3 className="text-sm font-semibold text-gray-900">Resolução de PRMs</h3>
      </div>

      {/* Ring */}
      <div className="flex items-center justify-center gap-6 flex-1">
        <div className="relative">
          <svg width={100} height={100} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={50} cy={50} r={r} fill="none" stroke="#f3f4f6" strokeWidth={10} />
            <circle
              cx={50} cy={50} r={r} fill="none"
              stroke={ringColor} strokeWidth={10}
              strokeDasharray={circ} strokeDashoffset={offset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold" style={{ color: ringColor }}>{rate}%</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="rounded-lg bg-emerald-50 px-3 py-2 text-center">
            <p className="text-xl font-bold text-emerald-700 tabular-nums">{resolved}</p>
            <p className="text-[10px] text-emerald-600 font-medium">Resolvidos</p>
          </div>
          <div className="rounded-lg bg-red-50 px-3 py-2 text-center">
            <p className="text-xl font-bold text-red-700 tabular-nums">{total - resolved}</p>
            <p className="text-[10px] text-red-600 font-medium">Em aberto</p>
          </div>
        </div>
      </div>

      {/* Label */}
      <div className={`mt-4 rounded-lg px-3 py-2 text-xs text-center font-medium ${
        rate >= 70 ? 'bg-green-50 text-green-700' :
        rate >= 40 ? 'bg-yellow-50 text-yellow-700' :
        'bg-red-50 text-red-700'
      }`}>
        {rate === 0 ? 'Nenhum PRM marcado como resolvido' :
         rate >= 70 ? '✓ Excelente taxa de resolução' :
         rate >= 40 ? '⚠ Taxa de resolução moderada' :
         '✗ Taxa baixa — requer atenção'}
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function DashboardCharts({
  riskChartData,
  categoryChartData,
  timelineData,
  totalFindingsCount,
  resolvedCount,
  resolutionRate,
}: Props) {
  return (
    <div className="space-y-4">

      {/* Row 1: risk donut + category bar + resolution */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Risk pie */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="h-4 w-4 text-red-500" />
            <h3 className="text-sm font-semibold text-gray-900">PRMs por gravidade</h3>
          </div>
          {riskChartData.length === 0 ? (
            <p className="py-10 text-center text-xs text-gray-400">Sem dados</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={riskChartData} cx="50%" cy="50%"
                    innerRadius={42} outerRadius={68}
                    paddingAngle={3} dataKey="value"
                  >
                    {riskChartData.map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1.5">
                {riskChartData.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="flex-1 text-xs text-gray-600">{item.name}</span>
                    <div className="h-1.5 w-16 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{
                        width: `${Math.round((item.value / totalFindingsCount) * 100)}%`,
                        backgroundColor: item.color,
                      }} />
                    </div>
                    <span className="w-5 text-right text-xs font-semibold text-gray-800 tabular-nums">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Category bar */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-[#1e3a5f]" />
            <h3 className="text-sm font-semibold text-gray-900">PRMs por categoria</h3>
          </div>
          {categoryChartData.length === 0 ? (
            <p className="py-10 text-center text-xs text-gray-400">Sem dados</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart
                  data={categoryChartData} layout="vertical"
                  margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                  barSize={16}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} width={72} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
                  <Bar dataKey="value" name="PRMs" radius={[0, 4, 4, 0]}>
                    {categoryChartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {categoryChartData.map((item, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="truncate text-[11px] text-gray-500">{item.name}</span>
                    <span className="ml-auto text-[11px] font-semibold text-gray-700 tabular-nums">
                      {Math.round((item.value / totalFindingsCount) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Resolution widget */}
        <ResolutionWidget rate={resolutionRate} resolved={resolvedCount} total={totalFindingsCount} />
      </div>

      {/* Row 2: timeline area chart */}
      {timelineData.length > 1 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-[#1e3a5f]" />
            <h3 className="text-sm font-semibold text-gray-900">Evolução nos últimos 90 dias</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={timelineData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradAnalises" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1e3a5f" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#1e3a5f" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradPRMs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#dc2626" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
              <Area
                type="monotone" dataKey="análises" name="Análises"
                stroke="#1e3a5f" strokeWidth={2}
                fill="url(#gradAnalises)"
                dot={{ r: 3, fill: '#1e3a5f', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
              <Area
                type="monotone" dataKey="PRMs" name="PRMs"
                stroke="#dc2626" strokeWidth={2}
                fill="url(#gradPRMs)"
                dot={{ r: 3, fill: '#dc2626', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
