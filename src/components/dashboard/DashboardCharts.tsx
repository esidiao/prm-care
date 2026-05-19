'use client'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts'

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

const RADIAN = Math.PI / 180
function renderLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.05) return null
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export function DashboardCharts({
  riskChartData, categoryChartData, timelineData,
  totalFindingsCount, resolvedCount, resolutionRate,
}: Props) {
  return (
    <div className="space-y-4">
      {/* Top row: two donut charts + resolution */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Risk distribution */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">PRMs por gravidade</h3>
          {riskChartData.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={riskChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={2}
                  dataKey="value"
                  labelLine={false}
                  label={renderLabel}
                >
                  {riskChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [`${value} PRMs`, name]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="mt-2 space-y-1">
            {riskChartData.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-gray-600">{item.name}</span>
                </div>
                <span className="font-semibold text-gray-800">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category distribution */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">PRMs por categoria</h3>
          {categoryChartData.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={categoryChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={2}
                  dataKey="value"
                  labelLine={false}
                  label={renderLabel}
                >
                  {categoryChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [`${value} PRMs`, name]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="mt-2 space-y-1">
            {categoryChartData.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-gray-600">{item.name}</span>
                </div>
                <span className="font-semibold text-gray-800">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Resolution rate */}
        <div className="card p-5 flex flex-col justify-between">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Resolução de PRMs</h3>

          {/* Big number */}
          <div className="text-center py-2">
            <p className="text-5xl font-bold text-gray-900">{resolutionRate}<span className="text-2xl text-gray-400">%</span></p>
            <p className="text-xs text-gray-500 mt-1">taxa de resolução</p>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${resolutionRate}%`,
                  backgroundColor: resolutionRate >= 70 ? '#16a34a' : resolutionRate >= 40 ? '#d97706' : '#dc2626',
                }}
              />
            </div>
            <div className="mt-3 flex justify-between text-xs text-gray-500">
              <span><strong className="text-green-700">{resolvedCount}</strong> resolvidos</span>
              <span><strong className="text-gray-700">{totalFindingsCount - resolvedCount}</strong> pendentes</span>
            </div>
          </div>

          {/* Context label */}
          <div className={`mt-4 rounded-lg px-3 py-2 text-xs text-center ${
            resolutionRate >= 70 ? 'bg-green-50 text-green-700' :
            resolutionRate >= 40 ? 'bg-yellow-50 text-yellow-700' :
            'bg-red-50 text-red-700'
          }`}>
            {resolutionRate === 0 ? 'Nenhum PRM marcado como resolvido' :
             resolutionRate >= 70 ? 'Excelente taxa de resolução' :
             resolutionRate >= 40 ? 'Taxa de resolução moderada' :
             'Taxa de resolução baixa — requer atenção'}
          </div>
        </div>
      </div>

      {/* Timeline chart */}
      {timelineData.length > 1 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Análises e PRMs nos últimos 90 dias</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={timelineData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="análises" fill="#1e3a5f" radius={[3, 3, 0, 0]} maxBarSize={32} />
              <Bar dataKey="PRMs" fill="#dc2626" radius={[3, 3, 0, 0]} maxBarSize={32} opacity={0.75} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
